\echo '1) professional + valid identity + clinical.attend can perform clinical journey transitions'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

SELECT * FROM public.transition_patient_journey(
  '30000000-0000-0000-0000-000000000001', 'tratamento', 'plano_definido', NULL
);
SELECT * FROM public.transition_patient_journey(
  '30000000-0000-0000-0000-000000000002', 'alta', 'objetivos_atingidos', NULL
);
SELECT * FROM public.transition_patient_journey(
  '30000000-0000-0000-0000-000000000003', 'tratamento', 'recidiva', NULL
);

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.patient_journey_events
  WHERE patient_id = '30000000-0000-0000-0000-000000000001'
    AND from_stage = 'avaliacao'
    AND to_stage = 'tratamento'
    AND actor_id = '10000000-0000-0000-0000-000000000001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'clinical_authorization_expected_exactly_one_journey_event';
  END IF;
END $$;

\echo '2) professional without clinical.attend is denied'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.transition_patient_journey(
      '30000000-0000-0000-0000-000000000005', 'tratamento', 'should_fail', NULL
    );
    RAISE EXCEPTION 'clinical_authorization_missing_capability_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END $$;

\echo '3) professional without valid clinical identity is denied'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.transition_patient_journey(
      '30000000-0000-0000-0000-000000000006', 'tratamento', 'should_fail', NULL
    );
    RAISE EXCEPTION 'clinical_authorization_invalid_identity_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END $$;

\echo '4) cross-tenant patient journey is denied'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.transition_patient_journey(
      '30000000-0000-0000-0000-000000000007', 'tratamento', 'should_fail', NULL
    );
    RAISE EXCEPTION 'clinical_authorization_cross_tenant_journey_was_allowed';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    NULL;
  END;
END $$;

\echo '5) direct browser funil_stage UPDATE by professional remains denied'
DO $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.patients
  SET funil_stage = 'alta'
  WHERE id = '30000000-0000-0000-0000-000000000005';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'clinical_authorization_professional_received_general_crm_write';
  END IF;
END $$;

\echo '6) reception lead -> assessment behavior is preserved through canonical RPC'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
SELECT * FROM public.transition_patient_journey(
  '30000000-0000-0000-0000-000000000004', 'avaliacao', 'avaliacao_agendada', NULL
);
DO $$
DECLARE v_stage text; v_count integer;
BEGIN
  SELECT funil_stage INTO v_stage FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000004';
  SELECT count(*) INTO v_count FROM public.patient_journey_events
  WHERE patient_id = '30000000-0000-0000-0000-000000000004'
    AND from_stage = 'lead' AND to_stage = 'avaliacao'
    AND actor_id = '10000000-0000-0000-0000-000000000004';
  IF v_stage <> 'avaliacao' OR v_count <> 1 THEN
    RAISE EXCEPTION 'clinical_authorization_reception_handoff_drift';
  END IF;
END $$;

\echo '7) owner/admin cannot bypass clinical journey through direct CRM UPDATE'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', false);
DO $$
BEGIN
  BEGIN
    UPDATE public.patients
    SET funil_stage = 'tratamento'
    WHERE id = '30000000-0000-0000-0000-000000000005';
    RAISE EXCEPTION 'clinical_authorization_owner_direct_clinical_transition_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END $$;

\echo '8) non-clinical owner does not receive clinical authority from role'
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.transition_patient_journey(
      '30000000-0000-0000-0000-000000000005', 'tratamento', 'should_fail', NULL
    );
    RAISE EXCEPTION 'clinical_authorization_owner_role_bypass_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END $$;

\echo '9) own appointment + clinical.attend + evolution can finalize'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_rows integer; v_status text;
BEGIN
  UPDATE public.appointments
  SET status = 'finalizado'
  WHERE id = '40000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  SELECT status INTO v_status FROM public.appointments WHERE id = '40000000-0000-0000-0000-000000000001';
  IF v_rows <> 1 OR v_status <> 'finalizado' THEN
    RAISE EXCEPTION 'clinical_authorization_valid_finalize_failed';
  END IF;
END $$;

\echo '10) own appointment without evolution cannot finalize'
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET status = 'finalizado'
    WHERE id = '40000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'clinical_authorization_finalize_without_evolution_was_allowed';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    NULL;
  END;
END $$;

\echo '11) another professional appointment cannot be mutated'
DO $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.appointments
  SET status = 'finalizado'
  WHERE id = '40000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'clinical_authorization_cross_professional_update_was_allowed';
  END IF;
END $$;

\echo '12) professional without clinical.attend cannot perform a clinical transition'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET status = 'finalizado'
    WHERE id = '40000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'clinical_authorization_appointment_without_attend_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END $$;

\echo '13) operational confirmation does not require clinical.attend'
DO $$
DECLARE v_rows integer; v_status text;
BEGIN
  UPDATE public.appointments
  SET status = 'confirmado'
  WHERE id = '40000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  SELECT status INTO v_status FROM public.appointments WHERE id = '40000000-0000-0000-0000-000000000004';
  IF v_rows <> 1 OR v_status <> 'confirmado' THEN
    RAISE EXCEPTION 'clinical_authorization_operational_professional_transition_broken';
  END IF;
END $$;

\echo '14) structural appointment mutation remains blocked'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET tipo = 'Mutação indevida'
    WHERE id = '40000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'clinical_authorization_structural_mutation_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END $$;

\echo '15) cross-tenant appointment mutation is denied'
DO $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.appointments
  SET status = 'finalizado'
  WHERE id = '40000000-0000-0000-0000-000000000005';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'clinical_authorization_cross_tenant_appointment_was_allowed';
  END IF;
END $$;

\echo '16) non-clinical owner cannot finalize even an appointment assigned to self'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', false);
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET status = 'finalizado'
    WHERE id = '40000000-0000-0000-0000-000000000006';
    RAISE EXCEPTION 'clinical_authorization_nonclinical_owner_finalize_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END $$;

RESET ROLE;
