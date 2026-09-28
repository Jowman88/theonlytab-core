-- Additive migration for pricing configuration and shared rate limiting support.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS pricing_config (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  base_price NUMERIC(10, 2) NOT NULL DEFAULT 19.00,
  prime_base_price NUMERIC(10, 2) NOT NULL DEFAULT 149.00,
  steal_multiplier NUMERIC(10, 4) NOT NULL DEFAULT 1.25,
  steal_flat_increase NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  prime_windows_json JSONB NOT NULL DEFAULT '[{"startHour":9,"endHour":11},{"startHour":18,"endHour":20}]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_config_singleton CHECK (id = 1)
);

INSERT INTO pricing_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (bucket, identifier, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at
  ON api_rate_limits (expires_at);
