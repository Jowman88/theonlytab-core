import { getDbPool } from './db';
import { DEFAULT_PRICING_SETTINGS, PricingSettings, resolvePricingSettings } from './pricing';

const CONFIG_CACHE_TTL_MS = 60_000;

let cachedSettings: PricingSettings | null = null;
let cacheExpiresAt = 0;

function parseJsonEnv(value?: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getEnvPricingOverrides(): Partial<PricingSettings> {
  return {
    basePrice: process.env.PRICING_BASE_PRICE,
    primeBasePrice: process.env.PRICING_PRIME_BASE_PRICE,
    stealMultiplier: process.env.PRICING_STEAL_MULTIPLIER,
    stealFlatIncrease: process.env.PRICING_STEAL_FLAT_INCREASE,
    primeWindows: parseJsonEnv(process.env.PRICING_PRIME_WINDOWS_JSON),
  };
}

function isMissingTableError(error: any): boolean {
  return error?.code === '42P01';
}

export async function getServerPricingSettings(): Promise<PricingSettings> {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiresAt) {
    return cachedSettings;
  }

  const envFallback = resolvePricingSettings(getEnvPricingOverrides());
  const client = await getDbPool().connect();

  try {
    const result = await client.query(
      `
      SELECT
        base_price,
        prime_base_price,
        steal_multiplier,
        steal_flat_increase,
        prime_windows_json
      FROM pricing_config
      WHERE id = 1
      `
    );

    if (!result.rows?.length) {
      cachedSettings = envFallback;
      cacheExpiresAt = now + CONFIG_CACHE_TTL_MS;
      return cachedSettings;
    }

    const row = result.rows[0];
    cachedSettings = resolvePricingSettings({
      ...DEFAULT_PRICING_SETTINGS,
      ...envFallback,
      basePrice: row.base_price ?? envFallback.basePrice,
      primeBasePrice: row.prime_base_price ?? envFallback.primeBasePrice,
      stealMultiplier: row.steal_multiplier ?? envFallback.stealMultiplier,
      stealFlatIncrease: row.steal_flat_increase ?? envFallback.stealFlatIncrease,
      primeWindows: row.prime_windows_json ?? envFallback.primeWindows,
    });
    cacheExpiresAt = now + CONFIG_CACHE_TTL_MS;
    return cachedSettings;
  } catch (error: any) {
    if (!isMissingTableError(error)) {
      console.warn('Pricing config fallback engaged:', error?.message || error);
    }
    cachedSettings = envFallback;
    cacheExpiresAt = now + CONFIG_CACHE_TTL_MS;
    return cachedSettings;
  } finally {
    client.release();
  }
}
