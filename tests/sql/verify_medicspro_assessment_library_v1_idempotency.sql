CREATE TEMP TABLE library_v1_before AS SELECT t.id, t.name, t.owner_type, t.status, t.specialty, v.id version_id, v.version, v.schema, v.published_at FROM public.assessment_templates t JOIN public.assessment_template_versions v ON v.template_id=t.id WHERE t.id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004');
DO $$ BEGIN IF (SELECT count(*) FROM library_v1_before) <> 2 THEN RAISE EXCEPTION 'unexpected first-apply snapshot cardinality'; END IF; END $$;
\i supabase-migrations/20260911_medicspro_general_psychiatric_assessments_v1.sql
\i supabase-verifiers/VERIFY_20260911_MEDICSPRO_GENERAL_PSYCHIATRIC_ASSESSMENTS_V1.sql
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assessment_templates WHERE id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004')) <> 2
  OR (SELECT count(*) FROM public.assessment_template_versions WHERE template_id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004')) <> 2
  OR EXISTS (SELECT 1 FROM library_v1_before b FULL JOIN (SELECT t.id,t.name,t.owner_type,t.status,t.specialty,v.id version_id,v.version,v.schema,v.published_at FROM public.assessment_templates t JOIN public.assessment_template_versions v ON v.template_id=t.id WHERE t.id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004')) a USING(id) WHERE a IS DISTINCT FROM b)
  THEN RAISE EXCEPTION 'library V1 idempotency drift'; END IF;
END $$;
