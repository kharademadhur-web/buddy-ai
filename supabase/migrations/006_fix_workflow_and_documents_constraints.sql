-- ================================================================
-- FIX-UP MIGRATION (safe to run after 001-005)
-- - Tighten constraints / FK integrity
-- - Ensure idempotent triggers for updated_at
-- - Backfill missing references on documents
-- ================================================================

-- ------------------------------
-- Clinical workflow tightening
-- ------------------------------
alter table if exists prescription_items
  alter column prescription_id set not null;

alter table if exists bills
  alter column clinic_id set not null,
  alter column appointment_id set not null,
  alter column patient_id set not null;

alter table if exists followups
  alter column clinic_id set not null,
  alter column patient_id set not null,
  alter column doctor_user_id set not null;

-- Helpful indexes (idempotent)
create index if not exists idx_consultations_clinic_id on consultations(clinic_id);
create index if not exists idx_prescriptions_clinic_id on prescriptions(clinic_id);
create index if not exists idx_appointments_status on appointments(status);
create index if not exists idx_bills_appointment_id on bills(appointment_id);

-- ------------------------------
-- Documents table tightening
-- ------------------------------
do $$
begin
  -- Add FK documents.created_by -> users.id if missing
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_created_by_fkey'
  ) then
    alter table documents
      add constraint documents_created_by_fkey
      foreign key (created_by) references users(id) on delete restrict;
  end if;

  -- Add FK documents.patient_id -> patients.id if missing
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_patient_id_fkey'
  ) then
    alter table documents
      add constraint documents_patient_id_fkey
      foreign key (patient_id) references patients(id) on delete set null;
  end if;
end $$;

create unique index if not exists uq_documents_bucket_path on documents(bucket, path);

-- ------------------------------
-- Ensure triggers are idempotent
-- ------------------------------
drop trigger if exists trigger_update_patients on patients;
create trigger trigger_update_patients
before update on patients
for each row execute function update_updated_at_column();

drop trigger if exists trigger_update_appointments on appointments;
create trigger trigger_update_appointments
before update on appointments
for each row execute function update_updated_at_column();

drop trigger if exists trigger_update_consultations on consultations;
create trigger trigger_update_consultations
before update on consultations
for each row execute function update_updated_at_column();

drop trigger if exists trigger_update_bills on bills;
create trigger trigger_update_bills
before update on bills
for each row execute function update_updated_at_column();

drop trigger if exists trigger_update_followups on followups;
create trigger trigger_update_followups
before update on followups
for each row execute function update_updated_at_column();

