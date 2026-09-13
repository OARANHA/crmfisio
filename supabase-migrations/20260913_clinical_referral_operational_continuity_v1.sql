-- MedicsPro — D2-E4 Referral Operational Continuity V1
-- The operational handoff is deliberately outside the immutable clinical document.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.clinical_referral_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  referral_document_id uuid NOT NULL UNIQUE REFERENCES public.clinical_documents(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  target_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  destination_scope text NOT NULL CHECK (destination_scope IN ('internal_professional', 'internal_service')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'scheduled', 'completed', 'declined', 'canceled')),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((destination_scope = 'internal_professional' AND target_profile_id IS NOT NULL) OR destination_scope = 'internal_service')
);

CREATE TABLE IF NOT EXISTS public.clinical_referral_operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.clinical_referral_operations(id) ON DELETE RESTRICT,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('received', 'scheduled', 'rescheduled', 'completed')),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_referral_operations_clinic_target_idx
  ON public.clinical_referral_operations (clinic_id, target_profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS clinical_referral_operation_events_operation_idx
  ON public.clinical_referral_operation_events (operation_id, created_at);

ALTER TABLE public.clinical_referral_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_referral_operation_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.clinical_referral_operation_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_referral_operation_updated_at ON public.clinical_referral_operations;
CREATE TRIGGER trg_clinical_referral_operation_updated_at BEFORE UPDATE ON public.clinical_referral_operations
FOR EACH ROW EXECUTE FUNCTION public.clinical_referral_operation_updated_at();

CREATE OR REPLACE FUNCTION public.open_clinical_referral_operation(p_referral_document_id uuid)
RETURNS public.clinical_referral_operations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_doc public.clinical_documents; v_scope text; v_target uuid; v_existing public.clinical_referral_operations; v_row public.clinical_referral_operations;
BEGIN
  IF auth.uid() IS NULL OR public.current_clinic_id() IS NULL THEN RAISE EXCEPTION 'clinical_referral_operation_auth_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_doc FROM public.clinical_documents WHERE id=p_referral_document_id AND clinic_id=public.current_clinic_id() FOR UPDATE;
  IF NOT FOUND OR v_doc.document_type <> 'referral' OR v_doc.status <> 'issued' THEN RAISE EXCEPTION 'clinical_referral_operation_referral_unavailable' USING ERRCODE='42501'; END IF;
  -- Only a clinician who can read this clinical record may originate the handoff.
  IF public.can_access_patient_clinical_record(v_doc.patient_id) IS NOT TRUE THEN RAISE EXCEPTION 'clinical_referral_operation_referral_unavailable' USING ERRCODE='42501'; END IF;
  v_scope := coalesce(nullif(btrim(v_doc.payload_snapshot->>'destination_scope'), ''), 'external');
  IF v_scope NOT IN ('internal_professional','internal_service') THEN RAISE EXCEPTION 'clinical_referral_operation_internal_required' USING ERRCODE='22023'; END IF;
  IF v_scope='internal_professional' THEN
    BEGIN v_target := (v_doc.payload_snapshot->>'target_profile_id')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'clinical_referral_operation_target_invalid' USING ERRCODE='23514'; END;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=v_target AND p.clinic_id=v_doc.clinic_id AND p.ativo IS TRUE) THEN RAISE EXCEPTION 'clinical_referral_operation_target_invalid' USING ERRCODE='23514'; END IF;
  END IF;
  SELECT * INTO v_existing FROM public.clinical_referral_operations WHERE referral_document_id=v_doc.id;
  IF FOUND THEN RETURN v_existing; END IF;
  INSERT INTO public.clinical_referral_operations(clinic_id,referral_document_id,patient_id,target_profile_id,destination_scope,created_by)
  VALUES(v_doc.clinic_id,v_doc.id,v_doc.patient_id,v_target,v_scope,auth.uid())
  ON CONFLICT (referral_document_id) DO NOTHING RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.clinical_referral_operations WHERE referral_document_id=v_doc.id;
    RETURN v_row;
  END IF;
  INSERT INTO public.clinical_referral_operation_events(operation_id,clinic_id,event_type,actor_id) VALUES(v_row.id,v_row.clinic_id,'received',auth.uid());
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_clinical_referral_operation(
  p_operation_id uuid, p_data date, p_inicio time, p_fim time, p_professional_id uuid, p_room_id uuid,
  p_tipo text DEFAULT 'Atendimento clínico', p_valor integer DEFAULT 0, p_pacote_id uuid DEFAULT NULL
) RETURNS public.appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_op public.clinical_referral_operations; v_app public.appointments; v_doc public.clinical_documents; v_role text; v_uid uuid := auth.uid();
BEGIN
  v_role := public.current_app_role();
  IF v_uid IS NULL OR v_role NOT IN ('owner','admin','recep','professional') THEN RAISE EXCEPTION 'clinical_referral_operation_schedule_denied' USING ERRCODE='42501'; END IF;
  IF p_fim <= p_inicio OR p_data IS NULL OR p_professional_id IS NULL THEN RAISE EXCEPTION 'clinical_referral_operation_schedule_invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_op FROM public.clinical_referral_operations WHERE id=p_operation_id AND clinic_id=public.current_clinic_id() FOR UPDATE;
  IF NOT FOUND OR v_op.status IN ('declined','canceled','completed') THEN RAISE EXCEPTION 'clinical_referral_operation_unavailable' USING ERRCODE='42501'; END IF;
  IF v_op.appointment_id IS NOT NULL THEN SELECT * INTO v_app FROM public.appointments WHERE id=v_op.appointment_id; RETURN v_app; END IF;
  IF v_role='professional' AND p_professional_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'clinical_referral_operation_self_schedule_required' USING ERRCODE='42501'; END IF;
  IF v_op.destination_scope='internal_professional' AND p_professional_id IS DISTINCT FROM v_op.target_profile_id THEN RAISE EXCEPTION 'clinical_referral_operation_target_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_doc FROM public.clinical_documents WHERE id=v_op.referral_document_id AND clinic_id=v_op.clinic_id AND status='issued' AND document_type='referral';
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=p_professional_id AND p.clinic_id=v_op.clinic_id AND p.ativo IS TRUE
      AND lower(btrim(coalesce(p.professional_type,''))) IN ('medico','fisioterapeuta','psicologo','quiropraxista')
      AND (v_op.destination_scope='internal_professional' OR (
        (nullif(btrim(v_doc.payload_snapshot->'recipient'->>'professional_type'),'') IS NOT NULL AND lower(btrim(coalesce(p.professional_type,'')))=lower(btrim(v_doc.payload_snapshot->'recipient'->>'professional_type')))
        OR (nullif(btrim(v_doc.payload_snapshot->'recipient'->>'specialty'),'') IS NOT NULL AND lower(btrim(coalesce(to_jsonb(p)->>'especialidade',to_jsonb(p)->>'specialty','')))=lower(btrim(v_doc.payload_snapshot->'recipient'->>'specialty')))
        OR (nullif(btrim(v_doc.payload_snapshot->'recipient'->>'service'),'') IS NOT NULL AND lower(btrim(coalesce(to_jsonb(p)->>'especialidade',to_jsonb(p)->>'specialty','')))=lower(btrim(v_doc.payload_snapshot->'recipient'->>'service')))
      ))
  ) THEN RAISE EXCEPTION 'clinical_referral_operation_target_invalid' USING ERRCODE='23514'; END IF;
  IF p_room_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rooms r WHERE r.id=p_room_id AND r.clinic_id=v_op.clinic_id AND r.ativo IS TRUE) THEN RAISE EXCEPTION 'clinical_referral_operation_room_invalid' USING ERRCODE='23514'; END IF;
  INSERT INTO public.appointments(clinic_id,paciente_id,fisio_id,professional_id,room_id,data,inicio,fim,status,tipo,valor,pacote_id,notas)
  VALUES(v_op.clinic_id,v_op.patient_id,p_professional_id,p_professional_id,p_room_id,p_data,p_inicio,p_fim,'agendado',coalesce(nullif(btrim(p_tipo),''),'Atendimento clínico'),greatest(coalesce(p_valor,0),0),p_pacote_id,NULL)
  RETURNING * INTO v_app;
  UPDATE public.clinical_referral_operations SET appointment_id=v_app.id,status='scheduled' WHERE id=v_op.id;
  INSERT INTO public.clinical_referral_operation_events(operation_id,clinic_id,event_type,actor_id,appointment_id) VALUES(v_op.id,v_op.clinic_id,'scheduled',v_uid,v_app.id);
  RETURN v_app;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_clinical_referral_operation_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_op public.clinical_referral_operations;
