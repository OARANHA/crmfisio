\pset pager off

select '1) canonical professional_id column exists and is required' as check;
select case when exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'appointments'
    and column_name = 'professional_id'
    and is_nullable = 'NO'
) then 'ok' else 'FAIL' end as professional_id_column;

select '2) legacy and canonical appointment professional ids are fully synchronized' as check;
select case when not exists (
  select 1
  from public.appointments
  where professional_id is distinct from fisio_id
) then 'ok' else 'FAIL' end as synchronized_rows;

select '3) compatibility trigger is installed' as check;
select case when exists (
  select 1
  from pg_trigger
  where tgrelid = 'public.appointments'::regclass
    and tgname = 'trg_sync_appointment_professional_id'
    and not tgisinternal
) then 'ok' else 'FAIL' end as sync_trigger;

select '4) compatibility trigger rejects ambiguous writes' as check;
select case when
  pg_get_functiondef('public.sync_appointment_professional_id()'::regprocedure)
    ilike '%appointment_professional_identity_conflict%'
  and pg_get_functiondef('public.sync_appointment_professional_id()'::regprocedure)
    ilike '%new.professional_id%new.fisio_id%'
then 'ok' else 'FAIL' end as conflict_guard;

select '5) canonical professional reference is indexed' as check;
select case when exists (
  select 1
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'appointments'
    and indexname = 'idx_appointments_professional_id'
) then 'ok' else 'FAIL' end as professional_index;

select '6) canonical professional reference keeps referential integrity' as check;
select case when exists (
  select 1
  from pg_constraint
  where conrelid = 'public.appointments'::regclass
    and conname = 'appointments_professional_id_fkey'
    and contype = 'f'
    and convalidated
) then 'ok' else 'FAIL' end as professional_fk;

select '7) legacy column intentionally remains during compatibility window' as check;
select case when exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'appointments'
    and column_name = 'fisio_id'
) then 'ok' else 'FAIL' end as legacy_alias_present;

select '8) final assertion' as check;
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'professional_id' and is_nullable = 'NO'
  ) then
    raise exception 'appointments.professional_id is missing or nullable';
  end if;

  if exists (
    select 1 from public.appointments
    where professional_id is distinct from fisio_id
  ) then
    raise exception 'appointment professional compatibility columns diverged';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.appointments'::regclass
      and tgname = 'trg_sync_appointment_professional_id'
      and not tgisinternal
  ) then
    raise exception 'appointment professional compatibility trigger missing';
  end if;
end $$;
select 'ok' as final_assertion;
