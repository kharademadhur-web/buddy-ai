-- Keep in sync with: supabase/migrations/022_consultations_ai_columns.sql

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ai_transcript TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_consent BOOLEAN DEFAULT false;
