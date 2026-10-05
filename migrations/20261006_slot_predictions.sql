-- "Predict the reign" free game: viewers guess how long the current reign lasts.
-- No money involved; rewards are points/badges only. Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS slot_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  voter_hash VARCHAR(64) NOT NULL,
  guess_minutes INTEGER NOT NULL CHECK (guess_minutes BETWEEN 1 AND 90),
  nickname VARCHAR(24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot_id, voter_hash)
);

CREATE INDEX IF NOT EXISTS idx_slot_predictions_slot ON slot_predictions (slot_id);

CREATE TABLE IF NOT EXISTS prediction_results (
  slot_id UUID PRIMARY KEY REFERENCES slots(id) ON DELETE CASCADE,
  actual_minutes NUMERIC(6,2) NOT NULL,
  winner_prediction_id UUID REFERENCES slot_predictions(id),
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prediction_scores (
  voter_hash VARCHAR(64) PRIMARY KEY,
  nickname VARCHAR(24),
  points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
