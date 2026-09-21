import { NextResponse } from 'next/server';
import { checkUrlWithWebRisk } from '../../../lib/webRisk';
import { Client } from 'pg';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function POST(request: Request) {
  try {
    const { targetUrl, displayName, incomingBidAmount, xHandle } = await request.json();
    const userProposedBid = parseFloat(incomingBidAmount);

    if (isNaN(userProposedBid) || userProposedBid <= 0 || userProposedBid > 1000.00) {
      return NextResponse.json({ error: "Bid safety boundary bounds exceeded. Cap is \$1,000.00." }, { status: 400 });
    }

    const safetyStatus = await checkUrlWithWebRisk(targetUrl);
    if (!safetyStatus.isSafe) return NextResponse.json({ error: "Security Exception: Blocked Domain." }, { status: 400 });

    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    const activeRes = await pgClient.query(`SELECT current_bid FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() LIMIT 1`);
    const liveBid = activeRes.rows.length > 0 ? parseFloat(activeRes.rows[0].current_bid) : 0;
    await pgClient.end();

    if (userProposedBid < (liveBid + 1.00)) {
      return NextResponse.json({ error: "Outbid Error: Price tier has advanced." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: { currency: 'usd', product_data: { name: `The Only Tab: ${displayName}` }, unit_amount: Math.round(userProposedBid * 100) },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?status=cancelled`,
      metadata: { targetUrl, displayName, incomingBidAmount: userProposedBid.toString(), xHandle: xHandle || 'anonymous' }
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
