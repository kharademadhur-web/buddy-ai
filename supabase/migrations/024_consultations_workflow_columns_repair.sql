-- Ensure consultation workflow columns exist for older environments
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(40),
  ADD COLUMN IF NOT EXISTS payment_notified_at TIMESTAMPTZ;

-- Set a safe default for newly created consultation rows.
ALTER TABLE consultations
  ALTER COLUMN workflow_status SET DEFAULT 'draft_rx';

-- Backfill existing rows that predate workflow tracking.
UPDATE consultations
SET workflow_status = 'draft_rx'
WHERE workflow_status IS NULL;
