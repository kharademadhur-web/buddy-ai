-- ================================================================
-- Mobile / tablet workflow: caps, letterhead, QR, assignments,
-- vitals history, consultation workflow, drug formulary stub
-- ================================================================

-- ----------------------------------------------------------------
-- Clinics: staff caps + asset paths (Supabase Storage keys)
-- ----------------------------------------------------------------
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS max_doctors INT,
  ADD COLUMN IF NOT EXISTS max_receptionists INT,
  ADD COLUMN IF NOT EXISTS letterhead_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS letterhead_mime VARCHAR(100),
  ADD COLUMN IF NOT EXISTS letterhead_field_map JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_qr_storage_path TEXT;

COMMENT ON COLUMN clinics.max_doctors IS 'NULL = no cap';
COMMENT ON COLUMN clinics.max_receptionists IS 'NULL = no cap';
COMMENT ON COLUMN clinics.letterhead_field_map IS 'Overlay positions for name, age, phone, vitals (% or px)';

-- ----------------------------------------------------------------
-- Users: optional per-doctor payment QR
-- ----------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_qr_storage_path TEXT;

-- ----------------------------------------------------------------
-- Receptionist <-> Doctor (same clinic only)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receptionist_doctor_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  receptionist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (receptionist_user_id, doctor_user_id, clinic_id),
  CONSTRAINT rda_same_clinic CHECK (
    EXISTS (
      SELECT 1 FROM users r
      JOIN users d ON d.id = receptionist_doctor_assignments.doctor_user_id
      WHERE r.id = receptionist_doctor_assignments.receptionist_user_id
        AND r.clinic_id = receptionist_doctor_assignments.clinic_id
        AND d.clinic_id = receptionist_doctor_assignments.clinic_id
    )
  )
);

-- FK self-reference issue: PostgreSQL may reject CHECK with subquery on same row.
-- Use simpler enforcement via trigger or app; replace CHECK with NOT VALID or drop.
ALTER TABLE receptionist_doctor_assignments DROP CONSTRAINT IF EXISTS rda_same_clinic;

CREATE INDEX IF NOT EXISTS idx_rda_receptionist ON receptionist_doctor_assignments(receptionist_user_id);
CREATE INDEX IF NOT EXISTS idx_rda_doctor ON receptionist_doctor_assignments(doctor_user_id);
CREATE INDEX IF NOT EXISTS idx_rda_clinic ON receptionist_doctor_assignments(clinic_id);

-- ----------------------------------------------------------------
-- Patient vitals history (letterhead auto-fill + audit)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bp_systolic INT,
  bp_diastolic INT,
  heart_rate INT,
  temperature_c NUMERIC(4,1),
  weight_kg NUMERIC(6,2),
  spo2 INT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient ON patient_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_clinic ON patient_vitals(clinic_id);

-- ----------------------------------------------------------------
-- Consultations: workflow + AI + handwriting metadata
-- ----------------------------------------------------------------
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(40) DEFAULT 'draft_rx'
    CHECK (workflow_status IS NULL OR workflow_status IN (
      'draft_rx', 'submitted_awaiting_payment', 'paid', 'cancelled'
    )),
  ADD COLUMN IF NOT EXISTS handwriting_strokes JSONB,
  ADD COLUMN IF NOT EXISTS handwriting_image_path TEXT,
  ADD COLUMN IF NOT EXISTS ai_transcript TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS structured_prescription JSONB,
  ADD COLUMN IF NOT EXISTS recording_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_notified_at TIMESTAMPTZ;

-- ----------------------------------------------------------------
-- Drug formulary stub (national / clinic allowlist later)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drug_formulary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(64),
  name VARCHAR(255) NOT NULL,
  strength VARCHAR(100),
  form VARCHAR(50),
  atc_code VARCHAR(20),
  regulatory_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drug_formulary_name ON drug_formulary(name);
CREATE INDEX IF NOT EXISTS idx_drug_formulary_active ON drug_formulary(is_active) WHERE is_active = true;

