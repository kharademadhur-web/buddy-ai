-- ================================================================
-- FIX-UP: ensure clinics.subscription_status exists
-- - For projects that created clinics earlier with a different column (e.g. status)
-- ================================================================

alter table if exists clinics
  add column if not exists subscription_status varchar(50);

-- Backfill from legacy column if present and subscription_status is null
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'status'
  ) then
    execute $sql$
      update clinics
      set subscription_status = coalesce(subscription_status, status)
    $sql$;
  end if;
end $$;

-- Set default + NOT NULL if safe
alter table clinics
  alter column subscription_status set default 'active';

update clinics
set subscription_status = 'active'
where subscription_status is null;

alter table clinics
  alter column subscription_status set not null;

-- Add check constraint if missing
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinics_subscription_status_check'
  ) then
    alter table clinics
      add constraint clinics_subscription_status_check
      check (subscription_status in ('active', 'pending', 'inactive'));
  end if;
end $$;

create index if not exists idx_clinics_subscription_status on clinics(subscription_status);

