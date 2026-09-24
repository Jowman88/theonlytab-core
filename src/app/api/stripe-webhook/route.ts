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
    console.error(`Webhook Signature Verification Failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Dit is de ENIGE, 100% juiste object-configuratie zonder protocol-fouten
  const dbConfig = {
  user: 'postgres',
  host: 'aws-1-eu-west-1.pooler.supabase.com',
  database: 'postgres',
  password: 'postgres.'fvqeeriisoediuwbftvh:MidVmXksB2TFPSwB',
  port: 6543,
  ssl: true
};

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    const targetUrl = session.metadata?.targetUrl;
    const displayName = session.metadata?.displayName;
    const bidAmount = session.metadata?.bidAmount;
    const expiresAt = session.metadata?.expiresAt;

    try {
      const pgClient = new Client(dbConfig);
      await pgClient.connect();

      // Zet alle huidige actieve slots op bevroren/inactief
      await pgClient.query('UPDATE slots SET is_frozen = TRUE WHERE is_frozen = FALSE');

      // Voeg de nieuwe winnende adverteerder direct toe aan de database
      await pgClient.query(
        `INSERT INTO slots (current_url, display_name, current_bid, expires_at, is_frozen) 
         VALUES ($1, $2, $3, $4, FALSE)`,
        [targetUrl, displayName, bidAmount, expiresAt]
      );

      await pgClient.end();
      console.log(`Successfully broadcasted new live slot: ${displayName} (${targetUrl})`);
    } catch (dbErr: any) {
      console.error("Webhook Database Insertion Error:", dbErr.message);
      return NextResponse.json({ error: "Database internal crash" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
