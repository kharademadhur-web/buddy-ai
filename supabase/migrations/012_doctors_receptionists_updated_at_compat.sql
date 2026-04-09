-- Fix: record "new" has no field "updated_at" on UPDATE to doctors/receptionists
-- when the table was created without updated_at but update_updated_at_column() trigger exists.
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

UPDATE doctors
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

UPDATE receptionists
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;