INSERT INTO drug_formulary (code, name, strength, form, atc_code)
SELECT 'PAR500', 'Paracetamol', '500mg', 'tablet', 'N02BE01'
WHERE NOT EXISTS (SELECT 1 FROM drug_formulary WHERE code = 'PAR500');
INSERT INTO drug_formulary (code, name, strength, form, atc_code)
SELECT 'AMX500', 'Amoxicillin', '500mg', 'capsule', 'J01CA04'
WHERE NOT EXISTS (SELECT 1 FROM drug_formulary WHERE code = 'AMX500');
INSERT INTO drug_formulary (code, name, strength, form, atc_code)
SELECT 'IBU400', 'Ibuprofen', '400mg', 'tablet', 'M01AE01'
WHERE NOT EXISTS (SELECT 1 FROM drug_formulary WHERE code = 'IBU400');

-- ----------------------------------------------------------------
-- Bills: optional created_by (API already sends it)
-- ----------------------------------------------------------------
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------
-- Backfill: each existing receptionist assigned to all clinic doctors
-- ----------------------------------------------------------------
INSERT INTO receptionist_doctor_assignments (clinic_id, receptionist_user_id, doctor_user_id)
SELECT r.clinic_id, r.id, d.id
FROM users r
JOIN users d ON d.clinic_id = r.clinic_id AND d.role IN ('doctor', 'independent')
WHERE r.role = 'receptionist' AND r.clinic_id IS NOT NULL
ON CONFLICT (receptionist_user_id, doctor_user_id, clinic_id) DO NOTHING;

-- ----------------------------------------------------------------
-- Helpers (must exist before RLS policies that reference them)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.receptionist_patient_allowed(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = p_patient_id AND p.clinic_id = app.current_clinic_id()
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.patient_id = p_patient_id AND a.clinic_id = app.current_clinic_id()
      )
      OR EXISTS (
        SELECT 1 FROM appointments a
        JOIN receptionist_doctor_assignments rda
          ON rda.doctor_user_id = a.doctor_user_id
         AND rda.receptionist_user_id = app.current_app_user_id()
         AND rda.clinic_id = app.current_clinic_id()
        WHERE a.patient_id = p_patient_id
          AND a.clinic_id = app.current_clinic_id()
      )
    );
$$;

CREATE OR REPLACE FUNCTION app.receptionist_appointment_allowed(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN app.current_role() IS DISTINCT FROM 'receptionist' THEN true
    WHEN app.current_clinic_id() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM appointments a
      JOIN receptionist_doctor_assignments rda
        ON rda.doctor_user_id = a.doctor_user_id
       AND rda.receptionist_user_id = app.current_app_user_id()
       AND rda.clinic_id = app.current_clinic_id()
      WHERE a.id = p_appointment_id
        AND a.clinic_id = app.current_clinic_id()
    )
  END;
$$;

-- ----------------------------------------------------------------
-- RLS: new tables
-- ----------------------------------------------------------------
ALTER TABLE receptionist_doctor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_formulary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rda: service role" ON receptionist_doctor_assignments;
CREATE POLICY "rda: service role" ON receptionist_doctor_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rda: super admin" ON receptionist_doctor_assignments;
CREATE POLICY "rda: super admin" ON receptionist_doctor_assignments
  FOR ALL TO authenticated
  USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

DROP POLICY IF EXISTS "rda: clinic staff read own clinic" ON receptionist_doctor_assignments;
CREATE POLICY "rda: clinic staff read own clinic" ON receptionist_doctor_assignments
  FOR SELECT TO authenticated
  USING (
    app.is_clinic_staff()
    AND receptionist_doctor_assignments.clinic_id = app.current_clinic_id()
  );

DROP POLICY IF EXISTS "pvitals: service role" ON patient_vitals;
CREATE POLICY "pvitals: service role" ON patient_vitals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pvitals: super admin" ON patient_vitals;
CREATE POLICY "pvitals: super admin" ON patient_vitals
  FOR ALL TO authenticated
  USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

DROP POLICY IF EXISTS "pvitals: clinic staff own clinic" ON patient_vitals;