BEGIN
  IF NEW.rescheduled_from_id IS NULL THEN RETURN NEW; END IF;
  SELECT o.* INTO v_op FROM public.clinical_referral_operations o WHERE o.appointment_id=NEW.rescheduled_from_id FOR UPDATE;
  IF FOUND THEN
    UPDATE public.clinical_referral_operations SET appointment_id=NEW.id,status='scheduled' WHERE id=v_op.id;
    INSERT INTO public.clinical_referral_operation_events(operation_id,clinic_id,event_type,appointment_id,metadata) VALUES(v_op.id,v_op.clinic_id,'rescheduled',NEW.id,jsonb_build_object('replaced_appointment_id',NEW.rescheduled_from_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_clinical_referral_operation_appointment ON public.appointments;
CREATE TRIGGER trg_sync_clinical_referral_operation_appointment AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_clinical_referral_operation_appointment();

REVOKE ALL ON TABLE public.clinical_referral_operations, public.clinical_referral_operation_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_clinical_referral_operation(uuid), public.schedule_clinical_referral_operation(uuid,date,time,time,uuid,uuid,text,integer,uuid), public.sync_clinical_referral_operation_appointment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_clinical_referral_operation(uuid), public.schedule_clinical_referral_operation(uuid,date,time,time,uuid,uuid,text,integer,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_clinical_referral_operation_appointment() TO service_role;

COMMIT;
