-- ================================================================
-- EXTENSIONS
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 🔥 FIX: CREATE FUNCTION FIRST (NO DO BLOCK)
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 1) PATIENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  date_of_birth DATE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
  medical_history TEXT,
  allergies TEXT,
  emergency_contact VARCHAR(50),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (clinic_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

-- ================================================================
-- 2) APPOINTMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receptionist_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show')),
  chief_complaint TEXT,
  checked_in_by UUID REFERENCES users(id),
  checked_in_time TIMESTAMP WITH TIME ZONE,
  vitals JSONB,
  intake_history JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_time ON appointments(clinic_id, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time ON appointments(doctor_user_id, appointment_time);

-- ================================================================
-- 3) CONSULTATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_user_id UUID NOT NULL REFERENCES users(id),
  diagnosis TEXT,
  treatment_plan TEXT,
  notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- 4) PRESCRIPTIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  consultation_id UUID NOT NULL UNIQUE REFERENCES consultations(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_user_id UUID NOT NULL REFERENCES users(id),
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  quantity INT,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- 5) BILLING
-- ================================================================
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES clinics(id),
  appointment_id UUID UNIQUE REFERENCES appointments(id),
  patient_id UUID REFERENCES patients(id),
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  medicine_cost DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled')),
  payment_method VARCHAR(20)
    CHECK (payment_method IN ('cash', 'upi', 'card', 'other')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT bill_total_match CHECK (total_amount = consultation_fee + medicine_cost)
);

-- ================================================================
-- 6) FOLLOWUPS
-- ================================================================
CREATE TABLE IF NOT EXISTS followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES clinics(id),
  patient_id UUID REFERENCES patients(id),
  doctor_user_id UUID REFERENCES users(id),
  source_consultation_id UUID REFERENCES consultations(id),
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- 🔥 TRIGGERS (NOW SAFE)
-- ================================================================
DROP TRIGGER IF EXISTS trigger_update_patients ON patients;
CREATE TRIGGER trigger_update_patients
BEFORE UPDATE ON patients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_appointments ON appointments;
CREATE TRIGGER trigger_update_appointments
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_consultations ON consultations;
CREATE TRIGGER trigger_update_consultations
BEFORE UPDATE ON consultations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_bills ON bills;
CREATE TRIGGER trigger_update_bills
BEFORE UPDATE ON bills
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_followups ON followups;
CREATE TRIGGER trigger_update_followups
BEFORE UPDATE ON followups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- RLS
-- ================================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;