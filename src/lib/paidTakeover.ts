import { calculateStealPrice, getBasePrice, PricingSettings } from './pricing';

export const TAKEOVER_LOCK_WINDOW_MINUTES = 12;
export const TAKEOVER_DURATION_MINUTES = 90;
export const ACTIVE_SLOT_ORDER_BY_SQL = 'created_at DESC, id DESC';

export interface ActiveSlotSnapshot {
  id: string;
  currentBid: number;
  createdAt: string | Date | null;
  expiresAt?: string | Date | null;
  currentUrl?: string | null;
  displayName?: string | null;
}

export interface CheckoutQuoteContext {
  quotedAt: string;
  quotedActiveSlotId: string | null;
  quotedActiveCreatedAt: string | null;
  quotedActiveBidCents: number;
  quotedBasePriceCents: number;
  quotedStealPriceCents: number;
  quotedCurrency: string;
  stealFlatIncreaseCents: number;
  stealMultiplierBasisPoints: number;
}

export interface FulfillmentDecision {
  action: 'duplicate' | 'fulfill' | 'defer';
  reason?:
    | 'existing_session'
    | 'quoted_slot_locked'
    | 'active_slot_changed'
    | 'active_slot_changed_and_locked'
    | 'active_slot_missing_quote';
  currentActiveSlotId: string | null;
  quotedActiveSlotId: string | null;
  firstSeenAt?: string | null;
  isLocked?: boolean;
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeBidAmount(value: unknown): number {
  const numeric = Number.parseFloat(String(value || '0'));
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

export function toAmountCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function getSecondsLeftInLock(slot: ActiveSlotSnapshot | null | undefined, now = new Date()) {
  if (!slot || slot.currentBid <= 0) return 0;
  const createdAt = parseDate(slot.createdAt);
  if (!createdAt) return 0;
  const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
  return Math.max(0, TAKEOVER_LOCK_WINDOW_MINUTES * 60 - elapsedSeconds);
}

export function isSlotLocked(slot: ActiveSlotSnapshot | null | undefined, now = new Date()) {
  return getSecondsLeftInLock(slot, now) > 0;
}

export function buildCheckoutQuoteContext({
  activeSlot,
  now = new Date(),
  pricingSettings,
  requiredStealPrice,
}: {
  activeSlot: ActiveSlotSnapshot | null;
  now?: Date;
  pricingSettings: PricingSettings;
  requiredStealPrice: number;
}): CheckoutQuoteContext {
  return {
    quotedAt: now.toISOString(),
    quotedActiveSlotId: activeSlot?.id || null,
    quotedActiveCreatedAt: parseDate(activeSlot?.createdAt)?.toISOString() || null,
    quotedActiveBidCents: toAmountCents(activeSlot?.currentBid || 0),
    quotedBasePriceCents: toAmountCents(getBasePrice(now, pricingSettings)),
    quotedStealPriceCents: toAmountCents(requiredStealPrice),
    quotedCurrency: 'usd',
    stealFlatIncreaseCents: toAmountCents(pricingSettings.stealFlatIncrease),
    stealMultiplierBasisPoints: Math.round(pricingSettings.stealMultiplier * 10_000),
  };
}

export function buildCheckoutMetadata({
  targetUrl,
  displayName,
  overlayLabel,
  expiresAt,
  quote,
}: {
  targetUrl: string;
  displayName: string;
  overlayLabel: string;
  expiresAt: string;
  quote: CheckoutQuoteContext;
}) {
  return {
    targeturl: targetUrl,
    displayname: displayName,
    overlaylabel: overlayLabel,
    bidamount: (quote.quotedStealPriceCents / 100).toFixed(2),
    bidamountcents: String(quote.quotedStealPriceCents),
    currency: quote.quotedCurrency,
    expiresat: expiresAt,
    quotecreatedat: quote.quotedAt,
    quoteactiveslotid: quote.quotedActiveSlotId || '',
    quoteactivecreatedat: quote.quotedActiveCreatedAt || '',
    quoteactivebidcents: String(quote.quotedActiveBidCents),
    quotebasepricecents: String(quote.quotedBasePriceCents),
    quotestealpricecents: String(quote.quotedStealPriceCents),
    quotestealflatincreasecents: String(quote.stealFlatIncreaseCents),
    quotestealmultiplierbps: String(quote.stealMultiplierBasisPoints),
    quotelockwindowminutes: String(TAKEOVER_LOCK_WINDOW_MINUTES),
    quotedurationminutes: String(TAKEOVER_DURATION_MINUTES),
  };
}

function parseInteger(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCheckoutQuoteContext(metadata?: Record<string, string | null | undefined>): CheckoutQuoteContext | null {
  if (!metadata) return null;

  const quotedStealPriceCents = parseInteger(metadata.quotestealpricecents ?? metadata.bidamountcents);
  const quotedBasePriceCents = parseInteger(metadata.quotebasepricecents);
  const quotedActiveBidCents = parseInteger(metadata.quoteactivebidcents) ?? 0;
  const stealFlatIncreaseCents = parseInteger(metadata.quotestealflatincreasecents);
  const stealMultiplierBasisPoints = parseInteger(metadata.quotestealmultiplierbps);
  const quotedAt = parseDate(metadata.quotecreatedat)?.toISOString();
  const quotedCurrency = String(metadata.currency || metadata.quotecurrency || '').toLowerCase();

  if (
    !quotedAt ||
    !quotedCurrency ||
    quotedStealPriceCents == null ||
    quotedBasePriceCents == null ||
    stealFlatIncreaseCents == null ||
    stealMultiplierBasisPoints == null
  ) {
    return null;
  }

  return {
    quotedAt,
    quotedActiveSlotId: metadata.quoteactiveslotid || null,
    quotedActiveCreatedAt: parseDate(metadata.quoteactivecreatedat)?.toISOString() || null,
    quotedActiveBidCents,
    quotedBasePriceCents,
    quotedStealPriceCents,
    quotedCurrency,
    stealFlatIncreaseCents,
    stealMultiplierBasisPoints,
  };
}

export function validateStripeCheckoutQuote({
  sessionAmountTotal,
  sessionCurrency,
  quote,
}: {
  sessionAmountTotal: number | null;
  sessionCurrency?: string | null;
  quote: CheckoutQuoteContext | null;
}) {
  if (sessionCurrency?.toLowerCase() !== 'usd' || sessionAmountTotal == null || sessionAmountTotal <= 0) {
    return 'Invalid Stripe session amount.';
  }

  if (!quote) {
    return 'Missing quoted checkout context.';
  }

  if (quote.quotedCurrency !== 'usd') {
    return 'Invalid quoted currency in Stripe session.';
  }

  if (quote.quotedStealPriceCents !== sessionAmountTotal) {
    return 'Stripe amount did not match quoted price.';
  }

  return null;
}

export function calculateQuotedStealPrice({
  quotedActiveBidCents,
  quotedBasePriceCents,
  stealFlatIncreaseCents,
  stealMultiplierBasisPoints,
}: Pick<
  CheckoutQuoteContext,
  'quotedActiveBidCents' | 'quotedBasePriceCents' | 'stealFlatIncreaseCents' | 'stealMultiplierBasisPoints'
>) {
  const quotedBid = quotedActiveBidCents / 100;
  const quotedBasePrice = quotedBasePriceCents / 100;
  const quotedFlatIncrease = stealFlatIncreaseCents / 100;
  const quotedMultiplier = stealMultiplierBasisPoints / 10_000;

  return toAmountCents(
    calculateStealPrice(quotedBid, new Date(), {
      basePrice: quotedBasePrice,
      primeBasePrice: quotedBasePrice,
      stealFlatIncrease: quotedFlatIncrease,
      stealMultiplier: quotedMultiplier,
      primeWindows: [],
    })
  );
}

export function decideCheckoutFulfillment({
  existingSessionCreatedAt,
  currentActiveSlot,
  quote,
  now = new Date(),
}: {
  existingSessionCreatedAt?: string | Date | null;
  currentActiveSlot: ActiveSlotSnapshot | null;
  quote: CheckoutQuoteContext;
  now?: Date;
}): FulfillmentDecision {
  if (existingSessionCreatedAt) {
    return {
      action: 'duplicate',
      reason: 'existing_session',
      firstSeenAt: parseDate(existingSessionCreatedAt)?.toISOString() || null,
      currentActiveSlotId: currentActiveSlot?.id || null,
      quotedActiveSlotId: quote.quotedActiveSlotId,
    };
  }

  const locked = isSlotLocked(currentActiveSlot, now);

  if (quote.quotedActiveSlotId) {
    if (currentActiveSlot && currentActiveSlot.id !== quote.quotedActiveSlotId) {
      return {
        action: 'defer',
        reason: locked ? 'active_slot_changed_and_locked' : 'active_slot_changed',
        currentActiveSlotId: currentActiveSlot.id,
        quotedActiveSlotId: quote.quotedActiveSlotId,
        isLocked: locked,
      };
    }

    if (currentActiveSlot && currentActiveSlot.id === quote.quotedActiveSlotId && locked) {
      return {
        action: 'defer',
        reason: 'quoted_slot_locked',
        currentActiveSlotId: currentActiveSlot.id,
        quotedActiveSlotId: quote.quotedActiveSlotId,
        isLocked: true,
      };
    }
  } else if (currentActiveSlot && currentActiveSlot.currentBid > 0) {
    return {
      action: 'defer',
      reason: locked ? 'active_slot_changed_and_locked' : 'active_slot_missing_quote',
      currentActiveSlotId: currentActiveSlot.id,
      quotedActiveSlotId: null,
      isLocked: locked,
    };
  }

  return {
    action: 'fulfill',
    currentActiveSlotId: currentActiveSlot?.id || null,
    quotedActiveSlotId: quote.quotedActiveSlotId,
    isLocked: locked,
  };
}
