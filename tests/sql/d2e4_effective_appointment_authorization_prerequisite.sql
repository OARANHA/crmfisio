-- Minimal disposable prerequisite for applying the canonical 20260909 clinical
-- authorization reconciliation inside the D2-E4 PostgreSQL 16 harness.
-- The historical Nexus bootstrap used by D2-E4 predates patient_journey_events;
-- production already has this table. Do not copy/redefine the appointment guard
-- here: the harness must load that body from the real migration.

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
