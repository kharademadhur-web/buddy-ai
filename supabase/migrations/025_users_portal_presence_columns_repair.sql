-- Repair portal presence columns required for doctor online/offline status.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_portal_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_accepting_patients BOOLEAN;

ALTER TABLE users
  ALTER COLUMN portal_accepting_patients SET DEFAULT true;

UPDATE users
SET portal_accepting_patients = true
WHERE portal_accepting_patients IS NULL
  AND role IN ('doctor', 'independent');
