import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDbPool } from '../../../lib/db';
import { logger } from '../../../lib/logger';
import {
  ACTIVE_SLOT_ORDER_BY_SQL,
  calculateQuotedStealPrice,
  calculateStealPriceFromQuoteInputs,
  decideCheckoutFulfillment,
  normalizeBidAmount,
  parseCheckoutQuoteContext,
  TAKEOVER_DURATION_MINUTES,
  validateStripeCheckoutQuote,
} from '../../../lib/paidTakeover';
import { settlePredictions } from '../../../lib/predictions';
import { validateTargetUrl } from '../../../lib/urlValidation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion,
});

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('Stripe webhook rejected for missing signature', {
      route: 'stripe-webhook',
    });
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
    logger.warn('Stripe webhook signature validation failed', {
      route: 'stripe-webhook',
      error: err,
    });
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  logger.debug('Stripe webhook signature validated', {
    route: 'stripe-webhook',
    eventType: event.type,
    stripeEventId: event.id,
  });

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true });
  }

  if (session.amount_total == null || session.amount_total <= 0) {
    return NextResponse.json({ error: 'Invalid Stripe session amount.' }, { status: 400 });
  }

  const targetUrl = session.metadata?.targeturl || session.metadata?.targetUrl;
  const displayName =
    session.metadata?.displayname || session.metadata?.displayName || 'Anonymous Takeover';
  const quote = parseCheckoutQuoteContext(session.metadata || undefined);

  const expiresAt =
    session.metadata?.expiresat ||
    session.metadata?.expiresAt ||
    new Date(Date.now() + TAKEOVER_DURATION_MINUTES * 60 * 1000).toISOString();

  if (!targetUrl || !validateTargetUrl(targetUrl).ok) {
    logger.warn('Stripe webhook rejected invalid target URL', {
      route: 'stripe-webhook',
      stripeSessionId: session.id,
      targetUrl,
    });
    return NextResponse.json({ error: 'Invalid target URL in Stripe session.' }, { status: 400 });
  }

  const quoteValidationError = validateStripeCheckoutQuote({
    sessionAmountSubtotal: session.amount_subtotal,
    sessionCurrency: session.currency,
    quote,
  });
  if (quoteValidationError) {
    logger.warn('Stripe webhook rejected invalid quoted checkout context', {
      route: 'stripe-webhook',
      stripeSessionId: session.id,
      reason: quoteValidationError,
      currency: session.currency,
      amountSubtotal: session.amount_subtotal,
      amountTotal: session.amount_total,
    });
    return NextResponse.json({ error: quoteValidationError }, { status: 400 });
  }

  const validatedQuote = quote!;
  const rawBid = (validatedQuote.quotedStealPriceCents / 100).toFixed(2);

  if (calculateQuotedStealPrice(validatedQuote) !== validatedQuote.quotedStealPriceCents) {
    logger.warn('Stripe webhook rejected inconsistent quote pricing metadata', {
      route: 'stripe-webhook',
      stripeSessionId: session.id,
      quotedPriceCents: validatedQuote.quotedStealPriceCents,
    });
    return NextResponse.json({ error: 'Quoted checkout metadata was inconsistent.' }, { status: 400 });
  }

  const validNumericBid = Number.parseFloat(String(rawBid || '0'));
  if (!Number.isFinite(validNumericBid) || validNumericBid <= 0) {
    logger.warn('Stripe webhook rejected invalid bid amount', {
      route: 'stripe-webhook',
      stripeSessionId: session.id,
      amountSubtotal: session.amount_subtotal,
      amountTotal: session.amount_total,
    });
    return NextResponse.json({ error: 'Invalid bid amount in Stripe session.' }, { status: 400 });
  }

  const dbClient = await getDbPool().connect();
  let transactionOpen = false;

  try {
    await dbClient.query('BEGIN');
    transactionOpen = true;
    await dbClient.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      'stripe_checkout_active_slot_state',
    ]);

    const duplicateRes = await dbClient.query(
      `
      SELECT id, created_at
      FROM slots
      WHERE stripe_session_id = $1
      LIMIT 1
      `,
      [session.id]
    );

    const activeRes = await dbClient.query(
      `
      SELECT id, current_url, display_name, current_bid, created_at, expires_at
      FROM slots
      WHERE is_frozen = FALSE AND expires_at > NOW()
      ORDER BY ${ACTIVE_SLOT_ORDER_BY_SQL}
      LIMIT 1
      FOR UPDATE
      `
    );

    const currentActiveSlot = activeRes.rows?.[0]
      ? {
        id: String(activeRes.rows[0].id),
        currentBid: normalizeBidAmount(activeRes.rows[0].current_bid),
        createdAt: activeRes.rows[0].created_at,
        expiresAt: activeRes.rows[0].expires_at,
        currentUrl: activeRes.rows[0].current_url,
        displayName: activeRes.rows[0].display_name,
      }
      : null;

    const currentExpectedPriceCents = currentActiveSlot
      ? calculateStealPriceFromQuoteInputs({
          currentBidCents: Math.round(currentActiveSlot.currentBid * 100),
          quote: validatedQuote,
        })
      : validatedQuote.quotedBasePriceCents;

    const decision = decideCheckoutFulfillment({
      existingSessionCreatedAt: duplicateRes.rows?.[0]?.created_at || null,
      currentActiveSlot,
      currentRequiredPriceCents: currentExpectedPriceCents,
      quote: validatedQuote,
      now: new Date(),
    });

    if (decision.action === 'duplicate') {
      await dbClient.query('COMMIT');
      transactionOpen = false;
      logger.info('Duplicate Stripe webhook ignored', {
        route: 'stripe-webhook',
        stripeSessionId: session.id,
        firstSeenAt: decision.firstSeenAt,
        activeSlotId: decision.currentActiveSlotId,
      });
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (decision.action === 'defer') {
      await dbClient.query('COMMIT');
      transactionOpen = false;
      logger.warn('Paid checkout deferred for manual reconciliation', {
      route: 'stripe-webhook',
      stripeSessionId: session.id,
      reason: decision.reason,
      activeSlotId: decision.currentActiveSlotId,
      quotedActiveSlotId: decision.quotedActiveSlotId,
      quotedPriceCents: validatedQuote.quotedStealPriceCents,
      actualPriceCents: currentExpectedPriceCents,
      targetUrl,
      });
      return NextResponse.json({ received: true, reconcile: true, reason: decision.reason }, { status: 202 });
    }

    if (currentActiveSlot?.id) {
      try {
        await dbClient.query('SAVEPOINT clear_likes');
        await dbClient.query(`DELETE FROM slot_likes WHERE slot_id = $1`, [currentActiveSlot.id]);
        await dbClient.query('RELEASE SAVEPOINT clear_likes');
      } catch (likesError: any) {
        if (likesError?.code !== '42P01') throw likesError;
        await dbClient.query('ROLLBACK TO SAVEPOINT clear_likes');
      }
      await dbClient.query(
      `
      UPDATE slots
      SET is_frozen = TRUE,
          expires_at = LEAST(expires_at, NOW())
      WHERE id = $1
      `,
      [currentActiveSlot.id]
      );
    }

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
      await dbClient.query('COMMIT');
      transactionOpen = false;
      logger.info('Duplicate Stripe webhook ignored after insert race', {
        route: 'stripe-webhook',
        stripeSessionId: session.id,
      });
      return NextResponse.json({ received: true, duplicate: true });
    }

    await dbClient.query('COMMIT');
    transactionOpen = false;
    if (currentActiveSlot?.id) await settlePredictions(currentActiveSlot.id, new Date());
    logger.info('Stripe webhook committed stage takeover', {
      route: 'stripe-webhook',
      stripeSessionId: session.id,
      activeSlotId: insertResult.rows[0].id,
      replacedSlotId: currentActiveSlot?.id || null,
      bidAmount: validNumericBid.toFixed(2),
      amountSubtotal: session.amount_subtotal,
      amountTotal: session.amount_total,
      targetUrl,
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    if (transactionOpen) {
      try {
        await dbClient.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Stripe webhook rollback failed', {
        route: 'stripe-webhook',
        stripeSessionId: session.id,
        error: rollbackError,
        recoveryAction: 'manual_reconciliation_required',
        });
      }
    }

    logger.error('Stripe webhook processing failed', {
      route: 'stripe-webhook',
      stripeSessionId: session.id,
      error,
      recoveryAction: 'manual_reconciliation_required',
    });
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  } finally {
    dbClient.release();
  }
}
