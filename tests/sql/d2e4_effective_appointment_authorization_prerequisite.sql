-- Minimal disposable prerequisites for loading the canonical effective
-- appointment authorization stack inside the D2-E4 PostgreSQL 16 harness.
-- The historical Nexus bootstrap used by D2-E4 predates these production tables.
-- Do not copy/redefine appointment authorization functions here: their bodies
-- must continue to come from the real versioned migrations.

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
