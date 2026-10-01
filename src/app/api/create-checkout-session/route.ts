import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { buildLockedCheckoutResponse } from '../../../lib/checkoutResponses';
import { getDbPool } from '../../../lib/db';
import { hashIdentifier, logger, redactUrl } from '../../../lib/logger';
import {
  ACTIVE_SLOT_ORDER_BY_SQL,
  buildCheckoutMetadata,
  buildCheckoutQuoteContext,
  isSlotLocked,
  normalizeBidAmount,
  TAKEOVER_DURATION_MINUTES,
} from '../../../lib/paidTakeover';
import { buildTargetUrl, validateTargetUrl } from '../../../lib/urlValidation';
import { checkUrlWithWebRisk } from '../../../lib/webRisk';
import { calculateStealPrice, getBasePrice } from '../../../lib/pricing';
import { getServerPricingSettings } from '../../../lib/pricingConfig';
import { enforceRateLimit, getClientIpAddress } from '../../../lib/rateLimit';

export const dynamic = 'force-dynamic';

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY is missing or invalid.');
  }

  return new Stripe(secretKey, {
    apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion,
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
    const clientIp = getClientIpAddress(req);
    const clientIpBucket = hashIdentifier(clientIp);
    const rateLimit = await enforceRateLimit({
      bucket: 'checkout-session',
      identifier: clientIp,
      windowMs: 60_000,
      maxRequests: 5,
    });

    if (!rateLimit.allowed) {
      logger.warn('Checkout session rejected by rate limit', {
        route: 'create-checkout-session',
        clientIpBucket,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const { targetUrl, displayName, startPath } = body;

    if (!targetUrl || typeof targetUrl !== 'string') {
      logger.warn('Checkout session rejected for missing target URL', {
        route: 'create-checkout-session',
        clientIpBucket,
      });
      return NextResponse.json({ error: 'TARGET URL REQUIRED: Please provide a website URL.' }, { status: 400 });
    }

    const validation = validateTargetUrl(targetUrl);
    if (!validation.ok || !validation.normalizedUrl) {
      logger.warn('Checkout session rejected for invalid target URL', {
        route: 'create-checkout-session',
        clientIpBucket,
        reason: validation.message || 'invalid_target_url',
        targetUrl,
      });
      return NextResponse.json({ error: validation.message || 'TARGET URL INVALID: Please provide a valid public website URL.' }, { status: 400 });
    }

    if (!(await checkUrlWithWebRisk(validation.normalizedUrl))) {
      logger.warn('Checkout session rejected by WebRisk', {
        route: 'create-checkout-session',
        clientIpBucket,
        targetUrl: validation.normalizedUrl,
      });
      return NextResponse.json({ error: 'URL refused by the safety gate.' }, { status: 400 });
    }

    const displayNameValue = String(displayName || 'Anonymous Takeover').trim();

    let finalTargetUrl: string;
    try {
      finalTargetUrl = buildTargetUrl(validation.normalizedUrl, startPath);
    } catch (err: any) {
      logger.warn('Checkout session rejected for invalid start path', {
        route: 'create-checkout-session',
        clientIpBucket,
        targetUrl: validation.normalizedUrl,
        reason: err?.message || 'invalid_start_path',
      });
      return NextResponse.json({ error: err.message || 'Invalid path supplied.' }, { status: 400 });
    }

    if (containsProfanity(displayNameValue) || containsProfanity(finalTargetUrl)) {
      logger.warn('Checkout session rejected for profanity', {
        route: 'create-checkout-session',
        clientIpBucket,
        targetUrl: finalTargetUrl,
      });
      return NextResponse.json(
        { error: 'TEXT REFUSED: Inappropriate language detected.' },
        { status: 400 }
      );
    }

    if (displayNameValue.length > 80) {
      logger.warn('Checkout session rejected for oversized display name', {
        route: 'create-checkout-session',
        clientIpBucket,
        displayNameLength: displayNameValue.length,
      });
      return NextResponse.json({ error: 'DISPLAY NAME IS TOO LONG.' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const pricingSettings = await getServerPricingSettings();
    const client = await getDbPool().connect();

    try {
      const activeRes = await client.query(
        `SELECT id, current_bid, created_at FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() ORDER BY ${ACTIVE_SLOT_ORDER_BY_SQL} LIMIT 1`
      );

      const activeSlot = activeRes.rows?.[0]
        ? {
            id: String(activeRes.rows[0].id),
            currentBid: normalizeBidAmount(activeRes.rows[0].current_bid),
            createdAt: activeRes.rows[0].created_at,
          }
        : null;

      let requiredStealPrice = getBasePrice(new Date(), pricingSettings);

      if (activeSlot?.currentBid && activeSlot.currentBid > 0) {
        if (isSlotLocked(activeSlot)) {
          return buildLockedCheckoutResponse({
            clientIpBucket,
            activeSlotId: activeSlot.id,
            targetUrl: finalTargetUrl,
          });
        }

        requiredStealPrice = calculateStealPrice(activeSlot.currentBid, new Date(), pricingSettings);
      }

      if (!Number.isFinite(requiredStealPrice) || requiredStealPrice <= 0) {
        logger.error('Checkout session could not determine a valid price', {
          route: 'create-checkout-session',
          clientIpBucket,
          activeSlotId: activeSlot?.id || null,
        });
        return NextResponse.json({ error: 'Unable to determine valid checkout price.' }, { status: 500 });
      }

      const requiredStealPriceCents = Math.round(requiredStealPrice * 100);
      const quote = buildCheckoutQuoteContext({
        activeSlot,
        now: new Date(),
        pricingSettings,
        requiredStealPrice,
      });
      const expiresAt = new Date(Date.now() + TAKEOVER_DURATION_MINUTES * 60 * 1000).toISOString();

      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `STEAL FEED: ${displayNameValue || 'Anonymous'}`,
              description: `Force takeover viewport to: ${finalTargetUrl}`,
              tax_code: 'txcd_10701100'
            },
            unit_amount: requiredStealPriceCents,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: 'https://theonlytab.io?payment=success',
        cancel_url: 'https://theonlytab.io',
        metadata: buildCheckoutMetadata({
          targetUrl: finalTargetUrl,
          displayName: displayNameValue,
          expiresAt,
          quote,
        }),
      });

      logger.info('Stripe checkout session created', {
        route: 'create-checkout-session',
        stripeSessionId: session.id,
        clientIpBucket,
        activeSlotId: activeSlot?.id || null,
        bidAmount: requiredStealPrice.toFixed(2),
        targetUrl: redactUrl(finalTargetUrl),
      });

      return NextResponse.json({ url: session.url });
    } finally {
      client.release();
    }
  } catch (err: any) {
    logger.error('Checkout session creation failed', {
      route: 'create-checkout-session',
      error: err,
    });
    return NextResponse.json({ error: `SERVER ERROR: ${err.message}` }, { status: 500 });
  }
}
