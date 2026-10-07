import { getDbPool } from './db';
import { logger } from './logger';

export interface HallOfFameData {
  longestReign: { displayName: string; durationMinutes: number; slotId: string; endedAt: string } | null;
  highestTakeover: { displayName: string; bidCents: number; slotId: string; createdAt: string } | null;
  mostTakeovers: { displayName: string; count: number; lastTakeoverAt: string } | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { data: HallOfFameData; expiresAt: number } | null = null;

const toIso = (value: unknown) => new Date(value as string | Date).toISOString();

export async function getHallOfFame(): Promise<HallOfFameData> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const client = await getDbPool().connect();

  try {
    const [reignRes, bidRes, takeoverRes] = await Promise.all([
      client.query(
        `SELECT display_name, id, LEAST(expires_at, NOW()) AS ended_at,
                EXTRACT(EPOCH FROM (LEAST(expires_at, NOW()) - created_at)) / 60 AS duration_minutes
         FROM slots
         ORDER BY duration_minutes DESC, created_at DESC
         LIMIT 1`
      ),
      client.query(
        `SELECT display_name, id, created_at, ROUND(current_bid * 100)::bigint AS bid_cents
         FROM slots
         ORDER BY current_bid DESC, created_at DESC
         LIMIT 1`
      ),
      client.query(
        `SELECT display_name, COUNT(*)::int AS takeover_count, MAX(created_at) AS last_takeover
         FROM slots
         GROUP BY display_name
         ORDER BY takeover_count DESC, last_takeover DESC
         LIMIT 1`
      ),
    ]);

    const reign = reignRes.rows[0];
    const bid = bidRes.rows[0];
    const takeover = takeoverRes.rows[0];

    const data: HallOfFameData = {
      longestReign: reign
        ? {
            displayName: reign.display_name,
            durationMinutes: Math.max(0, Math.round(Number(reign.duration_minutes))),
            slotId: reign.id,
            endedAt: toIso(reign.ended_at),
          }
        : null,
      highestTakeover: bid
        ? {
            displayName: bid.display_name,
            bidCents: Number(bid.bid_cents),
            slotId: bid.id,
            createdAt: toIso(bid.created_at),
          }
        : null,
      mostTakeovers: takeover
        ? {
            displayName: takeover.display_name,
            count: Number(takeover.takeover_count),
            lastTakeoverAt: toIso(takeover.last_takeover),
          }
        : null,
    };

    cached = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  } catch (err: unknown) {
    logger.error('Hall of fame query error:', { error: err });
    throw err;
  } finally {
    client.release();
  }
}
