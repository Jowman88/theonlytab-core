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
- `TRUST_PROXY_HEADERS` (default `false`; set `true` only when behind a trusted reverse proxy)
- `PUPPETEER_DISABLE_SANDBOX` (default `false`; set `true` only when container/runtime requires it)

If sandbox is disabled, deploy with strict container isolation and minimal runtime privileges.

## Payment flow regression checks

Run the focused payment scenarios with:

- `npm run test:payments`

Successful output ends with all payment-flow tests passing, covering duplicate delivery, delayed delivery, stale context, and lock-window enforcement scenarios.

## Optional log forwarding

- `LOG_FORWARD_URL` can point at a webhook collector or alerting bridge for structured operational events.
- Leave `LOG_FORWARD_URL` empty to keep logs on stdout/stderr only.
