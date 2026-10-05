import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { logger } from '../../../lib/logger';
import { isMissingTableError, ORACLE_MIN_WINS } from '../../../lib/predictions';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 15_000;
let cache: { expiresAt: number; entries: unknown[] } | null = null;

export async function GET() {
  const headers = { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' };
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ leaderboard: cache.entries }, { headers });
  }

  try {
    const res = await getDbPool().query(
      `SELECT nickname, points, wins, streak FROM prediction_scores
       WHERE points > 0 ORDER BY points DESC, wins DESC, updated_at ASC LIMIT 10`
    );
    const entries = res.rows.map((r) => ({
      nickname: r.nickname || 'Anonymous',
      points: Number(r.points),
      wins: Number(r.wins),
      streak: Number(r.streak),
      oracle: Number(r.wins) >= ORACLE_MIN_WINS,
    }));
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, entries };
    return NextResponse.json({ leaderboard: entries }, { headers });
  } catch (err) {
    if (isMissingTableError(err)) return NextResponse.json({ leaderboard: [] });
    logger.error('GET /api/prediction-leaderboard failed', { route: 'prediction-leaderboard', error: err });
    return NextResponse.json({ error: 'Unable to load leaderboard.' }, { status: 500 });
  }
}
