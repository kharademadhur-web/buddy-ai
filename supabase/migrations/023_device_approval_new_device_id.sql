-- Repair: "column device_approval_requests.new_device_id does not exist"
-- Older DBs may have created device_approval_requests without this column.

ALTER TABLE device_approval_requests
  ADD COLUMN IF NOT EXISTS new_device_id VARCHAR(255);

-- Rows that had NULL after ADD COLUMN: placeholder so NOT NULL app inserts still make sense
UPDATE device_approval_requests
SET new_device_id = 'legacy-pending-review'
WHERE new_device_id IS NULL OR TRIM(new_device_id) = '';

COMMENT ON COLUMN device_approval_requests.new_device_id IS 'Device fingerprint requesting access; approved into users.approved_device_id.';

CREATE INDEX IF NOT EXISTS idx_device_approval_new_device_id ON device_approval_requests(new_device_id);
