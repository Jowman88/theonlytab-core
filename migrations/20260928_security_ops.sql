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

ALTER TABLE pricing_config
  ALTER COLUMN id SET DEFAULT 1,
  ALTER COLUMN base_price SET DEFAULT 19.00,
  ALTER COLUMN prime_base_price SET DEFAULT 149.00,
  ALTER COLUMN steal_multiplier SET DEFAULT 1.25,
  ALTER COLUMN steal_flat_increase SET DEFAULT 10.00,
  ALTER COLUMN prime_windows_json SET DEFAULT '[{"startHour":9,"endHour":11},{"startHour":18,"endHour":20}]'::jsonb,
  ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pricing_config_singleton'
      AND conrelid = 'pricing_config'::regclass
  ) THEN
    ALTER TABLE pricing_config
      ADD CONSTRAINT pricing_config_singleton CHECK (id = 1);
  END IF;
END $$;

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

ALTER TABLE api_rate_limits
  ALTER COLUMN request_count SET DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at
  ON api_rate_limits (expires_at);
