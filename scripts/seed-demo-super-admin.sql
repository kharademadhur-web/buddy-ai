-- Manual QA only: run in Supabase SQL Editor (service role / postgres).
-- Creates or updates a demo super-admin so you can log in and test the admin shell.
--
-- Login (Portal or Admin login page — both use /api/auth/login):
--   User ID:  DEMO-SA-1
--   Password: SmartClinic-Test-2026!
--
-- After login, create clinics and clinic-admin users from the UI (Admin → Users / Onboarding).
-- Do NOT run this on production unless you accept a known password.

INSERT INTO users (
  name,
  phone,
  email,
  role,
  clinic_id,
  user_id,
  password_hash,
  is_active
) VALUES (
  'Demo Super Admin',
  '+919999999999',
  'demo-sa@example.com',
  'super-admin',
  NULL,
  'DEMO-SA-1',
  '$2b$10$zVQGN8zjz3V2rip.jCe3JuZMcM/Tuo97LHiSjQkerjb/KpA2m0Dj2',
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  updated_at = now();
