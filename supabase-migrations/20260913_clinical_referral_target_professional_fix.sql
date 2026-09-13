-- MedicsPro — D2-E4 Referral fixed-target scheduling correction
-- A professional may schedule the specific internal professional already frozen
-- in an issued referral. This does not permit arbitrary colleague scheduling.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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

  -- Professional users normally schedule themselves. The only exception is a
  -- fixed internal-professional referral: the requested professional must be
  -- exactly the immutable referral target already validated server-side.
  IF v_role='professional'
     AND p_professional_id IS DISTINCT FROM v_uid
     AND NOT (
       v_op.destination_scope='internal_professional'
       AND p_professional_id IS NOT DISTINCT FROM v_op.target_profile_id
     ) THEN
    RAISE EXCEPTION 'clinical_referral_operation_self_or_fixed_target_required' USING ERRCODE='42501';
  END IF;

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

COMMIT;
