BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_journey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  from_stage text NOT NULL CHECK (from_stage IN ('lead','avaliacao','tratamento','alta')),
  to_stage text NOT NULL CHECK (to_stage IN ('lead','avaliacao','tratamento','alta')),
  reason text NOT NULL,
  notes text,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_journey_events_patient_created
  ON public.patient_journey_events(patient_id, created_at DESC);

ALTER TABLE public.patient_journey_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_events_select_tenant ON public.patient_journey_events;
CREATE POLICY journey_events_select_tenant ON public.patient_journey_events
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

-- Eventos são append-only pela aplicação; transições são registradas pela RPC abaixo.
REVOKE INSERT, UPDATE, DELETE ON public.patient_journey_events FROM authenticated;
GRANT SELECT ON public.patient_journey_events TO authenticated;

CREATE OR REPLACE FUNCTION public.transition_patient_journey(
  p_patient_id uuid,
  p_to_stage text,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(patient_id uuid, from_stage text, to_stage text, patient_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_from text;
  v_status text;
BEGIN
  SELECT * INTO v_actor
  FROM public.profiles
  WHERE id = auth.uid() AND ativo = true;

  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'Perfil ativo não encontrado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_patient
  FROM public.patients
  WHERE id = p_patient_id
    AND clinic_id = v_actor.clinic_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado na clínica' USING ERRCODE = 'P0002';
  END IF;

  IF p_to_stage NOT IN ('lead','avaliacao','tratamento','alta') THEN
    RAISE EXCEPTION 'Etapa de jornada inválida';
  END IF;

  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Motivo da transição é obrigatório';
  END IF;

  v_from := v_patient.funil_stage::text;

  IF v_from = p_to_stage THEN
    RAISE EXCEPTION 'Paciente já está nesta etapa';
  END IF;

  -- Recepção pode encaminhar o lead para avaliação, mas não toma decisões clínicas.
  IF v_from = 'lead' AND p_to_stage = 'avaliacao' THEN
    IF v_actor.role::text NOT IN ('owner','admin','fisio','recep') THEN
      RAISE EXCEPTION 'Perfil sem permissão para encaminhar à avaliação' USING ERRCODE = '42501';
    END IF;

  -- Entrada em tratamento é decisão clínica.
  ELSIF v_from = 'avaliacao' AND p_to_stage = 'tratamento' THEN
    IF v_actor.role::text <> 'fisio' THEN
      RAISE EXCEPTION 'Somente profissional clínico pode iniciar tratamento' USING ERRCODE = '42501';
    END IF;

  -- Alta clínica é exclusiva do profissional clínico.
  ELSIF v_from = 'tratamento' AND p_to_stage = 'alta' THEN
    IF v_actor.role::text <> 'fisio' THEN
      RAISE EXCEPTION 'Somente profissional clínico pode conceder alta' USING ERRCODE = '42501';
    END IF;

  -- Reabertura preserva a alta anterior. Fisio reabre clinicamente; owner/admin podem corrigir erro administrativo.
  ELSIF v_from = 'alta' AND p_to_stage = 'tratamento' THEN
    IF v_actor.role::text NOT IN ('fisio','owner','admin') THEN
      RAISE EXCEPTION 'Perfil sem permissão para reabrir tratamento' USING ERRCODE = '42501';
    END IF;

  ELSE
    RAISE EXCEPTION 'Transição de jornada não permitida: % -> %', v_from, p_to_stage USING ERRCODE = '42501';
  END IF;

  UPDATE public.patients
  SET
    funil_stage = CASE p_to_stage
      WHEN 'lead' THEN 'lead'
      WHEN 'avaliacao' THEN 'avaliacao'
      WHEN 'tratamento' THEN 'tratamento'
      WHEN 'alta' THEN 'alta'
    END,
    status = CASE WHEN p_to_stage = 'alta' THEN 'alta' ELSE 'ativo' END,
    updated_at = now()
  WHERE id = v_patient.id;

  INSERT INTO public.patient_journey_events(
    clinic_id, patient_id, from_stage, to_stage, reason, notes, actor_id, actor_role
  ) VALUES (
    v_actor.clinic_id, v_patient.id, v_from, p_to_stage, trim(p_reason), nullif(trim(coalesce(p_notes, '')), ''), v_actor.id, v_actor.role::text
  );

  v_status := CASE WHEN p_to_stage = 'alta' THEN 'alta' ELSE 'ativo' END;

  RETURN QUERY SELECT v_patient.id, v_from, p_to_stage, v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_patient_journey(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_patient_journey(uuid, text, text, text) TO authenticated;

COMMIT;
