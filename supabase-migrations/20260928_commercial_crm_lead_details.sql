-- MEDICSPRO — MED-CRM-008 Lead Commercial Details V1
-- Bounded current-clinic Lead detail mutation for title/value/source only.
-- Contact != Lead != Patient. No stage, pipeline, owner or clinical authority is introduced.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_current_clinic_crm_lead_details(
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
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
  v_lead public.crm_leads%ROWTYPE;
  v_title text := btrim(coalesce(p_title, ''));
  v_source text := nullif(btrim(coalesce(p_source, '')), '');
  v_changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF p_lead_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'crm_lead_details_input_required' USING ERRCODE = '22023';
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

  IF v_title = '' THEN
    RAISE EXCEPTION 'crm_lead_title_required' USING ERRCODE = '22023';
  END IF;

  IF p_value_cents IS NOT NULL AND p_value_cents < 0 THEN
    RAISE EXCEPTION 'crm_lead_value_negative' USING ERRCODE = '22023';
  END IF;

  -- Exact desired-state replay is side-effect free and remains valid even if a
  -- related lifecycle state became read-only after the original COMMIT.
  IF v_lead.title IS NOT DISTINCT FROM v_title
     AND v_lead.value_cents IS NOT DISTINCT FROM p_value_cents
     AND v_lead.source IS NOT DISTINCT FROM v_source THEN
    RETURN v_lead.id;
  END IF;

  -- Real changes require the related Contact to remain mutable. FOR SHARE
  -- serializes this read with concurrent anonymize/delete UPDATEs.
  PERFORM 1
  FROM public.contacts c
  WHERE c.id = v_lead.contact_id
    AND c.clinic_id = v_clinic
    AND c.deleted_at IS NULL
    AND c.anonymized_at IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_lead_contact_not_mutable' USING ERRCODE = '23514';
  END IF;

  -- Preserve the RELEASED archived-pipeline boundary for detail writes too.
  PERFORM 1
  FROM public.crm_pipelines p
  WHERE p.id = v_lead.pipeline_id
    AND p.clinic_id = v_clinic
    AND p.archived_at IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_lead_details_current_pipeline_archived' USING ERRCODE = '23514';
  END IF;

  -- A Lead attached to an archived stage is legacy/read-only for real changes.
  PERFORM 1
  FROM public.crm_stages s
  WHERE s.id = v_lead.stage_id
    AND s.pipeline_id = v_lead.pipeline_id
    AND s.clinic_id = v_clinic
    AND s.archived_at IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_lead_details_current_stage_archived' USING ERRCODE = '23514';
  END IF;

  IF v_lead.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'crm_lead_details_stale' USING ERRCODE = '40001';
  END IF;

  IF v_lead.title IS DISTINCT FROM v_title THEN
    v_changed_fields := array_append(v_changed_fields, 'title');
  END IF;

  IF v_lead.value_cents IS DISTINCT FROM p_value_cents THEN
    v_changed_fields := array_append(v_changed_fields, 'value_cents');
  END IF;

  IF v_lead.source IS DISTINCT FROM v_source THEN
    v_changed_fields := array_append(v_changed_fields, 'source');
  END IF;

  UPDATE public.crm_leads
  SET title = v_title,
      value_cents = p_value_cents,
      source = v_source
  WHERE id = v_lead.id
    AND clinic_id = v_clinic;

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
    'lead_details_updated',
    auth.uid(),
    'human',
    jsonb_build_object('changed_fields', to_jsonb(v_changed_fields))
  );

  INSERT INTO public.audit_log (
    clinic_id,
    usuario_id,
    acao,
    detalhe
  ) VALUES (
    v_clinic,
    auth.uid(),
    'CRM_LEAD_DETAILS_UPDATED',
    format(
      'lead_id=%s; changed_fields=%s',
      v_lead.id,
      array_to_string(v_changed_fields, ',')
    )
  );

  RETURN v_lead.id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text)
TO authenticated;

COMMENT ON FUNCTION public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text) IS
  'Canonical current-clinic Lead details writer for title/value/source with optimistic concurrency, exact-retry idempotency and server-side privacy/archive guards.';

COMMIT;
