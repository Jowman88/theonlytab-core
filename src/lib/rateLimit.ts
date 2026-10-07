import { getDbPool, isMissingTableError } from './db';
import { logger } from './logger';

interface RateLimitOptions {
  bucket: string;
  identifier: string;
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  source: 'database' | 'memory';
}

interface MemoryBucket {
  count: number;
  expiresAt: number;
}

const memoryFallback = new Map<string, MemoryBucket>();

function getMemoryKey(bucket: string, identifier: string, windowMs: number): string {
  const now = Date.now();
  const windowStart = now - (now % windowMs);
  return `${bucket}:${identifier}:${windowStart}`;
}

function enforceMemoryRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = getMemoryKey(options.bucket, options.identifier, options.windowMs);
  const existing = memoryFallback.get(key);

  if (!existing || existing.expiresAt <= now) {
    memoryFallback.set(key, {
      count: 1,
      expiresAt: now + options.windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, options.maxRequests - 1),
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
      source: 'memory',
    };
  }

  existing.count += 1;
  memoryFallback.set(key, existing);

  return {
    allowed: existing.count <= options.maxRequests,
    remaining: Math.max(0, options.maxRequests - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
    source: 'memory',
  };
}

export function getClientIpAddress(request: Request): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown';
  return ip.slice(0, 100);
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartMs = now - (now % options.windowMs);
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + options.windowMs);
  const client = await getDbPool().connect();

  try {
    if (Math.random() < 0.05) {
      await client.query(`DELETE FROM api_rate_limits WHERE expires_at < NOW()`);
    }

    const upsertResult = await client.query(
      `
      INSERT INTO api_rate_limits (bucket, identifier, window_start, request_count, expires_at)
      VALUES ($1, $2, $3, 1, $4)
      ON CONFLICT (bucket, identifier, window_start)
      DO UPDATE SET request_count = api_rate_limits.request_count + 1
      RETURNING request_count
      `,
      [options.bucket, options.identifier, windowStart.toISOString(), expiresAt.toISOString()]
    );

    const requestCount = Number(upsertResult.rows?.[0]?.request_count || 0);
    return {
      allowed: requestCount <= options.maxRequests,
      remaining: Math.max(0, options.maxRequests - requestCount),
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
      source: 'database',
    };
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      logger.warn('Shared rate-limit fallback engaged:', { error: (err as Error)?.message || err });
    }
    return enforceMemoryRateLimit(options);
  } finally {
    client.release();
  }
}
