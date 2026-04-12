-- Presence for portal users (doctor / independent): reception sees online when heartbeat is recent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_portal_heartbeat_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_portal_heartbeat_at IS 'Updated by /api/staff/presence-heartbeat while doctor/independent portal is open.';
