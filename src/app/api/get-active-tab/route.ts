import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  const dbConfig = {
    user: 'fvqeeriisoediuwbftvh.postgres', 
    host: 'aws-1-eu-wimport { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  // This is the official, battle-tested parameter mapping for Supavisor over IPv4
  const dbConfig = {
    // FIX 1: Format username with the project reference prefix so the pooler can identify the tenant
    user: 'fvqeeriisoediuwbftvh.postgres', 
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: 'MidVmXksB2TFPSwB', // The pure, clean master password
    port: 6543,
    ssl: {
      rejectUnauthorized: false
    },

  };

  try {
    const pgClient = new Client(dbConfig);
    await pgClient.connect();

    // Query the active slot bidder that is not frozen and has not expired
    const activeRes = await pgClient.query(
      `SELECT id, current_url as "currentUrl", display_name as "displayName", current_bid, expires_at as "expiresAt" 
       FROM slots 
       WHERE is_frozen = FALSE AND expires_at > NOW() 
       LIMIT 1`
    );
    await pgClient.end();

    // If an active bidder exists, return it straight to the client dashboard
    if (activeRes.rows && activeRes.rows.length > 0) {
      return NextResponse.json({ data: activeRes.rows });
    }

    // FALLBACK LOGICA: If the site is idle, return the official House Default state
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
    console.error("Get Active Tab Runtime Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
est-1.pooler.supabase.com',
    database: 'postgres',
    password: 'MidVmXksB2TFPSwB', 
    port: 6543,
    ssl: {
      rejectUnauthorized: false
    },
    // FIX: Deze regel is ABSOLUUT VERPLICHT om de tenant-identifier fout (500 crash) te voorkomen!
    options: '--options=project=fvqeeriisoediuwbftvh'
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

    // SUCCES FIX: We sturen exact de eerste rij mee als los, schoon object (geen array haken!)
    if (activeRes.rows && activeRes.rows.length > 0) {
      return NextResponse.json({ data: activeRes.rows[0] });
    }

    // FALLBACK FIX: De hardcoded back-up is nu ook een zuiver enkelvoudig object
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
