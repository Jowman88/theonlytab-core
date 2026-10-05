import { calculateStealPriceCents, getBasePrice, PricingSettings } from './pricing';

export const PROTECTION_WINDOW_SECONDS = 90;
export const QUOTE_LOCK_MINUTES = 5;
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
  quotedCrowdPercent: number;
  quotedCurrency: string;
}

export interface FulfillmentDecision {
  action: 'duplicate' | 'fulfill' | 'defer';
  reason?:
    | 'existing_session'
    | 'active_slot_changed'
    | 'active_slot_changed_and_protected'
    | 'active_slot_missing_quote';
  currentActiveSlotId: string | null;
  quotedActiveSlotId: string | null;
  firstSeenAt?: string | null;
  isProtected?: boolean;
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

export function getSecondsLeftInProtection(slot: ActiveSlotSnapshot | null | undefined, now = new Date()) {
  if (!slot || slot.currentBid <= 0) return 0;
  const createdAt = parseDate(slot.createdAt);
  if (!createdAt) return 0;
  const elapsedSeconds = (now.getTime() - createdAt.getTime()) / 1000;
  return Math.max(0, Math.min(PROTECTION_WINDOW_SECONDS, Math.ceil(PROTECTION_WINDOW_SECONDS - elapsedSeconds)));
}

export function isSlotProtected(slot: ActiveSlotSnapshot | null | undefined, now = new Date()) {
  return getSecondsLeftInProtection(slot, now) > 0;
}

export function buildCheckoutQuoteContext({
  activeSlot,
  now = new Date(),
  pricingSettings,
  requiredStealPrice,
  crowdPercent = 0,
}: {
  activeSlot: ActiveSlotSnapshot | null;
  now?: Date;
  pricingSettings: PricingSettings;
  requiredStealPrice: number;
  crowdPercent?: number;
}): CheckoutQuoteContext {
  return {
    quotedAt: now.toISOString(),
    quotedActiveSlotId: activeSlot?.id || null,
    quotedActiveCreatedAt: parseDate(activeSlot?.createdAt)?.toISOString() || null,
    quotedActiveBidCents: toAmountCents(activeSlot?.currentBid || 0),
    quotedBasePriceCents: toAmountCents(getBasePrice(now, pricingSettings)),
    quotedStealPriceCents: toAmountCents(requiredStealPrice),
    quotedCrowdPercent: crowdPercent,
    quotedCurrency: 'usd',
  };
}

export function buildCheckoutMetadata({
  targetUrl,
  displayName,
  expiresAt,
  quote,
}: {
  targetUrl: string;
  displayName: string;
  expiresAt: string;
  quote: CheckoutQuoteContext;
}) {
  return {
    targeturl: targetUrl,
    displayname: displayName,
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
    quotecrowdpercent: String(quote.quotedCrowdPercent),
    quotelockminutes: String(QUOTE_LOCK_MINUTES),
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
  const quotedAt = parseDate(metadata.quotecreatedat)?.toISOString();
  const quotedCurrency = String(metadata.currency || metadata.quotecurrency || '').toLowerCase();

  if (
    !quotedAt ||
    !quotedCurrency ||
    quotedStealPriceCents == null ||
    quotedBasePriceCents == null
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
    quotedCrowdPercent: Math.max(0, parseInteger(metadata.quotecrowdpercent) ?? 0),
    quotedCurrency,
  };
}

export function validateStripeCheckoutQuote({
  sessionAmountSubtotal,
  sessionCurrency,
  quote,
}: {
  sessionAmountSubtotal: number | null;
  sessionCurrency?: string | null;
  quote: CheckoutQuoteContext | null;
}) {
  if (sessionCurrency?.toLowerCase() !== 'usd') {
    return 'Invalid Stripe session amount.';
  }

  if (sessionAmountSubtotal == null || sessionAmountSubtotal <= 0) {
    return 'Invalid Stripe session subtotal.';
  }

  if (!quote) {
    return 'Missing quoted checkout context.';
  }

  if (quote.quotedCurrency !== 'usd') {
    return 'Invalid quoted currency in Stripe session.';
  }

  if (quote.quotedStealPriceCents !== sessionAmountSubtotal) {
    return 'Stripe amount did not match quoted price.';
  }

  return null;
}

export function calculateQuotedStealPrice({
  quotedActiveBidCents,
  quotedBasePriceCents,
  quotedCrowdPercent = 0,
}: Pick<CheckoutQuoteContext, 'quotedActiveBidCents' | 'quotedBasePriceCents'> &
  Partial<Pick<CheckoutQuoteContext, 'quotedCrowdPercent'>>) {
  if (!quotedActiveBidCents || quotedActiveBidCents <= 0) {
    return quotedBasePriceCents;
  }

  return calculateStealPriceCents(quotedActiveBidCents, quotedCrowdPercent);
}

export function calculateStealPriceFromQuoteInputs({
  currentBidCents,
  quote,
}: {
  currentBidCents: number;
  quote: Pick<CheckoutQuoteContext, 'quotedBasePriceCents'> & Partial<Pick<CheckoutQuoteContext, 'quotedCrowdPercent'>>;
}) {
  if (!currentBidCents || currentBidCents <= 0) {
    return quote.quotedBasePriceCents;
  }

  return calculateStealPriceCents(currentBidCents, quote.quotedCrowdPercent);
}

export function decideCheckoutFulfillment({
  existingSessionCreatedAt,
  currentActiveSlot,
  currentRequiredPriceCents,
  quote,
  now = new Date(),
}: {
  existingSessionCreatedAt?: string | Date | null;
  currentActiveSlot: ActiveSlotSnapshot | null;
  currentRequiredPriceCents?: number | null;
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

  const protectedStage = isSlotProtected(currentActiveSlot, now);

  if (quote.quotedActiveSlotId) {
    if (currentActiveSlot && currentActiveSlot.id !== quote.quotedActiveSlotId) {
      return {
        action: 'defer',
        reason: protectedStage ? 'active_slot_changed_and_protected' : 'active_slot_changed',
        currentActiveSlotId: currentActiveSlot.id,
        quotedActiveSlotId: quote.quotedActiveSlotId,
        isProtected: protectedStage,
      };
    }
  } else if (currentActiveSlot && currentActiveSlot.currentBid > 0) {
    if (!protectedStage && currentRequiredPriceCents != null && quote.quotedStealPriceCents >= currentRequiredPriceCents) {
      return {
        action: 'fulfill',
        currentActiveSlotId: currentActiveSlot.id,
        quotedActiveSlotId: null,
        isProtected: false,
      };
    }

    return {
      action: 'defer',
      reason: protectedStage ? 'active_slot_changed_and_protected' : 'active_slot_missing_quote',
      currentActiveSlotId: currentActiveSlot.id,
      quotedActiveSlotId: null,
      isProtected: protectedStage,
    };
  }

  return {
    action: 'fulfill',
    currentActiveSlotId: currentActiveSlot?.id || null,
    quotedActiveSlotId: quote.quotedActiveSlotId,
    isProtected: protectedStage,
  };
}
