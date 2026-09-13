-- MedicsPro — D2-E4 fixed-target appointment boundary reconciliation
-- Allows a clinician to schedule only the immutable internal-professional target
-- of a referral through the canonical D2-E4 RPC, without weakening normal
-- appointment self-assignment. The exception is proven inside the same DB tx.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.clinical_referral_operation_events
  ADD COLUMN IF NOT EXISTS transaction_xid bigint,
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS target_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.clinical_referral_operation_events
  DROP CONSTRAINT IF EXISTS clinical_referral_operation_events_event_type_check;
ALTER TABLE public.clinical_referral_operation_events
  ADD CONSTRAINT clinical_referral_operation_events_event_type_check
  CHECK (event_type IN ('received','scheduled','rescheduled','completed','appointment_insert_authorized'));

ALTER TABLE public.clinical_referral_operation_events
  DROP CONSTRAINT IF EXISTS clinical_referral_operation_events_insert_proof_shape_check;
ALTER TABLE public.clinical_referral_operation_events
  ADD CONSTRAINT clinical_referral_operation_events_insert_proof_shape_check
  CHECK (
    event_type <> 'appointment_insert_authorized'
    OR (
      transaction_xid IS NOT NULL
      AND patient_id IS NOT NULL
      AND actor_id IS NOT NULL
      AND target_profile_id IS NOT NULL
      AND appointment_id IS NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS clinical_referral_operation_events_tx_proof_idx
  ON public.clinical_referral_operation_events (
    transaction_xid, operation_id, clinic_id, patient_id, actor_id, target_profile_id
  )
  WHERE event_type = 'appointment_insert_authorized';

-- Preserve the canonical appointment mutation boundary. The sole INSERT
-- exception is a same-transaction proof emitted by the D2-E4 SECURITY DEFINER
-- RPC for the exact clinic/patient/actor/fixed target. Ordinary cross-professional
-- INSERT and every cross-professional UPDATE remain denied.
CREATE OR REPLACE FUNCTION public.guard_appointment_mutation_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_jwt_role text := coalesce(auth.role(), '');
  v_assigned_professional uuid;
  v_fixed_target_proven boolean := false;
BEGIN
  IF v_jwt_role = 'service_role'
     OR (v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'appointment_active_tenant_role_required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_assigned_professional := coalesce(NEW.professional_id, NEW.fisio_id);

    IF v_role = 'professional'
       AND (auth.uid() IS NULL OR v_assigned_professional IS DISTINCT FROM auth.uid()) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.clinical_referral_operation_events e
        JOIN public.clinical_referral_operations o ON o.id = e.operation_id
        WHERE e.event_type = 'appointment_insert_authorized'
          AND e.transaction_xid = txid_current()
          AND e.clinic_id = NEW.clinic_id
          AND e.patient_id = NEW.paciente_id
          AND e.actor_id = auth.uid()
          AND e.target_profile_id = v_assigned_professional
          AND o.clinic_id = NEW.clinic_id
          AND o.patient_id = NEW.paciente_id
          AND o.target_profile_id = v_assigned_professional
          AND o.destination_scope = 'internal_professional'
          AND o.status = 'received'
          AND o.appointment_id IS NULL
      ) INTO v_fixed_target_proven;

      IF NOT v_fixed_target_proven THEN
        RAISE EXCEPTION 'appointment_professional_self_assignment_required' USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_role = 'professional'
       AND (
         auth.uid() IS NULL
         OR OLD.professional_id IS DISTINCT FROM auth.uid()
         OR NEW.professional_id IS DISTINCT FROM auth.uid()
       ) THEN
      RAISE EXCEPTION 'appointment_professional_self_mutation_required' USING ERRCODE = '42501';
    END IF;

    IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
       OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
       OR NEW.professional_id IS DISTINCT FROM OLD.professional_id
       OR NEW.fisio_id IS DISTINCT FROM OLD.fisio_id
       OR NEW.room_id IS DISTINCT FROM OLD.room_id
       OR NEW.data IS DISTINCT FROM OLD.data
       OR NEW.inicio IS DISTINCT FROM OLD.inicio
       OR NEW.fim IS DISTINCT FROM OLD.fim
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.pacote_id IS DISTINCT FROM OLD.pacote_id
       OR NEW.serie_id IS DISTINCT FROM OLD.serie_id
       OR NEW.is_fit_in IS DISTINCT FROM OLD.is_fit_in
       OR NEW.rescheduled_from_id IS DISTINCT FROM OLD.rescheduled_from_id THEN
      RAISE EXCEPTION 'appointment_structural_update_requires_canonical_flow' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_clinical_referral_operation(
  p_operation_id uuid,
  p_data date,
  p_inicio time,
  p_fim time,
  p_professional_id uuid,
  p_room_id uuid,
  p_tipo text DEFAULT 'Atendimento clínico',
  p_valor integer DEFAULT 0,
  p_pacote_id uuid DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op public.clinical_referral_operations;
  v_app public.appointments;
  v_doc public.clinical_documents;
  v_role text;
  v_uid uuid := auth.uid();
  v_doc_scope text;
  v_doc_target uuid;
BEGIN
  v_role := public.current_app_role();

  IF v_uid IS NULL OR v_role NOT IN ('owner','admin','recep','professional') THEN
    RAISE EXCEPTION 'clinical_referral_operation_schedule_denied' USING ERRCODE = '42501';
  END IF;

  IF p_fim <= p_inicio OR p_data IS NULL OR p_professional_id IS NULL THEN
    RAISE EXCEPTION 'clinical_referral_operation_schedule_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_op
  FROM public.clinical_referral_operations
  WHERE id = p_operation_id
    AND clinic_id = public.current_clinic_id()
  FOR UPDATE;

  IF NOT FOUND OR v_op.status IN ('declined','canceled','completed') THEN
    RAISE EXCEPTION 'clinical_referral_operation_unavailable' USING ERRCODE = '42501';
  END IF;

  IF v_op.appointment_id IS NOT NULL THEN
    SELECT * INTO v_app FROM public.appointments WHERE id = v_op.appointment_id;
    RETURN v_app;
  END IF;

  SELECT * INTO v_doc
  FROM public.clinical_documents
  WHERE id = v_op.referral_document_id
    AND clinic_id = v_op.clinic_id
    AND patient_id = v_op.patient_id
    AND status = 'issued'
    AND document_type = 'referral';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'clinical_referral_operation_referral_mismatch' USING ERRCODE = '23514';
  END IF;

  IF v_role = 'professional'
     AND public.can_access_patient_clinical_record(v_op.patient_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_referral_operation_schedule_denied' USING ERRCODE = '42501';
  END IF;

  v_doc_scope := coalesce(nullif(btrim(v_doc.payload_snapshot->>'destination_scope'), ''), 'external');
  IF v_doc_scope IS DISTINCT FROM v_op.destination_scope THEN
    RAISE EXCEPTION 'clinical_referral_operation_destination_mismatch' USING ERRCODE = '23514';
  END IF;

  IF v_op.destination_scope = 'internal_professional' THEN
    BEGIN
      v_doc_target := (v_doc.payload_snapshot->>'target_profile_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'clinical_referral_operation_target_invalid' USING ERRCODE = '23514';
    END;

    IF v_doc_target IS NULL
       OR v_doc_target IS DISTINCT FROM v_op.target_profile_id
       OR p_professional_id IS DISTINCT FROM v_op.target_profile_id THEN
      RAISE EXCEPTION 'clinical_referral_operation_target_required' USING ERRCODE = '42501';
    END IF;
  ELSIF v_op.destination_scope = 'internal_service' THEN
    IF v_op.target_profile_id IS NOT NULL THEN
      RAISE EXCEPTION 'clinical_referral_operation_destination_mismatch' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'clinical_referral_operation_internal_required' USING ERRCODE = '22023';
  END IF;

  -- Professional users may schedule a colleague only for the exact immutable
  -- internal-professional target. Internal-service and all arbitrary colleague
  -- scheduling remain under the normal self-assignment rule.
  IF v_role = 'professional'
     AND p_professional_id IS DISTINCT FROM v_uid
     AND v_op.destination_scope IS DISTINCT FROM 'internal_professional' THEN
    RAISE EXCEPTION 'clinical_referral_operation_self_or_fixed_target_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_professional_id
      AND p.clinic_id = v_op.clinic_id
      AND p.ativo IS TRUE
      AND lower(btrim(coalesce(p.professional_type,''))) IN ('medico','fisioterapeuta','psicologo','quiropraxista')
      AND (
        v_op.destination_scope = 'internal_professional'
        OR (
          (nullif(btrim(v_doc.payload_snapshot->'recipient'->>'professional_type'),'') IS NOT NULL
            AND lower(btrim(coalesce(p.professional_type,''))) = lower(btrim(v_doc.payload_snapshot->'recipient'->>'professional_type')))
          OR (nullif(btrim(v_doc.payload_snapshot->'recipient'->>'specialty'),'') IS NOT NULL
            AND lower(btrim(coalesce(to_jsonb(p)->>'especialidade',to_jsonb(p)->>'specialty',''))) = lower(btrim(v_doc.payload_snapshot->'recipient'->>'specialty')))
          OR (nullif(btrim(v_doc.payload_snapshot->'recipient'->>'service'),'') IS NOT NULL
            AND lower(btrim(coalesce(to_jsonb(p)->>'especialidade',to_jsonb(p)->>'specialty',''))) = lower(btrim(v_doc.payload_snapshot->'recipient'->>'service')))
        )
      )
  ) THEN
    RAISE EXCEPTION 'clinical_referral_operation_target_invalid' USING ERRCODE = '23514';
  END IF;

  IF p_room_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.rooms r
       WHERE r.id = p_room_id
         AND r.clinic_id = v_op.clinic_id
         AND r.ativo IS TRUE
     ) THEN
    RAISE EXCEPTION 'clinical_referral_operation_room_invalid' USING ERRCODE = '23514';
  END IF;

  -- The proof is not callable by the browser: authenticated has no direct INSERT
  -- on the event table. It is emitted only after every D2-E4 invariant above has
  -- been revalidated and immediately before the canonical appointment INSERT.
  IF v_role = 'professional'
     AND p_professional_id IS DISTINCT FROM v_uid THEN
    INSERT INTO public.clinical_referral_operation_events(
      operation_id,
      clinic_id,
      event_type,
      actor_id,
      transaction_xid,
      patient_id,
      target_profile_id
    ) VALUES (
      v_op.id,
      v_op.clinic_id,
      'appointment_insert_authorized',
      v_uid,
      txid_current(),
      v_op.patient_id,
      v_op.target_profile_id
    );
  END IF;

  INSERT INTO public.appointments(
    clinic_id,paciente_id,fisio_id,professional_id,room_id,data,inicio,fim,status,tipo,valor,pacote_id,notas
  ) VALUES (
    v_op.clinic_id,v_op.patient_id,p_professional_id,p_professional_id,p_room_id,p_data,p_inicio,p_fim,
    'agendado',coalesce(nullif(btrim(p_tipo),''),'Atendimento clínico'),greatest(coalesce(p_valor,0),0),p_pacote_id,NULL
  )
  RETURNING * INTO v_app;

  UPDATE public.clinical_referral_operations
  SET appointment_id = v_app.id, status = 'scheduled'
  WHERE id = v_op.id;

  INSERT INTO public.clinical_referral_operation_events(
    operation_id,clinic_id,event_type,actor_id,appointment_id
  ) VALUES (
    v_op.id,v_op.clinic_id,'scheduled',v_uid,v_app.id
  );

  RETURN v_app;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_clinical_referral_operation(uuid,date,time,time,uuid,uuid,text,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_clinical_referral_operation(uuid,date,time,time,uuid,uuid,text,integer,uuid) TO authenticated, service_role;

COMMIT;
