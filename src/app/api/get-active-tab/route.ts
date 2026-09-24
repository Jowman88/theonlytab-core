import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  // Dit is de EXACTE, correcte IPv4 pooler configuratie voor jouw specifieke Ierland-cluster
  const dbConfig = {
    user: 'postgres',
    host: 'aws-1-eu-west-1.pooler.supabase.com', // Gecorrigeerd naar .com conform jouw dashboard!
    database: 'postgres',
    password: 'postgres.fvqeeriisoediuwbftvhMidVmXksB2TFPSwB', // Project-ID gekoppeld in wachtwoord voor Supavisor
    port: 6543, // De officiële transactie-pooler poort
    ssl: {
      rejectUnauthorized: false // Accepteert het interne certificaat van de Supabase pooler
    }
  };

  try {
    const pgClient = new Client(dbConfig);
    await pgClient.connect();

    // Haal de actieve bieder op die nog niet verlopen of bevroren is
    const activeRes = await pgClient.query(
      `SELECT id, current_url as "currentUrl", display_name as "displayName", current_bid, expires_at as "expiresAt" 
       FROM slots 
       WHERE is_frozen = FALSE AND expires_at > NOW() 
       LIMIT 1`
    );
    await pgClient.end();

    // Als er een actieve bieder in de database staat, stuur deze direct door naar de frontend
    if (activeRes.rows && activeRes.rows.length > 0) {
      return NextResponse.json({ data: activeRes.rows });
    }

    // FALLBACK / HOUSE DEFAULT LOGICA: Als de site idle is, stuur de standaard lay-out door
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
