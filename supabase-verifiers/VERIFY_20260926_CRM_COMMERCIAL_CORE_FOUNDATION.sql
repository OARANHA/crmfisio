\set ON_ERROR_STOP on

SELECT '1) Commercial Core tables exist and RLS is enabled' AS check;
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['contacts','crm_pipelines','crm_stages','crm_leads','crm_lead_activities']
  LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE EXCEPTION 'crm_table_missing_%', v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.oid = to_regclass('public.' || v_table)
        AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'crm_rls_not_enabled_%', v_table;
    END IF;
  END LOOP;
END $$;

SELECT '2) browser direct table privileges are closed' AS check;
DO $$
DECLARE
  v_table text;
  v_role text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['contacts','crm_pipelines','crm_stages','crm_leads','crm_lead_activities']
  LOOP
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated']
    LOOP
      IF has_table_privilege(v_role, 'public.' || v_table, 'SELECT')
         OR has_table_privilege(v_role, 'public.' || v_table, 'INSERT')
         OR has_table_privilege(v_role, 'public.' || v_table, 'UPDATE')
         OR has_table_privilege(v_role, 'public.' || v_table, 'DELETE') THEN
        RAISE EXCEPTION 'crm_direct_privilege_leaked_%_%', v_role, v_table;
      END IF;
    END LOOP;
  END LOOP;
END $$;

SELECT '3) read projections are authenticated-only and enforce clinic/role/entitlement' AS check;
DO $$
DECLARE
  v_pipelines oid := to_regprocedure('public.list_current_clinic_crm_pipeline_stages()');
  v_leads oid := to_regprocedure('public.list_current_clinic_crm_leads()');
  v_def text;
BEGIN
  IF v_pipelines IS NULL OR v_leads IS NULL THEN
    RAISE EXCEPTION 'crm_read_projection_missing';
  END IF;

  IF has_function_privilege('anon', v_pipelines, 'EXECUTE')
     OR has_function_privilege('anon', v_leads, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_pipelines, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_leads, 'EXECUTE') THEN
    RAISE EXCEPTION 'crm_read_projection_acl_invalid';
  END IF;

  SELECT pg_get_functiondef(v_leads) INTO v_def;
  IF v_def NOT LIKE '%SECURITY DEFINER%'
     OR v_def NOT LIKE '%current_clinic_id%'
     OR v_def NOT LIKE '%current_app_role%'
     OR v_def NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_def LIKE '%queixa_principal%'
     OR v_def LIKE '%cid10%'
     OR v_def LIKE '%anamnese%' THEN
    RAISE EXCEPTION 'crm_lead_projection_boundary_invalid';
  END IF;
END $$;

SELECT '4) structural invariants exist' AS check;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='contacts'
      AND indexname='contacts_active_patient_unique'
      AND indexdef ILIKE '%WHERE%patient_id IS NOT NULL%deleted_at IS NULL%'
  ) THEN
    RAISE EXCEPTION 'contact_active_patient_unique_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='crm_pipelines'
      AND indexname='crm_pipelines_one_active_default'
  ) THEN
    RAISE EXCEPTION 'crm_default_pipeline_unique_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.crm_stages'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%stage_kind%open%won%lost%'
  ) THEN
    RAISE EXCEPTION 'crm_stage_kind_check_missing';
  END IF;

  IF to_regprocedure('public.guard_crm_contact_integrity()') IS NULL
     OR to_regprocedure('public.guard_crm_lead_integrity()') IS NULL THEN
    RAISE EXCEPTION 'crm_integrity_guard_missing';
  END IF;
END $$;

BEGIN;

-- Test fixtures use the canonical verifier clinics/users already present in the DB harness.
INSERT INTO public.platform_clinic_entitlements (clinic_id, entitlement_key, enabled, source)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'crm.access', true, 'manual'),
  ('20000000-0000-0000-0000-000000000002', 'crm.access', true, 'manual')
ON CONFLICT (clinic_id, entitlement_key)
DO UPDATE SET enabled=excluded.enabled, source=excluded.source, updated_at=now();

INSERT INTO public.patients (id, clinic_id, nome, nascimento)
VALUES
  ('92000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Paciente CRM A', '1990-01-01'),
  ('92000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Paciente CRM B', '1990-01-01');

INSERT INTO public.contacts (id, clinic_id, name, phone, email, patient_id)
VALUES
  ('93000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Contato A', '+555100000001', 'a@example.test', '92000000-0000-0000-0000-000000000001'),
  ('93000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Contato B', '+555100000002', 'b@example.test', '92000000-0000-0000-0000-000000000002');

INSERT INTO public.crm_pipelines (id, clinic_id, name, is_default)
VALUES
  ('94000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Pipeline A', true),
  ('94000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Pipeline B', true);

INSERT INTO public.crm_stages (id, clinic_id, pipeline_id, name, position, stage_kind)
VALUES
  ('95000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'Novo', 0, 'open'),
  ('95000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'Convertido', 10, 'won'),
  ('95000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'Perdido', 20, 'lost'),
  ('95000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000002', 'Novo B', 0, 'open');

INSERT INTO public.crm_leads (id, clinic_id, contact_id, pipeline_id, stage_id, source)
VALUES
  ('96000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', 'verifier'),
  ('96000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000002', '95000000-0000-0000-0000-000000000004', 'verifier');

SELECT '5) cross-tenant Contact→Patient link fails closed' AS check;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.contacts (clinic_id, name, patient_id)
    VALUES ('20000000-0000-0000-0000-000000000001', 'Cross tenant', '92000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'cross_tenant_contact_patient_unexpectedly_allowed';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

SELECT '6) Lead outcome invariants fail closed' AS check;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.crm_leads (clinic_id, contact_id, pipeline_id, stage_id, closed_at)
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      '95000000-0000-0000-0000-000000000003',
      now()
    );
    RAISE EXCEPTION 'lost_lead_without_reason_unexpectedly_allowed';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.crm_leads (clinic_id, contact_id, pipeline_id, stage_id, converted_patient_id, converted_at)
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      '95000000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000002',
      now()
    );
    RAISE EXCEPTION 'cross_tenant_converted_patient_unexpectedly_allowed';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

SELECT '7) authenticated browser cannot bypass the RPC/read boundary' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.contacts (clinic_id, name)
    VALUES ('20000000-0000-0000-0000-000000000001', 'Bypass');
    RAISE EXCEPTION 'authenticated_direct_contact_insert_unexpectedly_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.list_current_clinic_crm_leads();
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'owner_crm_read_expected_1_got_%', v_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.list_current_clinic_crm_leads()
    WHERE lead_id = '96000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'cross_tenant_lead_visible';
  END IF;
END $$;
RESET ROLE;

SELECT '8) disabled crm.access blocks read projection' AS check;
UPDATE public.platform_clinic_entitlements
SET enabled=false, updated_at=now()
WHERE clinic_id='20000000-0000-0000-0000-000000000001'
  AND entitlement_key='crm.access';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_leads();
    RAISE EXCEPTION 'disabled_crm_entitlement_read_unexpectedly_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

ROLLBACK;

SELECT 'CRM COMMERCIAL CORE FOUNDATION VERIFY PASSED' AS result;
