-- Single JSON column for KYC storage paths (works even when legacy *_encrypted columns are missing)
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS kyc_documents JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN doctors.kyc_documents IS 'Storage paths: panPath, aadhaarPath, signaturePath (kyc-documents bucket)';
