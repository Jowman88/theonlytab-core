import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDbPool } from '../../../lib/db';
import { validateTargetUrl } from '../../../lib/urlValidation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

function redactUrl(url?: string | null) {
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return 'redacted';
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing Stripe webhook signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Invalid Stripe webhook signature:', err);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true });
  }

  if (session.currency !== 'usd' || session.amount_total == null || session.amount_total <= 0) {
    return NextResponse.json({ error: 'Invalid Stripe session amount.' }, { status: 400 });
  }

  const targetUrl = session.metadata?.targeturl || session.metadata?.targetUrl;
  const displayName =
    session.metadata?.displayname || session.metadata?.displayName || 'Anonymous Takeover';
  const rawBid = (session.amount_total / 100).toFixed(2);
  const expectedBidCents = Number.parseInt(
    String(session.metadata?.bidamountcents || session.metadata?.bidAmountCents || ''),
    10
  );

  const expiresAt =
    session.metadata?.expiresat ||
    session.metadata?.expiresAt ||
    new Date(Date.now() + 90 * 60 * 1000).toISOString();

  if (!targetUrl || !validateTargetUrl(targetUrl).ok) {
    console.warn(`Webhook rejected invalid target: ${redactUrl(targetUrl)}`);
    return NextResponse.json({ error: 'Invalid target URL in Stripe session.' }, { status: 400 });
  }

  if (Number.isFinite(expectedBidCents) && expectedBidCents > 0 && expectedBidCents !== session.amount_total) {
    return NextResponse.json({ error: 'Stripe amount did not match expected price.' }, { status: 400 });
  }

  const validNumericBid = Number.parseFloat(String(rawBid || '0'));
  if (!Number.isFinite(validNumericBid) || validNumericBid <= 0) {
    return NextResponse.json({ error: 'Invalid bid amount in Stripe session.' }, { status: 400 });
  }

  const dbClient = await getDbPool().connect();

  try {
    const insertResult = await dbClient.query(
      `
      INSERT INTO slots (
        current_url,
        display_name,
        current_bid,
        expires_at,
        is_frozen,
        created_at,
        purchase_price,
        steal_price,
        stripe_session_id
      )
      VALUES ($1, $2, $3, $4, FALSE, NOW(), $5, $6, $7)
      ON CONFLICT (stripe_session_id) DO NOTHING
      RETURNING id
      `,
      [targetUrl, displayName, validNumericBid, expiresAt, validNumericBid, validNumericBid, session.id]
    );

    if (insertResult.rowCount === 0) {
      console.log(`[INFO] Duplicate webhook session ignored: ${session.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    console.log(`[SUCCESS] Webhook committed stage takeover for ${displayName} -> ${redactUrl(targetUrl)}`);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook processing failed:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  } finally {
    dbClient.release();
  }
}
