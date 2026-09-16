-- MedicsPro — Clinical Instrument Patient Delivery V1
-- Reuses the existing self-assessment transport while introducing a neutral,
-- registry-driven clinical authority and patient_self persistence.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF to_regclass('public.clinical_instrument_catalog') IS NULL
     OR to_regclass('public.clinic_clinical_instrument_settings') IS NULL
     OR to_regclass('public.clinical_instrument_administrations') IS NULL
     OR to_regclass('public.nexus_self_assessment_invites') IS NULL
     OR to_regclass('public.wa_logs') IS NULL
     OR to_regprocedure('public.clinical_instrument_base_authorized(uuid,text)') IS NULL
     OR to_regprocedure('public.current_clinic_id()') IS NULL
     OR to_regprocedure('public.current_clinic_operational_date()') IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_prerequisite_missing';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.clinical_instrument_patient_self_contracts (
  instrument_key text NOT NULL REFERENCES public.clinical_instrument_catalog(instrument_key)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  engine_source text NOT NULL,
  engine_module_key text NOT NULL,
  engine_tool_key text NOT NULL,
  engine_rule_key text NOT NULL,
  engine_rule_version text NOT NULL,
  display_label text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  default_expires_hours integer NOT NULL DEFAULT 48,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_instrument_patient_self_contracts_pkey
    PRIMARY KEY (instrument_key, engine_rule_version),
  CONSTRAINT clinical_instrument_patient_self_contracts_source_check
    CHECK (engine_source = 'nexus'),
  CONSTRAINT clinical_instrument_patient_self_contracts_label_check
    CHECK (btrim(display_label) <> ''),
  CONSTRAINT clinical_instrument_patient_self_contracts_expiry_check
    CHECK (default_expires_hours BETWEEN 1 AND 168)
);

COMMENT ON TABLE public.clinical_instrument_patient_self_contracts IS
  'Versioned allowlist for neutral patient_self delivery. Nexus/catalog membership alone never enables remote delivery.';

CREATE UNIQUE INDEX IF NOT EXISTS clinical_instrument_patient_self_one_active_version_idx
  ON public.clinical_instrument_patient_self_contracts(instrument_key)
  WHERE active IS TRUE;

ALTER TABLE public.clinical_instrument_patient_self_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinical_instrument_patient_self_contracts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.clinical_instrument_patient_self_contracts TO service_role;

