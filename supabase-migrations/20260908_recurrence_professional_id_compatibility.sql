-- MedicsPro — recurring appointments professional_id compatibility + role repair
--
-- The clinic-role cutover made `professional` canonical, but the historical
-- recurrence RPCs still authorized the removed `fisio` role and persisted only
-- appointment_series.fisio_id. This migration repairs that runtime boundary and
-- adds the same additive professional_id bridge already used by appointments.
--
-- Existing RPC parameter names intentionally remain p_fisio_id during this
-- compatibility phase. PostgreSQL does not allow CREATE OR REPLACE to rename
-- input parameters, and deployed clients may still use the named argument.

begin;

alter table public.appointment_series
  add column if not exists professional_id uuid;

update public.appointment_series
set professional_id = fisio_id
where professional_id is null;

create or replace function public.sync_appointment_series_professional_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.professional_id is null and new.fisio_id is null then
      raise exception 'appointment_series_professional_required' using errcode = '23502';
    end if;

    if new.professional_id is null then
      new.professional_id := new.fisio_id;
    elsif new.fisio_id is null then
      new.fisio_id := new.professional_id;
    elsif new.professional_id is distinct from new.fisio_id then
      raise exception 'appointment_series_professional_identity_conflict' using errcode = '23514';
    end if;

    return new;
  end if;

  if new.professional_id is distinct from old.professional_id
     and new.fisio_id is not distinct from old.fisio_id then
    new.fisio_id := new.professional_id;
  elsif new.fisio_id is distinct from old.fisio_id
        and new.professional_id is not distinct from old.professional_id then
    new.professional_id := new.fisio_id;
  elsif new.professional_id is distinct from new.fisio_id then
    raise exception 'appointment_series_professional_identity_conflict' using errcode = '23514';
  end if;

  if new.professional_id is null or new.fisio_id is null then
    raise exception 'appointment_series_professional_required' using errcode = '23502';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_appointment_series_professional_id() from public, anon, authenticated;

drop trigger if exists trg_sync_appointment_series_professional_id on public.appointment_series;
create trigger trg_sync_appointment_series_professional_id
before insert or update of fisio_id, professional_id
on public.appointment_series
for each row execute function public.sync_appointment_series_professional_id();

alter table public.appointment_series
  alter column professional_id set not null;

create index if not exists idx_appointment_series_professional_id
  on public.appointment_series (professional_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointment_series'::regclass
      and conname = 'appointment_series_professional_id_fkey'
  ) then
    alter table public.appointment_series
      add constraint appointment_series_professional_id_fkey
      foreign key (professional_id)
      references public.profiles(id)
      not valid;
  end if;
end $$;

alter table public.appointment_series
  validate constraint appointment_series_professional_id_fkey;

comment on column public.appointment_series.professional_id is
  'Canonical recurring-care professional reference. fisio_id remains a temporary compatibility alias.';
comment on function public.sync_appointment_series_professional_id() is
  'Temporary bidirectional bridge between appointment_series.fisio_id and professional_id.';

