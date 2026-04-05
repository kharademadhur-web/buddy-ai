-- Documents (uploads metadata)
-- Stores metadata for files saved in Supabase Storage (e.g. diagnostic reports).

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NULL REFERENCES clinics(id) ON DELETE SET NULL,
  patient_id UUID NULL REFERENCES patients(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  document_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_clinic_id ON documents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_patient_id ON documents(patient_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_bucket_path ON documents(bucket, path);

-- Enable RLS (policies should be tightened per your auth model)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Note: Policies are defined in 004_add_rls_policies.sql

