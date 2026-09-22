import { NextResponse } from 'next/server';
import { Client } from 'pg';
import Stripe from 'stripe';

const stripe = new Stripe('sk_test_51U5mSkEKVRr0yl1YGpRXE6Ql3aosswTULn7BLa0h85xooxpIiAU0gC4s2ECFF7vSdagCn0DsIuegBZzoKmtqqmee006jJvgLbo', { apiVersion: '2023-10-16' });
const SECONDS_PER_DOLLAR = 15;
const MAX_CAP_SECONDS = 7200;

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { targetUrl, displayName, incomingBidAmount, xHandle } = session.metadata!;
    const incomingBid = parseFloat(incomingBidAmount);
    const addedSeconds = Math.floor(incomingBid * SECONDS_PER_DOLLAR);

    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    try {
      await pgClient.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      const activeRes = await pgClient.query(`SELECT * FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1 FOR UPDATE`);

      if (activeRes.rows.length > 0) {
        const liveSlot = activeRes.rows[0];
        if (incomingBid <= parseFloat(liveSlot.current_bid)) {
          await pgClient.query('ROLLBACK');
          await stripe.refunds.create({ payment_intent: session.payment_intent as string });
          return NextResponse.json({ status: 'outbid_refunded' });
        }
        const exactDurationSecs = Math.floor((Date.now() - new Date(liveSlot.started_at).getTime()) / 1000);
        await pgClient.query(`INSERT INTO bid_history(url, display_name, final_bid, duration_seconds, buyer_x_handle, was_slashed) VALUES($1, $2, $3, $4, $5, FALSE)`, [liveSlot.current_url, liveSlot.display_name, liveSlot.current_bid, exactDurationSecs, liveSlot.buyer_x_handle]);
        const timeRemaining = Math.max(0, Math.floor((new Date(liveSlot.expires_at).getTime() - Date.now()) / 1000));
        const cumulativeSeconds = Math.min(MAX_CAP_SECONDS, timeRemaining + addedSeconds);

        await pgClient.query(`UPDATE slots SET current_url=$1, display_name=$2, current_bid=$3, seconds_purchased=$4, started_at=NOW(), expires_at=NOW() + ($5 || ' seconds')::INTERVAL, buyer_x_handle=$6, payment_intent_id=$7 WHERE id=$8`, [targetUrl, displayName, incomingBid, cumulativeSeconds, cumulativeSeconds, xHandle, session.payment_intent, liveSlot.id]);
      } else {
        const cappedInitSeconds = Math.min(MAX_CAP_SECONDS, addedSeconds);
        await pgClient.query(`INSERT INTO slots (current_url, display_name, current_bid, seconds_purchased, started_at, expires_at, buyer_x_handle, payment_intent_id) VALUES ($1, $2, $3, $4, NOW(), NOW() + ($5 || ' seconds')::INTERVAL, $6, $7)`, [targetUrl, displayName, incomingBid, cappedInitSeconds, cappedInitSeconds, xHandle, session.payment_intent]);
      }
      await pgClient.query('COMMIT');
    } catch {
      await pgClient.query('ROLLBACK');
    } finally {
      await pgClient.end();
    }
  }
  return NextResponse.json({ received: true });
}
