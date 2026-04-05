-- ================================================================
-- RLS POLICIES + RBAC HELPERS
-- Purpose:
--  - Enforce clinic/user/data isolation at the DB layer
--  - Standardize role evaluation via JWT claims
--
-- Assumptions:
--  - Requests to Supabase APIs are authenticated with a JWT that includes:
--      - app_role (e.g. 'super-admin', 'clinic-admin', 'doctor', 'receptionist', 'independent')
--      - clinicId (UUID string, for clinic-scoped users)
--      - userId (UUID string of the row in public.users.id)
--    OR Supabase Auth is used (auth.uid() is set), in which case userId/sub is available.
-- ================================================================

-- Ensure schema for helper functions exists
create schema if not exists app;

-- Helper: get JWT claim by key (returns NULL if missing)
create or replace function app.jwt_claim(claim_key text)
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> claim_key, '');
$$;

-- Helper: current role from JWT
create or replace function app.current_role()
returns text
language sql
stable
as $$
  select app.jwt_claim('app_role');
$$;

-- Helper: current clinic_id from JWT
create or replace function app.current_clinic_id()
returns uuid
language sql
stable
as $$
  select nullif(app.jwt_claim('clinicId'), '')::uuid;
$$;

-- Helper: current app user id (public.users.id) from JWT
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

-- Helper: role checks
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

-- ================================================================
-- DOCUMENTS (uploads metadata)
-- ================================================================
alter table if exists documents enable row level security;

drop policy if exists "documents: service role full access" on documents;
create policy "documents: service role full access"
on documents
as permissive
for all
to service_role
using (true)
with check (true);

drop policy if exists "documents: super admin full access" on documents;
create policy "documents: super admin full access"
on documents
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "documents: clinic staff access own clinic" on documents;
create policy "documents: clinic staff access own clinic"
on documents
as permissive
for all
to authenticated
using (
  app.is_clinic_staff()
  and documents.clinic_id is not null
  and documents.clinic_id = app.current_clinic_id()
)
with check (
  app.is_clinic_staff()
  and documents.clinic_id is not null
  and documents.clinic_id = app.current_clinic_id()
);

-- ================================================================
-- OTP SESSIONS: server-only access
-- ================================================================
alter table if exists otp_sessions enable row level security;

drop policy if exists "otp_sessions: service role full access" on otp_sessions;
create policy "otp_sessions: service role full access"
on otp_sessions
as permissive
for all
to service_role
using (true)
with check (true);

-- ================================================================
-- CLINICS
-- ================================================================
drop policy if exists "clinics: super admin can read/write" on clinics;
create policy "clinics: super admin can read/write"
on clinics
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "clinics: clinic staff can read own clinic" on clinics;
create policy "clinics: clinic staff can read own clinic"
on clinics
as permissive
for select
to authenticated
using (app.is_clinic_staff() and clinics.id = app.current_clinic_id());

-- ================================================================
-- USERS
-- ================================================================
drop policy if exists "users: super admin full access" on users;
create policy "users: super admin full access"
on users
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "users: clinic admin manage users in clinic" on users;
create policy "users: clinic admin manage users in clinic"
on users
as permissive
for all
to authenticated
using (app.is_clinic_admin() and users.clinic_id = app.current_clinic_id())
with check (app.is_clinic_admin() and users.clinic_id = app.current_clinic_id());

drop policy if exists "users: users can read/update self" on users;
create policy "users: users can read/update self"
on users
as permissive
for select
to authenticated
using (users.id = app.current_app_user_id());

drop policy if exists "users: users can update self (limited by app)" on users;
create policy "users: users can update self (limited by app)"
on users
as permissive
for update
to authenticated
using (users.id = app.current_app_user_id())
with check (users.id = app.current_app_user_id());

