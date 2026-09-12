-- MedicsPro — D2-B.2C Prescription Professional Print / Safe Presets
-- Adds a closed, versioned visual renderer contract for medication prescriptions.
-- Free-form HTML/CSS/JS remains forbidden. Historical issued documents remain immutable.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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
  v_layout text;
BEGIN
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

  IF jsonb_typeof(p_render_definition) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'clinical_document_template_renderer_invalid' USING ERRCODE = '22023';
  END IF;

  v_layout := p_render_definition->>'layout';

  -- Backward compatibility for versions already published by D2-A/D2-B.2A.
  IF v_layout = 'clinical-document/plain-text-v1' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_render_definition) AS k(key)
      WHERE k.key <> 'layout'
    ) THEN
      RAISE EXCEPTION 'clinical_document_template_renderer_invalid' USING ERRCODE = '22023';
    END IF;
  ELSIF v_layout = 'clinical-document/prescription-v2' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_render_definition) AS k(key)
      WHERE k.key NOT IN (
        'layout', 'preset', 'accent', 'title', 'medication_style',
        'show_clinic_address', 'show_clinic_phone',
        'show_patient_birth_date', 'show_specialty'
      )
    )
       OR p_render_definition->>'preset' NOT IN ('classic', 'institutional', 'compact')
       OR p_render_definition->>'accent' NOT IN ('monochrome', 'navy', 'emerald')
       OR p_render_definition->>'medication_style' NOT IN ('numbered', 'cards')
       OR jsonb_typeof(p_render_definition->'title') IS DISTINCT FROM 'string'
       OR nullif(btrim(p_render_definition->>'title'), '') IS NULL
       OR char_length(p_render_definition->>'title') > 80
       OR jsonb_typeof(p_render_definition->'show_clinic_address') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_render_definition->'show_clinic_phone') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_render_definition->'show_patient_birth_date') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_render_definition->'show_specialty') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'clinical_document_template_renderer_invalid' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'clinical_document_template_renderer_invalid' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_variables_contract) IS DISTINCT FROM 'array'
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(p_variables_contract) AS v(value)
       WHERE jsonb_typeof(v.value) IS DISTINCT FROM 'string'
          OR v.value #>> '{}' NOT IN (
            'patient.name',
            'patient.birth_date',
            'clinic.name',
            'clinic.address',
            'clinic.phone',
            'issuer.name',
            'issuer.professional_type',
            'issuer.council_type',
            'issuer.council_state',
            'issuer.registro',
            'appointment.id',
            'issued_at'
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

CREATE OR REPLACE FUNCTION public.save_clinic_prescription_template_presentation(
  p_template_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_relevance_metadata jsonb DEFAULT '{}'::jsonb,
  p_render_definition jsonb DEFAULT '{"layout":"clinical-document/prescription-v2","preset":"institutional","accent":"navy","title":"Receita médica","medication_style":"cards","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb
)
RETURNS public.clinical_document_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_template public.clinical_document_templates%ROWTYPE;
  v_current public.clinical_document_template_versions%ROWTYPE;
  v_next_version integer;
  v_new_version_id uuid;
