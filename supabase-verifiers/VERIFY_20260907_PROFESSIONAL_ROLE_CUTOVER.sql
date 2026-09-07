\set ON_ERROR_STOP on
\pset pager off

\echo '1) profiles.role accepts only the canonical clinic roles'
select case when exists (
  select 1
  from pg_constraint c
  where c.conrelid = 'public.profiles'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%owner%'
    and pg_get_constraintdef(c.oid) ilike '%professional%'
    and pg_get_constraintdef(c.oid) ilike '%recep%'
    and pg_get_constraintdef(c.oid) ilike '%financeiro%'
    and pg_get_constraintdef(c.oid) not ilike '%fisio%'
    and pg_get_constraintdef(c.oid) not ilike '%platform_admin%'
) then 'ok' else 'FAIL' end as role_constraint;

\echo '2) no legacy fisio profile remains'
select case when not exists (
  select 1 from public.profiles where role::text = 'fisio'
) then 'ok' else 'FAIL' end as no_legacy_role;

\echo '3) no platform_admin leaked into clinic profiles'
select case when not exists (
  select 1 from public.profiles where role::text = 'platform_admin'
) then 'ok' else 'FAIL' end as platform_boundary;

\echo '4) generic clinical capability resolver is installed'
select case when to_regprocedure('public.current_user_has_clinical_capability(text)') is not null
then 'ok' else 'FAIL' end as generic_capability;

\echo '5) generic capability fallback is canonical and legacy role-free'
select case when
  pg_get_functiondef('public.current_user_has_clinical_capability(text)'::regprocedure) ilike '%professional%'
  and pg_get_functiondef('public.current_user_has_clinical_capability(text)'::regprocedure) not ilike '%fisio%'
then 'ok' else 'FAIL' end as capability_cutover;

\echo '6) legacy-named authorship helper delegates to generic capability'
select case when
  pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure) ilike '%current_user_has_clinical_capability%'
  and pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure) ilike '%clinical.attend%'
then 'ok' else 'FAIL' end as legacy_helper_bridge;

\echo '7) team create RPC accepts professional and rejects legacy role contract'
select case when
  pg_get_functiondef('public.admin_create_team_profile_atomic(uuid,uuid,text,text,text,text,text,boolean,text,text,text,text,text,boolean,uuid[])'::regprocedure) ilike '%professional%'
  and pg_get_functiondef('public.admin_create_team_profile_atomic(uuid,uuid,text,text,text,text,text,boolean,text,text,text,text,text,boolean,uuid[])'::regprocedure) not ilike '%''fisio''%'
then 'ok' else 'FAIL' end as team_create_cutover;

\echo '8) team update RPC accepts professional and rejects legacy role contract'
select case when
  pg_get_functiondef('public.admin_update_team_profile_atomic(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid[])'::regprocedure) ilike '%professional%'
  and pg_get_functiondef('public.admin_update_team_profile_atomic(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid[])'::regprocedure) not ilike '%''fisio''%'
then 'ok' else 'FAIL' end as team_update_cutover;

\echo '9) professional capability table remains tenant-scoped'
select case when exists (
  select 1
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'public.professional_capabilities'::regclass
    and a.attname = 'clinic_id'
) then 'ok' else 'FAIL' end as capability_tenant_scope;

\echo '10) owner/admin can retain their operational role while carrying a professional identity'
select case when not exists (
  select 1
  from pg_constraint c
  where c.conrelid = 'public.profiles'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%professional_type%'
    and pg_get_constraintdef(c.oid) ilike '%role%'
    and (
      pg_get_constraintdef(c.oid) ilike '%owner%'
      or pg_get_constraintdef(c.oid) ilike '%admin%'
    )
) then 'ok' else 'FAIL' end as manager_clinician_shape;

\echo '11) only canonical role values exist in live profiles'
select role::text as role, count(*) as profiles
from public.profiles
group by role::text
order by role::text;

\echo '12) clinical identities and explicit capability rows remain visible for inspection'
select
  count(*) filter (where coalesce(professional_type, '') <> '') as profiles_with_identity,
  (select count(*) from public.professional_capabilities) as explicit_capability_rows
from public.profiles;

\echo '13) final assertion'
do $$
begin
  if exists (select 1 from public.profiles where role::text not in ('owner','admin','professional','recep','financeiro')) then
    raise exception 'FAIL: non-canonical role remains';
  end if;
  if exists (select 1 from public.profiles where role::text = 'fisio') then
    raise exception 'FAIL: legacy fisio role remains';
  end if;
end $$;
select 'ok' as final_assertion;