-- ================================================================
-- DOCTORS / RECEPTIONISTS (profile tables)
-- ================================================================
drop policy if exists "doctors: super admin full access" on doctors;
create policy "doctors: super admin full access"
on doctors
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "doctors: clinic staff access by clinic" on doctors;
create policy "doctors: clinic staff access by clinic"
on doctors
as permissive
for select
to authenticated
using (
  app.is_clinic_staff()
  and exists (
    select 1
    from users u
    where u.id = doctors.user_id
      and u.clinic_id = app.current_clinic_id()
  )
);

drop policy if exists "receptionists: super admin full access" on receptionists;
create policy "receptionists: super admin full access"
on receptionists
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "receptionists: clinic staff access by clinic" on receptionists;
create policy "receptionists: clinic staff access by clinic"
on receptionists
as permissive
for select
to authenticated
using (
  app.is_clinic_staff()
  and exists (
    select 1
    from users u
    where u.id = receptionists.user_id
      and u.clinic_id = app.current_clinic_id()
  )
);

-- ================================================================
-- PATIENTS
-- ================================================================
drop policy if exists "patients: super admin full access" on patients;
create policy "patients: super admin full access"
on patients
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "patients: clinic staff access own clinic" on patients;
create policy "patients: clinic staff access own clinic"
on patients
as permissive
for all
to authenticated
using (app.is_clinic_staff() and patients.clinic_id = app.current_clinic_id())
with check (app.is_clinic_staff() and patients.clinic_id = app.current_clinic_id());

-- ================================================================
-- APPOINTMENTS
-- ================================================================
drop policy if exists "appointments: super admin full access" on appointments;
create policy "appointments: super admin full access"
on appointments
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "appointments: clinic staff access own clinic" on appointments;
create policy "appointments: clinic staff access own clinic"
on appointments
as permissive
for all
to authenticated
using (app.is_clinic_staff() and appointments.clinic_id = app.current_clinic_id())
with check (app.is_clinic_staff() and appointments.clinic_id = app.current_clinic_id());

-- ================================================================
-- CONSULTATIONS
-- ================================================================
drop policy if exists "consultations: super admin full access" on consultations;
create policy "consultations: super admin full access"
on consultations
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "consultations: clinic staff access own clinic" on consultations;
create policy "consultations: clinic staff access own clinic"
on consultations
as permissive
for all
to authenticated
using (app.is_clinic_staff() and consultations.clinic_id = app.current_clinic_id())
with check (app.is_clinic_staff() and consultations.clinic_id = app.current_clinic_id());

-- ================================================================
-- PRESCRIPTIONS / ITEMS
-- ================================================================
drop policy if exists "prescriptions: super admin full access" on prescriptions;
create policy "prescriptions: super admin full access"
on prescriptions
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "prescriptions: clinic staff access own clinic" on prescriptions;
create policy "prescriptions: clinic staff access own clinic"
on prescriptions
as permissive
for all
to authenticated
using (app.is_clinic_staff() and prescriptions.clinic_id = app.current_clinic_id())
with check (app.is_clinic_staff() and prescriptions.clinic_id = app.current_clinic_id());

drop policy if exists "prescription_items: super admin full access" on prescription_items;
create policy "prescription_items: super admin full access"
on prescription_items
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "prescription_items: clinic staff via prescription clinic" on prescription_items;
create policy "prescription_items: clinic staff via prescription clinic"
on prescription_items
as permissive
for all
to authenticated
using (
  app.is_clinic_staff()
  and exists (
    select 1
    from prescriptions p
    where p.id = prescription_items.prescription_id
      and p.clinic_id = app.current_clinic_id()
  )
)
with check (
  app.is_clinic_staff()
  and exists (
    select 1
    from prescriptions p
    where p.id = prescription_items.prescription_id
      and p.clinic_id = app.current_clinic_id()
  )
);

