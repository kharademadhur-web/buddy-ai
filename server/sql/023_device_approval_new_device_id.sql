-- Keep in sync with: supabase/migrations/023_device_approval_new_device_id.sql

ALTER TABLE device_approval_requests
  ADD COLUMN IF NOT EXISTS new_device_id VARCHAR(255);

UPDATE device_approval_requests
SET new_device_id = 'legacy-pending-review'
WHERE new_device_id IS NULL OR TRIM(new_device_id) = '';

CREATE INDEX IF NOT EXISTS idx_device_approval_new_device_id ON device_approval_requests(new_device_id);
