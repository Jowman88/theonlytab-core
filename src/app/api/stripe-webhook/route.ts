import { NextResponse } from 'next/server';
import { Client } from 'pg';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any });
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("Stripe Webhook Signature Verification Failed:", err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const dbConfig = {
    user: 'postgres.fvqeeriisoediuwbftvh',
    host: '://supabase.com',
    database: 'postgres',
    password: process.env.DATABASE_PASSWORD,
    port: 6543,
    ssl: { rejectUnauthorized: false }
  };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata;
    
    // 🛡️ FEILLOZE FALLBACK HANDSHAKE: Leest zowel kleine letters als hoofdletters uit om mismatches te elimineren!
    const targetUrl = meta?.targeturl || meta?.targetUrl;
    const displayName = meta?.displayname || meta?.displayName;
    const bidAmount = meta?.bidamount || meta?.bidAmount || '19.00';
    const expiresAt = meta?.expiresat || meta?.expiresAt || new Date(Date.now() + 90 * 60 * 1000).toISOString();

    if (!targetUrl) {
      console.error("Critical Webhook Error: targetUrl is missing from Stripe metadata layout.");
      return NextResponse.json({ error: "Missing metadata url payload" }, { status: 400 });
    }

    try {
      const pgClient = new Client(dbConfig);
      await pgClient.connect();
      
      // Freeze de actieve sessie
      await pgClient.query('UPDATE slots SET is_frozen = TRUE WHERE is_frozen = FALSE');
      
      // Schrijf de takeover op met de exacte actuele timestamp
      await pgClient.query(
        `INSERT INTO slots (current_url, display_name, current_bid, expires_at, is_frozen, created_at, purchase_price, steal_price) 
         VALUES ($1, $2, $3, $4, FALSE, NOW(), $3, $3)`,
        [targetUrl, displayName, bidAmount, expiresAt]
      );
      
      await pgClient.end();
      console.log(`[SUCCESS] Database record populated successfully for: ${displayName}`);
    } catch (dbErr: any) {
      console.error("Webhook Database Error mapping:", dbErr.message);
      return NextResponse.json({ error: "Database execution fault" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