-- ================================================================
-- BILLS
-- ================================================================
drop policy if exists "bills: super admin full access" on bills;
create policy "bills: super admin full access"
on bills
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "bills: clinic staff access own clinic" on bills;
create policy "bills: clinic staff access own clinic"
on bills
as permissive
for all
to authenticated
using (app.is_clinic_staff() and bills.clinic_id = app.current_clinic_id())
with check (app.is_clinic_staff() and bills.clinic_id = app.current_clinic_id());

-- ================================================================
-- FOLLOWUPS
-- ================================================================
drop policy if exists "followups: super admin full access" on followups;
create policy "followups: super admin full access"
on followups
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "followups: clinic staff access own clinic" on followups;
create policy "followups: clinic staff access own clinic"
on followups
as permissive
for all
to authenticated
using (app.is_clinic_staff() and followups.clinic_id = app.current_clinic_id())
with check (app.is_clinic_staff() and followups.clinic_id = app.current_clinic_id());

-- ================================================================
-- PAYMENTS (legacy)
-- ================================================================
drop policy if exists "payments: super admin full access" on payments;
create policy "payments: super admin full access"
on payments
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "payments: clinic staff access own clinic" on payments;
create policy "payments: clinic staff access own clinic"
on payments
as permissive
for all
to authenticated
using (app.is_clinic_staff() and payments.clinic_id = app.current_clinic_id())
with check (app.is_clinic_staff() and payments.clinic_id = app.current_clinic_id());

-- ================================================================
-- COUNTERS (user ID generation): admin only
-- ================================================================
drop policy if exists "counters: super admin full access" on counters;
create policy "counters: super admin full access"
on counters
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "counters: clinic admin manage clinic counters" on counters;
create policy "counters: clinic admin manage clinic counters"
on counters
as permissive
for all
to authenticated
using (app.is_clinic_admin() and counters.clinic_id = app.current_clinic_id())
with check (app.is_clinic_admin() and counters.clinic_id = app.current_clinic_id());

-- ================================================================
-- DEVICE APPROVAL REQUESTS
-- ================================================================
drop policy if exists "device_approval_requests: super admin full access" on device_approval_requests;
create policy "device_approval_requests: super admin full access"
on device_approval_requests
as permissive
for all
to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

drop policy if exists "device_approval_requests: user can read own" on device_approval_requests;
create policy "device_approval_requests: user can read own"
on device_approval_requests
as permissive
for select
to authenticated
using (device_approval_requests.user_id = app.current_app_user_id());

drop policy if exists "device_approval_requests: clinic admin manage requests in clinic" on device_approval_requests;
create policy "device_approval_requests: clinic admin manage requests in clinic"
on device_approval_requests
as permissive
for all
to authenticated
using (
  app.is_clinic_admin()
  and exists (
    select 1
    from users u
    where u.id = device_approval_requests.user_id
      and u.clinic_id = app.current_clinic_id()
  )
)
with check (
  app.is_clinic_admin()
  and exists (
    select 1
    from users u
    where u.id = device_approval_requests.user_id
      and u.clinic_id = app.current_clinic_id()
  )
);

-- ================================================================
-- AUDIT LOGS
-- ================================================================
drop policy if exists "audit_logs: super admin read" on audit_logs;
create policy "audit_logs: super admin read"
on audit_logs
as permissive
for select
to authenticated
using (app.is_super_admin());

drop policy if exists "audit_logs: clinic admin read own clinic" on audit_logs;
create policy "audit_logs: clinic admin read own clinic"
on audit_logs
as permissive
for select
to authenticated
using (
  app.is_clinic_admin()
  and (
    audit_logs.user_id is null
    or exists (
      select 1
      from users u
      where u.id = audit_logs.user_id
        and u.clinic_id = app.current_clinic_id()
    )
  )
);

drop policy if exists "audit_logs: authenticated can insert" on audit_logs;
create policy "audit_logs: authenticated can insert"
on audit_logs
as permissive
for insert
to authenticated
with check (true);

