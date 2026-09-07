-- MedicsPro — staged operational-role compatibility
-- Phase 1 of the `fisio` -> `professional` cutover.
--
-- Safety contract:
--   * existing `fisio` rows remain untouched in this phase;
--   * both legacy and canonical values are accepted temporarily;
--   * clinical authorization remains capability + identity based;
--   * owner/admin clinicians keep their operational role;
--   * platform_admin is never accepted in profiles.role.

begin;

-- Support either a text/check column (current production shape) or an enum-backed
-- installation. Adding the enum label is harmless when profiles.role is text.
do $$
declare
  v_typcategory "char";
  v_typname text;
  v_typnamespace text;
begin
  select t.typcategory, t.typname, n.nspname
    into v_typcategory, v_typname, v_typnamespace
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where a.attrelid = 'public.profiles'::regclass
    and a.attname = 'role'
    and not a.attisdropped;

  if v_typcategory = 'E' then
    execute format('alter type %I.%I add value if not exists %L', v_typnamespace, v_typname, 'professional');
  end if;
end $$;

-- Replace only role-domain check constraints on profiles. This keeps all other
-- profile invariants intact and makes the deployment window bidirectional.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
      and (
        pg_get_constraintdef(c.oid) ilike '%owner%'
        or pg_get_constraintdef(c.oid) ilike '%fisio%'
        or pg_get_constraintdef(c.oid) ilike '%recep%'
      )
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;

-- For text/varchar role columns, explicitly accept both values during rollout.
do $$
declare
  v_typcategory "char";
begin
  select t.typcategory
    into v_typcategory
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.profiles'::regclass
    and a.attname = 'role'
    and not a.attisdropped;

  if v_typcategory <> 'E' then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and conname = 'profiles_role_check'
    ) then
      alter table public.profiles
        add constraint profiles_role_check
        check (role in ('owner', 'admin', 'fisio', 'professional', 'recep', 'financeiro'));
    end if;
  end if;
end $$;

