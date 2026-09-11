BEGIN;
SET TRANSACTION READ ONLY;
DO $$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM public.assessment_templates t JOIN public.assessment_template_versions v ON v.template_id=t.id
 WHERE t.id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004') AND t.owner_type='platform' AND t.status='active' AND v.version=1 AND v.published_at IS NOT NULL;
 IF v_count <> 2 THEN RAISE EXCEPTION 'MedicsPro V1 platform templates missing or unpublished'; END IF;
 IF EXISTS (SELECT 1 FROM public.assessment_template_versions WHERE template_id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004') AND schema::text ~* 'PHQ-9|GAD-7') THEN RAISE EXCEPTION 'Validated instruments must not be duplicated'; END IF;
END $$;
ROLLBACK;
\echo 'MEDICSPRO GENERAL + PSYCHIATRIC ASSESSMENTS V1 VERIFY PASSED'
