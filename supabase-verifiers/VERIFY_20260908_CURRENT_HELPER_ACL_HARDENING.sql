\pset pager off

select '1) anon cannot execute current_clinic_id' as check;
select case when not has_function_privilege('anon', 'public.current_clinic_id()', 'EXECUTE')
  then 'ok' else 'FAIL' end as anon_current_clinic_id_denied;

select '2) anon cannot execute current_app_role' as check;
select case when not has_function_privilege('anon', 'public.current_app_role()', 'EXECUTE')
  then 'ok' else 'FAIL' end as anon_current_app_role_denied;

select '3) authenticated keeps execute on both helpers' as check;
select case when
  has_function_privilege('authenticated', 'public.current_clinic_id()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.current_app_role()', 'EXECUTE')
then 'ok' else 'FAIL' end as authenticated_execute_preserved;

select '4) service_role keeps execute on both helpers' as check;
select case when
  has_function_privilege('service_role', 'public.current_clinic_id()', 'EXECUTE')
  and has_function_privilege('service_role', 'public.current_app_role()', 'EXECUTE')
then 'ok' else 'FAIL' end as service_role_execute_preserved;

select '5) final assertion' as check;
do $$
begin
  if has_function_privilege('anon', 'public.current_clinic_id()', 'EXECUTE') then
    raise exception 'anon still has EXECUTE on public.current_clinic_id()';
  end if;

  if has_function_privilege('anon', 'public.current_app_role()', 'EXECUTE') then
    raise exception 'anon still has EXECUTE on public.current_app_role()';
  end if;

  if not has_function_privilege('authenticated', 'public.current_clinic_id()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.current_app_role()', 'EXECUTE') then
    raise exception 'authenticated EXECUTE privilege was not preserved';
  end if;

  if not has_function_privilege('service_role', 'public.current_clinic_id()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.current_app_role()', 'EXECUTE') then
    raise exception 'service_role EXECUTE privilege was not preserved';
  end if;
end $$;
select 'ok' as final_assertion;
