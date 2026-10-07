import pkg from 'pg';
const { Client } = pkg;
import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import puppeteer from 'puppeteer';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { logger, redactUrl } from './logger.js';
import { canSendReaction, getJpegQuality, getStreamDimension, getStreamFps, hasFrameChanged, hashFrame, isValidReaction } from './stream-utils.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;
const idleUrl = 'https://theonlytab.io/house-default';

const configuredOrigins = (process.env.STREAM_ALLOWED_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = configuredOrigins.length === 0 || configuredOrigins.includes('*');
const maxConnectionsPerIp = Number.parseInt(process.env.STREAM_MAX_CONNECTIONS_PER_IP || '20', 10);
const disableSandbox = process.env.PUPPETEER_DISABLE_SANDBOX === 'true';
const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === 'true';
const streamFps = getStreamFps(process.env.STREAM_FPS);
const jpegQuality = getJpegQuality(process.env.STREAM_JPEG_QUALITY);
const streamWidth = getStreamDimension(process.env.STREAM_WIDTH, 1280);
const streamHeight = getStreamDimension(process.env.STREAM_HEIGHT, 720);
const frameIntervalMs = Math.round(1000 / streamFps);
const keepaliveIntervalMs = 5000;
const metricsIntervalMs = 60_000;
const browserLaunchArgs = [
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  `--window-size=${streamWidth},${streamHeight}`,
];

if (disableSandbox) {
  browserLaunchArgs.push('--no-sandbox', '--disable-setuid-sandbox');
  logger.warn('PUPPETEER_DISABLE_SANDBOX is enabled', {
    route: 'streamer-bootstrap',
  });
}

const socketCountByIp = new Map();
const hostResolutionCache = new Map();
const blockedHostnames = new Set([
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata',
]);
const blockedIpLiterals = new Set([
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
]);

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (trustProxyHeaders && typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  const ip = req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
  return String(ip).trim();
}

function isIpv4PrivateOrUnsafe(ipv4) {
  const parts = ipv4.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  ) {
    return true;
  }
  return blockedIpLiterals.has(ipv4);
}

function isIpv6PrivateOrUnsafe(ipv6) {
  const normalized = ipv6.toLowerCase();
  if (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true;
  }
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.replace('::ffff:', '');
    return isIpv4PrivateOrUnsafe(mapped);
  }
  return false;
}

function isPrivateOrUnsafeIpAddress(value) {
  const ip = value.replace(/^\[|\]$/g, '').toLowerCase();
  if (blockedIpLiterals.has(ip)) return true;
  const version = isIP(ip);
  if (version === 4) return isIpv4PrivateOrUnsafe(ip);
  if (version === 6) return isIpv6PrivateOrUnsafe(ip);
  return false;
}

async function resolvePublicDestination(hostname, options = {}) {
  const { forceFresh = false } = options;
  const normalizedHost = hostname.toLowerCase();
  if (blockedHostnames.has(normalizedHost) || normalizedHost.endsWith('.localhost') || normalizedHost.endsWith('.local')) {
    return false;
  }
  if (isPrivateOrUnsafeIpAddress(normalizedHost)) {
    return false;
  }

  const cacheKey = normalizedHost;
  const cached = hostResolutionCache.get(cacheKey);
  if (!forceFresh && cached && cached.expiresAt > Date.now()) {
    return cached.allowed;
  }

  try {
    const addresses = await dnsLookup(normalizedHost, { all: true, verbatim: true });
    const allowed = addresses.length > 0 && addresses.every((entry) => !isPrivateOrUnsafeIpAddress(entry.address));
    hostResolutionCache.set(cacheKey, { allowed, expiresAt: Date.now() + (allowed ? 30_000 : 15_000) });
    return allowed;
  } catch (error) {
    hostResolutionCache.set(cacheKey, { allowed: false, expiresAt: Date.now() + 15_000 });
    return false;
  }
}

function isHttpProtocol(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function hasUnsafeLiteralDestination(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;
    const hostname = parsed.hostname.toLowerCase();
    if (blockedHostnames.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      return true;
    }
    return isPrivateOrUnsafeIpAddress(hostname);
  } catch {
    return true;
  }
}

