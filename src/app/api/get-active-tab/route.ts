import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  // Dit is de OFFICIELE, perfecte IPv4 pooler opbouw van Supabase
  const dbConfig = {
  user: 'postgres',
  host: '://supabase.com',
  database: 'postgres',
  password: 'postgres.fvqeeriisoediuwbftvh:MidVmXksB2TFPSwB', 
  port: 6543,
  ssl: true // FIX: Dit dwingt de officiële, native SSL-handshake af die de pooler eist!
};
  try {
    const pgClient = new Client(dbConfig);
    await pgClient.connect();

    const activeRes = await pgClient.query(
      `SELECT id, current_url as "currentUrl", display_name as "displayName", current_bid, expires_at as "expiresAt" 
       FROM slots 
       WHERE is_frozen = FALSE AND expires_at > NOW() 
       LIMIT 1`
    );
    await pgClient.end();

    if (activeRes.rows && activeRes.rows.length > 0) {
      return NextResponse.json({ data: activeRes.rows });
    }

    const houseDefaults = [
      {
        id: "house-default-1",
        currentUrl: "https://theonlytab.io",
        displayName: "The Only Tab HQ",
        current_bid: "0.00"
      }
    ];

    return NextResponse.json({ data: houseDefaults });
  } catch (err: any) {
    console.error("Get Active Slot Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
