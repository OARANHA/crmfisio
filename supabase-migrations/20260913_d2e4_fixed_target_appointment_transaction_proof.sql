-- D2-E4 hotfix: narrowly proves a fixed referral target inside one transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.clinical_referral_operation_events
  ADD COLUMN IF NOT EXISTS transaction_xid bigint,
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS target_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.clinical_referral_operation_events DROP CONSTRAINT IF EXISTS clinical_referral_operation_events_event_type_check;
ALTER TABLE public.clinical_referral_operation_events ADD CONSTRAINT clinical_referral_operation_events_event_type_check
  CHECK (event_type IN ('received','scheduled','rescheduled','completed','appointment_insert_authorized'));
CREATE INDEX IF NOT EXISTS clinical_referral_operation_events_tx_proof_idx
  ON public.clinical_referral_operation_events (transaction_xid, clinic_id, patient_id, actor_id, target_profile_id, operation_id)
  WHERE event_type = 'appointment_insert_authorized';

CREATE OR REPLACE FUNCTION public.guard_appointment_mutation_boundary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role text := public.current_app_role(); v_jwt_role text := coalesce(auth.role(), ''); v_assigned uuid; v_proven boolean := false;
BEGIN
  IF v_jwt_role='service_role' OR (v_jwt_role='' AND session_user IN ('postgres','supabase_admin')) THEN RETURN NEW; END IF;
  IF v_role IS NULL THEN RAISE EXCEPTION 'appointment_active_tenant_role_required' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    v_assigned:=coalesce(NEW.professional_id,NEW.fisio_id);
    IF v_role='professional' AND (auth.uid() IS NULL OR v_assigned IS DISTINCT FROM auth.uid()) THEN
      SELECT EXISTS (SELECT 1 FROM public.clinical_referral_operation_events e JOIN public.clinical_referral_operations o ON o.id=e.operation_id
        WHERE e.event_type='appointment_insert_authorized' AND e.transaction_xid=txid_current()
          AND e.clinic_id=NEW.clinic_id AND e.patient_id=NEW.paciente_id AND e.actor_id=auth.uid()
          AND e.target_profile_id=v_assigned AND o.clinic_id=NEW.clinic_id AND o.patient_id=NEW.paciente_id
          AND o.target_profile_id=v_assigned AND o.destination_scope='internal_professional' AND o.appointment_id IS NULL) INTO v_proven;
      IF NOT v_proven THEN RAISE EXCEPTION 'appointment_professional_self_assignment_required' USING ERRCODE='42501'; END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF v_role='professional' AND (auth.uid() IS NULL OR OLD.professional_id IS DISTINCT FROM auth.uid() OR NEW.professional_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'appointment_professional_self_mutation_required' USING ERRCODE='42501';
  END IF;
  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id OR NEW.professional_id IS DISTINCT FROM OLD.professional_id OR NEW.fisio_id IS DISTINCT FROM OLD.fisio_id OR NEW.room_id IS DISTINCT FROM OLD.room_id OR NEW.data IS DISTINCT FROM OLD.data OR NEW.inicio IS DISTINCT FROM OLD.inicio OR NEW.fim IS DISTINCT FROM OLD.fim OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.pacote_id IS DISTINCT FROM OLD.pacote_id OR NEW.serie_id IS DISTINCT FROM OLD.serie_id OR NEW.is_fit_in IS DISTINCT FROM OLD.is_fit_in OR NEW.rescheduled_from_id IS DISTINCT FROM OLD.rescheduled_from_id THEN RAISE EXCEPTION 'appointment_structural_update_requires_canonical_flow' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END; $$;

-- The D2-E4 RPC already validates the fixed target. Insert this proof immediately
-- before its canonical appointment INSERT; it rolls back with any failed insert.
CREATE OR REPLACE FUNCTION public.authorize_d2e4_fixed_target_insert(p_operation public.clinical_referral_operations, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_operation.destination_scope <> 'internal_professional' OR p_operation.target_profile_id IS NULL OR p_actor IS NULL THEN RAISE EXCEPTION 'clinical_referral_operation_proof_invalid' USING ERRCODE='42501'; END IF;
  INSERT INTO public.clinical_referral_operation_events(operation_id,clinic_id,event_type,actor_id,transaction_xid,patient_id,target_profile_id)
  VALUES(p_operation.id,p_operation.clinic_id,'appointment_insert_authorized',p_actor,txid_current(),p_operation.patient_id,p_operation.target_profile_id);
END; $$;
REVOKE ALL ON FUNCTION public.authorize_d2e4_fixed_target_insert(public.clinical_referral_operations,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_d2e4_fixed_target_insert(public.clinical_referral_operations,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.schedule_clinical_referral_operation(p_operation_id uuid,p_data date,p_inicio time,p_fim time,p_professional_id uuid,p_room_id uuid,p_tipo text DEFAULT 'Atendimento clínico',p_valor integer DEFAULT 0,p_pacote_id uuid DEFAULT NULL)
RETURNS public.appointments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_op public.clinical_referral_operations; v_app public.appointments; v_doc public.clinical_documents; v_role text; v_uid uuid:=auth.uid();
BEGIN
  v_role:=public.current_app_role();
  IF v_uid IS NULL OR v_role NOT IN ('owner','admin','recep','professional') THEN RAISE EXCEPTION 'clinical_referral_operation_schedule_denied' USING ERRCODE='42501'; END IF;
  IF p_fim<=p_inicio OR p_data IS NULL OR p_professional_id IS NULL THEN RAISE EXCEPTION 'clinical_referral_operation_schedule_invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_op FROM public.clinical_referral_operations WHERE id=p_operation_id AND clinic_id=public.current_clinic_id() FOR UPDATE;
  IF NOT FOUND OR v_op.status IN ('declined','canceled','completed') THEN RAISE EXCEPTION 'clinical_referral_operation_unavailable' USING ERRCODE='42501'; END IF;
  IF v_op.appointment_id IS NOT NULL THEN SELECT * INTO v_app FROM public.appointments WHERE id=v_op.appointment_id; RETURN v_app; END IF;
  IF v_role='professional' AND p_professional_id IS DISTINCT FROM v_uid AND NOT (v_op.destination_scope='internal_professional' AND p_professional_id IS NOT DISTINCT FROM v_op.target_profile_id) THEN RAISE EXCEPTION 'clinical_referral_operation_self_or_fixed_target_required' USING ERRCODE='42501'; END IF;
  IF v_op.destination_scope='internal_professional' AND p_professional_id IS DISTINCT FROM v_op.target_profile_id THEN RAISE EXCEPTION 'clinical_referral_operation_target_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_doc FROM public.clinical_documents WHERE id=v_op.referral_document_id AND clinic_id=v_op.clinic_id AND status='issued' AND document_type='referral';
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_professional_id AND p.clinic_id=v_op.clinic_id AND p.ativo AND lower(btrim(coalesce(p.professional_type,''))) IN ('medico','fisioterapeuta','psicologo','quiropraxista')) THEN RAISE EXCEPTION 'clinical_referral_operation_target_invalid' USING ERRCODE='23514'; END IF;
  IF p_room_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=p_room_id AND r.clinic_id=v_op.clinic_id AND r.ativo) THEN RAISE EXCEPTION 'clinical_referral_operation_room_invalid' USING ERRCODE='23514'; END IF;
  -- Only the immutable fixed target earns a same-transaction proof. Internal
  -- service remains subject to the ordinary professional self-assignment guard.
  IF v_role='professional' AND p_professional_id IS DISTINCT FROM v_uid THEN PERFORM public.authorize_d2e4_fixed_target_insert(v_op,v_uid); END IF;
  INSERT INTO public.appointments(clinic_id,paciente_id,fisio_id,professional_id,room_id,data,inicio,fim,status,tipo,valor,pacote_id,notas)
  VALUES(v_op.clinic_id,v_op.patient_id,p_professional_id,p_professional_id,p_room_id,p_data,p_inicio,p_fim,'agendado',coalesce(nullif(btrim(p_tipo),''),'Atendimento clínico'),greatest(coalesce(p_valor,0),0),p_pacote_id,NULL) RETURNING * INTO v_app;
  UPDATE public.clinical_referral_operations SET appointment_id=v_app.id,status='scheduled' WHERE id=v_op.id;
  INSERT INTO public.clinical_referral_operation_events(operation_id,clinic_id,event_type,actor_id,appointment_id) VALUES(v_op.id,v_op.clinic_id,'scheduled',v_uid,v_app.id);
  RETURN v_app;
END; $$;

REVOKE ALL ON FUNCTION public.schedule_clinical_referral_operation(uuid,date,time,time,uuid,uuid,text,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_clinical_referral_operation(uuid,date,time,time,uuid,uuid,text,integer,uuid) TO authenticated, service_role;
COMMIT;
