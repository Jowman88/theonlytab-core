-- Crowd likes: each like adds 1% to the steal price (max +50%) for 10 minutes.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS slot_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID REFERENCES slots(id) ON DELETE CASCADE,
  voter_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(slot_id, voter_hash)
);

CREATE INDEX IF NOT EXISTS idx_slot_likes_created_at ON slot_likes (slot_id, created_at DESC);
