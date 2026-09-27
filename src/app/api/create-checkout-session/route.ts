import { NextResponse } from 'next/server';
import { Client } from 'pg';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any });

const BANNED_WORDS = [
  'nigger', 'kike', 'faggot', 'tranny', 'hitler', 'nazi', 
  'kanker', 'kankeren', 'kankerlijer', 'kkr', 'neger', 'homo',
  'fuck', 'bitch', 'asshole', 'pussy', 'dick', 'cock', 'scam'
];

function containsProfanity(text: string): boolean {
  if (!text) return false;
  const cleanText = text.toLowerCase().trim();
  return BANNED_WORDS.some(badWord => {
    const regex = new RegExp(badWord, 'i');
    return regex.test(cleanText);
  });
}

export async function POST(req: Request) {
  const dbConfig = {
    user: 'postgres.fvqeeriisoediuwbftvh',
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: process.env.DATABASE_PASSWORD,
    port: 6543,
    ssl: { rejectUnauthorized: false }
  };

  try {
    const { targetUrl, displayName, overlayLabel, startPath } = await req.json();

    if (containsProfanity(overlayLabel) || containsProfanity(displayName) || containsProfanity(targetUrl)) {
      return NextResponse.json(
        { error: 'TEXT REFUSED: Inappropriate language or banned terms detected.' }, 
        { status: 400 }
      );
    }

    const pgClient = new Client(dbConfig);
    await pgClient.connect();
    
    const activeRes = await pgClient.query(
      `SELECT id, current_bid, created_at FROM slots 
       WHERE is_frozen = FALSE AND expires_at > NOW()
       LIMIT 1`
    );

    let requiredStealPrice = 19.00; 
    
    if (activeRes.rows && activeRes.rows.length > 0) {
      const activeSlot = activeRes.rows[0];
      const currentPaid = parseFloat(activeSlot.current_bid || '0');
      
      if (currentPaid > 0 && activeSlot.created_at) {
        const createdAt = new Date(activeSlot.created_at).getTime();
        const minutesOnStage = (Date.now() - createdAt) / (1000 * 60);

        if (!isNaN(minutesOnStage) && minutesOnStage < 12) {
          await pgClient.end();
          return NextResponse.json({ error: `FEED LOCKED: Protected for the first 12 minutes.` }, { status: 400 });
        }
        
        const percentageIncrease = currentPaid * 1.25;
        const flatIncrease = currentPaid + 10.00;
        requiredStealPrice = Math.max(percentageIncrease, flatIncrease);
      }
    }

    await pgClient.end();

    let finalTargetUrl = targetUrl;
    if (startPath) {
      const cleanPath = startPath.trim();
      if (cleanPath.startsWith('/') || cleanPath.startsWith('#')) {
        finalTargetUrl = `${targetUrl}${cleanPath}`;
      } else {
        finalTargetUrl = `${targetUrl}/${cleanPath}`;
      }
    }

    const session = await stripe.checkout.sessions.create({
      // FIX: payment_method_types is volledig VERWIJDERD om Managed Payments de controle te geven!
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `STEAL FEED: ${displayName || 'Anonymous'}`,
            description: `Force takeover viewport to: ${finalTargetUrl}`,
          },
          unit_amount: Math.round(requiredStealPrice * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://theonlytab.io',
      cancel_url: 'https://theonlytab.io',
      metadata: {
        targetUrl: finalTargetUrl,
        displayName: displayName || 'Anonymous Takeover',
        overlayLabel: overlayLabel || '',
        bidAmount: requiredStealPrice.toFixed(2),
        expiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString()
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout route internal error:", err.message);
    return NextResponse.json({ error: `SERVER ERROR: ${err.message}` }, { status: 500 });
  }
}
