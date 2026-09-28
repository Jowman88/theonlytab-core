import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCheckoutMetadata,
  buildCheckoutQuoteContext,
  calculateQuotedStealPrice,
  decideCheckoutFulfillment,
  getSecondsLeftInLock,
  parseCheckoutQuoteContext,
  validateStripeCheckoutQuote,
} from '../src/lib/paidTakeover';
import { DEFAULT_PRICING_SETTINGS } from '../src/lib/pricing';

const now = new Date('2026-09-28T15:00:00.000Z');

function createActiveSlot(overrides: Partial<Parameters<typeof buildCheckoutQuoteContext>[0]['activeSlot']> = {}) {
  return {
    id: 'slot-active-1',
    currentBid: 75,
    createdAt: new Date(now.getTime() - 13 * 60 * 1000).toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function createQuote(activeSlot = createActiveSlot()) {
  return buildCheckoutQuoteContext({
    activeSlot,
    now,
    pricingSettings: DEFAULT_PRICING_SETTINGS,
    requiredStealPrice: 93.75,
  });
}

test('happy path quote metadata round-trips for fulfillment', () => {
  const quote = createQuote();
  const metadata = buildCheckoutMetadata({
    targetUrl: 'https://example.com/path',
    displayName: 'Happy Path',
    overlayLabel: 'LIVE',
    expiresAt: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
    quote,
  });

  const parsedQuote = parseCheckoutQuoteContext(metadata);
  assert.ok(parsedQuote);
  assert.equal(parsedQuote?.quotedActiveSlotId, quote.quotedActiveSlotId);
  assert.equal(calculateQuotedStealPrice(parsedQuote!), quote.quotedStealPriceCents);

  const validationError = validateStripeCheckoutQuote({
    sessionAmountTotal: quote.quotedStealPriceCents,
    sessionCurrency: 'usd',
    quote: parsedQuote,
  });
  assert.equal(validationError, null);

  const decision = decideCheckoutFulfillment({
    currentActiveSlot: createActiveSlot(),
    quote: parsedQuote!,
    now: new Date(now.getTime() + 5_000),
  });
  assert.equal(decision.action, 'fulfill');
});

test('duplicate webhook delivery is idempotent', () => {
  const decision = decideCheckoutFulfillment({
    existingSessionCreatedAt: now.toISOString(),
    currentActiveSlot: createActiveSlot(),
    quote: createQuote(),
    now,
  });

  assert.equal(decision.action, 'duplicate');
  assert.equal(decision.reason, 'existing_session');
  assert.equal(decision.firstSeenAt, now.toISOString());
});

test('delayed webhook delivery still fulfills when active slot context is unchanged', () => {
  const quote = createQuote();
  const decision = decideCheckoutFulfillment({
    currentActiveSlot: createActiveSlot(),
    quote,
    now: new Date(now.getTime() + 4_000),
  });

  assert.equal(decision.action, 'fulfill');
});

test('concurrent checkout fulfillment defers stale payment when another takeover wins first', () => {
  const quote = createQuote();
  const winnerSlot = createActiveSlot({
    id: 'slot-active-2',
    currentBid: 110,
    createdAt: new Date(now.getTime() - 60 * 1000).toISOString(),
  });

  const decision = decideCheckoutFulfillment({
    currentActiveSlot: winnerSlot,
    quote,
    now,
  });

  assert.equal(decision.action, 'defer');
  assert.equal(decision.reason, 'active_slot_changed_and_locked');
  assert.equal(decision.currentActiveSlotId, 'slot-active-2');
});

test('stale checkout context without a quoted active slot is deferred when a new paid slot appears', () => {
  const quote = buildCheckoutQuoteContext({
    activeSlot: null,
    now,
    pricingSettings: DEFAULT_PRICING_SETTINGS,
    requiredStealPrice: 19,
  });

  const decision = decideCheckoutFulfillment({
    currentActiveSlot: createActiveSlot({
      id: 'slot-active-locked',
      currentBid: 45,
      createdAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
    }),
    quote,
    now,
  });

  assert.equal(decision.action, 'defer');
  assert.equal(decision.reason, 'active_slot_changed_and_locked');
});

test('failed payment metadata is rejected for invalid currency, amount, or missing quote', () => {
  assert.equal(
    validateStripeCheckoutQuote({
      sessionAmountTotal: 5000,
      sessionCurrency: 'eur',
      quote: createQuote(),
    }),
    'Invalid Stripe session amount.'
  );

  assert.equal(
    validateStripeCheckoutQuote({
      sessionAmountTotal: 0,
      sessionCurrency: 'usd',
      quote: createQuote(),
    }),
    'Invalid Stripe session amount.'
  );

  assert.equal(
    validateStripeCheckoutQuote({
      sessionAmountTotal: 1900,
      sessionCurrency: 'usd',
      quote: null,
    }),
    'Missing quoted checkout context.'
  );
});

test('lock timer enforcement only blocks paid slots inside the first 12 minutes', () => {
  const lockedSeconds = getSecondsLeftInLock(
    createActiveSlot({
      currentBid: 40,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    }),
    now
  );
  const unlockedSeconds = getSecondsLeftInLock(
    createActiveSlot({
      currentBid: 40,
      createdAt: new Date(now.getTime() - 13 * 60 * 1000).toISOString(),
    }),
    now
  );

  assert.ok(lockedSeconds > 0);
  assert.equal(unlockedSeconds, 0);
});
