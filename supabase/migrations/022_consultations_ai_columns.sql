-- Fixes: "Could not find the 'ai_summary' column of 'consultations' in the schema cache"
-- when migration 008 was never applied on a project.

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ai_transcript TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_consent BOOLEAN DEFAULT false;

COMMENT ON COLUMN consultations.ai_transcript IS 'Voice / conversation transcript (doctor-patient), if recorded.';
COMMENT ON COLUMN consultations.ai_summary IS 'Short English phrase / structured summary from transcript.';
COMMENT ON COLUMN consultations.recording_consent IS 'True if clinician consented to capture for documentation.';
