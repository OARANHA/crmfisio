\pset pager off

DO $$
DECLARE
  v_assessment text := pg_get_functiondef('public.validate_clinical_assessment_context()'::regprocedure);
  v_authorship text := pg_get_functiondef('public.guard_legacy_clinical_self_authorship()'::regprocedure);
  v_evolution text := pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure);
BEGIN
  IF position('''fisio''' IN lower(v_assessment)) = 0 THEN
    RAISE EXCEPTION 'precondition_assessment_fisio_drift_not_reproduced';
  END IF;
  IF position('a.professional_id = new.professional_id' IN lower(v_assessment)) > 0 THEN
    RAISE EXCEPTION 'precondition_assessment_professional_link_already_present';
  END IF;
  IF position('''fisio''' IN lower(v_authorship)) = 0 THEN
    RAISE EXCEPTION 'precondition_self_authorship_fisio_drift_not_reproduced';
  END IF;
  IF position('v_appointment.fisio_id' IN lower(v_evolution)) = 0 THEN
    RAISE EXCEPTION 'precondition_evolution_alias_dependency_not_reproduced';
  END IF;
END
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clinical_assessments(
      id, clinic_id, patient_id, professional_id, appointment_id, template_id, template_version_id
    ) VALUES (
      '00000000-0000-0000-0000-000000009001',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000001101',
      '00000000-0000-0000-0000-000000003001',
      '00000000-0000-0000-0000-000000003101'
    );
    RAISE EXCEPTION 'precondition_canonical_professional_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'precondition_canonical_professional_should_have_failed' THEN RAISE; END IF;
    IF position('Ato clínico exige profissional assistencial ativo' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END
$$;
RESET request.jwt.claim.sub;

SELECT 'CLINICAL_FOUNDATION_PRECONDITION_REPRODUCED' AS verification;