BEGIN
  v_clinic_id := public.require_clinical_document_template_manager();

  IF nullif(btrim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'clinical_document_template_name_required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_relevance_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'clinical_document_template_relevance_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_template
  FROM public.clinical_document_templates
  WHERE id = p_template_id
  FOR UPDATE;

  IF v_template.id IS NULL
     OR v_template.owner_type <> 'clinic'
     OR v_template.clinic_id IS DISTINCT FROM v_clinic_id
     OR v_template.document_type <> 'medication_prescription'
     OR v_template.status <> 'active'
     OR v_template.current_version_id IS NULL THEN
    RAISE EXCEPTION 'clinical_document_clinic_template_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_current
  FROM public.clinical_document_template_versions
  WHERE id = v_template.current_version_id
    AND template_id = v_template.id
    AND published_at IS NOT NULL;

  IF v_current.id IS NULL THEN
    RAISE EXCEPTION 'clinical_document_template_published_version_required' USING ERRCODE = '23514';
  END IF;

  PERFORM public.validate_clinical_document_template_contract(
    v_template.document_type,
    v_current.definition,
    p_render_definition,
    v_current.variables_contract
  );

  UPDATE public.clinical_document_templates
  SET name = btrim(p_name),
      description = coalesce(p_description, ''),
      relevance_metadata = p_relevance_metadata
  WHERE id = v_template.id;

  IF v_current.render_definition IS DISTINCT FROM p_render_definition THEN
    SELECT coalesce(max(version), 0) + 1
    INTO v_next_version
    FROM public.clinical_document_template_versions
    WHERE template_id = v_template.id;

    INSERT INTO public.clinical_document_template_versions(
      template_id, version, definition, render_definition, variables_contract,
      published_at, published_by
    ) VALUES (
      v_template.id, v_next_version, v_current.definition, p_render_definition,
      v_current.variables_contract, now(), auth.uid()
    )
    RETURNING id INTO v_new_version_id;

    UPDATE public.clinical_document_templates
    SET current_version_id = v_new_version_id
    WHERE id = v_template.id;
  END IF;

  SELECT * INTO v_template
  FROM public.clinical_document_templates
  WHERE id = p_template_id;

  RETURN v_template;
END;
$$;

-- New issues freeze the additional presentation context needed by the safe
-- renderer. Authorization/lifecycle logic is intentionally preserved from D2-A.
CREATE OR REPLACE FUNCTION public.issue_clinical_document(p_document_id uuid)
RETURNS public.clinical_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  d public.clinical_documents%ROWTYPE;
  a public.appointments%ROWTYPE;
  p public.profiles%ROWTYPE;
  c public.clinics%ROWTYPE;
  pat public.patients%ROWTYPE;
  v public.clinical_document_template_versions%ROWTYPE;
  snap jsonb;
  now_at timestamptz := now();
BEGIN
  SELECT * INTO d
  FROM public.clinical_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF d.id IS NULL OR d.status <> 'draft' THEN
    RAISE EXCEPTION 'clinical_document_draft_required' USING ERRCODE = '42501';
  END IF;

  a := public.assert_clinical_document_actor(d.appointment_id, d.document_type);
  PERFORM public.assert_clinical_document_payload_ready(d.document_type, d.payload);

  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO c FROM public.clinics WHERE id = d.clinic_id;
  SELECT * INTO pat FROM public.patients WHERE id = d.patient_id;
  SELECT * INTO v
  FROM public.clinical_document_template_versions
  WHERE id = d.template_version_id
    AND template_id = d.template_id
    AND published_at IS NOT NULL;

  IF v.id IS NULL THEN
    RAISE EXCEPTION 'clinical_document_published_version_required' USING ERRCODE = '23514';
  END IF;

  snap := jsonb_build_object(
    'patient', jsonb_build_object(
      'id', d.patient_id,
      'name', pat.nome,
      'birth_date', pat.nascimento
    ),
    'clinic', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'address', c.address,
      'phone', c.phone
    ),
    'issuer', jsonb_build_object(
      'id', p.id,
      'name', p.nome,
      'professional_type', p.professional_type,
      'council_type', p.council_type,
      'council_state', p.council_state,
      'registro', p.registro
    ),
    'appointment_id', a.id,
    'encounter_record_id', d.encounter_record_id,
    'issued_at', now_at
  );

  UPDATE public.clinical_documents
  SET status = 'issued',
      payload_snapshot = d.payload,
      context_snapshot = snap,
      template_definition_snapshot = jsonb_build_object(
        'template_name', (SELECT name FROM public.clinical_document_templates WHERE id = d.template_id),
        'definition', v.definition,
        'render_definition', v.render_definition,
        'variables_contract', v.variables_contract
      ),
      rendered_snapshot = public.render_clinical_document_snapshot(
        d.document_type,
        (SELECT name FROM public.clinical_document_templates WHERE id = d.template_id),
        d.payload,
        snap
      ),
      renderer_version = 'd2-a/plain-text-v1',
      issued_at = now_at,
      issued_by = auth.uid()
  WHERE id = d.id
  RETURNING * INTO d;

  INSERT INTO public.clinical_document_events(document_id, clinic_id, event_type, actor_id)
  VALUES(d.id, d.clinic_id, 'issued', auth.uid());

  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.save_clinic_prescription_template_presentation(uuid,text,text,jsonb,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_clinic_prescription_template_presentation(uuid,text,text,jsonb,jsonb)
  TO authenticated, service_role;

-- Curated MedicsPro presets. Existing published versions are never mutated.
INSERT INTO public.clinical_document_template_versions(
  id, template_id, version, definition, render_definition, variables_contract,
  published_at, published_by
) VALUES
(
  '12100000-0000-4000-8000-000000000011',
  '12000000-0000-4000-8000-000000000001',
  2,
  '{"kind":"medication_prescription","fields":["items","observations"]}'::jsonb,
  '{"layout":"clinical-document/prescription-v2","preset":"classic","accent":"monochrome","title":"Receita médica","medication_style":"numbered","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
  '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.professional_type","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb,
  now(), NULL
),
(
  '12100000-0000-4000-8000-000000000012',
  '12000000-0000-4000-8000-000000000002',
  2,
  '{"kind":"medication_prescription","fields":["items","observations"]}'::jsonb,
  '{"layout":"clinical-document/prescription-v2","preset":"institutional","accent":"navy","title":"Prescrição médica","medication_style":"cards","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
  '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.professional_type","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb,
  now(), NULL
)
ON CONFLICT (template_id, version) DO NOTHING;

UPDATE public.clinical_document_templates t
SET current_version_id = v.id
FROM public.clinical_document_template_versions v
WHERE v.template_id = t.id
  AND v.version = 2
  AND t.id IN (
    '12000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000002'
  );

INSERT INTO public.clinical_document_templates(
  id, owner_type, document_type, name, description, relevance_metadata, status
) VALUES (
  '12000000-0000-4000-8000-000000000005',
  'platform', 'medication_prescription', 'Receita compacta',
  'Modelo MedicsPro com composição mais enxuta para prescrições objetivas.',
  '{"relevance":"general"}'::jsonb, 'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_document_template_versions(
  id, template_id, version, definition, render_definition, variables_contract,
  published_at, published_by
) VALUES (
  '12100000-0000-4000-8000-000000000005',
  '12000000-0000-4000-8000-000000000005',
  1,
  '{"kind":"medication_prescription","fields":["items","observations"]}'::jsonb,
  '{"layout":"clinical-document/prescription-v2","preset":"compact","accent":"emerald","title":"Receita médica","medication_style":"numbered","show_clinic_address":false,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
  '["patient.name","patient.birth_date","clinic.name","clinic.phone","issuer.name","issuer.professional_type","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb,
  now(), NULL
)
ON CONFLICT (template_id, version) DO NOTHING;

UPDATE public.clinical_document_templates
SET current_version_id = '12100000-0000-4000-8000-000000000005'
WHERE id = '12000000-0000-4000-8000-000000000005'
  AND current_version_id IS DISTINCT FROM '12100000-0000-4000-8000-000000000005';

COMMIT;