-- Keep the deployed signature intact while moving conflict evaluation to the
-- canonical appointments.professional_id column.
create or replace function public.preview_appointment_series(
  p_paciente_id uuid,
  p_fisio_id uuid,
  p_room_id uuid,
  p_dias_semana smallint[],
  p_hora time,
  p_duracao_min integer,
  p_data_inicio date,
  p_data_fim date
)
returns table (
  data date,
  inicio time,
  fim time,
  available boolean,
  conflict_kind text,
  conflict_detail text
)
language sql
stable
security definer
set search_path = public
as $$
with requested as (
  select d::date as data,
         p_hora as inicio,
         (p_hora + make_interval(mins => p_duracao_min))::time as fim
  from generate_series(p_data_inicio, p_data_fim, interval '1 day') d
  where extract(isodow from d)::smallint = any(p_dias_semana)
), checked as (
  select r.*,
    exists (
      select 1 from public.appointments a
      where a.clinic_id = public.current_clinic_id()
        and a.data = r.data and a.status <> 'cancelado'
        and a.professional_id = p_fisio_id
        and r.inicio < a.fim and a.inicio < r.fim
    ) as professional_conflict,
    exists (
      select 1 from public.appointments a
      where a.clinic_id = public.current_clinic_id()
        and a.data = r.data and a.status <> 'cancelado'
        and p_room_id is not null and a.room_id = p_room_id
        and r.inicio < a.fim and a.inicio < r.fim
    ) as room_conflict,
    exists (
      select 1 from public.appointments a
      where a.clinic_id = public.current_clinic_id()
        and a.data = r.data and a.status <> 'cancelado'
        and a.paciente_id = p_paciente_id
        and r.inicio < a.fim and a.inicio < r.fim
    ) as patient_conflict
  from requested r
)
select c.data, c.inicio, c.fim,
       not (c.professional_conflict or c.room_conflict or c.patient_conflict) as available,
       case when c.professional_conflict then 'professional'
            when c.room_conflict then 'room'
            when c.patient_conflict then 'patient'
            else null end as conflict_kind,
       case when c.professional_conflict then 'Profissional já ocupado neste horário'
            when c.room_conflict then 'Sala/recurso já ocupado neste horário'
            when c.patient_conflict then 'Paciente já possui atendimento neste horário'
            else null end as conflict_detail
from checked c
order by c.data;
$$;

create or replace function public.create_appointment_series(
  p_paciente_id uuid,
  p_fisio_id uuid,
  p_room_id uuid,
  p_tipo text,
  p_dias_semana smallint[],
  p_hora time,
  p_duracao_min integer,
  p_data_inicio date,
  p_data_fim date,
  p_valor integer,
  p_skip_conflicts boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_clinic uuid;
  v_series_id uuid;
  v_slot record;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  v_role := public.current_app_role();
  v_clinic := public.current_clinic_id();

  if v_role not in ('owner', 'admin', 'recep', 'professional') then
    raise exception 'Perfil sem permissão para criar recorrências' using errcode = '42501';
  end if;
  if v_role = 'professional' and p_fisio_id is distinct from auth.uid() then
    raise exception 'Profissional só pode criar recorrências para a própria agenda' using errcode = '42501';
  end if;
  if v_clinic is null then raise exception 'Clínica não identificada' using errcode = '42501'; end if;
  if p_data_fim < p_data_inicio then raise exception 'Período inválido' using errcode = '22023'; end if;
  if p_duracao_min < 15 or p_duracao_min > 240 then raise exception 'Duração inválida' using errcode = '22023'; end if;
  if nullif(trim(p_tipo), '') is null then raise exception 'Tipo de atendimento obrigatório' using errcode = '22023'; end if;
  if p_valor < 0 then raise exception 'Valor inválido' using errcode = '22023'; end if;
  if cardinality(p_dias_semana) is null or cardinality(p_dias_semana) = 0
     or not (p_dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'Dias da semana inválidos' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.patients
    where id = p_paciente_id
      and clinic_id = v_clinic
      and deleted_at is null
      and coalesce(anonimizado, false) = false
  ) then
    raise exception 'Paciente inválido para esta clínica' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_fisio_id
      and clinic_id = v_clinic
      and ativo = true
      and role::text in ('professional', 'owner', 'admin')
      and lower(trim(coalesce(professional_type, ''))) in (
        'fisioterapeuta', 'fisioterapia', 'physiotherapist', 'physical therapist',
        'psicologo', 'psicólogo', 'psicologa', 'psicóloga', 'psychologist',
        'medico', 'médico', 'medica', 'médica', 'physician', 'doctor',
        'quiropraxista', 'quiropraxia', 'chiropractor', 'chiropractic'
      )
  ) then
    raise exception 'Profissional inválido para esta clínica' using errcode = '42501';
  end if;

  if p_room_id is not null and not exists (
    select 1 from public.rooms where id = p_room_id and clinic_id = v_clinic and ativo = true
  ) then
    raise exception 'Sala/recurso inválido para esta clínica' using errcode = '42501';
  end if;

  insert into public.appointment_series (
    clinic_id, paciente_id, professional_id, room_id, tipo, dias_semana, hora,
    duracao_min, data_inicio, data_fim, valor, created_by
  ) values (
    v_clinic, p_paciente_id, p_fisio_id, p_room_id, trim(p_tipo), p_dias_semana,
    p_hora, p_duracao_min, p_data_inicio, p_data_fim, p_valor, auth.uid()
  ) returning id into v_series_id;

  for v_slot in
    select * from public.preview_appointment_series(
      p_paciente_id, p_fisio_id, p_room_id, p_dias_semana,
      p_hora, p_duracao_min, p_data_inicio, p_data_fim
    )
  loop
    if not v_slot.available then
      if not p_skip_conflicts then
        raise exception 'Conflito em %: %', v_slot.data, v_slot.conflict_detail using errcode = 'P0001';
      end if;
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.appointments (
      clinic_id, paciente_id, professional_id, room_id, data, inicio, fim,
      status, tipo, valor, pacote_id, serie_id, notas
    ) values (
      v_clinic, p_paciente_id, p_fisio_id, p_room_id, v_slot.data,
      v_slot.inicio, v_slot.fim, 'agendado', trim(p_tipo), p_valor, null,
      v_series_id, 'Gerado por série recorrente'
    );
    v_created := v_created + 1;
  end loop;

  if v_created = 0 then
    raise exception 'Nenhum horário disponível para criar a série' using errcode = 'P0001';
  end if;

  return jsonb_build_object('series_id', v_series_id, 'created', v_created, 'skipped', v_skipped);
