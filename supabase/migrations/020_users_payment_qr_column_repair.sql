-- Repair: "Could not find the 'payment_qr_storage_path' column of 'users' in the schema cache"
-- Apply on databases where 008 was not run. Safe to re-run (IF NOT EXISTS).

ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_qr_storage_path TEXT;

COMMENT ON COLUMN users.payment_qr_storage_path IS 'Optional personal UPI QR in clinic-assets bucket; /api/staff/me/payment-qr';
