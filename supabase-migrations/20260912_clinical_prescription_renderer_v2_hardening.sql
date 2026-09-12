-- MedicsPro — D2-B.2C renderer hardening
-- Final fail-closed validator + schema-tolerant frozen presentation context.

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
       OR coalesce(p_render_definition->>'preset', '') NOT IN ('classic', 'institutional', 'compact')
       OR coalesce(p_render_definition->>'accent', '') NOT IN ('monochrome', 'navy', 'emerald')
       OR coalesce(p_render_definition->>'medication_style', '') NOT IN ('numbered', 'cards')
       OR jsonb_typeof(p_render_definition->'title') IS DISTINCT FROM 'string'
       OR nullif(btrim(coalesce(p_render_definition->>'title', '')), '') IS NULL
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
            'issuer.specialty',
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
      'birth_date', to_jsonb(pat)->>'nascimento'
    ),
    'clinic', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'address', to_jsonb(c)->>'address',
      'phone', to_jsonb(c)->>'phone'
    ),
    'issuer', jsonb_build_object(
      'id', p.id,
      'name', p.nome,
      'professional_type', p.professional_type,
      'specialty', to_jsonb(p)->>'especialidade',
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

COMMIT;