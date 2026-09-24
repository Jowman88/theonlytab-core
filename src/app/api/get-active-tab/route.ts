import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  const dbConfig = {
    user: 'postgres.fvqeeriisoediuwbftvh', 
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: process.env.DATABASE_PASSWORD, 
    port: 6543,
    ssl: {
      rejectUnauthorized: false
    }
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

    // FIX: We sturen ALTIJD de eerste rij mee als een puur, los object (haalt de array-haken weg!)
    if (activeRes.rows && activeRes.rows.length > 0) {
      return NextResponse.json({ data: activeRes.rows[0] });
    }

    const houseDefault = {
      id: "house-default-1",
      currentUrl: "https://theonlytab.io",
      displayName: "The Only Tab HQ",
      current_bid: "0.00",
      expiresAt: null
    };

    return NextResponse.json({ data: houseDefault });
  } catch (err: any) {
    console.error("Get Active Tab Runtime Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
