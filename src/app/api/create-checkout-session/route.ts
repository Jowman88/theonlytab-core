import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import http from 'http';
import https from 'https';
import { getDbPool } from '../../../lib/db';
import { buildTargetUrl, validateTargetUrl } from '../../../lib/urlValidation';
import { checkUrlWithWebRisk } from '../../../lib/webRisk';

export const dynamic = 'force-dynamic';

// 🛡️ Gecorrigeerd: HTTP agents statisch gedefinieerd om Webpack runtime crashes te voorkomen
const stripeHttpClient = Stripe.createFetchHttpClient({
  httpAgent: http.globalAgent,
  httpsAgent: new https.Agent({ keepAlive: true }), // 100% Veilig en optimaal voor live Stripe verkeer
});

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY is missing or invalid.');
  }

  return new Stripe(secretKey, {
    apiVersion: '2025-03-31.basil',
    httpClient: stripeHttpClient,
  });
}

const BANNED_WORDS = [
  'nigger', 'kike', 'faggot', 'tranny', 'hitler', 'nazi',
  'kanker', 'kankeren', 'kankerlijer', 'kkr', 'neger', 'homo',
  'fuck', 'bitch', 'asshole', 'pussy', 'dick', 'cock', 'scam'
];

function containsProfanity(text: string): boolean {
  if (!text) return false;
  const cleaned = text.toLowerCase().trim();
  return BANNED_WORDS.some((badWord) => {
    const regex = new RegExp(`\\b${badWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(cleaned);
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetUrl, displayName, overlayLabel, startPath } = body;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return NextResponse.json({ error: 'TARGET URL REQUIRED: Please provide a website URL.' }, { status: 400 });
    }

    const validation = validateTargetUrl(targetUrl);
    if (!validation.ok || !validation.normalizedUrl) {
      return NextResponse.json({ error: validation.message || 'TARGET URL INVALID: Please provide a valid public website URL.' }, { status: 400 });
    }

    if (!(await checkUrlWithWebRisk(validation.normalizedUrl))) {
      return NextResponse.json({ error: 'URL refused by the safety gate.' }, { status: 400 });
    }

    const displayNameValue = String(displayName || 'Anonymous Takeover').trim();
    const overlayLabelValue = String(overlayLabel || '').trim();

    let finalTargetUrl: string;
    try {
      finalTargetUrl = buildTargetUrl(validation.normalizedUrl, startPath);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Invalid path supplied.' }, { status: 400 });
    }

    if (containsProfanity(overlayLabelValue) || containsProfanity(displayNameValue) || containsProfanity(finalTargetUrl)) {
      return NextResponse.json(
        { error: 'TEXT REFUSED: Inappropriate language detected.' },
        { status: 400 }
      );
    }

    if (displayNameValue.length > 80 || overlayLabelValue.length > 15) {
      return NextResponse.json({ error: 'DISPLAY NAME OR OVERLAY LABEL IS TOO LONG.' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const client = await getDbPool().connect();

    try {
      // FIX: activeRes.rows[0] logica veilig gesteld tegen undefined array crashes
      const activeRes = await client.query(
        `SELECT id, current_bid, created_at FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() LIMIT 1`
      );

      let requiredStealPrice = 19.0;

      if (activeRes.rows && activeRes.rows.length > 0) {
        const activeSlot = activeRes.rows[0];
        const currentPaid = parseFloat(activeSlot.current_bid || '0');

        if (currentPaid > 0 && activeSlot.created_at) {
          const createdAt = new Date(activeSlot.created_at).getTime();
          const minutesOnStage = (Date.now() - createdAt) / (1000 * 60);

          if (!isNaN(minutesOnStage) && minutesOnStage < 12) {
            return NextResponse.json({ error: 'FEED LOCKED: Protected for the first 12 minutes.' }, { status: 400 });
          }

          const percentageIncrease = currentPaid * 1.25;
          const flatIncrease = currentPaid + 10.0;
          requiredStealPrice = Math.max(percentageIncrease, flatIncrease);
        }
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `STEAL FEED: ${displayNameValue || 'Anonymous'}`,
              description: `Force takeover viewport to: ${finalTargetUrl}`,
              tax_code: 'txcd_10701100'
            },
            unit_amount: Math.round(requiredStealPrice * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        // FIX: Hersteld naar de juiste succes-parameters om de Embed-widget direct te tonen aan de koper
        success_url: 'https://theonlytab.io',
        cancel_url: 'https://theonlytab.io',
        metadata: {
          targeturl: finalTargetUrl,
          displayname: displayNameValue,
          overlaylabel: overlayLabelValue,
          bidamount: requiredStealPrice.toFixed(2),
          expiresat: new Date(Date.now() + 90 * 60 * 1000).toISOString()
        },
      });

      return NextResponse.json({ url: session.url });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Checkout session error:', err);
    return NextResponse.json({ error: `SERVER ERROR: ${err.message}` }, { status: 500 });
  }
}