-- Generic capability resolver. Explicit grants/revocations always win. The
-- legacy/default clinician bridge accepts both role names during Phase 1.
create or replace function public.current_user_has_clinical_capability(p_capability_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_explicit boolean;
begin
  select p.* into v_profile
  from public.profiles p
  where p.id = auth.uid()
    and p.ativo = true
  limit 1;

  if v_profile.id is null then
    return false;
  end if;

  select pc.granted
    into v_explicit
  from public.professional_capabilities pc
  where pc.clinic_id = v_profile.clinic_id
    and pc.professional_id = v_profile.id
    and pc.capability_key = p_capability_key
  limit 1;

  if found then
    return coalesce(v_explicit, false);
  end if;

  -- Temporary compatibility default: the old clinical role keeps its existing
  -- behavior until rows are converted. New canonical professionals receive the
  -- same default only when they have a recognized clinical identity.
  if v_profile.role::text in ('fisio', 'professional')
     and coalesce(v_profile.professional_type, '') <> '' then
    return p_capability_key = any(array[
      'clinical.attend',
      'clinical.timeline.read',
      'clinical.evolution.write',
      'clinical.assessment.apply',
      'clinical.body_map',
      'clinical.documents'
    ]::text[]);
  end if;

  return false;
end;
$$;

revoke all on function public.current_user_has_clinical_capability(text) from public;
grant execute on function public.current_user_has_clinical_capability(text) to authenticated, service_role;

-- Keep old database policies/RPCs safe during the staged rollout. Any legacy
-- policy that still calls this helper now delegates to the generic capability.
create or replace function public.current_user_can_author_physiotherapy()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_clinical_capability('clinical.attend');
$$;

revoke all on function public.current_user_can_author_physiotherapy() from public;
grant execute on function public.current_user_can_author_physiotherapy() to authenticated, service_role;

-- Atomic team RPCs are redefined so the updated admin-team Edge Function can
-- create/update the canonical role before legacy rows are converted.
create or replace function public.admin_create_team_profile_atomic(
  p_profile_id uuid,
  p_clinic_id uuid,
  p_email text,
  p_nome text,
  p_role text,
  p_registro text,
  p_cor text,
  p_ativo boolean,
  p_telefone text,
  p_professional_type text,
  p_council_type text,
  p_council_state text,
  p_especialidade text,
  p_must_change_password boolean,
  p_unit_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_role not in ('admin', 'fisio', 'professional', 'recep', 'financeiro') then
    raise exception 'invalid_role';
  end if;
  if not exists (select 1 from public.clinics c where c.id = p_clinic_id and c.deleted_at is null) then
    raise exception 'clinic_not_found';
  end if;
  if coalesce(array_length(p_unit_ids, 1), 0) > 0 and exists (
    select 1 from unnest(p_unit_ids) as requested(id)
    left join public.clinic_units u on u.id = requested.id and u.clinic_id = p_clinic_id
    where u.id is null
  ) then
    raise exception 'invalid_unit';
  end if;

  insert into public.profiles (
    id, clinic_id, email, nome, role, registro, cor, ativo, telefone,
    professional_type, council_type, council_state, especialidade, must_change_password
  ) values (
    p_profile_id, p_clinic_id, lower(trim(p_email)), trim(p_nome), p_role,
    nullif(trim(p_registro), ''), coalesce(nullif(p_cor, ''), '#9ab8c9'), coalesce(p_ativo, true),
    nullif(trim(p_telefone), ''), nullif(trim(p_professional_type), ''), nullif(trim(p_council_type), ''),
    nullif(upper(trim(p_council_state)), ''), nullif(trim(p_especialidade), ''), coalesce(p_must_change_password, true)
  );

  if coalesce(array_length(p_unit_ids, 1), 0) > 0 then
    insert into public.profile_units (profile_id, unit_id, clinic_id)
    select p_profile_id, requested.id, p_clinic_id
    from unnest(p_unit_ids) as requested(id)
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.admin_update_team_profile_atomic(
  p_profile_id uuid,
  p_clinic_id uuid,
  p_nome text,
  p_role text,
  p_registro text,
  p_cor text,
  p_telefone text,
  p_professional_type text,
  p_council_type text,
  p_council_state text,
  p_especialidade text,
  p_unit_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_role not in ('admin', 'fisio', 'professional', 'recep', 'financeiro') then
    raise exception 'invalid_role';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p.clinic_id = p_clinic_id and p.role::text <> 'owner'
  ) then
    raise exception 'profile_not_manageable';
  end if;
  if p_unit_ids is not null and coalesce(array_length(p_unit_ids, 1), 0) > 0 and exists (
    select 1 from unnest(p_unit_ids) as requested(id)
    left join public.clinic_units u on u.id = requested.id and u.clinic_id = p_clinic_id
    where u.id is null
  ) then
    raise exception 'invalid_unit';
  end if;

  update public.profiles
  set nome = trim(p_nome),
      role = p_role,
      registro = nullif(trim(p_registro), ''),
      cor = coalesce(nullif(p_cor, ''), cor),
      telefone = nullif(trim(p_telefone), ''),
      professional_type = nullif(trim(p_professional_type), ''),
      council_type = nullif(trim(p_council_type), ''),
      council_state = nullif(upper(trim(p_council_state)), ''),
      especialidade = nullif(trim(p_especialidade), '')
  where id = p_profile_id and clinic_id = p_clinic_id;

  if p_unit_ids is not null then
    delete from public.profile_units where profile_id = p_profile_id and clinic_id = p_clinic_id;
    if coalesce(array_length(p_unit_ids, 1), 0) > 0 then
      insert into public.profile_units (profile_id, unit_id, clinic_id)
      select p_profile_id, requested.id, p_clinic_id
      from unnest(p_unit_ids) as requested(id)
      on conflict do nothing;
    end if;
  end if;
end;
$$;

revoke all on function public.admin_create_team_profile_atomic(uuid, uuid, text, text, text, text, text, boolean, text, text, text, text, text, boolean, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_create_team_profile_atomic(uuid, uuid, text, text, text, text, text, boolean, text, text, text, text, text, boolean, uuid[]) to service_role;
revoke all on function public.admin_update_team_profile_atomic(uuid, uuid, text, text, text, text, text, text, text, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_update_team_profile_atomic(uuid, uuid, text, text, text, text, text, text, text, text, text, uuid[]) to service_role;

commit;
