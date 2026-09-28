type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Record<string, unknown>;

const SERVICE_NAME = 'theonlytab-core';
const EXTERNAL_LOG_URL = process.env.LOG_FORWARD_URL;

function isSensitiveKey(key: string): boolean {
  return /(authorization|secret|signature|token|password|cookie)/i.test(key);
}

function isUrlKey(key: string): boolean {
  return /url|origin|referer|referrer|hostname/i.test(key);
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function redactUrl(url?: string | null) {
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return 'redacted';
  }
}

export function hashIdentifier(value?: string | null) {
  if (!value) return 'unknown';
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
}

export function serializeError(error: unknown) {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  return {
    message: typeof error === 'string' ? error : JSON.stringify(error),
  };
}

function sanitizeValue(key: string, value: unknown, depth = 0): unknown {
  if (depth > 3 || value == null) return value ?? null;
  if (value instanceof Date) return normalizeDate(value);
  if (value instanceof Error) return serializeError(value);

  if (typeof value === 'string') {
    if (isSensitiveKey(key)) return '[redacted]';
    if (isUrlKey(key)) return redactUrl(value);
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(key, entry, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childKey, childValue, depth + 1),
      ])
    );
  }

  return value;
}

function sanitizeContext(context: LogContext = {}) {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)])
  );
}

function writeConsole(level: LogLevel, payload: Record<string, unknown>) {
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

function forwardExternally(payload: Record<string, unknown>) {
  if (!EXTERNAL_LOG_URL || typeof window !== 'undefined' || typeof fetch !== 'function') {
    return;
  }

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

function log(level: LogLevel, message: string, context: LogContext = {}) {
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

export const logger = {
  debug(message: string, context?: LogContext) {
    log('debug', message, context);
  },
  info(message: string, context?: LogContext) {
    log('info', message, context);
  },
  warn(message: string, context?: LogContext) {
    log('warn', message, context);
  },
  error(message: string, context?: LogContext) {
    log('error', message, context);
  },
};