CREATE POLICY "pvitals: clinic staff non-reception" ON patient_vitals
  FOR ALL TO authenticated
  USING (
    app.is_clinic_staff()
    AND patient_vitals.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  )
  WITH CHECK (
    app.is_clinic_staff()
    AND patient_vitals.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  );

CREATE POLICY "pvitals: receptionist scoped" ON patient_vitals
  FOR ALL TO authenticated
  USING (
    app.current_role() = 'receptionist'
    AND patient_vitals.clinic_id = app.current_clinic_id()
    AND app.receptionist_patient_allowed(patient_vitals.patient_id)
  )
  WITH CHECK (
    app.current_role() = 'receptionist'
    AND patient_vitals.clinic_id = app.current_clinic_id()
    AND app.receptionist_patient_allowed(patient_vitals.patient_id)
  );

DROP POLICY IF EXISTS "drug: service role" ON drug_formulary;
CREATE POLICY "drug: service role" ON drug_formulary
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "drug: read authenticated" ON drug_formulary;
CREATE POLICY "drug: read authenticated" ON drug_formulary
  FOR SELECT TO authenticated
  USING (coalesce(is_active, true) = true);

-- Tighten patients policy for receptionists (drop broad clinic staff policy and split)
DROP POLICY IF EXISTS "patients: clinic staff access own clinic" ON patients;

CREATE POLICY "patients: clinic staff non-reception" ON patients
  FOR ALL TO authenticated
  USING (
    app.is_clinic_staff()
    AND patients.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  )
  WITH CHECK (
    app.is_clinic_staff()
    AND patients.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  );

CREATE POLICY "patients: receptionist scoped" ON patients
  FOR ALL TO authenticated
  USING (
    app.current_role() = 'receptionist'
    AND patients.clinic_id = app.current_clinic_id()
    AND app.receptionist_patient_allowed(patients.id)
  )
  WITH CHECK (
    app.current_role() = 'receptionist'
    AND patients.clinic_id = app.current_clinic_id()
    AND app.receptionist_patient_allowed(patients.id)
  );

-- Appointments: add receptionist-scoped policy (drop old broad one first)
DROP POLICY IF EXISTS "appointments: clinic staff access own clinic" ON appointments;

CREATE POLICY "appointments: clinic staff non-reception" ON appointments
  FOR ALL TO authenticated
  USING (
    app.is_clinic_staff()
    AND appointments.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  )
  WITH CHECK (
    app.is_clinic_staff()
    AND appointments.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  );

CREATE POLICY "appointments: receptionist scoped" ON appointments
  FOR ALL TO authenticated
  USING (
    app.current_role() = 'receptionist'
    AND appointments.clinic_id = app.current_clinic_id()
    AND app.receptionist_appointment_allowed(appointments.id)
  )
  WITH CHECK (
    app.current_role() = 'receptionist'
    AND appointments.clinic_id = app.current_clinic_id()
    AND EXISTS (
      SELECT 1 FROM receptionist_doctor_assignments rda
      WHERE rda.receptionist_user_id = app.current_app_user_id()
        AND rda.doctor_user_id = appointments.doctor_user_id
        AND rda.clinic_id = appointments.clinic_id
    )
  );

-- ----------------------------------------------------------------
-- Consultations / prescriptions / bills: split receptionist scope
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "consultations: clinic staff access own clinic" ON consultations;

CREATE POLICY "consultations: clinic staff non-reception" ON consultations
  FOR ALL TO authenticated
  USING (
    app.is_clinic_staff()
    AND consultations.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  )
  WITH CHECK (
    app.is_clinic_staff()
    AND consultations.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  );

CREATE POLICY "consultations: receptionist scoped" ON consultations
  FOR SELECT TO authenticated
  USING (
    app.current_role() = 'receptionist'
    AND consultations.clinic_id = app.current_clinic_id()
    AND EXISTS (
      SELECT 1 FROM appointments a
      JOIN receptionist_doctor_assignments rda
        ON rda.doctor_user_id = a.doctor_user_id
       AND rda.receptionist_user_id = app.current_app_user_id()
       AND rda.clinic_id = app.current_clinic_id()
      WHERE a.id = consultations.appointment_id
    )
  );

