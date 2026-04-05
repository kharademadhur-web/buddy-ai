-- Ensure doctor KYC storage columns exist (idempotent; fixes PostgREST "column not in schema cache")
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS pan_encrypted VARCHAR(255),
  ADD COLUMN IF NOT EXISTS aadhaar_encrypted VARCHAR(255),
  ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500);

-- Optional URL-style columns used by some deployments / admin attach flow
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS pan_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS aadhaar_url VARCHAR(500);
