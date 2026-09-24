import { NextResponse } from 'next/server';
import { Client } from 'pg';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: Request) {
  try {
    const { targetUrl, displayName, bidAmount, durationMinutes } = await req.json();

    // 1. Bereken de exacte verlooptijd voor de metadata
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    // 2. Dit is de ENIGE, 100% juiste object-configuratie zonder protocol-fouten
    const dbConfig = {
      user: 'postgres',
      host: 'aws-0-eu-central-1.pooler.supabase.com',
      database: 'postgres',
      password: 'postgres.fvqeeriisoediuwbftvh:MidVmXksB2TFPSwB',
      port: 6543,
      ssl: true
    };

    // 3. Controleer heel even in de database of het bod nog steeds het hoogste is
    const pgClient = new Client(dbConfig);
    await pgClient.connect();
    
    const activeRes = await pgClient.query(
      `SELECT current_bid FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() LIMIT 1`
    );
    await pgClient.end();

    const currentHighestBid = activeRes.rows.length > 0 ? parseFloat(activeRes.rows[0].current_bid) : 0.00;

    if (parseFloat(bidAmount) <= currentHighestBid) {
      return NextResponse.json({ error: 'Outbid! Er is inmiddels al een hoger bod geplaatst.' }, { status: 400 });
    }

    // 4. Maak de officiële Stripe Checkout Sessie aan
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'ideal'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `The Only Tab Broadcast Slot: ${displayName}`,
              description: `Live video feed takeover for exactly ${durationMinutes} minutes. Target Node: ${targetUrl}`,
            },
            unit_amount: Math.round(parseFloat(bidAmount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://theonlytab.io',
      cancel_url: 'https://theonlytab.io',
      metadata: {
        targetUrl,
        displayName,
        bidAmount,
        expiresAt,
      },
    });

    return NextResponse.json({ id: session.id });
  } catch (err: any) {
    console.error("Create Checkout Session Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
