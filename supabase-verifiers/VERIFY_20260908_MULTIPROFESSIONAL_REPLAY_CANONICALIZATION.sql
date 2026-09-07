\pset pager off

select '1) no legacy fisio profile remains' as check;
select case when not exists (
  select 1 from public.profiles where role::text = 'fisio'
) then 'ok' else 'FAIL' end as no_legacy_role;

select '2) legacy-named helper delegates to generic clinical capability' as check;
select case when
  pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure)
    ilike '%current_user_has_clinical_capability(''clinical.attend'')%'
  and pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure)
    not ilike '%v_role%fisio%'
then 'ok' else 'FAIL' end as helper_is_generic;

select '3) evaluation policies use generic assessment capability' as check;
select case when count(*) = 2 then 'ok' else 'FAIL' end as evaluation_policies
from pg_policy p
where p.polrelid = 'public.physiotherapy_evaluations'::regclass
  and p.polname in ('evaluations_insert_author', 'evaluations_update_author')
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) ilike '%current_user_has_clinical_capability(''clinical.assessment.apply'')%'
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) not ilike '%current_user_can_author_physiotherapy%';

select '4) evolution policies use generic evolution capability' as check;
select case when count(*) = 2 then 'ok' else 'FAIL' end as evolution_policies
from pg_policy p
where p.polrelid = 'public.physiotherapy_evolutions'::regclass
  and p.polname in ('evolutions_insert_author', 'evolutions_update_author')
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) ilike '%current_user_has_clinical_capability(''clinical.evolution.write'')%'
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) not ilike '%current_user_can_author_physiotherapy%';

select '5) structured assessment policies use generic assessment capability' as check;
select case when count(*) = 2 then 'ok' else 'FAIL' end as assessment_policies
from pg_policy p
where p.polrelid = 'public.clinical_assessments'::regclass
  and p.polname in ('clinical_assessments_insert_author', 'clinical_assessments_update_author')
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) ilike '%current_user_has_clinical_capability(''clinical.assessment.apply'')%'
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) not ilike '%current_user_can_author_physiotherapy%';

select '6) body-map policies use generic body-map capability' as check;
select case when count(*) = 3 then 'ok' else 'FAIL' end as body_map_policies
from pg_policy p
where p.polrelid = 'public.assessment_body_points'::regclass
  and p.polname in (
    'assessment_body_points_insert_author',
    'assessment_body_points_update_author',
    'assessment_body_points_delete_author'
  )
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
  ) ilike '%current_user_has_clinical_capability(''clinical.body_map'')%';

select '7) appointment transition guards are canonical professional-role based' as check;
select case when
  pg_get_functiondef('public.guard_appointment_clinical_self_transition()'::regprocedure)
    ilike '%current_user_has_clinical_capability(''clinical.attend'')%'
  and pg_get_functiondef('public.guard_appointment_clinical_self_transition()'::regprocedure)
    ilike '%v_role = ''professional''%'
  and pg_get_functiondef('public.guard_appointment_clinical_self_transition()'::regprocedure)
    not ilike '%v_role = ''fisio''%'
  and pg_get_functiondef('public.guard_appointment_status_transition()'::regprocedure)
    ilike '%app_role = ''professional''%'
  and pg_get_functiondef('public.guard_appointment_status_transition()'::regprocedure)
    not ilike '%app_role = ''fisio''%'
then 'ok' else 'FAIL' end as appointment_guards;

select '8) finalization requires attend plus evolution-write capabilities' as check;
select case when
  pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure)
    ilike '%current_user_has_clinical_capability(''clinical.attend'')%'
  and pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure)
    ilike '%current_user_has_clinical_capability(''clinical.evolution.write'')%'
then 'ok' else 'FAIL' end as finalization_capabilities;

select '9) final assertion' as check;
do $$
begin
  if exists (select 1 from public.profiles where role::text = 'fisio') then
    raise exception 'legacy role remains';
  end if;

  if pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure)
       not ilike '%current_user_has_clinical_capability(''clinical.attend'')%' then
    raise exception 'legacy helper is not generic';
  end if;

  if pg_get_functiondef('public.guard_appointment_status_transition()'::regprocedure)
       ilike '%app_role = ''fisio''%' then
    raise exception 'legacy role branch remains in appointment status guard';
  end if;
end $$;
select 'ok' as final_assertion;
