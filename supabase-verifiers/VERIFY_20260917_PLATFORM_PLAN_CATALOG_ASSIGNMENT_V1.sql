\set ON_ERROR_STOP on
\pset pager off

DO $$
DECLARE
  v_admin uuid := '00000000-0000-0000-0000-000000000101';
  v_user uuid := '00000000-0000-0000-0000-000000000102';
  v_clinic_a uuid := '00000000-0000-0000-0000-000000000201';
  v_clinic_b uuid := '00000000-0000-0000-0000-000000000202';
  v_plan uuid;
  v_version uuid;
  v_version2 uuid;
  v_assignment uuid;
  v_effective boolean;
  v_count integer;
  v_old_assignment uuid;
  v_blocked boolean := false;
BEGIN
  INSERT INTO auth.users(id,email) VALUES
    (v_admin,'platform@example.invalid'), (v_user,'tenant@example.invalid')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.platform_admins(user_id,ativo) VALUES (v_admin,true)
  ON CONFLICT (user_id) DO UPDATE SET ativo = EXCLUDED.ativo;
  INSERT INTO public.clinics(id,name) VALUES
    (v_clinic_a,'Clinic A'), (v_clinic_b,'Clinic B')
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  BEGIN
    PERFORM public.platform_list_plans();
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'tenant user must not list plans'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  v_plan := public.platform_create_plan(
    'pilot', 'Pilot', 'Plano de validação',
    '{"nexus.access":false,"finance.access":true,"crm.access":false,"reports.access":true,"assessments.custom":false,"whatsapp.access":true}'::jsonb,
    true
  );
  SELECT version_id INTO v_version FROM public.platform_list_plans() WHERE plan_id = v_plan;
  IF v_version IS NULL THEN RAISE EXCEPTION 'published version missing'; END IF;

  v_assignment := public.platform_assign_clinic_plan(v_clinic_a, v_version, 'active', now(), NULL, 'initial');
  IF v_assignment IS NULL THEN RAISE EXCEPTION 'assignment missing'; END IF;

  IF public.platform_assign_clinic_plan(v_clinic_a, v_version, 'active', now(), NULL, 'duplicate') <> v_assignment THEN
    RAISE EXCEPTION 'same commercial assignment must be idempotent';
  END IF;
  SELECT count(*) INTO v_count FROM public.clinic_plan_assignments WHERE clinic_id = v_clinic_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate assignment created history noise'; END IF;

  SELECT public.clinic_entitlement_allowed(v_clinic_a,'finance.access') INTO v_effective;
  IF v_effective IS NOT TRUE THEN RAISE EXCEPTION 'plan baseline finance should allow'; END IF;
  SELECT public.clinic_entitlement_allowed(v_clinic_a,'nexus.access') INTO v_effective;
  IF v_effective IS NOT FALSE THEN RAISE EXCEPTION 'plan baseline nexus should deny'; END IF;

  -- Clinic B has no plan/override: preserve legacy rollout defaults.
  SELECT public.clinic_entitlement_allowed(v_clinic_b,'finance.access') INTO v_effective;
  IF v_effective IS NOT TRUE THEN RAISE EXCEPTION 'legacy finance fallback changed'; END IF;
  SELECT public.clinic_entitlement_allowed(v_clinic_b,'nexus.access') INTO v_effective;
  IF v_effective IS NOT FALSE THEN RAISE EXCEPTION 'legacy nexus fail-closed changed'; END IF;

  INSERT INTO public.platform_clinic_entitlements(
    clinic_id,entitlement_key,enabled,source,updated_by
  ) VALUES (v_clinic_a,'finance.access',false,'manual',v_admin);
  SELECT public.clinic_entitlement_allowed(v_clinic_a,'finance.access') INTO v_effective;
  IF v_effective IS NOT FALSE THEN RAISE EXCEPTION 'manual override must win plan baseline'; END IF;

  IF NOT public.platform_reset_clinic_entitlement(v_clinic_a,'finance.access') THEN
    RAISE EXCEPTION 'reset should delete override';
  END IF;
  SELECT public.clinic_entitlement_allowed(v_clinic_a,'finance.access') INTO v_effective;
  IF v_effective IS NOT TRUE THEN RAISE EXCEPTION 'reset must return to plan baseline'; END IF;

  SELECT assignment_id INTO v_old_assignment
  FROM public.platform_get_clinic_plan_assignment(v_clinic_a);

  v_version2 := public.platform_publish_plan_version(
    v_plan, 'Pilot 2', 'Segunda versão',
    '{"nexus.access":false,"finance.access":false,"crm.access":true,"reports.access":true,"assessments.custom":false,"whatsapp.access":true}'::jsonb
  );
  PERFORM public.platform_assign_clinic_plan(v_clinic_a, v_version2, 'active', now(), NULL, 'upgrade');

  SELECT count(*) INTO v_count FROM public.clinic_plan_assignments WHERE clinic_id = v_clinic_a;
  IF v_count <> 2 THEN RAISE EXCEPTION 'plan change must preserve assignment history'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinic_plan_assignments WHERE id = v_old_assignment AND ends_at IS NOT NULL) THEN
    RAISE EXCEPTION 'previous assignment not closed';
  END IF;
  SELECT public.clinic_entitlement_allowed(v_clinic_a,'finance.access') INTO v_effective;
  IF v_effective IS NOT FALSE THEN RAISE EXCEPTION 'new plan version baseline not effective'; END IF;

  -- Published plan snapshots are immutable.
  v_blocked := false;
  BEGIN
    UPDATE public.platform_plan_entitlements
    SET enabled = NOT enabled
    WHERE plan_version_id = v_version2 AND entitlement_key = 'finance.access';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'published plan entitlement mutation must be blocked'; END IF;

  -- V1 assignments are immediate only; scheduling/backdating belongs to a future contract.
  v_blocked := false;
  BEGIN
    PERFORM public.platform_assign_clinic_plan(v_clinic_b, v_version2, 'active', now() + interval '1 day', NULL, 'future');
  EXCEPTION WHEN invalid_parameter_value THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'future plan assignment must be rejected in V1'; END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.platform_assign_clinic_plan(v_clinic_b, v_version2, 'active', now(), now() + interval '1 day', 'invalid trial end');
  EXCEPTION WHEN invalid_parameter_value THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'active assignment must not carry trial end'; END IF;

  -- Invalid assignment states fail closed at the command boundary.
  v_blocked := false;
  BEGIN
    PERFORM public.platform_assign_clinic_plan(v_clinic_b, v_version2, 'past_due', now(), NULL, 'invalid command');
  EXCEPTION WHEN invalid_parameter_value THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'past_due assignment command must be rejected in V1'; END IF;

  -- Trial baseline expires without affecting another clinic.
  PERFORM public.platform_assign_clinic_plan(v_clinic_b, v_version2, 'trialing', now(), now() + interval '2 days', 'trial');
  SELECT public.clinic_entitlement_allowed(v_clinic_b,'crm.access') INTO v_effective;
  IF v_effective IS NOT TRUE THEN RAISE EXCEPTION 'active trial baseline missing'; END IF;

  -- Plan catalog activity governs new sales only; existing assignment remains historical/effective.
  PERFORM public.platform_set_plan_active(v_plan, false);
  SELECT public.clinic_entitlement_allowed(v_clinic_a,'reports.access') INTO v_effective;
  IF v_effective IS NOT TRUE THEN RAISE EXCEPTION 'deactivating catalog must not revoke existing assignment'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.platform_clinic_entitlements WHERE source = 'plan'
  ) THEN RAISE EXCEPTION 'plan baseline must not be materialized as override rows'; END IF;

  IF pg_get_functiondef('public.platform_assign_clinic_plan(uuid,uuid,text,timestamptz,timestamptz,text)'::regprocedure)
       ~* '(professional_capabilities|profiles|nexus_clinical_results|clinical_instrument)' THEN
    RAISE EXCEPTION 'plan assignment must not mutate or grant clinical authorization';
  END IF;
END $$;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.platform_plans','SELECT')
     OR has_table_privilege('authenticated','public.platform_plan_versions','SELECT')
     OR has_table_privilege('authenticated','public.platform_plan_entitlements','SELECT')
     OR has_table_privilege('authenticated','public.clinic_plan_assignments','SELECT') THEN
    RAISE EXCEPTION 'authenticated direct table access must remain denied';
  END IF;
  IF has_function_privilege('anon','public.platform_list_plans()','EXECUTE')
     OR has_function_privilege('anon','public.platform_get_clinic_plan_assignment(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'anon control-plane RPC access must be denied';
  END IF;
  IF NOT has_function_privilege('service_role','public.clinic_entitlement_allowed(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role worker entitlement predicate missing';
  END IF;
END $$;

SELECT 'VERIFY PLATFORM PLAN CATALOG + CLINIC PLAN ASSIGNMENT V1 OK' AS result;
