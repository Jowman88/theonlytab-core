import { NextResponse } from 'next/server';
import { Client } from 'pg';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
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
    const targetUrl = session.metadata?.targetUrl;
    const displayName = session.metadata?.displayName;
    const bidAmount = session.metadata?.bidAmount;
    const expiresAt = session.metadata?.expiresAt;
    const overlayLabel = session.metadata?.overlayLabel || '';

    try {
      const pgClient = new Client(dbConfig);
      await pgClient.connect();
      
      // Freeze de huidige actieve sessie
      await pgClient.query('UPDATE slots SET is_frozen = TRUE WHERE is_frozen = FALSE');
      
      // Sla de nieuwe bieder op inclusief het custom video overlay label
      await pgClient.query(
        `INSERT INTO slots (current_url, display_name, current_bid, expires_at, is_frozen, created_at, purchase_price, steal_price) 
         VALUES ($1, $2, $3, $4, FALSE, NOW(), $3, $3)`,
        [targetUrl, displayName, bidAmount, expiresAt]
      );
      
      await pgClient.end();
      console.log(`Successfully processed slot takeover for: ${displayName}`);
    } catch (dbErr: any) {
      console.error("Webhook Database Insertion Error:", dbErr.message);
      return NextResponse.json({ error: "Database internal crash" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
