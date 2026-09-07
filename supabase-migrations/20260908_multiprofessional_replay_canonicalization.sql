-- MedicsPro — canonical multiprofessional replay guard
--
-- 20260907_solo_owner_clinical_identity.sql sorts after the 20260907
-- multiprofessional/cutover migrations on a filename-ordered clean replay.
-- This later migration reasserts the canonical capability-based runtime after
-- every 20260907 migration has run.

begin;

create or replace function public.current_user_can_author_physiotherapy()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_has_clinical_capability('clinical.attend');
$$;

revoke all on function public.current_user_can_author_physiotherapy() from public, anon;
grant execute on function public.current_user_can_author_physiotherapy() to authenticated, service_role;

comment on function public.current_user_can_author_physiotherapy() is
  'Legacy compatibility alias. Clinical authorization is canonical multiprofessional capability-based.';

drop policy if exists evaluations_insert_author on public.physiotherapy_evaluations;
create policy evaluations_insert_author
on public.physiotherapy_evaluations
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.assessment.apply')
);

drop policy if exists evaluations_update_author on public.physiotherapy_evaluations;
create policy evaluations_update_author
on public.physiotherapy_evaluations
for update to authenticated
using (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.assessment.apply')
)
with check (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.assessment.apply')
);

drop policy if exists evolutions_insert_author on public.physiotherapy_evolutions;
create policy evolutions_insert_author
on public.physiotherapy_evolutions
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.evolution.write')
);

drop policy if exists evolutions_update_author on public.physiotherapy_evolutions;
create policy evolutions_update_author
on public.physiotherapy_evolutions
for update to authenticated
using (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.evolution.write')
)
with check (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.evolution.write')
);

drop policy if exists clinical_assessments_insert_author on public.clinical_assessments;
create policy clinical_assessments_insert_author
on public.clinical_assessments
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.assessment.apply')
  and status = 'draft'
);

drop policy if exists clinical_assessments_update_author on public.clinical_assessments;
create policy clinical_assessments_update_author
on public.clinical_assessments
for update to authenticated
using (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.assessment.apply')
  and status = 'draft'
)
with check (
  clinic_id = public.current_clinic_id()
  and professional_id = auth.uid()
  and public.current_user_has_clinical_capability('clinical.assessment.apply')
  and status in ('draft', 'finalized')
);

drop policy if exists assessment_body_points_insert_author on public.assessment_body_points;
create policy assessment_body_points_insert_author
on public.assessment_body_points
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and public.current_user_has_clinical_capability('clinical.body_map')
  and exists (
    select 1 from public.clinical_assessments a
    where a.id = assessment_id
      and a.professional_id = auth.uid()
      and a.status = 'draft'
      and a.clinic_id = public.current_clinic_id()
  )
);

drop policy if exists assessment_body_points_update_author on public.assessment_body_points;
create policy assessment_body_points_update_author
on public.assessment_body_points
for update to authenticated
using (
  clinic_id = public.current_clinic_id()
  and public.current_user_has_clinical_capability('clinical.body_map')
  and exists (
    select 1 from public.clinical_assessments a
    where a.id = assessment_id
      and a.professional_id = auth.uid()
      and a.status = 'draft'
      and a.clinic_id = public.current_clinic_id()
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and public.current_user_has_clinical_capability('clinical.body_map')
);

drop policy if exists assessment_body_points_delete_author on public.assessment_body_points;
create policy assessment_body_points_delete_author
on public.assessment_body_points
for delete to authenticated
using (
  clinic_id = public.current_clinic_id()
  and public.current_user_has_clinical_capability('clinical.body_map')
  and exists (
    select 1 from public.clinical_assessments a
    where a.id = assessment_id
      and a.professional_id = auth.uid()
      and a.status = 'draft'
      and a.clinic_id = public.current_clinic_id()
  )
);

create or replace function public.guard_appointment_clinical_self_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.current_app_role();
  v_is_clinical_transition boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  if v_role is null then return new; end if;

  v_is_clinical_transition := new.status = 'em_atendimento'
    or (old.status = 'em_atendimento' and new.status = 'finalizado');

  if v_is_clinical_transition then
    if not public.current_user_has_clinical_capability('clinical.attend') then
      raise exception 'clinical_professional_capability_required' using errcode = '42501';
    end if;
    if auth.uid() is null
       or old.fisio_id is distinct from auth.uid()
       or new.fisio_id is distinct from auth.uid() then
      raise exception 'appointment_clinical_self_transition_required' using errcode = '42501';
    end if;
    return new;
  end if;

  if v_role = 'professional'
     and (auth.uid() is null
       or old.fisio_id is distinct from auth.uid()
       or new.fisio_id is distinct from auth.uid()) then
    raise exception 'appointment_professional_self_transition_required' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_appointment_clinical_self_transition() from public, anon, authenticated;

create or replace function public.guard_appointment_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  app_role text;
  allowed boolean := false;
  v_clinical boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  app_role := public.current_app_role();
  if app_role is null then return new; end if;

  v_clinical := new.status = 'em_atendimento'
    or (old.status = 'em_atendimento' and new.status = 'finalizado');

  if v_clinical then
    allowed := public.current_user_has_clinical_capability('clinical.attend')
      and auth.uid() is not null
      and old.fisio_id = auth.uid()
      and new.fisio_id = auth.uid();
  elsif app_role in ('owner', 'admin') then
    allowed := true;
  elsif app_role = 'recep' then
    allowed := (old.status = 'agendado' and new.status in ('confirmado', 'faltou', 'cancelado'))
      or (old.status = 'confirmado' and new.status in ('faltou', 'cancelado'));
  elsif app_role = 'professional' then
    allowed := (old.status = 'agendado' and new.status in ('confirmado', 'faltou', 'cancelado'))
      or (old.status = 'confirmado' and new.status in ('faltou', 'cancelado'));
  end if;

  if not allowed then
    raise exception 'Transição de status não permitida para o perfil atual: % -> %', old.status, new.status
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_appointment_status_transition() from public, anon, authenticated;

create or replace function public.require_evolution_before_appointment_finalize()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from 'em_atendimento'
     or new.status is distinct from 'finalizado' then
    return new;
  end if;
  if public.current_app_role() is null then return new; end if;

  if not public.current_user_has_clinical_capability('clinical.attend')
     or not public.current_user_has_clinical_capability('clinical.evolution.write')
     or auth.uid() is null
     or new.fisio_id is distinct from auth.uid() then
    raise exception 'clinical_finalize_self_authorship_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.physiotherapy_evolutions e
    where e.session_id = new.id
      and e.clinic_id = new.clinic_id
      and e.patient_id = new.paciente_id
      and e.professional_id = auth.uid()
      and e.deleted_at is null
  ) then
    raise exception 'clinical_evolution_required_before_finalize' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.require_evolution_before_appointment_finalize() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from public.profiles where role::text = 'fisio') then
    raise exception 'legacy_fisio_role_reintroduced_after_canonical_cutover';
  end if;
end $$;

commit;
