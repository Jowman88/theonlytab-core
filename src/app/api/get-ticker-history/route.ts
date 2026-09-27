import { NextResponse } from 'next/server';
import { dbPool } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = await dbPool.connect();

  try {
    const historyRes = await client.query(
      `SELECT display_name as "displayName", current_url as "currentUrl", current_bid as "currentBid"
       FROM slots 
       WHERE is_frozen = TRUE
       ORDER BY created_at DESC 
       LIMIT 8`
    );

    return NextResponse.json({ history: historyRes.rows || [] });
  } catch (err: any) {
    console.error('Ticker history core error:', err.message);
    return NextResponse.json({ history: [] });
  } finally {
    client.release();
  }
}
