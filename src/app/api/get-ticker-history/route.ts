import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { logger } from '../../../lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = await getDbPool().connect();

  try {
    const historyRes = await client.query(
      `SELECT display_name as "displayName", current_url as "currentUrl", current_bid as "currentBid"
       FROM slots 
       WHERE is_frozen = TRUE
       ORDER BY created_at DESC 
       LIMIT 8`
    );

    return NextResponse.json({ history: historyRes.rows || [] });
  } catch (err: unknown) {
    logger.error('Ticker history core error:', { error: err });
    return NextResponse.json({ history: [] });
  } finally {
    client.release();
  }
}
