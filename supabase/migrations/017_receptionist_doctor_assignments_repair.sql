-- Repair: table missing in some production DBs → PostgREST "Could not find the table ...
-- in the schema cache". Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).

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

ALTER TABLE receptionist_doctor_assignments ENABLE ROW LEVEL SECURITY;

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

-- Existing receptionists → all doctors in same clinic (same as 008 backfill)
INSERT INTO receptionist_doctor_assignments (clinic_id, receptionist_user_id, doctor_user_id)
SELECT r.clinic_id, r.id, d.id
FROM users r
JOIN users d ON d.clinic_id = r.clinic_id AND d.role IN ('doctor', 'independent')
WHERE r.role = 'receptionist' AND r.clinic_id IS NOT NULL
ON CONFLICT (receptionist_user_id, doctor_user_id, clinic_id) DO NOTHING;

-- Refresh PostgREST schema cache (Supabase)
NOTIFY pgrst, 'reload schema';
