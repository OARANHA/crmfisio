begin;

create or replace function public.admin_create_team_profile_atomic(
  p_profile_id uuid,
  p_clinic_id uuid,
  p_email text,
  p_nome text,
  p_role text,
  p_registro text default '',
  p_cor text default '#666666',
  p_ativo boolean default true,
  p_telefone text default '',
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

  if p_role not in ('admin', 'fisio', 'recep') then
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
    id,
    clinic_id,
    email,
    nome,
    role,
    registro,
    cor,
    ativo,
    telefone,
    professional_type,
    council_type,
    council_state,
    especialidade,
    must_change_password
  ) values (
    p_profile_id,
    p_clinic_id,
    lower(btrim(p_email)),
    btrim(p_nome),
    p_role,
    coalesce(p_registro, ''),
    coalesce(nullif(btrim(p_cor), ''), '#666666'),
    coalesce(p_ativo, true),
    coalesce(p_telefone, ''),
    nullif(btrim(coalesce(p_professional_type, '')), ''),
    nullif(btrim(coalesce(p_council_type, '')), ''),
    nullif(upper(btrim(coalesce(p_council_state, ''))), ''),
    nullif(btrim(coalesce(p_especialidade, '')), ''),
    coalesce(p_must_change_password, true)
  )
  returning * into v_profile;

  if cardinality(v_unit_ids) > 0 then
    insert into public.profile_units (profile_id, unit_id)
    select p_profile_id, unit_id
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
  p_registro text default '',
  p_cor text default '#666666',
  p_telefone text default '',
  p_professional_type text default null,
  p_council_type text default null,
  p_council_state text default null,
  p_especialidade text default null,
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
  v_existing_role text;
  v_profile public.profiles;
begin
  if p_profile_id is null or p_clinic_id is null then
    raise exception using errcode = '22023', message = 'Perfil e clinica sao obrigatorios.';
  end if;

  if nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception using errcode = '22023', message = 'Nome e obrigatorio.';
  end if;

  if p_role not in ('admin', 'fisio', 'recep') then
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

  update public.profiles
  set
    nome = btrim(p_nome),
    role = p_role,
    registro = coalesce(p_registro, ''),
    cor = coalesce(nullif(btrim(p_cor), ''), '#666666'),
    telefone = coalesce(p_telefone, ''),
    professional_type = nullif(btrim(coalesce(p_professional_type, '')), ''),
    council_type = nullif(btrim(coalesce(p_council_type, '')), ''),
    council_state = nullif(upper(btrim(coalesce(p_council_state, ''))), ''),
    especialidade = nullif(btrim(coalesce(p_especialidade, '')), '')
  where id = p_profile_id
    and clinic_id = p_clinic_id
  returning * into v_profile;

  delete from public.profile_units
  where profile_id = p_profile_id;

  if cardinality(v_unit_ids) > 0 then
    insert into public.profile_units (profile_id, unit_id)
    select p_profile_id, unit_id
    from unnest(v_unit_ids) as requested(unit_id);
  end if;

  return v_profile;
end;
$$;

revoke all on function public.admin_create_team_profile_atomic(uuid, uuid, text, text, text, text, text, boolean, text, text, text, text, text, boolean, uuid[]) from public, anon, authenticated;
revoke all on function public.admin_update_team_profile_atomic(uuid, uuid, text, text, text, text, text, text, text, text, text, uuid[]) from public, anon, authenticated;

grant execute on function public.admin_create_team_profile_atomic(uuid, uuid, text, text, text, text, text, boolean, text, text, text, text, text, boolean, uuid[]) to service_role;
grant execute on function public.admin_update_team_profile_atomic(uuid, uuid, text, text, text, text, text, text, text, text, text, uuid[]) to service_role;

commit;
