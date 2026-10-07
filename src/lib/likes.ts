import { createHash } from 'crypto';
import { isMissingTableError } from './db';
import { LIKE_WINDOW_MINUTES } from './pricing';

interface Queryable {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

export function hashVoter(clientIp: string): string {
  return createHash('sha256').update(`voter:${clientIp}`).digest('hex');
}

/** Likes cast within the rolling window. Missing table (pre-migration) counts as zero. */
export async function getActiveLikeCount(client: Queryable, slotId: string): Promise<number> {
  try {
    const res = await client.query(
      `SELECT COUNT(*) AS count FROM slot_likes WHERE slot_id = $1 AND created_at > NOW() - INTERVAL '${LIKE_WINDOW_MINUTES} minutes'`,
      [slotId]
    );
    return Number.parseInt(String(res.rows?.[0]?.count ?? '0'), 10) || 0;
  } catch (err: unknown) {
    if (isMissingTableError(err)) return 0;
    throw err;
  }
}

export async function verifyTurnstile(token: unknown, remoteIp: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || typeof token !== 'string') return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}