async function isNavigationAllowed(rawUrl, options = {}) {
  const { forceFresh = false } = options;
  if (!isHttpProtocol(rawUrl) || hasUnsafeLiteralDestination(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl);
    return resolvePublicDestination(parsed.hostname, { forceFresh });
  } catch {
    return false;
  }
}

const io = new Server(server, {
  path: '/socket.io/',
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins || configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by stream policy'));
    },
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  perMessageDeflate: false,
  allowRequest: (req, callback) => {
    const origin = String(req.headers.origin || '');
    if (origin && !allowAllOrigins && !configuredOrigins.includes(origin)) {
      callback('Origin not allowed', false);
      return;
    }

    const ip = getRequestIp(req);
    const count = Number(socketCountByIp.get(ip) || 0);
    if (count >= maxConnectionsPerIp) {
      callback('Too many connections from this IP', false);
      return;
    }

    callback(null, true);
  },
});

app.get('/', (req, res) => {
  res.status(200).send('The Only Tab Streaming Core Engine is Active!');
});

let browser = null;
let page = null;
let currentUrlInStream = '';

async function initPuppeteer() {
  try {
    if (browser && page) return;

    logger.info('Launching headless browser', {
      route: 'streamer-bootstrap',
    });

    browser = await puppeteer.launch({
      headless: 'new',
      args: browserLaunchArgs,
      defaultViewport: { width: streamWidth, height: streamHeight },
    });

    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(15000);
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      const requestUrl = request.url();

      if (!isHttpProtocol(requestUrl) || hasUnsafeLiteralDestination(requestUrl)) {
        await request.abort('blockedbyclient');
        return;
      }

      const isNavigationRequest = request.isNavigationRequest() || request.resourceType() === 'document';
      const allowed = await isNavigationAllowed(requestUrl, { forceFresh: isNavigationRequest });
      if (!allowed) {
        await request.abort('blockedbyclient');
        return;
      }

      await request.continue();
    });

    logger.info('Cloud browser initialized', {
      route: 'streamer-bootstrap',
    });
  } catch (err) {
    logger.error('Fatal error initializing Puppeteer runtime layout', {
      route: 'streamer-bootstrap',
      error: err,
    });
  }
}

async function navigateSafely(targetUrl) {
  if (!page) return false;
  const allowed = await isNavigationAllowed(targetUrl);
  if (!allowed) {
    logger.warn('Blocked unsafe stream target', {
      route: 'stream-navigation',
      targetUrl,
      reason: 'navigation_policy_blocked',
    });
    return false;
  }

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    logger.info('Stream navigation succeeded', {
      route: 'stream-navigation',
      targetUrl,
    });
    return true;
  } catch (error) {
    logger.warn('Stream navigation failed', {
      route: 'stream-navigation',
      targetUrl,
      reason: 'page_goto_failed',
      error,
    });
    return false;
  }
}

