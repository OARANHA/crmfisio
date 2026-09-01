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

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_one_open_entry_per_patient_idx
  ON public.waitlist_entries (clinic_id, patient_id)
  WHERE status IN ('aguardando', 'ofertado');

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
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_id AND p.clinic_id = clinic_id
  )
  AND (
    professional_id IS NULL OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = professional_id AND p.clinic_id = clinic_id
    )
  )
  AND (
    unit_id IS NULL OR EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = unit_id AND u.clinic_id = clinic_id
    )
  )
);

DROP POLICY IF EXISTS waitlist_update_operational ON public.waitlist_entries;
CREATE POLICY waitlist_update_operational
ON public.waitlist_entries
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_id AND p.clinic_id = clinic_id
  )
);

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

CREATE OR REPLACE FUNCTION public.claim_waitlist_slot(
  p_waitlist_id uuid,
  p_cancelled_appointment_id uuid
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_clinic uuid;
  v_wait public.waitlist_entries%ROWTYPE;
  v_slot public.appointments%ROWTYPE;
  v_new public.appointments%ROWTYPE;
BEGIN
  v_role := public.current_app_role();
  v_clinic := public.current_clinic_id();

  IF v_role NOT IN ('owner', 'admin', 'recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão para preencher vaga da lista de espera'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_wait
  FROM public.waitlist_entries
  WHERE id = p_waitlist_id
  FOR UPDATE;

  IF NOT FOUND OR v_wait.clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Entrada da lista de espera não encontrada';
  END IF;

  IF v_wait.status NOT IN ('aguardando', 'ofertado') THEN
    RAISE EXCEPTION 'Entrada da lista de espera não está disponível';
  END IF;

  SELECT * INTO v_slot
  FROM public.appointments
  WHERE id = p_cancelled_appointment_id
  FOR UPDATE;

  IF NOT FOUND OR v_slot.clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Vaga liberada não encontrada';
  END IF;

  IF v_slot.status <> 'cancelado' THEN
    RAISE EXCEPTION 'O horário selecionado não está mais liberado';
  END IF;

  INSERT INTO public.appointments (
    clinic_id,
    paciente_id,
    fisio_id,
    room_id,
    data,
    inicio,
    fim,
    status,
    tipo,
    valor,
    pacote_id,
    serie_id,
    notas,
    is_fit_in
  ) VALUES (
    v_slot.clinic_id,
    v_wait.patient_id,
    v_slot.fisio_id,
    v_slot.room_id,
    v_slot.data,
    v_slot.inicio,
    v_slot.fim,
    'agendado',
    v_slot.tipo,
    v_slot.valor,
    NULL,
    NULL,
    concat_ws(E'\n', NULLIF(v_wait.notes, ''), 'Encaixe originado da lista de espera.'),
    true
  )
  RETURNING * INTO v_new;

  UPDATE public.waitlist_entries
  SET status = 'agendado', booked_appointment_id = v_new.id
  WHERE id = v_wait.id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_waitlist_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_waitlist_slot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_waitlist_slot(uuid, uuid) TO authenticated;

COMMIT;
