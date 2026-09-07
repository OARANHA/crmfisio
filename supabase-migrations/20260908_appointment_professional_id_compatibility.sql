-- MedicsPro — appointment professional_id compatibility bridge
-- Phase 1 of the structural rename from appointments.fisio_id to professional_id.
--
-- This migration is intentionally additive. Existing clients may keep writing
-- fisio_id while newer clients move to professional_id. A BEFORE trigger keeps
-- both columns identical and rejects ambiguous writes.

begin;

alter table public.appointments
  add column if not exists professional_id uuid;

update public.appointments
set professional_id = fisio_id
where professional_id is null;

create or replace function public.sync_appointment_professional_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.professional_id is null and new.fisio_id is null then
      raise exception 'appointment_professional_required' using errcode = '23502';
    end if;

    if new.professional_id is null then
      new.professional_id := new.fisio_id;
    elsif new.fisio_id is null then
      new.fisio_id := new.professional_id;
    elsif new.professional_id is distinct from new.fisio_id then
      raise exception 'appointment_professional_identity_conflict' using errcode = '23514';
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
    raise exception 'appointment_professional_identity_conflict' using errcode = '23514';
  end if;

  if new.professional_id is null or new.fisio_id is null then
    raise exception 'appointment_professional_required' using errcode = '23502';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_appointment_professional_id() from public, anon, authenticated;

drop trigger if exists trg_sync_appointment_professional_id on public.appointments;
create trigger trg_sync_appointment_professional_id
before insert or update of fisio_id, professional_id
on public.appointments
for each row execute function public.sync_appointment_professional_id();

alter table public.appointments
  alter column professional_id set not null;

create index if not exists idx_appointments_professional_id
  on public.appointments (professional_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_professional_id_fkey'
  ) then
    alter table public.appointments
      add constraint appointments_professional_id_fkey
      foreign key (professional_id)
      references public.profiles(id)
      not valid;
  end if;
end $$;

alter table public.appointments
  validate constraint appointments_professional_id_fkey;

comment on column public.appointments.professional_id is
  'Canonical care-professional reference. fisio_id is a temporary compatibility alias during staged cutover.';
comment on function public.sync_appointment_professional_id() is
  'Temporary bidirectional compatibility bridge between appointments.fisio_id and professional_id. Remove after all consumers and DB policies use professional_id.';

commit;
