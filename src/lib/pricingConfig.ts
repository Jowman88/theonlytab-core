import { getDbPool } from './db';
import { DEFAULT_PRICING_SETTINGS, PricingSettings, resolvePricingSettings } from './pricing';

const CONFIG_CACHE_TTL_MS = 60_000;
const DB_RETRY_BACKOFF_MS = 5 * 60_000;

let cachedSettings: PricingSettings | null = null;
let cacheExpiresAt = 0;
let dbRetryAfter = 0;

function getEnvPricingOverrides(): Record<string, unknown> {
  return {
    basePrice: process.env.PRICING_BASE_PRICE,
  };
}

function isMissingTableError(error: any): boolean {
  return error?.code === '42P01';
}

/**
 * NOTE: The `pricing_config` table still carries legacy
 * `prime_base_price` / `steal_multiplier` / `steal_flat_increase` /
 * `prime_windows_json` columns from the old prime-time pricing model.
 * They are intentionally left in the schema for backward compatibility
 * with existing database records, but are no longer read or used by the
 * current "double per steal, capped at $299" pricing calculation below.
 */
export async function getServerPricingSettings(): Promise<PricingSettings> {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiresAt) {
    return cachedSettings;
  }

  const envFallback = resolvePricingSettings(getEnvPricingOverrides() as Partial<PricingSettings>);
  if (now < dbRetryAfter) {
    cachedSettings = envFallback;
    cacheExpiresAt = now + CONFIG_CACHE_TTL_MS;
    return cachedSettings;
  }

  const client = await getDbPool().connect();

  try {
    const result = await client.query(
      `
      SELECT
        base_price
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
    });
    dbRetryAfter = 0;
    cacheExpiresAt = now + CONFIG_CACHE_TTL_MS;
    return cachedSettings;
  } catch (error: any) {
    if (!isMissingTableError(error)) {
      console.warn('Pricing config fallback engaged:', error?.message || error);
    }
    dbRetryAfter = now + DB_RETRY_BACKOFF_MS;
    cachedSettings = envFallback;
    cacheExpiresAt = now + CONFIG_CACHE_TTL_MS;
    return cachedSettings;
  } finally {
    client.release();
  }
}
