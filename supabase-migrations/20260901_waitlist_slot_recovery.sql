-- MEDICSPRO — lista de espera e recuperação de vagas canceladas
BEGIN;

CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  preferred_days smallint[] NOT NULL DEFAULT '{}',
  period text NOT NULL DEFAULT 'qualquer' CHECK (period IN ('manha', 'tarde', 'noite', 'qualquer')),
  priority smallint NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  notes text,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'ofertado', 'agendado', 'cancelado')),
  offered_at timestamptz,
  booked_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_entries_clinic_status_idx
  ON public.waitlist_entries (clinic_id, status, priority DESC, created_at);

CREATE INDEX IF NOT EXISTS waitlist_entries_patient_idx
  ON public.waitlist_entries (patient_id, status);

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waitlist_select_tenant ON public.waitlist_entries;
CREATE POLICY waitlist_select_tenant
ON public.waitlist_entries
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS waitlist_insert_operational ON public.waitlist_entries;
CREATE POLICY waitlist_insert_operational
ON public.waitlist_entries
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
);

DROP POLICY IF EXISTS waitlist_update_operational ON public.waitlist_entries;
CREATE POLICY waitlist_update_operational
ON public.waitlist_entries
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
)
WITH CHECK (clinic_id = public.current_clinic_id());

GRANT SELECT, INSERT, UPDATE ON public.waitlist_entries TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_waitlist_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_waitlist_updated_at ON public.waitlist_entries;
CREATE TRIGGER trg_touch_waitlist_updated_at
BEFORE UPDATE ON public.waitlist_entries
FOR EACH ROW
EXECUTE FUNCTION public.touch_waitlist_updated_at();

REVOKE ALL ON FUNCTION public.touch_waitlist_updated_at() FROM PUBLIC;

COMMIT;