CREATE OR REPLACE FUNCTION public.validate_clinical_instrument_patient_self_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.instrument_key IS DISTINCT FROM OLD.instrument_key
    OR NEW.engine_source IS DISTINCT FROM OLD.engine_source
    OR NEW.engine_module_key IS DISTINCT FROM OLD.engine_module_key
    OR NEW.engine_tool_key IS DISTINCT FROM OLD.engine_tool_key
    OR NEW.engine_rule_key IS DISTINCT FROM OLD.engine_rule_key
    OR NEW.engine_rule_version IS DISTINCT FROM OLD.engine_rule_version
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_contract_identity_immutable' USING ERRCODE = '55000';
  END IF;

  IF NEW.active IS TRUE AND NOT EXISTS (
    SELECT 1
    FROM public.clinical_instrument_catalog c
    WHERE c.instrument_key = NEW.instrument_key
      AND c.engine_source = NEW.engine_source
      AND c.engine_module_key = NEW.engine_module_key
      AND c.engine_tool_key = NEW.engine_tool_key
      AND c.engine_rule_key = NEW.engine_rule_key
      AND c.engine_rule_version = NEW.engine_rule_version
      AND c.active IS TRUE
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_contract_catalog_mismatch' USING ERRCODE = '22023';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_clinical_instrument_patient_self_contract()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_clinical_instrument_patient_self_contract
  ON public.clinical_instrument_patient_self_contracts;
CREATE TRIGGER trg_validate_clinical_instrument_patient_self_contract
BEFORE INSERT OR UPDATE ON public.clinical_instrument_patient_self_contracts
FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_instrument_patient_self_contract();

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.clinical_instrument_catalog c
  WHERE c.instrument_key IN ('phq9','gad7')
    AND c.active IS TRUE
    AND c.engine_source = 'nexus';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_seed_contract_missing';
  END IF;
END;
$$;

INSERT INTO public.clinical_instrument_patient_self_contracts(
  instrument_key, engine_source, engine_module_key, engine_tool_key,
  engine_rule_key, engine_rule_version, display_label, active, default_expires_hours
)
SELECT
  c.instrument_key, c.engine_source, c.engine_module_key, c.engine_tool_key,
  c.engine_rule_key, c.engine_rule_version,
  CASE c.instrument_key WHEN 'phq9' THEN 'PHQ-9' WHEN 'gad7' THEN 'GAD-7' END,
  true, 48
FROM public.clinical_instrument_catalog c
WHERE c.instrument_key IN ('phq9','gad7')
ON CONFLICT (instrument_key, engine_rule_version) DO UPDATE
SET engine_source = EXCLUDED.engine_source,
    engine_module_key = EXCLUDED.engine_module_key,
    engine_tool_key = EXCLUDED.engine_tool_key,
    engine_rule_key = EXCLUDED.engine_rule_key,
    display_label = EXCLUDED.display_label,
    default_expires_hours = EXCLUDED.default_expires_hours,
    updated_at = now();

ALTER TABLE public.nexus_self_assessment_invites
  ADD COLUMN IF NOT EXISTS authority_source text NOT NULL DEFAULT 'nexus',
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS processed_administration_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nexus_self_assessment_invites'::regclass
      AND conname = 'nexus_self_assessment_authority_source_check'
  ) THEN
    ALTER TABLE public.nexus_self_assessment_invites
      ADD CONSTRAINT nexus_self_assessment_authority_source_check
      CHECK (authority_source IN ('nexus','clinical_instrument'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nexus_self_assessment_invites'::regclass
      AND conname = 'nexus_self_assessment_processed_administration_fkey'
  ) THEN
    ALTER TABLE public.nexus_self_assessment_invites
      ADD CONSTRAINT nexus_self_assessment_processed_administration_fkey
      FOREIGN KEY (processed_administration_id)
      REFERENCES public.clinical_instrument_administrations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nexus_self_assessment_invites'::regclass
      AND conname = 'nexus_self_assessment_authority_result_check'
  ) THEN
    ALTER TABLE public.nexus_self_assessment_invites
      ADD CONSTRAINT nexus_self_assessment_authority_result_check
      CHECK (
        (authority_source = 'nexus' AND processed_administration_id IS NULL)
        OR
        (authority_source = 'clinical_instrument' AND processed_result_id IS NULL AND request_id IS NOT NULL)
      );
  END IF;
END;
$$;

DROP POLICY IF EXISTS nexus_self_assessment_authority_read_guard
  ON public.nexus_self_assessment_invites;
CREATE POLICY nexus_self_assessment_authority_read_guard
ON public.nexus_self_assessment_invites
AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (authority_source = 'nexus');

CREATE UNIQUE INDEX IF NOT EXISTS nexus_self_assessment_clinical_request_idx
  ON public.nexus_self_assessment_invites(professional_id, appointment_id, request_id)
  WHERE authority_source = 'clinical_instrument' AND request_id IS NOT NULL;

ALTER TABLE public.clinical_instrument_administrations
  DROP CONSTRAINT IF EXISTS clinical_instrument_administrations_provenance_check;
ALTER TABLE public.clinical_instrument_administrations
  ADD CONSTRAINT clinical_instrument_administrations_provenance_check
  CHECK (provenance IN ('clinician_assisted','patient_self'));

