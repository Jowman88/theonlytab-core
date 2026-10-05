export interface PricingSettings {
  basePrice: number;
}

export const DEFAULT_BASE_PRICE = 19;
export const STEAL_PRICE_CAP = 299;
export const LIKE_STEP_PERCENT = 1;
export const MAX_CROWD_PERCENT = 50;
export const LIKE_WINDOW_MINUTES = 10;
export const LONG_IDLE_RESET_MINUTES = 120;

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  basePrice: DEFAULT_BASE_PRICE,
};

function parseNumeric(value: unknown, fallback: number): number {
  const numeric = Number.parseFloat(String(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

export function resolvePricingSettings(partialSettings?: Partial<PricingSettings>): PricingSettings {
  const fallback = DEFAULT_PRICING_SETTINGS;
  const merged = partialSettings || {};

  return {
    basePrice: parseNumeric(merged.basePrice, fallback.basePrice),
  };
}

/**
 * Pricing model: "Doubles per steal, capped at $299, daily reset"
 * - Base price (idle/house-default): $19
 * - Steal price: min(currentBid * 2, $299) -- always exactly double, never more than $299
 * - Once price reaches $299, stealing costs exactly $299 (flat, no further doubling)
 * - No idle decay: price stays locked at its current value until a reset triggers
 */
export function getCrowdPercent(activeLikes: number | string = 0): number {
  const likes = Math.floor(Number(activeLikes));
  if (!Number.isFinite(likes) || likes <= 0) return 0;
  return Math.min(MAX_CROWD_PERCENT, likes * LIKE_STEP_PERCENT);
}

/** Doubles the current bid, applies the crowd multiplier first, then caps at $299. */
export function calculateStealPriceCents(currentBidCents: number, crowdPercent = 0): number {
  const percent = Math.min(MAX_CROWD_PERCENT, Math.max(0, Math.floor(crowdPercent) || 0));
  return Math.min(Math.round((currentBidCents * 2 * (100 + percent)) / 100), STEAL_PRICE_CAP * 100);
}

export function calculateStealPrice(
  currentBid: number | string = 0,
  _now = new Date(),
  settings: PricingSettings = DEFAULT_PRICING_SETTINGS,
  activeLikes: number | string = 0
): number {
  const numericBid = Number(currentBid || 0);
  const resolvedSettings = resolvePricingSettings(settings);

  if (!Number.isFinite(numericBid) || numericBid <= 0) {
    return resolvedSettings.basePrice;
  }

  return calculateStealPriceCents(Math.round(numericBid * 100), getCrowdPercent(activeLikes)) / 100;
}

export function getBasePrice(_now = new Date(), settings: PricingSettings = DEFAULT_PRICING_SETTINGS): number {
  return resolvePricingSettings(settings).basePrice;
}

/**
 * @deprecated Prime-time/peak pricing windows were removed in favor of the
 * flat doubling-to-cap model. This is kept for backward compatibility with
 * any callers that still reference it; it always reports inactive.
 */
export function getPrimeBlockStatus(
  now = new Date(),
  settings: PricingSettings = DEFAULT_PRICING_SETTINGS
): { active: boolean; basePrice: number } {
  return { active: false, basePrice: getBasePrice(now, settings) };
}

/**
 * Long-idle reset: if a slot has had zero steal activity for 2+ hours,
 * the price should snap back to the base price immediately (rather than
 * waiting for the next daily reset). Returns whether that reset should
 * trigger given the timestamp of the last activity on the slot.
 */
export function getResetTime(
  lastActivityTimestamp: Date | string | number | null | undefined,
  now = new Date()
): { shouldReset: boolean; idleMinutes: number } {
  if (!lastActivityTimestamp) {
    return { shouldReset: true, idleMinutes: Number.POSITIVE_INFINITY };
  }

  const lastActivity =
    lastActivityTimestamp instanceof Date ? lastActivityTimestamp : new Date(lastActivityTimestamp);

  if (Number.isNaN(lastActivity.getTime())) {
    return { shouldReset: true, idleMinutes: Number.POSITIVE_INFINITY };
  }

  const idleMinutes = Math.max(0, (now.getTime() - lastActivity.getTime()) / 60_000);
  return { shouldReset: idleMinutes >= LONG_IDLE_RESET_MINUTES, idleMinutes };
}
