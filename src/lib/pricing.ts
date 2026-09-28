export interface PrimeBlockWindow {
  startHour: number;
  endHour: number;
}

export interface PricingSettings {
  basePrice: number;
  primeBasePrice: number;
  stealFlatIncrease: number;
  stealMultiplier: number;
  primeWindows: PrimeBlockWindow[];
}

export const DEFAULT_BASE_PRICE = 19;
export const DEFAULT_PRIME_BASE_PRICE = 149;
export const DEFAULT_STEAL_FLAT_INCREASE = 10;
export const DEFAULT_STEAL_MULTIPLIER = 1.25;

export const PRIME_BLOCK_WINDOWS: PrimeBlockWindow[] = [
  { startHour: 9, endHour: 11 },
  { startHour: 18, endHour: 20 },
];

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  basePrice: DEFAULT_BASE_PRICE,
  primeBasePrice: DEFAULT_PRIME_BASE_PRICE,
  stealFlatIncrease: DEFAULT_STEAL_FLAT_INCREASE,
  stealMultiplier: DEFAULT_STEAL_MULTIPLIER,
  primeWindows: PRIME_BLOCK_WINDOWS,
};

function parseNumeric(value: unknown, fallback: number): number {
  const numeric = Number.parseFloat(String(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function normalizePrimeWindow(window: any): PrimeBlockWindow | null {
  if (!window || typeof window !== 'object') return null;
  const startHour = Number.parseInt(String(window.startHour), 10);
  const endHour = Number.parseInt(String(window.endHour), 10);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null;
  if (startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24 || endHour <= startHour) return null;
  return { startHour, endHour };
}

function parsePrimeWindows(raw: unknown, fallback: PrimeBlockWindow[]): PrimeBlockWindow[] {
  if (!raw) return fallback;

  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  if (!Array.isArray(candidate)) return fallback;

  const windows = candidate
    .map((entry) => normalizePrimeWindow(entry))
    .filter((entry): entry is PrimeBlockWindow => Boolean(entry));

  return windows.length > 0 ? windows : fallback;
}

export function resolvePricingSettings(partialSettings?: Partial<PricingSettings>): PricingSettings {
  const fallback = DEFAULT_PRICING_SETTINGS;
  const merged = partialSettings || {};

  return {
    basePrice: parseNumeric(merged.basePrice, fallback.basePrice),
    primeBasePrice: parseNumeric(merged.primeBasePrice, fallback.primeBasePrice),
    stealFlatIncrease: parseNumeric(merged.stealFlatIncrease, fallback.stealFlatIncrease),
    stealMultiplier: parseNumeric(merged.stealMultiplier, fallback.stealMultiplier),
    primeWindows: parsePrimeWindows(merged.primeWindows, fallback.primeWindows),
  };
}

function isPrimeBlock(now: Date, settings: PricingSettings): boolean {
  const hour = now.getHours();
  return settings.primeWindows.some(({ startHour, endHour }) => hour >= startHour && hour < endHour);
}

export function getBasePrice(now = new Date(), settings: PricingSettings = DEFAULT_PRICING_SETTINGS): number {
  const resolvedSettings = resolvePricingSettings(settings);
  return isPrimeBlock(now, resolvedSettings) ? resolvedSettings.primeBasePrice : resolvedSettings.basePrice;
}

export function calculateStealPrice(
  currentBid: number | string = 0,
  now = new Date(),
  settings: PricingSettings = DEFAULT_PRICING_SETTINGS
): number {
  const numericBid = Number(currentBid || 0);
  const resolvedSettings = resolvePricingSettings(settings);
  const basePrice = getBasePrice(now, resolvedSettings);

  const stealPrice = Math.max(
    numericBid * resolvedSettings.stealMultiplier,
    numericBid + resolvedSettings.stealFlatIncrease,
    basePrice
  );

  return Number(stealPrice.toFixed(2));
}

export function getPrimeBlockStatus(
  now = new Date(),
  settings: PricingSettings = DEFAULT_PRICING_SETTINGS
): { active: boolean; basePrice: number } {
  const resolvedSettings = resolvePricingSettings(settings);
  const basePrice = getBasePrice(now, resolvedSettings);
  const active = isPrimeBlock(now, resolvedSettings);
  return { active, basePrice };
}
