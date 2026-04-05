-- ================================================================
-- OTP SESSIONS (for OTP-based login)
-- ================================================================

CREATE TABLE IF NOT EXISTS otp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact VARCHAR(255) NOT NULL,
  contact_type VARCHAR(20) NOT NULL CHECK (contact_type IN ('phone', 'email')),
  otp_hash VARCHAR(255) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_attempt_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_otp_sessions_contact ON otp_sessions(contact, contact_type);
CREATE INDEX IF NOT EXISTS idx_otp_sessions_expires_at ON otp_sessions(expires_at);
