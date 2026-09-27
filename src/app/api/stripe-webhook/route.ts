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
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: process.env.DATABASE_PASSWORD,
    port: 6543,
    ssl: { rejectUnauthorized: false }
  };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata;
    
    // Lees flexibel alle mogelijke Stripe metadata-formats uit (camelCase & lowercase)
    const targetUrl = meta?.targeturl || meta?.targetUrl;
    const displayName = meta?.displayname || meta?.displayName || 'Anonymous Takeover';
    const rawBid = meta?.bidamount || meta?.bidAmount || '19.00';
    const expiresAt = meta?.expiresat || meta?.expiresAt || new Date(Date.now() + 90 * 60 * 1000).toISOString();

    if (!targetUrl) {
      console.error("Critical Webhook Error: targetUrl is missing from Stripe metadata layout.");
      return NextResponse.json({ error: "Missing metadata url payload" }, { status: 400 });
    }

    // FIX: Converteer de string-waarde ("19.00") expliciet naar een vlot getal (Float) voor PostgreSQL!
    const validNumericBid = parseFloat(rawBid);

    try {
      const pgClient = new Client(dbConfig);
      await pgClient.connect();
      
      // 1. Freeze de actieve sessies
      await pgClient.query('UPDATE slots SET is_frozen = TRUE WHERE is_frozen = FALSE');
      
      // 2. Schrijf de takeover op met gegarandeerd kloppende data-types!
      await pgClient.query(
        `INSERT INTO slots (current_url, display_name, current_bid, expires_at, is_frozen, created_at, purchase_price, steal_price) 
         VALUES ($1, $2, $3, $4, FALSE, NOW(), $5, $6)`,
        [targetUrl, displayName, validNumericBid, expiresAt, validNumericBid, validNumericBid]
      );
      
      await pgClient.end();
      console.log(`[SUCCESS] Database record populated successfully for: ${displayName}`);
    } catch (dbErr: any) {
      console.error("Webhook Database Error mapping execution:", dbErr.message);
      return NextResponse.json({ error: "Database execution fault" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