CREATE OR REPLACE FUNCTION public.can_send_clinical_instrument_to_patient(
  p_appointment_id uuid,
  p_instrument_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_patient uuid;
  v_key text := lower(btrim(coalesce(p_instrument_key, '')));
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR p_appointment_id IS NULL OR v_key = '' THEN
    RETURN false;
  END IF;

  SELECT a.paciente_id INTO v_patient
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_clinic
    AND a.professional_id = v_uid
    AND a.status = 'em_atendimento'
    AND a.data <= public.current_clinic_operational_date()
  LIMIT 1;
  IF v_patient IS NULL THEN
    RETURN false;
  END IF;

  IF public.clinical_instrument_base_authorized(v_patient, v_key) IS NOT TRUE THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.clinical_instrument_catalog c
    JOIN public.clinical_instrument_patient_self_contracts d
      ON d.instrument_key = c.instrument_key
     AND d.engine_rule_version = c.engine_rule_version
     AND d.engine_source = c.engine_source
     AND d.engine_module_key = c.engine_module_key
     AND d.engine_tool_key = c.engine_tool_key
     AND d.engine_rule_key = c.engine_rule_key
     AND d.active IS TRUE
    WHERE c.instrument_key = v_key
      AND c.active IS TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_send_clinical_instrument_to_patient(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_send_clinical_instrument_to_patient(uuid,text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_send_clinical_instrument_to_patient(uuid,text) IS
  'Patient-delivery V1 act boundary: own active Encounter + neutral clinical authorization + explicit versioned patient_self contract. Never consults nexus.* authorization.';

CREATE OR REPLACE FUNCTION public.list_available_clinical_instrument_patient_delivery(
  p_appointment_id uuid
)
RETURNS TABLE(
  instrument_key text,
  engine_rule_version text,
  display_label text,
  default_expires_hours integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_patient uuid;
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR p_appointment_id IS NULL THEN
    RETURN;
  END IF;

  SELECT a.paciente_id INTO v_patient
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_clinic
    AND a.professional_id = v_uid
    AND a.status = 'em_atendimento'
    AND a.data <= public.current_clinic_operational_date()
  LIMIT 1;
  IF v_patient IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.instrument_key, c.engine_rule_version, d.display_label, d.default_expires_hours
  FROM public.clinical_instrument_catalog c
  JOIN public.clinic_clinical_instrument_settings s
    ON s.clinic_id = v_clinic
   AND s.instrument_key = c.instrument_key
   AND s.enabled IS TRUE
  JOIN public.clinical_instrument_patient_self_contracts d
    ON d.instrument_key = c.instrument_key
   AND d.engine_rule_version = c.engine_rule_version
   AND d.engine_source = c.engine_source
   AND d.engine_module_key = c.engine_module_key
   AND d.engine_tool_key = c.engine_tool_key
   AND d.engine_rule_key = c.engine_rule_key
   AND d.active IS TRUE
  WHERE c.active IS TRUE
    AND public.clinical_instrument_base_authorized(v_patient, c.instrument_key) IS TRUE
  ORDER BY d.display_label, c.instrument_key;
END;
$$;

REVOKE ALL ON FUNCTION public.list_available_clinical_instrument_patient_delivery(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_available_clinical_instrument_patient_delivery(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_clinical_instrument_patient_delivery(
  p_actor_user_id uuid,
  p_appointment_id uuid,
  p_instrument_key text,
  p_request_id uuid,
  p_expires_hours integer,
  p_public_app_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
  v_previous_claims text := current_setting('request.jwt.claims', true);
  v_key text := lower(btrim(coalesce(p_instrument_key, '')));
  v_clinic uuid;
  v_patient uuid;
  v_patient_name text;
  v_phone text;
  v_opt_in boolean;
  v_contract public.clinical_instrument_patient_self_contracts%ROWTYPE;
  v_existing public.nexus_self_assessment_invites%ROWTYPE;
  v_invite_id uuid;
  v_token text;
  v_expires timestamptz;
  v_wa_id uuid;
  v_wa_status text;
  v_url text := regexp_replace(btrim(coalesce(p_public_app_url,'')), '/+$', '');
  v_message text;
  v_hours integer;
BEGIN
  IF p_actor_user_id IS NULL OR p_appointment_id IS NULL OR p_request_id IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_invalid_request' USING ERRCODE = '22023';
  END IF;
  IF v_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_invalid_public_url' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_actor_user_id::text, 'role', 'authenticated')::text, true);

  IF public.can_send_clinical_instrument_to_patient(p_appointment_id, v_key) IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_not_authorized' USING ERRCODE = '42501';
  END IF;

  v_clinic := public.current_clinic_id();
  SELECT a.paciente_id INTO v_patient
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_clinic
    AND a.professional_id = p_actor_user_id
    AND a.status = 'em_atendimento'
  LIMIT 1;
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_encounter_invalid' USING ERRCODE = '42501';
  END IF;

  SELECT p.nome, p.telefone, p.opt_in_whats
    INTO v_patient_name, v_phone, v_opt_in
  FROM public.patients p
  WHERE p.id = v_patient
    AND p.clinic_id = v_clinic
    AND p.deleted_at IS NULL
    AND coalesce(p.anonimizado,false) IS FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_patient_invalid' USING ERRCODE = '42501';
  END IF;
  IF coalesce(v_opt_in,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_whatsapp_opt_in_required' USING ERRCODE = '22023';
  END IF;
  IF regexp_replace(coalesce(v_phone,''), '\D', '', 'g') = '' THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_phone_required' USING ERRCODE = '22023';
  END IF;

  SELECT d.* INTO v_contract
  FROM public.clinical_instrument_catalog c
  JOIN public.clinical_instrument_patient_self_contracts d
    ON d.instrument_key = c.instrument_key
   AND d.engine_rule_version = c.engine_rule_version
   AND d.engine_source = c.engine_source
   AND d.engine_module_key = c.engine_module_key
   AND d.engine_tool_key = c.engine_tool_key
   AND d.engine_rule_key = c.engine_rule_key
   AND d.active IS TRUE
  WHERE c.instrument_key = v_key
    AND c.active IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'clinical_instrument_patient_delivery_contract_unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT i.* INTO v_existing
  FROM public.nexus_self_assessment_invites i
  WHERE i.authority_source = 'clinical_instrument'
    AND i.professional_id = p_actor_user_id
    AND i.appointment_id = p_appointment_id
    AND i.request_id = p_request_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.scale_key IS DISTINCT FROM v_key
       OR v_existing.rule_version IS DISTINCT FROM v_contract.engine_rule_version
       OR v_existing.patient_id IS DISTINCT FROM v_patient
       OR v_existing.clinic_id IS DISTINCT FROM v_clinic THEN
      RAISE EXCEPTION 'clinical_instrument_patient_delivery_idempotency_conflict' USING ERRCODE = '23505';
    END IF;
    SELECT w.id, w.status INTO v_wa_id, v_wa_status
    FROM public.wa_logs w
    WHERE w.self_assessment_invite_id = v_existing.id
    ORDER BY w.created_at DESC, w.id DESC
    LIMIT 1;
    IF v_wa_id IS NULL THEN
      RAISE EXCEPTION 'clinical_instrument_patient_delivery_replay_inconsistent' USING ERRCODE = '55000';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', coalesce(v_previous_sub,''), true);
    PERFORM set_config('request.jwt.claims', coalesce(v_previous_claims,''), true);
    RETURN jsonb_build_object(
      'inviteId', v_existing.id, 'waLogId', v_wa_id, 'instrumentKey', v_existing.scale_key,
      'ruleVersion', v_existing.rule_version, 'displayLabel', v_contract.display_label,
      'expiresAt', v_existing.expires_at, 'status', v_wa_status, 'replayed', true
    );
  END IF;

  v_hours := greatest(1, least(coalesce(p_expires_hours, v_contract.default_expires_hours), 168));
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(hours => v_hours);

  INSERT INTO public.nexus_self_assessment_invites(
    clinic_id, patient_id, professional_id, appointment_id, scale_key, rule_version,
    token_hash, expires_at, authority_source, request_id
  ) VALUES (
    v_clinic, v_patient, p_actor_user_id, p_appointment_id, v_key, v_contract.engine_rule_version,
    encode(digest(v_token, 'sha256'), 'hex'), v_expires, 'clinical_instrument', p_request_id
  ) RETURNING id INTO v_invite_id;

  v_message := concat(
    coalesce(nullif(split_part(btrim(coalesce(v_patient_name,'')), ' ', 1), ''), 'Olá'),
    ', seu profissional enviou o instrumento ', v_contract.display_label, E'.\n\n',
    'Acesse o link seguro abaixo para responder:', E'\n',
    v_url, '/#/autoavaliacao/', v_token, E'\n\n',
    'O link é individual e expira automaticamente.'
  );

  INSERT INTO public.wa_logs(
    clinic_id, patient_id, appointment_id, self_assessment_invite_id,
    template, mensagem, enviado_em, status, scheduled_for, created_by
  ) VALUES (
    v_clinic, v_patient, p_appointment_id, v_invite_id,
    'clinical_instrument_patient_self', v_message, now(), 'fila', now(), p_actor_user_id
  ) RETURNING id, status INTO v_wa_id, v_wa_status;

  PERFORM set_config('request.jwt.claim.sub', coalesce(v_previous_sub,''), true);
  PERFORM set_config('request.jwt.claims', coalesce(v_previous_claims,''), true);
  RETURN jsonb_build_object(
    'inviteId', v_invite_id, 'waLogId', v_wa_id, 'instrumentKey', v_key,
    'ruleVersion', v_contract.engine_rule_version, 'displayLabel', v_contract.display_label,
    'expiresAt', v_expires, 'status', v_wa_status, 'replayed', false
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_previous_sub,''), true);
  PERFORM set_config('request.jwt.claims', coalesce(v_previous_claims,''), true);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_clinical_instrument_patient_delivery(uuid,uuid,text,uuid,integer,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_clinical_instrument_patient_delivery(uuid,uuid,text,uuid,integer,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.list_clinical_instrument_patient_deliveries(
  p_appointment_id uuid
)
RETURNS TABLE(
  invite_id uuid,
  instrument_key text,
  engine_rule_version text,
  display_label text,
  status text,
  created_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  expires_at timestamptz,
  processed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR p_appointment_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND a.clinic_id = v_clinic
      AND a.professional_id = v_uid
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.id, i.scale_key, i.rule_version,
         coalesce(d.display_label, i.scale_key), i.status, i.created_at,
         i.opened_at, i.submitted_at, i.expires_at,
         i.processed_administration_id IS NOT NULL
  FROM public.nexus_self_assessment_invites i
  LEFT JOIN public.clinical_instrument_patient_self_contracts d
    ON d.instrument_key = i.scale_key
   AND d.engine_rule_version = i.rule_version
  WHERE i.authority_source = 'clinical_instrument'
    AND i.clinic_id = v_clinic
    AND i.professional_id = v_uid
    AND i.appointment_id = p_appointment_id
  ORDER BY i.created_at DESC, i.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_clinical_instrument_patient_deliveries(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_clinical_instrument_patient_deliveries(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.list_clinical_instrument_patient_deliveries(uuid) IS
  'Narrow own-Encounter delivery status projection. Never returns token hashes, raw responses, WhatsApp message content or Nexus result internals.';

-- Keep the historical Nexus worker strictly on historical Nexus authority rows.
CREATE OR REPLACE FUNCTION public.claim_nexus_self_assessment_invites(
  p_scale_key text, p_rule_version text, p_limit integer DEFAULT 20
)
RETURNS TABLE(
  invite_id uuid, clinic_id uuid, patient_id uuid, professional_id uuid,
  appointment_id uuid, scale_key text, rule_version text, response_snapshot jsonb
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF nullif(trim(coalesce(p_scale_key, '')), '') IS NULL
     OR nullif(trim(coalesce(p_rule_version, '')), '') IS NULL THEN
    RAISE EXCEPTION 'scale_key/rule_version obrigatórios';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT i.id
    FROM public.nexus_self_assessment_invites i
    JOIN public.clinics c ON c.id = i.clinic_id
    WHERE i.authority_source = 'nexus'
      AND i.status = 'submitted'
      AND i.processed_result_id IS NULL
      AND i.submitted_at IS NOT NULL
      AND i.scale_key = trim(p_scale_key)
      AND i.rule_version = trim(p_rule_version)
      AND c.lifecycle_status = 'active'
      AND c.deleted_at IS NULL
      AND (i.processing_started_at IS NULL OR i.processing_started_at < now() - interval '10 minutes')
    ORDER BY i.submitted_at, i.id
    FOR UPDATE OF i SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 20), 100))
  ), claimed AS (
    UPDATE public.nexus_self_assessment_invites i
       SET processing_started_at = now(), processing_attempts = i.processing_attempts + 1,
           last_processing_error = NULL, updated_at = now()
      FROM picked
     WHERE i.id = picked.id
    RETURNING i.*
  )
  SELECT c.id, c.clinic_id, c.patient_id, c.professional_id, c.appointment_id,
         c.scale_key, c.rule_version, c.response_snapshot
  FROM claimed c;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_nexus_self_assessment_invites(text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_nexus_self_assessment_invites(text,text,integer) TO service_role;

-- Historical Nexus claim release must never mutate a neutral clinical-instrument claim.
CREATE OR REPLACE FUNCTION public.release_nexus_self_assessment_claim(
  p_invite_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.nexus_self_assessment_invites
     SET processing_started_at = NULL,
         last_processing_error = left(coalesce(p_error, 'Falha de processamento'), 1000),
         updated_at = now()
   WHERE id = p_invite_id
     AND authority_source = 'nexus'
     AND status = 'submitted'
     AND processed_result_id IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.release_nexus_self_assessment_claim(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_nexus_self_assessment_claim(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_clinical_instrument_patient_invites(
  p_scale_key text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  invite_id uuid, clinic_id uuid, patient_id uuid, professional_id uuid,
  appointment_id uuid, scale_key text, rule_version text, response_snapshot jsonb
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT i.id
    FROM public.nexus_self_assessment_invites i
    JOIN public.clinics c ON c.id = i.clinic_id
    WHERE i.authority_source = 'clinical_instrument'
      AND i.status = 'submitted'
      AND i.processed_administration_id IS NULL
      AND (p_scale_key IS NULL OR i.scale_key = btrim(p_scale_key))
      AND i.submitted_at IS NOT NULL
      AND c.lifecycle_status = 'active'
      AND c.deleted_at IS NULL
      AND (i.processing_started_at IS NULL OR i.processing_started_at < now() - interval '10 minutes')
    ORDER BY i.submitted_at, i.id
    FOR UPDATE OF i SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 20), 100))
  ), claimed AS (
    UPDATE public.nexus_self_assessment_invites i
       SET processing_started_at = now(), processing_attempts = i.processing_attempts + 1,
           last_processing_error = NULL, updated_at = now()
      FROM picked
     WHERE i.id = picked.id
    RETURNING i.*
  )
  SELECT c.id, c.clinic_id, c.patient_id, c.professional_id, c.appointment_id,
         c.scale_key, c.rule_version, c.response_snapshot
  FROM claimed c;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_clinical_instrument_patient_invites(text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_clinical_instrument_patient_invites(text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_clinical_instrument_patient_claim(
  p_invite_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.nexus_self_assessment_invites
     SET processing_started_at = NULL,
         last_processing_error = left(coalesce(p_error, 'Falha de processamento'), 1000),
         updated_at = now()
   WHERE id = p_invite_id
     AND authority_source = 'clinical_instrument'
     AND status = 'submitted'
     AND processed_administration_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.release_clinical_instrument_patient_claim(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_clinical_instrument_patient_claim(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_clinical_instrument_patient_self_processing(
  p_invite_id uuid,
  p_result jsonb,
  p_safety_signals jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.nexus_self_assessment_invites%ROWTYPE;
  v_contract public.clinical_instrument_patient_self_contracts%ROWTYPE;
  v_existing public.clinical_instrument_administrations%ROWTYPE;
  v_created_id uuid;
  v_answers jsonb;
  v_total numeric;
  v_max numeric;
BEGIN
  IF p_result IS NULL OR jsonb_typeof(p_result) IS DISTINCT FROM 'object'
     OR p_safety_signals IS NULL OR jsonb_typeof(p_safety_signals) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_invalid_result' USING ERRCODE = '22023';
  END IF;

  SELECT i.* INTO v_invite
  FROM public.nexus_self_assessment_invites i
  WHERE i.id = p_invite_id
  FOR UPDATE;
  IF v_invite.id IS NULL OR v_invite.authority_source <> 'clinical_instrument' THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_invite_invalid' USING ERRCODE = '42501';
  END IF;
  IF v_invite.processed_administration_id IS NOT NULL OR v_invite.status = 'processed' THEN
    RETURN v_invite.processed_administration_id;
  END IF;
  IF v_invite.status <> 'submitted' OR v_invite.submitted_at IS NULL OR v_invite.processing_started_at IS NULL
     OR v_invite.appointment_id IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_not_claimed' USING ERRCODE = '55000';
  END IF;

  SELECT d.* INTO v_contract
  FROM public.clinical_instrument_patient_self_contracts d
  WHERE d.instrument_key = v_invite.scale_key
    AND d.engine_rule_version = v_invite.rule_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_contract_missing' USING ERRCODE = '22023';
  END IF;

  IF nullif(p_result->>'engineSource','') IS DISTINCT FROM v_contract.engine_source
     OR nullif(p_result->>'moduleKey','') IS DISTINCT FROM v_contract.engine_module_key
     OR nullif(p_result->>'toolKey','') IS DISTINCT FROM v_contract.engine_tool_key
     OR nullif(p_result->>'ruleKey','') IS DISTINCT FROM v_contract.engine_rule_key
     OR nullif(p_result->>'ruleVersion','') IS DISTINCT FROM v_contract.engine_rule_version
     OR jsonb_typeof(p_result->'inputSnapshot') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_result->'outputSnapshot') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_result->'evidenceSnapshot') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_contract_mismatch' USING ERRCODE = '22023';
  END IF;

  v_answers := p_result->'inputSnapshot'->'answers';
  IF v_answers IS NULL OR jsonb_typeof(v_answers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_answers_invalid' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_total := nullif(p_result->>'totalScore','')::numeric;
    v_max := nullif(p_result->>'maxScore','')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_score_invalid' USING ERRCODE = '22023';
  END;
  IF v_total IS NULL OR v_max IS NULL OR v_total < 0 OR v_max <= 0 OR v_total > v_max
     OR nullif(p_result->>'classification','') IS NULL
     OR nullif(p_result->>'severity','') IS NULL
     OR nullif(p_result->>'interpretation','') IS NULL
     OR nullif(p_result->>'soapText','') IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_result_incomplete' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = v_invite.clinic_id AND c.lifecycle_status = 'active' AND c.deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = v_invite.patient_id AND p.clinic_id = v_invite.clinic_id
      AND p.deleted_at IS NULL AND coalesce(p.anonimizado,false) IS FALSE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = v_invite.appointment_id
      AND a.clinic_id = v_invite.clinic_id
      AND a.paciente_id = v_invite.patient_id
      AND a.professional_id = v_invite.professional_id
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_patient_processing_context_invalid' USING ERRCODE = '42501';
  END IF;

  SELECT a.* INTO v_existing
  FROM public.clinical_instrument_administrations a
  WHERE a.professional_id = v_invite.professional_id
    AND a.appointment_id = v_invite.appointment_id
    AND a.request_id = v_invite.id
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.provenance <> 'patient_self'
       OR v_existing.instrument_key <> v_invite.scale_key
       OR v_existing.engine_rule_version <> v_invite.rule_version
       OR v_existing.answers_snapshot IS DISTINCT FROM v_answers THEN
      RAISE EXCEPTION 'clinical_instrument_patient_processing_idempotency_conflict' USING ERRCODE = '23505';
    END IF;
    UPDATE public.nexus_self_assessment_invites
       SET processed_administration_id = v_existing.id, status = 'processed',
           processing_started_at = NULL, last_processing_error = NULL, updated_at = now()
     WHERE id = v_invite.id;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.clinical_instrument_administrations(
    clinic_id, patient_id, appointment_id, professional_id, instrument_key,
    engine_source, engine_module_key, engine_tool_key, engine_rule_key, engine_rule_version,
    provenance, request_id, answers_snapshot, output_snapshot, total_score, max_score,
    classification, severity, interpretation, soap_text, evidence_snapshot, safety_signals
  ) VALUES (
    v_invite.clinic_id, v_invite.patient_id, v_invite.appointment_id, v_invite.professional_id,
    v_invite.scale_key, v_contract.engine_source, v_contract.engine_module_key,
    v_contract.engine_tool_key, v_contract.engine_rule_key, v_contract.engine_rule_version,
    'patient_self', v_invite.id, v_answers, p_result->'outputSnapshot', v_total, v_max,
    p_result->>'classification', p_result->>'severity', p_result->>'interpretation',
    p_result->>'soapText', p_result->'evidenceSnapshot', p_safety_signals
  ) RETURNING id INTO v_created_id;

  UPDATE public.nexus_self_assessment_invites
     SET processed_administration_id = v_created_id, status = 'processed',
         processing_started_at = NULL, last_processing_error = NULL, updated_at = now()
   WHERE id = v_invite.id;

  RETURN v_created_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_clinical_instrument_patient_self_processing(uuid,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_clinical_instrument_patient_self_processing(uuid,jsonb,jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.list_patient_clinical_instrument_history(
  p_patient_id uuid
)
RETURNS TABLE (
  id uuid,
  appointment_id uuid,
  professional_id uuid,
  instrument_key text,
  engine_rule_version text,
  provenance text,
  total_score numeric,
  max_score numeric,
  classification text,
  severity text,
  interpretation text,
  has_safety_signal boolean,
  has_critical_safety_signal boolean,
  completed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
BEGIN
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_history_patient_required' USING ERRCODE = '22023';
  END IF;
  IF v_clinic IS NULL OR public.can_access_patient_clinical_record(p_patient_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_instrument_history_not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.appointment_id, a.professional_id, a.instrument_key,
         a.engine_rule_version, a.provenance, a.total_score, a.max_score,
         a.classification, a.severity, a.interpretation,
         jsonb_array_length(a.safety_signals) > 0,
         EXISTS (
           SELECT 1 FROM jsonb_array_elements(a.safety_signals) AS signal(value)
           WHERE lower(coalesce(signal.value->>'severity','')) = 'critical'
         ),
         a.completed_at
  FROM public.clinical_instrument_administrations a
  WHERE a.clinic_id = v_clinic
    AND a.patient_id = p_patient_id
    AND a.provenance IN ('clinician_assisted','patient_self')
  ORDER BY a.completed_at DESC, a.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_patient_clinical_instrument_history(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_patient_clinical_instrument_history(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.list_patient_clinical_instrument_history(uuid) IS
  'Neutral chart-read projection for clinician_assisted and patient_self administrations; no answers, engine snapshots, SOAP or evidence are exposed.';

COMMIT;
