import { NextResponse } from 'next/server';
import { Client } from 'pg';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function POST(request: Request) {
  try {
    const { targetUrl, displayName, incomingBidAmount, xHandle } = await request.json();
    
    // Fallback voor bedrag als de database nog leeg is
    const userProposedBid = parseFloat(incomingBidAmount);
    let finalProposedBid = isNaN(userProposedBid) || userProposedBid <= 0 ? 1.00 : userProposedBid;

    if (finalProposedBid > 1000.00) {
      return NextResponse.json({ error: "Bid safety boundary bounds exceeded. Cap is \$1,000.00." }, { status: 400 });
    }

    // Waterdichte fallback voor de target URL om fouten te voorkomen
    let cleanTargetUrl = targetUrl;
    if (!cleanTargetUrl || cleanTargetUrl.trim() === "" || cleanTargetUrl === "https://google.com") {
      cleanTargetUrl = "https://theonlytab.io";
    }

    // Database check voor het huidige bod
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    const activeRes = await pgClient.query(`SELECT current_bid FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() LIMIT 1`);
    const liveBid = activeRes.rows.length > 0 && activeRes.rows[0].current_bid ? parseFloat(activeRes.rows[0].current_bid) : 0;
    await pgClient.end();

    if (finalProposedBid < (liveBid + 1.00)) {
      return NextResponse.json({ error: "Outbid Error: Price tier has advanced." }, { status: 400 });
    }

    // Bouw de Stripe Checkout sessie op met geverifieerde absolute URL's
    const baseUrl = 'https://theonlytab.io';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: { 
          currency: 'usd', 
          product_data: { name: `The Only Tab: ${displayName || 'Premium Space'}` }, 
          unit_amount: Math.round(finalProposedBid * 100) 
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${baseUrl}/?status=success`,
      cancel_url: `${baseUrl}/?status=cancelled`,
      metadata: { 
        targetUrl: cleanTargetUrl, 
        displayName: displayName || 'Anonymous', 
        incomingBidAmount: finalProposedBid.toString(), 
        xHandle: xHandle || 'anonymous' 
      }
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: `SERVER_CRASH: ${err.message || 'Unknown server error'}` }, { status: 500 });
  }
}
