BEGIN;
SET TRANSACTION READ ONLY;
DO $$
DECLARE r record; schema_value jsonb;
BEGIN
  -- v1 has no slug, owner_id or current_version_id: UUID + version is canonical.
  FOR r IN SELECT * FROM (VALUES
    ('10000000-0000-4000-8000-000000000003'::uuid,'11000000-0000-4000-8000-000000000003'::uuid,'Anamnese Médica Geral','medicina geral',ARRAY['demanda','antecedentes','habitos','revisao_sintese'],ARRAY['queixa_principal','historia_atual','medicamentos_snapshot','alergias_snapshot','sintese_clinica']),
    ('10000000-0000-4000-8000-000000000004'::uuid,'11000000-0000-4000-8000-000000000004'::uuid,'Anamnese Psiquiátrica','psiquiatria',ARRAY['demanda_evolucao','sintomas_atuais','antecedentes_tratamentos','contexto_risco','exame_sintese'],ARRAY['motivo_consulta','humor','risco_atual','estado_mental','sintese_clinica'])
  ) x(template_id,version_id,name,specialty,sections,components) LOOP
    IF (SELECT count(*) FROM public.assessment_templates WHERE id=r.template_id) <> 1 THEN RAISE EXCEPTION 'stable template ID drift: %', r.template_id; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.assessment_templates WHERE id=r.template_id AND clinic_id IS NULL AND owner_type='platform' AND status='active' AND name=r.name AND specialty=r.specialty AND created_by IS NULL) THEN RAISE EXCEPTION 'template definition drift: %',r.name; END IF;
    IF (SELECT count(*) FROM public.assessment_template_versions WHERE template_id=r.template_id AND version=1) <> 1 THEN RAISE EXCEPTION 'version duplicate/drift: %',r.name; END IF;
    SELECT schema INTO schema_value FROM public.assessment_template_versions WHERE id=r.version_id AND template_id=r.template_id AND version=1 AND published_at IS NOT NULL;
    IF schema_value IS NULL THEN RAISE EXCEPTION 'published version missing: %',r.name; END IF;
    IF EXISTS (SELECT 1 FROM unnest(r.sections) s WHERE NOT jsonb_path_exists(schema_value, format('$.sections[*] ? (@.key == "%s")',s)::jsonpath)) THEN RAISE EXCEPTION 'section contract drift: %',r.name; END IF;
    IF EXISTS (SELECT 1 FROM unnest(r.components) c WHERE NOT jsonb_path_exists(schema_value, format('$.sections[*].components[*] ? (@.key == "%s")',c)::jsonpath)) THEN RAISE EXCEPTION 'component contract drift: %',r.name; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.assessment_template_versions WHERE template_id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004') AND schema::text ~* 'PHQ-9|GAD-7|baixo risco|médio risco|alto risco') THEN RAISE EXCEPTION 'instrument/automatic risk drift'; END IF;
END $$;
ROLLBACK;
\echo 'MEDICSPRO GENERAL + PSYCHIATRIC ASSESSMENTS V1 VERIFY PASSED'
