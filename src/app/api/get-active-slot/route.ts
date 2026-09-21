import { NextResponse } from 'next/server';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await pgClient.connect();
    const result = await pgClient.query(`SELECT id, current_url AS "currentUrl", display_name AS "displayName", current_bid AS "currentBid", expires_at AS "expiresAt" FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`);
    if (result.rows.length > 0) return NextResponse.json({ data: result.rows[0] });
    return NextResponse.json({ data: { id: null, currentUrl: "https://example.com", displayName: "Billboard Space Open!", currentBid: 0.00, expiresAt: new Date(Date.now() + 60000).toISOString() } });
  } catch {
    return NextResponse.json({ error: "Failed to read database state." }, { status: 500 });
  } finally {
    await pgClient.end();
  }
}
