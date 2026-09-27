import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  const dbConfig = {
    user: 'postgres.fvqeeriisoediuwbftvh',
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: process.env.DATABASE_PASSWORD,
    port: 6543,
    ssl: { rejectUnauthorized: false }
  };

  try {
    const pgClient = new Client(dbConfig);
    await pgClient.connect();

    // Pull the last 8 completed takeovers, omitting the active one (OFFSET 1)
    const historyRes = await pgClient.query(
      `SELECT display_name as "displayName", current_url as "currentUrl", current_bid as "currentBid"
       FROM slots 
       WHERE is_frozen = TRUE
       ORDER BY created_at DESC 
       LIMIT 8`
    );
    await pgClient.end();

    return NextResponse.json({ history: historyRes.rows || [] });
  } catch (err: any) {
    console.error("Ticker history core error:", err.message);
    return NextResponse.json({ history: [] });
  }
}