DROP POLICY IF EXISTS "prescriptions: clinic staff access own clinic" ON prescriptions;

CREATE POLICY "prescriptions: clinic staff non-reception" ON prescriptions
  FOR ALL TO authenticated
  USING (
    app.is_clinic_staff()
    AND prescriptions.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  )
  WITH CHECK (
    app.is_clinic_staff()
    AND prescriptions.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  );

CREATE POLICY "prescriptions: receptionist read scoped" ON prescriptions
  FOR SELECT TO authenticated
  USING (
    app.current_role() = 'receptionist'
    AND prescriptions.clinic_id = app.current_clinic_id()
    AND EXISTS (
      SELECT 1 FROM consultations c
      JOIN appointments a ON a.id = c.appointment_id
      JOIN receptionist_doctor_assignments rda
        ON rda.doctor_user_id = a.doctor_user_id
       AND rda.receptionist_user_id = app.current_app_user_id()
       AND rda.clinic_id = app.current_clinic_id()
      WHERE c.id = prescriptions.consultation_id
    )
  );

DROP POLICY IF EXISTS "prescription_items: clinic staff via prescription clinic" ON prescription_items;

CREATE POLICY "prescription_items: clinic staff non-reception" ON prescription_items
  FOR ALL TO authenticated
  USING (
    app.is_clinic_staff()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
    AND EXISTS (
      SELECT 1 FROM prescriptions p
      WHERE p.id = prescription_items.prescription_id
        AND p.clinic_id = app.current_clinic_id()
    )
  )
  WITH CHECK (
    app.is_clinic_staff()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
    AND EXISTS (
      SELECT 1 FROM prescriptions p
      WHERE p.id = prescription_items.prescription_id
        AND p.clinic_id = app.current_clinic_id()
    )
  );

CREATE POLICY "prescription_items: receptionist read scoped" ON prescription_items
  FOR SELECT TO authenticated
  USING (
    app.current_role() = 'receptionist'
    AND EXISTS (
      SELECT 1 FROM prescriptions pr
      JOIN consultations c ON c.id = pr.consultation_id
      JOIN appointments a ON a.id = c.appointment_id
      JOIN receptionist_doctor_assignments rda
        ON rda.doctor_user_id = a.doctor_user_id
       AND rda.receptionist_user_id = app.current_app_user_id()
       AND rda.clinic_id = app.current_clinic_id()
      WHERE pr.id = prescription_items.prescription_id
        AND pr.clinic_id = app.current_clinic_id()
    )
  );

DROP POLICY IF EXISTS "bills: clinic staff access own clinic" ON bills;

CREATE POLICY "bills: clinic staff non-reception" ON bills
  FOR ALL TO authenticated
  USING (
    app.is_clinic_staff()
    AND bills.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  )
  WITH CHECK (
    app.is_clinic_staff()
    AND bills.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  );

CREATE POLICY "bills: receptionist scoped" ON bills
  FOR ALL TO authenticated
  USING (
    app.current_role() = 'receptionist'
    AND bills.clinic_id = app.current_clinic_id()
    AND (
      bills.appointment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM appointments a
        JOIN receptionist_doctor_assignments rda
          ON rda.doctor_user_id = a.doctor_user_id
         AND rda.receptionist_user_id = app.current_app_user_id()
         AND rda.clinic_id = app.current_clinic_id()
        WHERE a.id = bills.appointment_id
      )
    )
  )
  WITH CHECK (
    app.current_role() = 'receptionist'
    AND bills.clinic_id = app.current_clinic_id()
    AND (
      bills.appointment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM appointments a
        JOIN receptionist_doctor_assignments rda
          ON rda.doctor_user_id = a.doctor_user_id
         AND rda.receptionist_user_id = app.current_app_user_id()
         AND rda.clinic_id = app.current_clinic_id()
        WHERE a.id = bills.appointment_id
      )
    )
  );