async function syncSlotToBrowser() {
  const dbConnectionString = process.env.DATABASE_URL;

  if (!dbConnectionString) {
    logger.warn('DATABASE_URL is not set; using idle fallback target', {
      route: 'stream-sync',
      fallbackUrl: idleUrl,
    });
    return;
  }

  try {
    const pgClient = new Client({
      connectionString: dbConnectionString,
      ssl: { rejectUnauthorized: false },
    });

    await pgClient.connect();

    const res = await pgClient.query(`
      SELECT id, current_url
      FROM slots
      WHERE is_frozen = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);

    await pgClient.end();

    let targetUrl = idleUrl;
    let slotId = 'house-default-id';

    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      slotId = row.id || slotId;
      targetUrl = row.current_url || idleUrl;
    }

    if (!page || targetUrl === currentUrlInStream) return;

    logger.info('Stream target changed', {
      route: 'stream-sync',
      slotId,
      targetUrl,
    });

    let navigatedUrl = '';
    if (await navigateSafely(targetUrl)) {
      navigatedUrl = targetUrl;
    } else if (targetUrl !== idleUrl && await navigateSafely(idleUrl)) {
      navigatedUrl = idleUrl;
      logger.warn('Stream navigation fell back to idle target', {
        route: 'stream-sync',
        slotId,
        targetUrl,
        fallbackUrl: idleUrl,
      });
    } else {
      logger.error('Stream navigation failed without available fallback', {
        route: 'stream-sync',
        slotId,
        targetUrl,
        fallbackUrl: idleUrl,
      });
      return;
    }

    currentUrlInStream = navigatedUrl;
  } catch (dbErr) {
    logger.error('Database sync loop failed', {
      route: 'stream-sync',
      error: dbErr,
      fallbackBehavior: 'keep_current_stream_target',
    });
  }
}

let lastFrame = null;
let lastFrameHash = null;
let lastEmitAt = 0;
let metrics = { frames: 0, bytes: 0, screenshots: 0 };
let wakeFrameLoop = null;

function emitFrame(frame) {
  const viewers = io.engine.clientsCount;
  io.emit('v-frame', frame);
  lastEmitAt = Date.now();
  metrics.frames += 1;
  metrics.bytes += frame.length * viewers;
}

async function captureAndEmitFrame() {
  if (!page || !browser) return;
  try {
    const frame = await page.screenshot({ type: 'jpeg', quality: jpegQuality });
    metrics.screenshots += 1;
    const hash = hashFrame(frame);
    const changed = hasFrameChanged(lastFrameHash, hash);
    lastFrame = frame;
    lastFrameHash = hash;
    if (changed || Date.now() - lastEmitAt >= keepaliveIntervalMs) {
      emitFrame(frame);
    }
  } catch {
    // Ignore transient page/navigation issues during a live stream refresh.
  }
}

async function frameLoop() {
  for (;;) {
    const startedAt = Date.now();
    if (io.engine.clientsCount > 0) {
      await captureAndEmitFrame();
      const wait = Math.max(0, frameIntervalMs - (Date.now() - startedAt));
      await new Promise((resolve) => setTimeout(resolve, wait));
    } else {
      await new Promise((resolve) => {
        wakeFrameLoop = resolve;
        setTimeout(resolve, 1000);
      });
      wakeFrameLoop = null;
    }
  }
}

async function startStreamingCore() {
  await initPuppeteer();

  setInterval(() => {
    syncSlotToBrowser();
  }, 4000);

  setInterval(() => {
    logger.info('Stream metrics', {
      route: 'stream-metrics',
      windowSeconds: metricsIntervalMs / 1000,
      framesSent: metrics.frames,
      bytesSent: metrics.bytes,
      screenshotsTaken: metrics.screenshots,
      viewers: io.engine.clientsCount,
    });
    metrics = { frames: 0, bytes: 0, screenshots: 0 };
  }, metricsIntervalMs);

  frameLoop();
}

function broadcastViewerCount() {
  io.emit('viewer-count', io.engine.clientsCount);
}

io.on('connection', (socket) => {
  broadcastViewerCount();
  const ip = getRequestIp(socket.request);
  const currentCount = Number(socketCountByIp.get(ip) || 0);
  socketCountByIp.set(ip, currentCount + 1);

  logger.info('Client connected to stream endpoint', {
    route: 'stream-socket',
    clientIp: ip,
  });

  if (lastFrame) {
    socket.emit('v-frame', lastFrame);
    metrics.frames += 1;
    metrics.bytes += lastFrame.length;
  }
  if (wakeFrameLoop) wakeFrameLoop();

  let lastReactionAt = null;
  socket.on('reaction', (payload) => {
    const emoji = payload && typeof payload === 'object' ? payload.emoji : undefined;
    if (!isValidReaction(emoji)) return;
    const now = Date.now();
    if (!canSendReaction(lastReactionAt, now)) return;
    lastReactionAt = now;
    io.emit('reaction', { emoji, from: socket.id.slice(0, 6), at: now });
  });

  socket.on('disconnect', () => {
    setTimeout(broadcastViewerCount, 0);
    const existing = Number(socketCountByIp.get(ip) || 1);
    const next = Math.max(0, existing - 1);
    if (next === 0) {
      socketCountByIp.delete(ip);
    } else {
      socketCountByIp.set(ip, next);
    }
    logger.info('Client disconnected from stream endpoint', {
      route: 'stream-socket',
      clientIp: ip,
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  logger.info('Server bound to port', {
    route: 'streamer-bootstrap',
    port: PORT,
  });
  startStreamingCore();
});
