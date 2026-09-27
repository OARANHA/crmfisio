-- MEDICSPRO — MED-CRM-002 Commercial Command Boundary
-- Canonical authenticated mutation operations for the Commercial Core.
-- Contact != Lead != Patient. No Patient link/conversion is introduced here.

BEGIN;

CREATE OR REPLACE FUNCTION public.crm_current_mutator_clinic_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
BEGIN
  SELECT *
    INTO v_actor
  FROM public.current_active_profile();

  IF v_actor.role::text NOT IN ('owner', 'admin', 'recep') THEN
    RAISE EXCEPTION 'crm_mutation_role_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF public.current_clinic_entitlement_allowed('crm.access') IS NOT TRUE THEN
    RAISE EXCEPTION 'crm_access_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN v_actor.clinic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_current_mutator_clinic_id()
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_current_mutator_clinic_id() IS
  'Internal Commercial Core mutation guard: active current profile + owner/admin/recep + crm.access. Not a browser RPC.';

CREATE OR REPLACE FUNCTION public.create_current_clinic_crm_contact(
  p_contact_id uuid,
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_mutator_clinic_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_existing public.contacts%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'crm_contact_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'crm_contact_name_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.contacts (
    id,
    clinic_id,
    name,
    phone,
    email
  ) VALUES (
    p_contact_id,
    v_clinic,
    v_name,
    v_phone,
    v_email
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT *
      INTO v_existing
    FROM public.contacts c
    WHERE c.id = p_contact_id;

    IF NOT FOUND
       OR v_existing.clinic_id IS DISTINCT FROM v_clinic
       OR v_existing.deleted_at IS NOT NULL
       OR v_existing.patient_id IS NOT NULL
       OR v_existing.name IS DISTINCT FROM v_name
       OR v_existing.phone IS DISTINCT FROM v_phone
       OR v_existing.email IS DISTINCT FROM v_email THEN
      RAISE EXCEPTION 'crm_contact_idempotency_conflict' USING ERRCODE = '23505';
    END IF;

    RETURN p_contact_id;
  END IF;

  INSERT INTO public.audit_log (
    clinic_id,
    usuario_id,
    acao,
    detalhe
  ) VALUES (
    v_clinic,
    auth.uid(),
    'CRM_CONTACT_CREATED',
    format('contact_id=%s', p_contact_id)
  );

  RETURN p_contact_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_current_clinic_crm_lead(
  p_lead_id uuid,
  p_contact_id uuid,
  p_title text,
  p_pipeline_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_value_cents bigint DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_mutator_clinic_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_source text := nullif(btrim(coalesce(p_source, '')), '');
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_stage_kind text;
  v_existing public.crm_leads%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  IF p_lead_id IS NULL OR p_contact_id IS NULL THEN
    RAISE EXCEPTION 'crm_lead_and_contact_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'crm_lead_title_required' USING ERRCODE = '22023';
  END IF;

  IF p_value_cents IS NOT NULL AND p_value_cents < 0 THEN
    RAISE EXCEPTION 'crm_lead_value_negative' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = p_contact_id
      AND c.clinic_id = v_clinic
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'crm_contact_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_pipeline_id IS NULL THEN
    SELECT p.id
      INTO v_pipeline_id
    FROM public.crm_pipelines p
    WHERE p.clinic_id = v_clinic
      AND p.is_default IS TRUE
      AND p.archived_at IS NULL
    ORDER BY p.created_at, p.id
    LIMIT 1;
  ELSE
    SELECT p.id
      INTO v_pipeline_id
    FROM public.crm_pipelines p
    WHERE p.id = p_pipeline_id
      AND p.clinic_id = v_clinic
      AND p.archived_at IS NULL;
  END IF;

  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'crm_pipeline_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_stage_id IS NULL THEN
    SELECT s.id, s.stage_kind
      INTO v_stage_id, v_stage_kind
    FROM public.crm_stages s
    WHERE s.clinic_id = v_clinic
      AND s.pipeline_id = v_pipeline_id
      AND s.archived_at IS NULL
      AND s.stage_kind = 'open'
    ORDER BY s.position, s.created_at, s.id
    LIMIT 1;
  ELSE
    SELECT s.id, s.stage_kind
      INTO v_stage_id, v_stage_kind
    FROM public.crm_stages s
    WHERE s.id = p_stage_id
      AND s.clinic_id = v_clinic
      AND s.pipeline_id = v_pipeline_id
      AND s.archived_at IS NULL;
  END IF;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'crm_stage_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_stage_kind <> 'open' THEN
    RAISE EXCEPTION 'crm_lead_initial_stage_must_be_open' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.crm_leads (
    id,
    clinic_id,
    contact_id,
    pipeline_id,
    stage_id,
    owner_id,
    title,
    value_cents,
    source
  ) VALUES (
    p_lead_id,
    v_clinic,
    p_contact_id,
    v_pipeline_id,
    v_stage_id,
    p_owner_id,
    v_title,
    p_value_cents,
    v_source
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT *
      INTO v_existing
    FROM public.crm_leads l
    WHERE l.id = p_lead_id;

    IF NOT FOUND
       OR v_existing.clinic_id IS DISTINCT FROM v_clinic
       OR v_existing.deleted_at IS NOT NULL
       OR v_existing.contact_id IS DISTINCT FROM p_contact_id
       OR v_existing.pipeline_id IS DISTINCT FROM v_pipeline_id
       OR v_existing.stage_id IS DISTINCT FROM v_stage_id
       OR v_existing.owner_id IS DISTINCT FROM p_owner_id
       OR v_existing.title IS DISTINCT FROM v_title
       OR v_existing.value_cents IS DISTINCT FROM p_value_cents
       OR v_existing.source IS DISTINCT FROM v_source THEN
      RAISE EXCEPTION 'crm_lead_idempotency_conflict' USING ERRCODE = '23505';
    END IF;

    RETURN p_lead_id;
  END IF;

  INSERT INTO public.crm_lead_activities (
    clinic_id,
    lead_id,
    activity_type,
    actor_id,
    actor_kind,
    metadata
  ) VALUES (
    v_clinic,
    p_lead_id,
    'lead_created',
    auth.uid(),
    'human',
    jsonb_build_object(
      'contact_id', p_contact_id,
      'pipeline_id', v_pipeline_id,
      'stage_id', v_stage_id
    )
  );

  INSERT INTO public.audit_log (
    clinic_id,
    usuario_id,
    acao,
    detalhe
  ) VALUES (
    v_clinic,
    auth.uid(),
    'CRM_LEAD_CREATED',
    format(
      'lead_id=%s; contact_id=%s; pipeline_id=%s; stage_id=%s',
      p_lead_id,
      p_contact_id,
      v_pipeline_id,
      v_stage_id
    )
  );

  RETURN p_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_current_clinic_crm_lead_stage(
  p_lead_id uuid,
  p_to_stage_id uuid,
  p_lost_reason_code text DEFAULT NULL,
  p_lost_reason_detail text DEFAULT NULL
)
RETURNS TABLE (
  lead_id uuid,
  from_stage_id uuid,
  to_stage_id uuid,
  stage_kind text,
  closed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_mutator_clinic_id();
  v_lead public.crm_leads%ROWTYPE;
  v_target public.crm_stages%ROWTYPE;
  v_reason_code text := nullif(btrim(coalesce(p_lost_reason_code, '')), '');
  v_reason_detail text := nullif(btrim(coalesce(p_lost_reason_detail, '')), '');
  v_from_stage uuid;
BEGIN
  IF p_lead_id IS NULL OR p_to_stage_id IS NULL THEN
    RAISE EXCEPTION 'crm_lead_and_target_stage_required' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_lead
  FROM public.crm_leads l
  WHERE l.id = p_lead_id
    AND l.clinic_id = v_clinic
    AND l.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_lead_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
    INTO v_target
  FROM public.crm_stages s
  WHERE s.id = p_to_stage_id
    AND s.clinic_id = v_clinic
    AND s.pipeline_id = v_lead.pipeline_id
    AND s.archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_target_stage_not_found_in_current_pipeline' USING ERRCODE = 'P0002';
  END IF;

  IF v_target.stage_kind = 'lost' THEN
    IF v_reason_code IS NULL AND v_reason_detail IS NULL THEN
      RAISE EXCEPTION 'crm_lost_lead_reason_required' USING ERRCODE = '23514';
    END IF;
  ELSIF v_reason_code IS NOT NULL OR v_reason_detail IS NOT NULL THEN
    RAISE EXCEPTION 'crm_non_lost_stage_reason_forbidden' USING ERRCODE = '23514';
  END IF;

  IF v_lead.stage_id = v_target.id THEN
    IF v_target.stage_kind = 'open'
       AND v_lead.closed_at IS NULL
       AND v_lead.lost_reason_code IS NULL
       AND v_lead.lost_reason_detail IS NULL THEN
      RETURN QUERY
      SELECT v_lead.id, v_lead.stage_id, v_target.id, v_target.stage_kind, v_lead.closed_at;
      RETURN;
    END IF;

    IF v_target.stage_kind = 'won'
       AND v_lead.closed_at IS NOT NULL
       AND v_lead.lost_reason_code IS NULL
       AND v_lead.lost_reason_detail IS NULL THEN
      RETURN QUERY
      SELECT v_lead.id, v_lead.stage_id, v_target.id, v_target.stage_kind, v_lead.closed_at;
      RETURN;
    END IF;

    IF v_target.stage_kind = 'lost'
       AND v_lead.closed_at IS NOT NULL
       AND v_lead.lost_reason_code IS NOT DISTINCT FROM v_reason_code
       AND v_lead.lost_reason_detail IS NOT DISTINCT FROM v_reason_detail THEN
      RETURN QUERY
      SELECT v_lead.id, v_lead.stage_id, v_target.id, v_target.stage_kind, v_lead.closed_at;
      RETURN;
    END IF;

    RAISE EXCEPTION 'crm_stage_transition_idempotency_conflict' USING ERRCODE = '23505';
  END IF;

  v_from_stage := v_lead.stage_id;

  UPDATE public.crm_leads
  SET stage_id = v_target.id,
      closed_at = CASE
        WHEN v_target.stage_kind = 'open' THEN NULL
        ELSE now()
      END,
      lost_reason_code = CASE
        WHEN v_target.stage_kind = 'lost' THEN v_reason_code
        ELSE NULL
      END,
      lost_reason_detail = CASE
        WHEN v_target.stage_kind = 'lost' THEN v_reason_detail
        ELSE NULL
      END
  WHERE id = v_lead.id
    AND clinic_id = v_clinic
  RETURNING public.crm_leads.closed_at
       INTO v_lead.closed_at;

  INSERT INTO public.crm_lead_activities (
    clinic_id,
    lead_id,
    activity_type,
    actor_id,
    actor_kind,
    metadata
  ) VALUES (
    v_clinic,
    v_lead.id,
    'stage_changed',
    auth.uid(),
    'human',
    jsonb_strip_nulls(
      jsonb_build_object(
        'from_stage_id', v_from_stage,
        'to_stage_id', v_target.id,
        'stage_kind', v_target.stage_kind,
        'lost_reason_code', CASE WHEN v_target.stage_kind = 'lost' THEN v_reason_code ELSE NULL END,
        'lost_reason_detail', CASE WHEN v_target.stage_kind = 'lost' THEN v_reason_detail ELSE NULL END
      )
    )
  );

  INSERT INTO public.audit_log (
    clinic_id,
    usuario_id,
    acao,
    detalhe
  ) VALUES (
    v_clinic,
    auth.uid(),
    'CRM_LEAD_STAGE_CHANGED',
    format(
      'lead_id=%s; from_stage_id=%s; to_stage_id=%s; stage_kind=%s',
      v_lead.id,
      v_from_stage,
      v_target.id,
      v_target.stage_kind
    )
  );

  RETURN QUERY
  SELECT v_lead.id, v_from_stage, v_target.id, v_target.stage_kind, v_lead.closed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_current_clinic_crm_contact(uuid,text,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_current_clinic_crm_contact(uuid,text,text,text)
TO authenticated;

REVOKE ALL ON FUNCTION public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)
TO authenticated;

REVOKE ALL ON FUNCTION public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)
TO authenticated;

COMMENT ON FUNCTION public.create_current_clinic_crm_contact(uuid,text,text,text) IS
  'Canonical authenticated Contact creation for the current clinic. Never links Patient and never auto-deduplicates phone/email.';

COMMENT ON FUNCTION public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text) IS
  'Canonical authenticated Lead creation for the current clinic. Initial stage must be active/open.';

COMMENT ON FUNCTION public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text) IS
  'Canonical same-pipeline Lead stage transition. Serializes the Lead and derives terminal fields server-side.';

COMMIT;
