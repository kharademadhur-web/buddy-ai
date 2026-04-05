-- ================================================================
-- FIX: avoid conflict with Supabase/PostgREST `role` claim
-- - In Supabase, JWT claim `role` determines the *database role* (usually 'authenticated')
-- - Our app RBAC role must live in a different claim key
--
-- This migration updates helper functions so they read:
--   - app_role (for app RBAC)
--   - clinicId, userId (for tenancy)
-- ================================================================

create schema if not exists app;

create or replace function app.jwt_claim(claim_key text)
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> claim_key, '');
$$;

create or replace function app.current_role()
returns text
language sql
stable
as $$
  select app.jwt_claim('app_role');
$$;

create or replace function app.current_clinic_id()
returns uuid
language sql
stable
as $$
  select nullif(app.jwt_claim('clinicId'), '')::uuid;
$$;

create or replace function app.current_app_user_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(app.jwt_claim('userId'), '')::uuid,
    nullif(app.jwt_claim('sub'), '')::uuid,
    auth.uid()
  );
$$;

create or replace function app.is_super_admin()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'super-admin';
$$;

create or replace function app.is_clinic_admin()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'clinic-admin';
$$;

create or replace function app.is_clinic_staff()
returns boolean
language sql
stable
as $$
  select app.current_role() in ('clinic-admin', 'doctor', 'receptionist');
$$;

