-- MedicsPro — final operational-role cutover
-- Phase 2 of `fisio` -> `professional`.
-- Apply ONLY after:
--   1) 20260907_professional_role_compatibility.sql
--   2) frontend containing normalizeClinicRole()
--   3) updated admin-team Edge Function
-- are deployed.

begin;

-- Fail before touching role data if a legacy clinician would lose the valid
-- identity required by the canonical capability boundary after conversion.
do $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.role::text = 'fisio'
      and not (
        case
          when lower(trim(coalesce(p.professional_type, ''))) in ('fisioterapeuta','fisioterapia','physiotherapist','physical therapist')
            then lower(trim(coalesce(p.council_type, ''))) = 'crefito'
             and trim(coalesce(p.council_state, '')) <> ''
             and trim(coalesce(p.registro, '')) <> ''
          when lower(trim(coalesce(p.professional_type, ''))) in ('psicologo','psicólogo','psicologa','psicóloga','psychologist')
            then lower(trim(coalesce(p.council_type, ''))) = 'crp'
             and trim(coalesce(p.council_state, '')) <> ''
             and trim(coalesce(p.registro, '')) <> ''
          when lower(trim(coalesce(p.professional_type, ''))) in ('medico','médico','medica','médica','physician','doctor')
            then lower(trim(coalesce(p.council_type, ''))) = 'crm'
             and trim(coalesce(p.council_state, '')) <> ''
             and trim(coalesce(p.registro, '')) <> ''
          when lower(trim(coalesce(p.professional_type, ''))) in ('quiropraxista','quiropraxia','chiropractor','chiropractic')
            then true
          else false
        end
      )
  ) then
    raise exception 'legacy_professional_identity_incomplete';
  end if;
end $$;

-- Convert every remaining legacy operational role without changing identity,
-- capabilities, clinic ownership or care relationships.
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
    execute format(
      'update public.profiles set role = %L::%I.%I where role::text = %L',
      'professional', v_typnamespace, v_typname, 'fisio'
    );
  else
    update public.profiles
       set role = 'professional'
     where role::text = 'fisio';
  end if;
end $$;

-- Tighten the persisted operational-role domain to the canonical five values.
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
        or pg_get_constraintdef(c.oid) ilike '%professional%'
        or pg_get_constraintdef(c.oid) ilike '%fisio%'
      )
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role::text in ('owner', 'admin', 'professional', 'recep', 'financeiro'));

-- Remove the legacy role bypass from identity validation. Operational role never
-- proves clinical identity after final cutover.
create or replace function public.current_user_has_valid_clinical_identity()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_profession text;
  v_council text;
  v_state text;
  v_registration text;
begin
  if v_uid is null or v_clinic is null then
    return false;
  end if;

  select
    lower(trim(coalesce(p.professional_type, ''))),
    lower(trim(coalesce(p.council_type, ''))),
    trim(coalesce(p.council_state, '')),
    trim(coalesce(p.registro, ''))
  into v_profession, v_council, v_state, v_registration
  from public.profiles p
  join public.clinics c on c.id = p.clinic_id
  where p.id = v_uid
    and p.clinic_id = v_clinic
    and p.ativo is true
    and c.deleted_at is null
    and coalesce(c.lifecycle_status, 'active') = 'active'
  limit 1;

  if not found or v_profession = '' then
    return false;
  end if;

  if v_profession in ('fisioterapeuta','fisioterapia','physiotherapist','physical therapist') then
    return v_council = 'crefito' and v_state <> '' and v_registration <> '';
  end if;
  if v_profession in ('psicologo','psicólogo','psicologa','psicóloga','psychologist') then
    return v_council = 'crp' and v_state <> '' and v_registration <> '';
  end if;
  if v_profession in ('medico','médico','medica','médica','physician','doctor') then
    return v_council = 'crm' and v_state <> '' and v_registration <> '';
  end if;

  return v_profession in ('quiropraxista','quiropraxia','chiropractor','chiropractic');
end;
$$;

revoke all on function public.current_user_has_valid_clinical_identity() from public, anon;
grant execute on function public.current_user_has_valid_clinical_identity() to authenticated, service_role;

