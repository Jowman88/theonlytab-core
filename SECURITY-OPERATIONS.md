# Security and operations configuration

## Database migration requirement

Apply `/migrations/20260928_security_ops.sql` before deploying these changes.  
This migration is additive and creates:

- `pricing_config` (centralized pricing settings)
- `api_rate_limits` (shared request counters for API abuse controls)

## Pricing source of truth

Pricing defaults preserve current behavior:

- Base: `$19`
- Prime windows: `09:00-11:00` and `18:00-20:00`
- Prime base price: `$149`
- Steal price: `max(currentBid * 1.25, currentBid + 10, basePrice)`

`pricing_config` is read-only from the public API surface; no unauthenticated mutation route is exposed.

Optional environment fallbacks:

- `PRICING_BASE_PRICE`
- `PRICING_PRIME_BASE_PRICE`
- `PRICING_STEAL_MULTIPLIER`
- `PRICING_STEAL_FLAT_INCREASE`
- `PRICING_PRIME_WINDOWS_JSON` (JSON array of `{ "startHour": number, "endHour": number }`)

## Streamer safety/sandbox controls

- `STREAM_ALLOWED_ORIGINS` (comma-separated origins, default `*` for public stream compatibility)
- `STREAM_MAX_CONNECTIONS_PER_IP` (default `20`)
- `PUPPETEER_DISABLE_SANDBOX` (default `false`; set `true` only when container/runtime requires it)

If sandbox is disabled, deploy with strict container isolation and minimal runtime privileges.
