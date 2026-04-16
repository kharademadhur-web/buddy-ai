-- Keep in sync with: supabase/migrations/021_portal_accepting_patients_and_patient_vitals.sql
-- Run in Supabase SQL Editor (or supabase db push) — not executed by Node at runtime.

-- ================================================================
-- 021: Doctor portal availability + patient_vitals
--
-- Idempotent. Includes pieces from 008 when that migration was never
-- applied (missing receptionist_doctor_assignments / helper function).
--
-- Expects: public.clinics, public.users, public.patients, public.appointments
--          and app.* JWT helpers from 004_add_rls_policies.sql
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS app;

-- ----------------------------------------------------------------
-- 1) Users: reception sees "offline" when false (with heartbeat)
-- ----------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_accepting_patients BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN users.portal_accepting_patients IS
  'When false, reception sees doctor as offline. Combined with last_portal_heartbeat_at for online.';

-- ----------------------------------------------------------------
-- 2) Receptionist <-> doctor assignments (needed for RLS helper)
--    Same shape as 008_mobile_clinic_workflow.sql
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receptionist_doctor_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  receptionist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (receptionist_user_id, doctor_user_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_rda_receptionist ON receptionist_doctor_assignments(receptionist_user_id);
CREATE INDEX IF NOT EXISTS idx_rda_doctor ON receptionist_doctor_assignments(doctor_user_id);
CREATE INDEX IF NOT EXISTS idx_rda_clinic ON receptionist_doctor_assignments(clinic_id);

INSERT INTO receptionist_doctor_assignments (clinic_id, receptionist_user_id, doctor_user_id)
SELECT r.clinic_id, r.id, d.id
FROM users r
JOIN users d ON d.clinic_id = r.clinic_id AND d.role IN ('doctor', 'independent')
WHERE r.role = 'receptionist' AND r.clinic_id IS NOT NULL
ON CONFLICT (receptionist_user_id, doctor_user_id, clinic_id) DO NOTHING;

-- ----------------------------------------------------------------
-- 3) Helper: receptionist may only touch patients/appointments in scope
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

GRANT EXECUTE ON FUNCTION app.receptionist_patient_allowed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.receptionist_patient_allowed(uuid) TO service_role;

-- ----------------------------------------------------------------
-- 4) patient_vitals
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

ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 5) RLS policies (match 008 naming so DROP IF EXISTS is stable)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "pvitals: service role" ON patient_vitals;
CREATE POLICY "pvitals: service role" ON patient_vitals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pvitals: super admin" ON patient_vitals;
CREATE POLICY "pvitals: super admin" ON patient_vitals
  FOR ALL TO authenticated
  USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

DROP POLICY IF EXISTS "pvitals: clinic staff own clinic" ON patient_vitals;
DROP POLICY IF EXISTS "pvitals: clinic staff non-reception" ON patient_vitals;
-- Note: do not use app.is_clinic_staff() here — it omits 'independent', which must access vitals.
CREATE POLICY "pvitals: clinic staff non-reception" ON patient_vitals
  FOR ALL TO authenticated
  USING (
    patient_vitals.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  )
  WITH CHECK (
    patient_vitals.clinic_id = app.current_clinic_id()
    AND app.current_role() IN ('clinic-admin', 'doctor', 'independent')
  );

DROP POLICY IF EXISTS "pvitals: receptionist scoped" ON patient_vitals;
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
