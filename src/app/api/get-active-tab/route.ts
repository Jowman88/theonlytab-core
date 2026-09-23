import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  try {
    // HARDCODED BYPASS: We omzeilen process.env en voeren de juiste link direct in!
    const pgClient = new Client({ 
      connectionString: "postgresql://postgres.fvqeeriisoediuwbftvh:MidVmXksB2TFPSwB@://supabase.com" 
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

    // ALS ER EEN ACTIEVE BIEDER IS: Stuur exact de eerste rij door
    if (activeRes.rows && activeRes.rows.length > 0) {
      return NextResponse.json({ data: activeRes.rows });
    }

    // FALLBACK / HOUSE DEFAULT LOGICA: Als de site idle is, veins activiteit!
    const houseDefaults = [
      {
        id: "house-default-1",
        currentUrl: "https://theonlytab.io",
        displayName: "The Only Tab HQ",
        current_bid: "0.00"
      },
      {
        id: "house-default-2",
        currentUrl: "https://producthunt.com",
        displayName: "Product Hunt Daily",
        current_bid: "19.00"
      }
    ];

    const randomDefault = houseDefaults[Math.floor(Math.random() * houseDefaults.length)];
    return NextResponse.json({ data: randomDefault });
  } catch (err: any) {
    console.error("Get Active Slot Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
