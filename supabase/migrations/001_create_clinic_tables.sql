-- ================================================================
-- CLINIC SAAS DATABASE SCHEMA
-- Project: bwifzsqclfetsmqqcpud
-- Created: 2024-03-31
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 1. CLINICS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  clinic_code VARCHAR(20) NOT NULL UNIQUE,
  -- Standardized status column name used by the app code
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'pending', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT clinic_code_format CHECK (clinic_code ~ '^[A-Z0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_clinics_code ON clinics(clinic_code);
-- If clinics table already existed with a different column name (e.g. status),
-- create indexes conditionally to avoid "column does not exist" errors.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinics'
      AND column_name = 'subscription_status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinics_subscription_status ON clinics(subscription_status)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinics'
      AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinics_status ON clinics(status)';
  END IF;
END $$;

-- ================================================================
-- 2. USERS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('super-admin', 'clinic-admin', 'doctor', 'receptionist', 'independent')),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  device_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT user_id_format CHECK (user_id ~ '^[A-Z0-9]+-[A-Z]+-[0-9]+$' OR role = 'super-admin'),
  CONSTRAINT non_null_clinic_for_clinic_roles CHECK (
    (role IN ('doctor', 'receptionist') AND clinic_id IS NOT NULL) OR 
    (role IN ('super-admin', 'independent'))
  )
);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ================================================================
-- 3. DOCTORS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(100) NOT NULL UNIQUE,
  aadhaar_encrypted VARCHAR(255),
  pan_encrypted VARCHAR(255),
  signature_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_license ON doctors(license_number);

-- ================================================================
-- 4. RECEPTIONISTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS receptionists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receptionists_user_id ON receptionists(user_id);

-- ================================================================
-- 5. PAYMENTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'failed', 'cancelled')),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_payments_clinic_id ON payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ================================================================
-- 6. COUNTERS TABLE (for user ID generation)
-- ================================================================
CREATE TABLE IF NOT EXISTS counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'receptionist', 'independent')),
  current_count INT DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(clinic_id, role)
);

CREATE INDEX IF NOT EXISTS idx_counters_clinic_id ON counters(clinic_id);
CREATE INDEX IF NOT EXISTS idx_counters_role ON counters(role);

-- ================================================================
-- 7. DEVICE APPROVAL REQUESTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS device_approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_device_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT request_timeline CHECK (
    (status = 'pending' AND approved_at IS NULL AND rejected_at IS NULL) OR
    (status = 'approved' AND approved_at IS NOT NULL AND rejected_at IS NULL) OR
    (status = 'rejected' AND rejected_at IS NOT NULL AND approved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_device_approval_user_id ON device_approval_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_device_approval_status ON device_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_device_approval_created_at ON device_approval_requests(created_at);

-- ================================================================
-- 8. AUDIT LOGS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_role VARCHAR(50),
  resource_type VARCHAR(100),
  resource_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ================================================================
-- ROW LEVEL SECURITY (Optional - Enable for production)
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptionists ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp trigger to tables that have updated_at
CREATE TRIGGER trigger_update_clinics_timestamp
  BEFORE UPDATE ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_users_timestamp
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_doctors_timestamp
  BEFORE UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_receptionists_timestamp
  BEFORE UPDATE ON receptionists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_payments_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_counters_timestamp
  BEFORE UPDATE ON counters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- INITIAL DATA (OPTIONAL)
-- ================================================================

-- Create a test super-admin user (you'll need to set the password)
-- INSERT INTO users (name, email, role, user_id, password_hash, is_active)
-- VALUES ('System Admin', 'admin@estrellx.shop', 'super-admin', 'ADMIN-001', 'HASH_HERE', true);

-- ================================================================
-- NOTES
-- ================================================================
-- 
-- 1. Password hashing should be done in the application layer using bcrypt
-- 2. Aadhaar and PAN should be encrypted using application-level encryption before storing
-- 3. Signature URLs should be signed URLs from Supabase Storage
-- 4. Enable RLS policies after initial setup for production security
-- 5. Regular backups should be configured in Supabase dashboard
--
