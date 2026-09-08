\pset pager off

\echo '1) appointment_series has canonical professional_id and keeps the compatibility alias'
select case when
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointment_series'
      and column_name = 'professional_id' and is_nullable = 'NO'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointment_series'
      and column_name = 'fisio_id'
  )
then 'ok' else 'FAIL' end as professional_id_column;

\echo '2) legacy and canonical series references are synchronized'
select case when not exists (
  select 1 from public.appointment_series
  where professional_id is distinct from fisio_id
) then 'ok' else 'FAIL' end as synchronized_rows;

\echo '3) compatibility trigger is installed'
select case when exists (
  select 1
  from pg_trigger
  where tgrelid = 'public.appointment_series'::regclass
    and tgname = 'trg_sync_appointment_series_professional_id'
    and not tgisinternal
) then 'ok' else 'FAIL' end as sync_trigger;

\echo '4) recurrence creation authorizes canonical professional role, not legacy fisio role'
with fn as (
  select lower(pg_get_functiondef('public.create_appointment_series(uuid,uuid,uuid,text,smallint[],time,integer,date,date,integer,boolean)'::regprocedure)) as def
)
select case when
  position('''professional''' in def) > 0
  and position('''fisio''' in def) = 0
then 'ok' else 'FAIL' end as create_role_cutover
from fn;

\echo '5) recurrence cancellation authorizes canonical professional role, not legacy fisio role'
with fn as (
  select lower(pg_get_functiondef('public.cancel_appointment_series(uuid,text)'::regprocedure)) as def
)
select case when
  position('''professional''' in def) > 0
  and position('''fisio''' in def) = 0
then 'ok' else 'FAIL' end as cancel_role_cutover
from fn;

\echo '6) recurrence preview checks canonical appointment professional reference'
with fn as (
  select lower(pg_get_functiondef('public.preview_appointment_series(uuid,uuid,uuid,smallint[],time,integer,date,date)'::regprocedure)) as def
)
select case when
  position('a.professional_id = p_fisio_id' in def) > 0
then 'ok' else 'FAIL' end as preview_professional_reference
from fn;

\echo '7) recurrence creation persists canonical professional references'
with fn as (
  select lower(pg_get_functiondef('public.create_appointment_series(uuid,uuid,uuid,text,smallint[],time,integer,date,date,integer,boolean)'::regprocedure)) as def
)
select case when
  position('professional_id' in def) > 0
  and position('insert into public.appointment_series' in def) > 0
  and position('insert into public.appointments' in def) > 0
then 'ok' else 'FAIL' end as create_professional_reference
from fn;

\echo '8) canonical series professional reference has index and FK'
select case when
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'appointment_series'
      and indexname = 'idx_appointment_series_professional_id'
  )
  and exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointment_series'::regclass
      and conname = 'appointment_series_professional_id_fkey'
      and convalidated
  )
then 'ok' else 'FAIL' end as professional_integrity;

\echo '9) final assertion'
do $$
declare
  v_create text := lower(pg_get_functiondef('public.create_appointment_series(uuid,uuid,uuid,text,smallint[],time,integer,date,date,integer,boolean)'::regprocedure));
  v_cancel text := lower(pg_get_functiondef('public.cancel_appointment_series(uuid,text)'::regprocedure));
  v_preview text := lower(pg_get_functiondef('public.preview_appointment_series(uuid,uuid,uuid,smallint[],time,integer,date,date)'::regprocedure));
begin
  if exists (
    select 1 from public.appointment_series
    where professional_id is null or professional_id is distinct from fisio_id
  ) then
    raise exception 'recurrence_professional_reference_not_synchronized';
  end if;

  if position('''professional''' in v_create) = 0
     or position('''fisio''' in v_create) > 0
     or position('''professional''' in v_cancel) = 0
     or position('''fisio''' in v_cancel) > 0 then
    raise exception 'recurrence_role_cutover_incomplete';
  end if;

  if position('a.professional_id = p_fisio_id' in v_preview) = 0 then
    raise exception 'recurrence_preview_not_canonical';
  end if;
end $$;

select 'ok' as final_assertion;
