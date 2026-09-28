-- ENABLE EXTENSIONS FOR UUID GENERATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS system_reports CASCADE;
DROP TABLE IF EXISTS slots CASCADE;
DROP TABLE IF EXISTS bid_history CASCADE;

-- TRACKS THE ACTIVE BILLBOARD SLOT STATE
CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    current_url TEXT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    current_bid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    seconds_purchased INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    buyer_x_handle VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    payment_intent_id VARCHAR(255) UNIQUE,
    purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    steal_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    report_count INTEGER NOT NULL DEFAULT 0,
    stripe_session_id TEXT UNIQUE
);

-- CENTRALIZED PRICING CONFIGURATION (ADMIN-MANAGED VIA DATABASE/ENV)
CREATE TABLE pricing_config (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 19.00,
    prime_base_price NUMERIC(10, 2) NOT NULL DEFAULT 149.00,
    steal_multiplier NUMERIC(10, 4) NOT NULL DEFAULT 1.25,
    steal_flat_increase NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    prime_windows_json JSONB NOT NULL DEFAULT '[{"startHour":9,"endHour":11},{"startHour":18,"endHour":20}]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT pricing_config_singleton CHECK (id = 1)
);

INSERT INTO pricing_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- SHARED API RATE LIMIT COUNTERS
CREATE TABLE api_rate_limits (
    bucket TEXT NOT NULL,
    identifier TEXT NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (bucket, identifier, window_start)
);

-- HISTORICAL AUDIT TRAIL FOR DETHRONED AND SLASHED CARDS
CREATE TABLE bid_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    final_bid NUMERIC(10, 2) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    dethroned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    buyer_x_handle VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    was_slashed BOOLEAN NOT NULL DEFAULT FALSE
);

-- UNIQUE TRUST-POOL ANTI-SPAM REPORT REGISTRY
CREATE TABLE system_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_id UUID REFERENCES slots(id) ON DELETE CASCADE,
    reporter_ip_hash VARCHAR(64) NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(slot_id, reporter_ip_hash)
);

-- INDICES FOR OPTIMAL QUERY PERFORMANCE UNDER CONCURRENCY
CREATE INDEX IF NOT EXISTS idx_slots_time_decay ON slots (is_frozen, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at ON api_rate_limits (expires_at);

-- SEED INITIAL BASELINE DEPLOYMENT RECORD
INSERT INTO slots (
    current_url,
    display_name,
    current_bid,
    seconds_purchased,
    started_at,
    created_at,
    expires_at,
    buyer_x_handle,
    purchase_price,
    steal_price,
    report_count,
    stripe_session_id
)
VALUES (
    'https://example.com',
    'The Baseline Center Stage Available',
    0.00,
    315360000,
    NOW(),
    NOW(),
    NOW() + INTERVAL '10 years',
    'theonlytab',
    0.00,
    0.00,
    0,
    NULL
)
ON CONFLICT DO NOTHING;
