-- Minimal disposable prerequisites for loading the canonical effective
-- appointment authorization stack inside the D2-E4 PostgreSQL 16 harness.
-- The historical Nexus bootstrap used by D2-E4 predates these production tables,
-- helper and appointment columns. Do not copy/redefine appointment authorization
-- functions here: their bodies must continue to come from the real migrations.

-- Supabase supplies auth.role() in production. The historical Nexus fixture only
-- defines auth.uid(), so reproduce this infrastructure helper for the disposable
-- effective-stack test database.
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')
$$;

CREATE TABLE IF NOT EXISTS public.patient_journey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  reason text NOT NULL,
  notes text,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- D2-E4 validates a room when one is supplied. Production already has rooms,
-- while the historical bootstrap does not. Only the columns read by the
-- canonical scheduling RPC are reproduced here.
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  ativo boolean NOT NULL DEFAULT true
);

-- Nexus C-06 intentionally carries only the identity columns of appointments.
-- Add the production-shape fields consumed by the canonical D2-E4 RPC and by
-- guard_appointment_mutation_boundary. This is schema fixture only; all
-- authorization logic still comes from versioned migrations.
ALTER TABLE public.appointments
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS room_id uuid,
  ADD COLUMN IF NOT EXISTS data date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS inicio time NOT NULL DEFAULT time '09:00',
  ADD COLUMN IF NOT EXISTS fim time NOT NULL DEFAULT time '10:00',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'agendado',
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'Atendimento clínico',
  ADD COLUMN IF NOT EXISTS valor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pacote_id uuid,
  ADD COLUMN IF NOT EXISTS notas text,
  ADD COLUMN IF NOT EXISTS serie_id uuid,
  ADD COLUMN IF NOT EXISTS is_fit_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rescheduled_from_id uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
