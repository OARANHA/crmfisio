-- MedicsPro — Assessment Engine / Phase B
-- Standard templates + safe clinic-template lifecycle helpers.

BEGIN;

-- Stable platform templates. Tenants can read them through RLS but cannot mutate them.
INSERT INTO public.assessment_templates (
  id, clinic_id, owner_type, name, description, specialty, status, created_by
) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    NULL,
    'platform',
    'Avaliação fisioterapêutica inicial',
    'Modelo MedicsPro para avaliação inicial com anamnese, exame físico, dor, objetivos e plano terapêutico.',
    'fisioterapia',
    'active',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    NULL,
    'platform',
    'Avaliação de dor e função',
    'Modelo objetivo para registrar intensidade, localização da dor e impacto funcional.',
    'fisioterapia',
    'active',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_template_versions (
  id, template_id, version, schema, published_at, published_by
) VALUES
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    '{
      "sections": [
        {
          "key": "anamnese",
          "title": "Anamnese",
          "components": [
            {"key":"historia_condicao","type":"long_text","label":"História da condição atual","required":true},
            {"key":"cirurgias","type":"long_text","label":"Cirurgias prévias"},
            {"key":"medicamentos","type":"long_text","label":"Medicamentos em uso"},
            {"key":"alergias","type":"long_text","label":"Alergias"}
          ]
        },
        {
          "key": "avaliacao_fisica",
          "title": "Avaliação física",
          "components": [
            {"key":"exame_fisico","type":"long_text","label":"Exame físico / achados","required":true},
            {"key":"eva","type":"scale","label":"Intensidade da dor (0–10)","config":{"min":0,"max":10}},
            {"key":"mapa_dor","type":"body_map","label":"Mapa corporal de dor"}
          ]
        },
        {
          "key": "plano",
          "title": "Objetivos e plano",
          "components": [
            {"key":"objetivos","type":"long_text","label":"Objetivos terapêuticos","required":true},
            {"key":"plano_terapeutico","type":"long_text","label":"Plano terapêutico","required":true},
            {"key":"observacoes","type":"long_text","label":"Observações"}
          ]
        }
      ]
    }'::jsonb,
    now(),
    NULL
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    1,
    '{
      "sections": [
        {
          "key":"dor",
          "title":"Dor",
          "components":[
            {"key":"eva","type":"scale","label":"Intensidade da dor (0–10)","required":true,"config":{"min":0,"max":10}},
            {"key":"mapa_dor","type":"body_map","label":"Localização da dor","required":true},
            {"key":"caracteristica","type":"multiple_choice","label":"Característica","config":{"options":["Pontada","Queimação","Pressão","Choque","Peso","Outro"]}}
          ]
        },
        {
          "key":"funcao",
          "title":"Impacto funcional",
          "components":[
            {"key":"limitacao","type":"long_text","label":"Atividades limitadas pela condição"},
            {"key":"funcao_0_10","type":"scale","label":"Percepção funcional (0–10)","config":{"min":0,"max":10}},
            {"key":"observacoes","type":"long_text","label":"Observações"}
          ]
        }
      ]
    }'::jsonb,
    now(),
    NULL
  )
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.require_assessment_template_manager()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT p.clinic_id
    INTO v_clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo = true
    AND p.role IN ('owner', 'admin')
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Gerenciamento de modelos exige owner/admin ativo';
  END IF;

  RETURN v_clinic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.require_assessment_template_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_assessment_template_manager() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_clinic_assessment_template(
  p_name text,
  p_description text DEFAULT NULL,
  p_specialty text DEFAULT NULL,
  p_schema jsonb DEFAULT '{"sections":[]}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_template_id uuid;
BEGIN
  v_clinic_id := public.require_assessment_template_manager();

  IF length(trim(coalesce(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Nome do modelo é obrigatório';
  END IF;

  IF jsonb_typeof(p_schema) <> 'object' OR NOT (p_schema ? 'sections') OR jsonb_typeof(p_schema->'sections') <> 'array' THEN
    RAISE EXCEPTION 'Schema de avaliação inválido';
  END IF;

  INSERT INTO public.assessment_templates (
    clinic_id, owner_type, name, description, specialty, status, created_by
  ) VALUES (
    v_clinic_id, 'clinic', trim(p_name), nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_specialty, '')), ''), 'draft', auth.uid()
  )
  RETURNING id INTO v_template_id;

  INSERT INTO public.assessment_template_versions (
    template_id, version, schema, published_by
  ) VALUES (
    v_template_id, 1, p_schema, NULL
  );

  RETURN v_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_clinic_assessment_template(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_clinic_assessment_template(text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.duplicate_standard_assessment_template(
  p_source_template_id uuid,
  p_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_source public.assessment_templates%ROWTYPE;
  v_schema jsonb;
  v_template_id uuid;
BEGIN
  v_clinic_id := public.require_assessment_template_manager();

  SELECT * INTO v_source
  FROM public.assessment_templates t
  WHERE t.id = p_source_template_id
    AND t.owner_type = 'platform'
    AND t.status = 'active';

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Modelo padrão inexistente ou indisponível';
  END IF;

  SELECT v.schema INTO v_schema
  FROM public.assessment_template_versions v
  WHERE v.template_id = v_source.id
    AND v.published_at IS NOT NULL
  ORDER BY v.version DESC
  LIMIT 1;

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'Modelo padrão sem versão publicada';
  END IF;

  INSERT INTO public.assessment_templates (
    clinic_id, owner_type, name, description, specialty, status, created_by
  ) VALUES (
    v_clinic_id,
    'clinic',
    trim(coalesce(nullif(p_name, ''), v_source.name || ' — cópia')),
    v_source.description,
    v_source.specialty,
    'draft',
    auth.uid()
  )
  RETURNING id INTO v_template_id;

  INSERT INTO public.assessment_template_versions(template_id, version, schema)
  VALUES (v_template_id, 1, v_schema);

  RETURN v_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_standard_assessment_template(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_standard_assessment_template(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_next_assessment_template_version(
  p_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_next integer;
  v_schema jsonb;
  v_version_id uuid;
BEGIN
  v_clinic_id := public.require_assessment_template_manager();

  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_templates t
    WHERE t.id = p_template_id
      AND t.owner_type = 'clinic'
      AND t.clinic_id = v_clinic_id
      AND t.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'Modelo da clínica não encontrado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.assessment_template_versions v
    WHERE v.template_id = p_template_id
      AND v.published_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Já existe uma versão em rascunho para este modelo';
  END IF;

  SELECT coalesce(max(v.version), 0) + 1 INTO v_next
  FROM public.assessment_template_versions v
  WHERE v.template_id = p_template_id;

  SELECT v.schema INTO v_schema
  FROM public.assessment_template_versions v
  WHERE v.template_id = p_template_id
  ORDER BY v.version DESC
  LIMIT 1;

  INSERT INTO public.assessment_template_versions(template_id, version, schema)
  VALUES (p_template_id, v_next, coalesce(v_schema, '{"sections":[]}'::jsonb))
  RETURNING id INTO v_version_id;

  RETURN v_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_next_assessment_template_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_next_assessment_template_version(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_assessment_template_version(
  p_template_id uuid,
  p_version_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  v_clinic_id := public.require_assessment_template_manager();

  IF NOT EXISTS (
    SELECT 1
    FROM public.assessment_templates t
    JOIN public.assessment_template_versions v ON v.template_id = t.id
    WHERE t.id = p_template_id
      AND t.owner_type = 'clinic'
      AND t.clinic_id = v_clinic_id
      AND t.status <> 'archived'
      AND v.id = p_version_id
      AND v.published_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Versão em rascunho não encontrada';
  END IF;

  UPDATE public.assessment_template_versions
  SET published_at = now(), published_by = auth.uid()
  WHERE id = p_version_id;

  UPDATE public.assessment_templates
  SET status = 'active'
  WHERE id = p_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_assessment_template_version(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_assessment_template_version(uuid, uuid) TO authenticated;

COMMIT;