-- Capability authorization remains identity + capability. Explicit grants or
-- revocations decide the fine-grained permission once identity is valid.
create or replace function public.current_user_has_clinical_capability(p_capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
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

  if v_profile.id is null or coalesce(p_capability, '') = '' then
    return false;
  end if;

  if not public.current_user_has_valid_clinical_identity() then
    return false;
  end if;

  select pc.granted
    into v_explicit
  from public.professional_capabilities pc
  join public.capability_catalog cc on cc.capability_key = pc.capability_key
  where pc.clinic_id = v_profile.clinic_id
    and pc.professional_id = v_profile.id
    and pc.capability_key = p_capability
    and cc.active is true
    and cc.clinical is true
  limit 1;

  if found then
    return coalesce(v_explicit, false);
  end if;

  if v_profile.role::text = 'professional' then
    return p_capability = any(array[
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

create or replace function public.current_user_can_author_physiotherapy()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_has_clinical_capability('clinical.attend');
$$;

revoke all on function public.current_user_can_author_physiotherapy() from public;
grant execute on function public.current_user_can_author_physiotherapy() to authenticated, service_role;

-- Final appointment boundary knows only the canonical professional role.
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
  if new.status is not distinct from old.status then
    return new;
  end if;
  if v_role is null then
    return new;
  end if;

  v_is_clinical_transition :=
    new.status = 'em_atendimento'
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
     and (
       auth.uid() is null
       or old.fisio_id is distinct from auth.uid()
       or new.fisio_id is distinct from auth.uid()
     ) then
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
  if new.status is not distinct from old.status then
    return new;
  end if;

  app_role := public.current_app_role();
  if app_role is null then
    return new;
  end if;

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
    allowed :=
      (old.status = 'agendado' and new.status in ('confirmado', 'faltou', 'cancelado'))
      or (old.status = 'confirmado' and new.status in ('faltou', 'cancelado'));
  elsif app_role = 'professional' then
    allowed :=
      (old.status = 'agendado' and new.status in ('confirmado', 'faltou', 'cancelado'))
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

-- Preserve the existing atomic RPC contract while removing the legacy role from
-- the accepted managed-role set after final cutover.
create or replace function public.admin_create_team_profile_atomic(
  p_profile_id uuid,
  p_clinic_id uuid,
  p_email text,
  p_nome text,
  p_role text,
  p_registro text default null,
  p_cor text default '#9ab8c9',
  p_ativo boolean default true,
  p_telefone text default null,
  p_professional_type text default null,
  p_council_type text default null,
  p_council_state text default null,
  p_especialidade text default null,
  p_must_change_password boolean default true,
  p_unit_ids uuid[] default array[]::uuid[]
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_ids uuid[] := array[]::uuid[];
  v_valid_unit_count integer := 0;
  v_profile public.profiles;
begin
  if p_profile_id is null or p_clinic_id is null then
    raise exception using errcode = '22023', message = 'Perfil e clinica sao obrigatorios.';
  end if;

  if nullif(btrim(coalesce(p_email, '')), '') is null or nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception using errcode = '22023', message = 'Email e nome sao obrigatorios.';
  end if;

  if p_role not in ('admin', 'professional', 'recep', 'financeiro') then
    raise exception using errcode = '22023', message = 'Papel invalido para administracao de equipe.';
  end if;

  select coalesce(array_agg(distinct unit_id order by unit_id), array[]::uuid[])
    into v_unit_ids
  from unnest(coalesce(p_unit_ids, array[]::uuid[])) as requested(unit_id)
  where unit_id is not null;

  if cardinality(v_unit_ids) > 0 then
    select count(*)
      into v_valid_unit_count
    from public.units
    where clinic_id = p_clinic_id
      and ativo = true
      and id = any(v_unit_ids);

    if v_valid_unit_count <> cardinality(v_unit_ids) then
      raise exception using errcode = '22023', message = 'Unidade invalida ou inativa para esta clinica.';
    end if;
  end if;

  insert into public.profiles (
    id, clinic_id, email, nome, role, registro, cor, ativo, telefone,
    professional_type, council_type, council_state, especialidade, must_change_password
  ) values (
    p_profile_id,
    p_clinic_id,
    lower(btrim(p_email)),
    btrim(p_nome),
    p_role,
    nullif(btrim(coalesce(p_registro, '')), ''),
    coalesce(nullif(btrim(coalesce(p_cor, '')), ''), '#9ab8c9'),
    coalesce(p_ativo, true),
    nullif(btrim(coalesce(p_telefone, '')), ''),
    nullif(btrim(coalesce(p_professional_type, '')), ''),
    nullif(btrim(coalesce(p_council_type, '')), ''),
    nullif(upper(btrim(coalesce(p_council_state, ''))), ''),
    nullif(btrim(coalesce(p_especialidade, '')), ''),
    coalesce(p_must_change_password, true)
  )
  returning * into v_profile;

  if cardinality(v_unit_ids) > 0 then
    insert into public.profile_units (profile_id, unit_id, clinic_id)
    select p_profile_id, unit_id, p_clinic_id
    from unnest(v_unit_ids) as requested(unit_id);
  end if;

  return v_profile;
end;
$$;

create or replace function public.admin_update_team_profile_atomic(
  p_profile_id uuid,
  p_clinic_id uuid,
  p_nome text,
  p_role text,
  p_registro text default null,
  p_cor text default '#9ab8c9',
  p_telefone text default null,
  p_professional_type text default null,
  p_council_type text default null,
  p_council_state text default null,
  p_especialidade text default null,
  p_unit_ids uuid[] default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_ids uuid[] := array[]::uuid[];
  v_valid_unit_count integer := 0;
  v_existing_role text;
  v_profile public.profiles;
begin
  if p_profile_id is null or p_clinic_id is null then
    raise exception using errcode = '22023', message = 'Perfil e clinica sao obrigatorios.';
  end if;

  if nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception using errcode = '22023', message = 'Nome e obrigatorio.';
  end if;

  if p_role not in ('admin', 'professional', 'recep', 'financeiro') then
    raise exception using errcode = '22023', message = 'Papel invalido para administracao de equipe.';
  end if;

  select role
    into v_existing_role
  from public.profiles
  where id = p_profile_id
    and clinic_id = p_clinic_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Usuario nao encontrado nesta clinica.';
  end if;

  if v_existing_role = 'owner' then
    raise exception using errcode = '42501', message = 'Owner nao pode ser alterado por esta operacao.';
  end if;

  if p_unit_ids is not null then
    select coalesce(array_agg(distinct unit_id order by unit_id), array[]::uuid[])
      into v_unit_ids
    from unnest(p_unit_ids) as requested(unit_id)
    where unit_id is not null;

    if cardinality(v_unit_ids) > 0 then
      select count(*)
        into v_valid_unit_count
      from public.units
      where clinic_id = p_clinic_id
        and ativo = true
        and id = any(v_unit_ids);

      if v_valid_unit_count <> cardinality(v_unit_ids) then
        raise exception using errcode = '22023', message = 'Unidade invalida ou inativa para esta clinica.';
      end if;
    end if;
  end if;

  update public.profiles
  set
    nome = btrim(p_nome),
    role = p_role,
    registro = nullif(btrim(coalesce(p_registro, '')), ''),
    cor = coalesce(nullif(btrim(coalesce(p_cor, '')), ''), '#9ab8c9'),
    telefone = nullif(btrim(coalesce(p_telefone, '')), ''),
    professional_type = nullif(btrim(coalesce(p_professional_type, '')), ''),
    council_type = nullif(btrim(coalesce(p_council_type, '')), ''),
    council_state = nullif(upper(btrim(coalesce(p_council_state, ''))), ''),
    especialidade = nullif(btrim(coalesce(p_especialidade, '')), '')
  where id = p_profile_id
    and clinic_id = p_clinic_id
  returning * into v_profile;

  if p_unit_ids is not null then
    delete from public.profile_units
    where profile_id = p_profile_id
      and clinic_id = p_clinic_id;

    if cardinality(v_unit_ids) > 0 then
      insert into public.profile_units (profile_id, unit_id, clinic_id)
      select p_profile_id, unit_id, p_clinic_id
      from unnest(v_unit_ids) as requested(unit_id);
    end if;
  end if;

  return v_profile;
end;
$$;

revoke all on function public.admin_create_team_profile_atomic(uuid, uuid, text, text, text, text, text, boolean, text, text, text, text, text, boolean, uuid[]) from public, anon, authenticated;
revoke all on function public.admin_update_team_profile_atomic(uuid, uuid, text, text, text, text, text, text, text, text, text, uuid[]) from public, anon, authenticated;

grant execute on function public.admin_create_team_profile_atomic(uuid, uuid, text, text, text, text, text, boolean, text, text, text, text, text, boolean, uuid[]) to service_role;
grant execute on function public.admin_update_team_profile_atomic(uuid, uuid, text, text, text, text, text, text, text, text, text, uuid[]) to service_role;

-- Fail closed if an unexpected value somehow survived before committing.
do $$
begin
  if exists (
    select 1 from public.profiles
    where role::text not in ('owner', 'admin', 'professional', 'recep', 'financeiro')
  ) then
    raise exception 'non_canonical_profile_role_remains';
  end if;
end $$;

commit;
