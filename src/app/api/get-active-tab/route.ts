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

    // Cron Check: Automatically freeze slots that cross the 90-minute maximum stage cap
    await pgClient.query(`UPDATE slots SET is_frozen = TRUE WHERE is_frozen = FALSE AND created_at < NOW() - INTERVAL '90 minutes'`);

    const activeRes = await pgClient.query(
      `SELECT id, current_url as "currentUrl", display_name as "displayName", current_bid, expires_at as "expiresAt", created_at as "createdAt" 
       FROM slots 
       WHERE is_frozen = FALSE AND expires_at > NOW() 
       LIMIT 1`
    );
    await pgClient.end();

    if (activeRes.rows && activeRes.rows.length > 0) {
      const row = activeRes.rows[0];
      const currentPaid = parseFloat(row.current_bid);
      const percentageIncrease = currentPaid * 1.25;
      const flatIncrease = currentPaid + 10.00;
      const nextStealPrice = Math.max(percentageIncrease, flatIncrease);
      
      const secondsOnStage = Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 1000);
      const secondsLeftInLock = Math.max(0, (12 * 60) - secondsOnStage);

      return NextResponse.json({
        data: {
          ...row,
          current_bid: currentPaid.toFixed(2),
          stealPrice: nextStealPrice.toFixed(2),
          secondsOnStage,
          secondsLeftInLock,
          isLocked: secondsLeftInLock > 0
        }
      });
    }

    // Default System Idle Fallback
    return NextResponse.json({
      data: {
        id: "house-default-id",
        currentUrl: "https://theonlytab.io",
        displayName: "The Only Tab HQ",
        current_bid: "0.00",
        stealPrice: "19.00",
        secondsOnStage: 0,
        secondsLeftInLock: 0,
        isLocked: false
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
