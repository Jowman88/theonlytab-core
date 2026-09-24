import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  try {
    // We isoleren de verbinding volledig van process.env door een zuiver, vers object te voeren
    const pgClient = new Client({
      user: 'postgres.fvqeeriisoediuwbftvh',
      host: '://supabase.com',
      database: 'postgres',
      password: 'MidVmXksB2TFPSwB',
      port: 6543,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await pgClient.connect();

    // Haal de actieve bieder op die nog niet verlopen of bevroren is
    const activeRes = await pgClient.query(
      `SELECT id, current_url as "currentUrl", display_name as "displayName", current_bid, expires_at as "expiresAt" 
       FROM slots 
       WHERE is_frozen = FALSE AND expires_at > NOW() 
       LIMIT 1`
    );
    await pgClient.end();

    // ALS ER EEN ACTIEVE BIEDER IS: Stuur deze direct door
    if (activeRes.rows && activeRes.rows.length > 0) {
      return NextResponse.json({ data: activeRes.rows });
    }

    // FALLBACK / HOUSE DEFAULT LOGICA: Als de site idle is, stuur de default door
    const houseDefaults = [
      {
        id: "house-default-1",
        currentUrl: "https://theonlytab.io",
        displayName: "The Only Tab HQ",
        current_bid: "0.00"
      }
    ];

    return NextResponse.json({ data: houseDefaults[0] });
  } catch (err: any) {
    console.error("Get Active Slot Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
