\pset pager off
\set ON_ERROR_STOP on

select '1) atomic team RPCs exist' as check_name;
select
  to_regprocedure('public.admin_create_team_profile_atomic(uuid,uuid,text,text,text,text,text,boolean,text,text,text,text,text,boolean,uuid[])') is not null as create_rpc_exists,
  to_regprocedure('public.admin_update_team_profile_atomic(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid[])') is not null as update_rpc_exists;

select '2) RPCs are SECURITY DEFINER with pinned search_path' as check_name;
select
  p.proname,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=public, pg_temp%' as search_path_pinned
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_create_team_profile_atomic', 'admin_update_team_profile_atomic')
order by p.proname;

select '3) browser roles cannot execute atomic team RPCs' as check_name;
select
  not has_function_privilege('anon', 'public.admin_create_team_profile_atomic(uuid,uuid,text,text,text,text,text,boolean,text,text,text,text,text,boolean,uuid[])', 'EXECUTE') as create_anon_denied,
  not has_function_privilege('authenticated', 'public.admin_create_team_profile_atomic(uuid,uuid,text,text,text,text,text,boolean,text,text,text,text,text,boolean,uuid[])', 'EXECUTE') as create_authenticated_denied,
  not has_function_privilege('anon', 'public.admin_update_team_profile_atomic(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid[])', 'EXECUTE') as update_anon_denied,
  not has_function_privilege('authenticated', 'public.admin_update_team_profile_atomic(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid[])', 'EXECUTE') as update_authenticated_denied;

select '4) service_role can execute atomic team RPCs' as check_name;
select
  has_function_privilege('service_role', 'public.admin_create_team_profile_atomic(uuid,uuid,text,text,text,text,text,boolean,text,text,text,text,text,boolean,uuid[])', 'EXECUTE') as create_service_role_allowed,
  has_function_privilege('service_role', 'public.admin_update_team_profile_atomic(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid[])', 'EXECUTE') as update_service_role_allowed;

select '5) update RPC validates units before destructive unit synchronization' as check_name;
select
  strpos(pg_get_functiondef('public.admin_update_team_profile_atomic(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid[])'::regprocedure), 'Unidade invalida ou inativa')
    < strpos(pg_get_functiondef('public.admin_update_team_profile_atomic(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid[])'::regprocedure), 'delete from public.profile_units')
    as validates_before_delete;

select '6) profile_units remains tenant-qualified' as check_name;
select
  count(*) = 3 as expected_columns_present
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profile_units'
  and column_name in ('profile_id', 'unit_id', 'clinic_id');
