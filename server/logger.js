const SERVICE_NAME = 'theonlytab-streamer';
const EXTERNAL_LOG_URL = process.env.LOG_FORWARD_URL;

function redactUrl(url) {
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return 'redacted';
  }
}

function serializeError(error) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }
  return { message: typeof error === 'string' ? error : JSON.stringify(error) };
}

function sanitizeValue(key, value, depth = 0) {
  if (depth > 3 || value == null) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (typeof value === 'string') {
    if (/(authorization|secret|signature|token|password|cookie)/i.test(key)) return '[redacted]';
    if (/url|origin|referer|referrer|hostname/i.test(key)) return redactUrl(value);
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(key, entry, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childKey, childValue, depth + 1),
      ])
    );
  }
  return value;
}

function sanitizeContext(context = {}) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]));
}

function writeConsole(level, payload) {
  const consoleMethod =
    level === 'debug'
      ? console.debug
      : level === 'info'
        ? console.info
        : level === 'warn'
          ? console.warn
          : console.error;

  consoleMethod(payload);
}

function forwardExternally(payload) {
  if (!EXTERNAL_LOG_URL || typeof fetch !== 'function') return;

  void fetch(EXTERNAL_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    console.warn({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: SERVICE_NAME,
      message: 'External log forward failed',
    });
  });
}

function log(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    message,
    context: sanitizeContext(context),
  };

  writeConsole(level, payload);
  forwardExternally(payload);
}

export { redactUrl, serializeError };

export const logger = {
  debug(message, context) {
    log('debug', message, context);
  },
  info(message, context) {
    log('info', message, context);
  },
  warn(message, context) {
    log('warn', message, context);
  },
  error(message, context) {
    log('error', message, context);
  },
};