end;
$$;

create or replace function public.cancel_appointment_series(
  p_series_id uuid,
  p_reason text default 'Série cancelada'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_clinic uuid := public.current_clinic_id();
  v_cancelled integer := 0;
  v_series_professional uuid;
begin
  if v_role not in ('owner', 'admin', 'recep', 'professional') then
    raise exception 'Perfil sem permissão para cancelar séries' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Informe o motivo do cancelamento' using errcode = '22023';
  end if;

  select professional_id into v_series_professional
  from public.appointment_series
  where id = p_series_id and clinic_id = v_clinic;

  if not found then raise exception 'Série não encontrada' using errcode = 'P0002'; end if;
  if v_role = 'professional' and v_series_professional is distinct from auth.uid() then
    raise exception 'Profissional só pode cancelar recorrências da própria agenda' using errcode = '42501';
  end if;

  update public.appointments
  set status = 'cancelado', cancellation_reason = trim(p_reason), updated_at = now()
  where clinic_id = v_clinic
    and serie_id = p_series_id
    and data >= current_date
    and status in ('agendado', 'confirmado');
  get diagnostics v_cancelled = row_count;

  update public.appointment_series
  set status = 'cancelada', cancelled_at = now(), cancellation_reason = trim(p_reason), updated_at = now()
  where id = p_series_id and clinic_id = v_clinic;

  return jsonb_build_object('series_id', p_series_id, 'cancelled_appointments', v_cancelled);
end;
$$;

revoke all on function public.preview_appointment_series(uuid, uuid, uuid, smallint[], time, integer, date, date) from public;
revoke all on function public.create_appointment_series(uuid, uuid, uuid, text, smallint[], time, integer, date, date, integer, boolean) from public;
revoke all on function public.cancel_appointment_series(uuid, text) from public;
grant execute on function public.preview_appointment_series(uuid, uuid, uuid, smallint[], time, integer, date, date) to authenticated;
grant execute on function public.create_appointment_series(uuid, uuid, uuid, text, smallint[], time, integer, date, date, integer, boolean) to authenticated;
grant execute on function public.cancel_appointment_series(uuid, text) to authenticated;

commit;
