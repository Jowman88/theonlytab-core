import pkg from 'pg';
const { Client } = pkg;
import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import puppeteer from 'puppeteer';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

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
const browserLaunchArgs = [
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1280,720',
];

if (disableSandbox) {
  browserLaunchArgs.push('--no-sandbox', '--disable-setuid-sandbox');
  console.warn('PUPPETEER_DISABLE_SANDBOX is enabled. Use only in containers that require it.');
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

function redactUrl(url) {
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return 'redacted';
  }
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
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

async function resolvePublicDestination(hostname) {
  const normalizedHost = hostname.toLowerCase();
  if (blockedHostnames.has(normalizedHost) || normalizedHost.endsWith('.localhost') || normalizedHost.endsWith('.local')) {
    return false;
  }
  if (isPrivateOrUnsafeIpAddress(normalizedHost)) {
    return false;
  }

  const cacheKey = normalizedHost;
  const cached = hostResolutionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed;
  }

  try {
    const addresses = await dnsLookup(normalizedHost, { all: true, verbatim: true });
    const allowed = addresses.length > 0 && addresses.every((entry) => !isPrivateOrUnsafeIpAddress(entry.address));
    hostResolutionCache.set(cacheKey, { allowed, expiresAt: Date.now() + (allowed ? 0 : 15_000) });
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

async function isNavigationAllowed(rawUrl) {
  if (!isHttpProtocol(rawUrl) || hasUnsafeLiteralDestination(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl);
    return resolvePublicDestination(parsed.hostname);
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

    console.log('Launching headless browser...');

    browser = await puppeteer.launch({
      headless: 'new',
      args: browserLaunchArgs,
      defaultViewport: { width: 1280, height: 720 },
    });

    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(15000);
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      const requestUrl = request.url();
      const isNavigationRequest = request.isNavigationRequest() || request.resourceType() === 'document';

      if (!isHttpProtocol(requestUrl) || hasUnsafeLiteralDestination(requestUrl)) {
        await request.abort('blockedbyclient');
        return;
      }

      if (isNavigationRequest) {
        const allowed = await isNavigationAllowed(requestUrl);
        if (!allowed) {
          await request.abort('blockedbyclient');
          return;
        }
      }

      await request.continue();
    });

    console.log('Cloud browser successfully initialized.');
  } catch (err) {
    console.error('Fatal Error initializing Puppeteer runtime layout:', err.message);
  }
}

async function navigateSafely(targetUrl) {
  if (!page) return false;
  const allowed = await isNavigationAllowed(targetUrl);
  if (!allowed) {
    console.warn(`Blocked unsafe stream target: ${redactUrl(targetUrl)}`);
    return false;
  }

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    return true;
  } catch {
    console.warn(`Stream navigation failed: ${redactUrl(targetUrl)}`);
    return false;
  }
}

async function syncSlotToBrowser() {
  const dbConnectionString = process.env.DATABASE_URL;

  if (!dbConnectionString) {
    console.warn('DATABASE_URL is not set; using idle fallback target.');
    return;
  }

  try {
    const pgClient = new Client({
      connectionString: dbConnectionString,
      ssl: { rejectUnauthorized: false },
    });

    await pgClient.connect();

    const res = await pgClient.query(`
      SELECT current_url, display_name
      FROM slots
      WHERE is_frozen = FALSE AND expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 1
    `);

    await pgClient.end();

    let targetUrl = idleUrl;
    let displayLabel = 'SYSTEM IDLE';

    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      targetUrl = row.current_url || idleUrl;
      displayLabel = row.display_name || 'LIVE FEED';
    }

    if (!page || targetUrl === currentUrlInStream) return;

    console.log(`Stream target shifted. Steering browser to: ${redactUrl(targetUrl)}`);

    let navigatedUrl = '';
    if (await navigateSafely(targetUrl)) {
      navigatedUrl = targetUrl;
    } else if (targetUrl !== idleUrl && await navigateSafely(idleUrl)) {
      navigatedUrl = idleUrl;
      displayLabel = 'SYSTEM IDLE';
    } else {
      return;
    }

    currentUrlInStream = navigatedUrl;

    await page.evaluate((labelText) => {
      const oldBadge = document.getElementById('tot-live-badge');
      if (oldBadge) oldBadge.remove();

      const badge = document.createElement('div');
      badge.id = 'tot-live-badge';

      Object.assign(badge.style, {
        position: 'fixed',
        top: '24px',
        right: '24px',
        backgroundColor: '#13131A',
        color: '#F59E0B',
        border: '2px solid #262626',
        borderRadius: '12px',
        padding: '10px 18px',
        fontFamily: 'monospace',
        fontSize: '14px',
        fontWeight: '900',
        letterSpacing: '0.15em',
        zIndex: '2147483647',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
        textTransform: 'uppercase',
      });

      badge.innerText = `ON STAGE: ${String(labelText || 'LIVE FEED').substring(0, 15)}`;
      document.body.appendChild(badge);
    }, displayLabel).catch(() => {});
  } catch (dbErr) {
    console.error('Database sync loop error:', dbErr.message);
  }
}

async function startStreamingCore() {
  await initPuppeteer();

  setInterval(() => {
    syncSlotToBrowser();
  }, 4000);

  setInterval(async () => {
    if (!page || !browser) return;

    try {
      const screenshotBase64 = await page.screenshot({
        type: 'jpeg',
        quality: 42,
        encoding: 'base64',
      });

      io.emit('v-frame', screenshotBase64);
    } catch {
      // Ignore transient page/navigation issues during a live stream refresh.
    }
  }, 41);
}

io.on('connection', (socket) => {
  const ip = getRequestIp(socket.request);
  const currentCount = Number(socketCountByIp.get(ip) || 0);
  socketCountByIp.set(ip, currentCount + 1);

  console.log(`Client connected to stream endpoint (${ip})`);

  socket.on('disconnect', () => {
    const existing = Number(socketCountByIp.get(ip) || 1);
    const next = Math.max(0, existing - 1);
    if (next === 0) {
      socketCountByIp.delete(ip);
    } else {
      socketCountByIp.set(ip, next);
    }
    console.log(`Client disconnected from stream endpoint (${ip})`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server fully bound and locked on port ${PORT}`);
  startStreamingCore();
});
