-- MedicsPro — D2-B.2A Clinical Document Template Admin
-- Backend-only tenant administration for medication-prescription templates.
-- Administering a template is intentionally separate from authorization to issue it.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.require_clinical_document_template_manager()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT p.clinic_id
  INTO v_clinic_id
  FROM public.profiles p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND p.role IN ('owner', 'admin')
    AND c.lifecycle_status = 'active'
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF v_clinic_id IS NULL
     OR public.current_clinic_id() IS DISTINCT FROM v_clinic_id THEN
    RAISE EXCEPTION 'clinical_document_template_manager_required' USING ERRCODE = '42501';
  END IF;

  RETURN v_clinic_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_clinical_document_template_contract(
  p_document_type text,
  p_definition jsonb,
  p_render_definition jsonb,
  p_variables_contract jsonb
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fields jsonb;
BEGIN
  -- D2-B.2A deliberately manages prescriptions only. Other document families
  -- get their own typed contract instead of inheriting a generic editor.
  IF p_document_type IS DISTINCT FROM 'medication_prescription' THEN
    RAISE EXCEPTION 'clinical_document_template_type_not_managed' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_definition) IS DISTINCT FROM 'object'
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_definition) AS k(key)
       WHERE k.key NOT IN ('kind', 'fields')
     )
     OR p_definition->>'kind' IS DISTINCT FROM 'medication_prescription'
     OR jsonb_typeof(p_definition->'fields') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'clinical_document_template_definition_invalid' USING ERRCODE = '22023';
  END IF;

  v_fields := p_definition->'fields';
  IF jsonb_array_length(v_fields) = 0
     OR NOT (v_fields ? 'items')
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_fields) AS f(value)
       WHERE jsonb_typeof(f.value) IS DISTINCT FROM 'string'
          OR f.value #>> '{}' NOT IN ('items', 'observations')
     )
     OR (
       SELECT count(*) FROM jsonb_array_elements(v_fields)
     ) IS DISTINCT FROM (
       SELECT count(DISTINCT f.value #>> '{}') FROM jsonb_array_elements(v_fields) AS f(value)
     ) THEN
    RAISE EXCEPTION 'clinical_document_template_fields_invalid' USING ERRCODE = '22023';
  END IF;

  -- V1 remains a closed renderer contract. Professional visual presets are a
  -- later additive slice; free-form HTML/CSS/JS never becomes clinical truth.
  IF jsonb_typeof(p_render_definition) IS DISTINCT FROM 'object'
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_render_definition) AS k(key)
       WHERE k.key <> 'layout'
     )
     OR p_render_definition->>'layout' IS DISTINCT FROM 'clinical-document/plain-text-v1' THEN
    RAISE EXCEPTION 'clinical_document_template_renderer_invalid' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_variables_contract) IS DISTINCT FROM 'array'
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(p_variables_contract) AS v(value)
       WHERE jsonb_typeof(v.value) IS DISTINCT FROM 'string'
          OR v.value #>> '{}' NOT IN (
            'patient.name',
            'issuer.name',
            'issuer.registro',
            'appointment.id'
          )
     )
     OR (
       SELECT count(*) FROM jsonb_array_elements(p_variables_contract)
     ) IS DISTINCT FROM (
       SELECT count(DISTINCT v.value #>> '{}')
       FROM jsonb_array_elements(p_variables_contract) AS v(value)
     ) THEN
    RAISE EXCEPTION 'clinical_document_template_variables_invalid' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_clinical_document_templates_for_management(
  p_document_type text DEFAULT 'medication_prescription'
)
RETURNS TABLE (
  template_id uuid,
  owner_type text,
  clinic_id uuid,
  document_type text,
  name text,
  description text,
  relevance_metadata jsonb,
  status text,
  current_version_id uuid,
  current_version integer,
  definition jsonb,
  render_definition jsonb,
  variables_contract jsonb,
  published_at timestamptz,
  read_only boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  v_clinic_id := public.require_clinical_document_template_manager();

  IF p_document_type IS DISTINCT FROM 'medication_prescription' THEN
    RAISE EXCEPTION 'clinical_document_template_type_not_managed' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.owner_type,
    t.clinic_id,
    t.document_type,
    t.name,
    t.description,
    t.relevance_metadata,
    t.status,
    t.current_version_id,
    v.version,
    v.definition,
    v.render_definition,
    v.variables_contract,
    v.published_at,
    (t.owner_type = 'platform') AS read_only,
    t.created_at,
    t.updated_at
  FROM public.clinical_document_templates t
  LEFT JOIN public.clinical_document_template_versions v
    ON v.id = t.current_version_id
   AND v.template_id = t.id
  WHERE t.document_type = p_document_type
    AND (
      (t.owner_type = 'platform' AND t.status = 'active')
      OR (t.owner_type = 'clinic' AND t.clinic_id = v_clinic_id)
    )
  ORDER BY
    CASE WHEN t.owner_type = 'platform' THEN 0 ELSE 1 END,
    lower(t.name),
    t.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_clinic_clinical_document_template(
  p_name text,
  p_description text DEFAULT '',
  p_relevance_metadata jsonb DEFAULT '{}'::jsonb,
  p_definition jsonb DEFAULT '{"kind":"medication_prescription","fields":["items","observations"]}'::jsonb,
  p_render_definition jsonb DEFAULT '{"layout":"clinical-document/plain-text-v1"}'::jsonb,
  p_variables_contract jsonb DEFAULT '["patient.name","issuer.name","issuer.registro","appointment.id"]'::jsonb
)
RETURNS public.clinical_document_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_template public.clinical_document_templates%ROWTYPE;
  v_version_id uuid;
BEGIN
  v_clinic_id := public.require_clinical_document_template_manager();

  IF nullif(btrim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'clinical_document_template_name_required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_relevance_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'clinical_document_template_relevance_invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM public.validate_clinical_document_template_contract(
    'medication_prescription', p_definition, p_render_definition, p_variables_contract
  );

  INSERT INTO public.clinical_document_templates(
    clinic_id, owner_type, document_type, name, description,
    relevance_metadata, status, created_by
  ) VALUES (
    v_clinic_id, 'clinic', 'medication_prescription', btrim(p_name),
    coalesce(p_description, ''), p_relevance_metadata, 'active', auth.uid()
  )
  RETURNING * INTO v_template;

  INSERT INTO public.clinical_document_template_versions(
    template_id, version, definition, render_definition, variables_contract,
    published_at, published_by
  ) VALUES (
    v_template.id, 1, p_definition, p_render_definition, p_variables_contract,
    now(), auth.uid()
  )
  RETURNING id INTO v_version_id;

  UPDATE public.clinical_document_templates
  SET current_version_id = v_version_id
  WHERE id = v_template.id
  RETURNING * INTO v_template;

  RETURN v_template;
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_clinical_document_template_to_clinic(
  p_source_template_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS public.clinical_document_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_source public.clinical_document_templates%ROWTYPE;
  v_source_version public.clinical_document_template_versions%ROWTYPE;
  v_template public.clinical_document_templates%ROWTYPE;
  v_version_id uuid;
  v_name text;
BEGIN
  v_clinic_id := public.require_clinical_document_template_manager();

  SELECT * INTO v_source
  FROM public.clinical_document_templates
  WHERE id = p_source_template_id
  FOR SHARE;

  IF v_source.id IS NULL
     OR v_source.document_type <> 'medication_prescription'
     OR v_source.current_version_id IS NULL
     OR NOT (
       (v_source.owner_type = 'platform' AND v_source.status = 'active')
       OR (v_source.owner_type = 'clinic' AND v_source.clinic_id = v_clinic_id)
     ) THEN
    RAISE EXCEPTION 'clinical_document_template_clone_source_denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_source_version
  FROM public.clinical_document_template_versions
  WHERE id = v_source.current_version_id
    AND template_id = v_source.id
    AND published_at IS NOT NULL;

  IF v_source_version.id IS NULL THEN
    RAISE EXCEPTION 'clinical_document_template_published_version_required' USING ERRCODE = '23514';
  END IF;

  PERFORM public.validate_clinical_document_template_contract(
    v_source.document_type,
    v_source_version.definition,
    v_source_version.render_definition,
    v_source_version.variables_contract
  );

  v_name := coalesce(nullif(btrim(coalesce(p_name, '')), ''), v_source.name || ' (cópia)');

  INSERT INTO public.clinical_document_templates(
    clinic_id, owner_type, document_type, name, description,
    relevance_metadata, status, created_by
  ) VALUES (
    v_clinic_id, 'clinic', v_source.document_type, v_name,
    CASE WHEN p_description IS NULL THEN v_source.description ELSE p_description END,
    v_source.relevance_metadata, 'active', auth.uid()
  )
  RETURNING * INTO v_template;

  INSERT INTO public.clinical_document_template_versions(
    template_id, version, definition, render_definition, variables_contract,
    published_at, published_by
  ) VALUES (
    v_template.id, 1, v_source_version.definition, v_source_version.render_definition,
    v_source_version.variables_contract, now(), auth.uid()
  )
  RETURNING id INTO v_version_id;

  UPDATE public.clinical_document_templates
  SET current_version_id = v_version_id
  WHERE id = v_template.id
  RETURNING * INTO v_template;

  RETURN v_template;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_clinic_clinical_document_template_version(
  p_template_id uuid,
  p_definition jsonb,
  p_render_definition jsonb,
  p_variables_contract jsonb
)
RETURNS public.clinical_document_template_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_template public.clinical_document_templates%ROWTYPE;
  v_version public.clinical_document_template_versions%ROWTYPE;
  v_next_version integer;
BEGIN
  v_clinic_id := public.require_clinical_document_template_manager();

  SELECT * INTO v_template
  FROM public.clinical_document_templates
  WHERE id = p_template_id
  FOR UPDATE;

  IF v_template.id IS NULL
     OR v_template.owner_type <> 'clinic'
     OR v_template.clinic_id IS DISTINCT FROM v_clinic_id
     OR v_template.document_type <> 'medication_prescription'
     OR v_template.status <> 'active' THEN
    RAISE EXCEPTION 'clinical_document_clinic_template_required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.validate_clinical_document_template_contract(
    v_template.document_type, p_definition, p_render_definition, p_variables_contract
  );

  SELECT coalesce(max(version), 0) + 1
  INTO v_next_version
  FROM public.clinical_document_template_versions
  WHERE template_id = v_template.id;

  INSERT INTO public.clinical_document_template_versions(
    template_id, version, definition, render_definition, variables_contract,
    published_at, published_by
  ) VALUES (
    v_template.id, v_next_version, p_definition, p_render_definition,
    p_variables_contract, now(), auth.uid()
  )
  RETURNING * INTO v_version;

  UPDATE public.clinical_document_templates
  SET current_version_id = v_version.id
  WHERE id = v_template.id;

  RETURN v_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_clinic_clinical_document_template_metadata(
  p_template_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_relevance_metadata jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'active'
)
RETURNS public.clinical_document_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_template public.clinical_document_templates%ROWTYPE;
BEGIN
  v_clinic_id := public.require_clinical_document_template_manager();

  IF nullif(btrim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'clinical_document_template_name_required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_relevance_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'clinical_document_template_relevance_invalid' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION 'clinical_document_template_status_invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.clinical_document_templates
  SET name = btrim(p_name),
      description = coalesce(p_description, ''),
      relevance_metadata = p_relevance_metadata,
      status = p_status
  WHERE id = p_template_id
    AND owner_type = 'clinic'
    AND clinic_id = v_clinic_id
    AND document_type = 'medication_prescription'
  RETURNING * INTO v_template;

  IF v_template.id IS NULL THEN
    RAISE EXCEPTION 'clinical_document_clinic_template_required' USING ERRCODE = '42501';
  END IF;

  RETURN v_template;
END;
$$;

-- Internal helpers are not client APIs.
REVOKE ALL ON FUNCTION public.require_clinical_document_template_manager()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_clinical_document_template_contract(text,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;

-- Management is exposed only through explicit RPCs. SECURITY DEFINER is required
-- because direct authenticated mutation of the protected tables remains revoked.
REVOKE ALL ON FUNCTION public.list_clinical_document_templates_for_management(text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_clinic_clinical_document_template(text,text,jsonb,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clone_clinical_document_template_to_clinic(uuid,text,text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_clinic_clinical_document_template_version(uuid,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_clinic_clinical_document_template_metadata(uuid,text,text,jsonb,text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_clinical_document_templates_for_management(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_clinic_clinical_document_template(text,text,jsonb,jsonb,jsonb,jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clone_clinical_document_template_to_clinic(uuid,text,text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_clinic_clinical_document_template_version(uuid,jsonb,jsonb,jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_clinic_clinical_document_template_metadata(uuid,text,text,jsonb,text)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.require_clinical_document_template_manager() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_clinical_document_template_contract(text,jsonb,jsonb,jsonb) TO service_role;

COMMIT;
