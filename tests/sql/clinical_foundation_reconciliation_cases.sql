\pset pager off

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';

-- professional A + own appointment -> allowed; canonical role='professional' is enough.
INSERT INTO public.clinical_assessments(
  id, clinic_id, patient_id, professional_id, appointment_id, template_id, template_version_id
) VALUES (
  '00000000-0000-0000-0000-000000004001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000001101',
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000003101'
);

-- Draft without an appointment remains a valid Assessment Engine flow.
INSERT INTO public.clinical_assessments(
  id, clinic_id, patient_id, professional_id, appointment_id, template_id, template_version_id
) VALUES (
  '00000000-0000-0000-0000-000000004002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000011',
  NULL,
  '00000000-0000-0000-0000-000000003002',
  '00000000-0000-0000-0000-000000003102'
);
UPDATE public.clinical_assessments
SET answers = '{"pain":6}'::jsonb
WHERE id = '00000000-0000-0000-0000-000000004002';

-- Body Map remains writable while its assessment is a draft.
INSERT INTO public.assessment_body_points(
  id, clinic_id, assessment_id, component_key, view, x, y, region, laterality, intensity, symptom, note
) VALUES (
  '00000000-0000-0000-0000-000000005001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000004002',
  'pain-map','front',0.5,0.5,'lumbar','midline',6,'Dor','teste'
);

DO $$
BEGIN
  -- Same patient, appointment owned by professional B -> blocked server-side.
  BEGIN
    INSERT INTO public.clinical_assessments(id,clinic_id,patient_id,professional_id,appointment_id,template_id,template_version_id)
    VALUES ('00000000-0000-0000-0000-000000004011','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000001102','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003101');
    RAISE EXCEPTION 'expected_other_professional_appointment_denial';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_other_professional_appointment_denial' THEN RAISE; END IF;
    IF position('Atendimento inválido para paciente/clínica/profissional' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- Appointment belongs to another patient -> blocked.
  BEGIN
    INSERT INTO public.clinical_assessments(id,clinic_id,patient_id,professional_id,appointment_id,template_id,template_version_id)
    VALUES ('00000000-0000-0000-0000-000000004012','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000001103','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003101');
    RAISE EXCEPTION 'expected_other_patient_appointment_denial';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_other_patient_appointment_denial' THEN RAISE; END IF;
    IF position('Atendimento inválido para paciente/clínica/profissional' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- Appointment from another tenant -> blocked even when the caller supplies its id.
  BEGIN
    INSERT INTO public.clinical_assessments(id,clinic_id,patient_id,professional_id,appointment_id,template_id,template_version_id)
    VALUES ('00000000-0000-0000-0000-000000004013','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000002101','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003101');
    RAISE EXCEPTION 'expected_other_tenant_appointment_denial';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_other_tenant_appointment_denial' THEN RAISE; END IF;
    IF position('Atendimento inválido para paciente/clínica/profissional' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END
$$;

-- Legacy evolution table now authorizes the canonical professional through capability,
-- and its session linkage uses appointments.professional_id.
INSERT INTO public.physiotherapy_evolutions(id,clinic_id,patient_id,professional_id,session_id,texto)
VALUES (
  '00000000-0000-0000-0000-000000006001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000001101',
  'evolução canônica'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.physiotherapy_evolutions(id,clinic_id,patient_id,professional_id,session_id,texto)
    VALUES ('00000000-0000-0000-0000-000000006002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000001102','sessão de B');
    RAISE EXCEPTION 'expected_evolution_other_professional_denial';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_evolution_other_professional_denial' THEN RAISE; END IF;
    IF position('clinical_evolution_session_mismatch' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END
$$;

-- Finalization remains intact and finalized assessments stay immutable.
UPDATE public.clinical_assessments
SET status = 'finalized', finalized_at = now()
WHERE id = '00000000-0000-0000-0000-000000004002';

DO $$
BEGIN
  BEGIN
    UPDATE public.clinical_assessments SET answers = '{"pain":7}'::jsonb
    WHERE id = '00000000-0000-0000-0000-000000004002';
    RAISE EXCEPTION 'expected_finalized_assessment_immutable';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_finalized_assessment_immutable' THEN RAISE; END IF;
    IF position('Avaliação finalizada não pode ser sobrescrita' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.assessment_body_points(id,clinic_id,assessment_id,component_key,view,x,y)
    VALUES ('00000000-0000-0000-0000-000000005002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000004002','pain-map','front',0.4,0.4);
    RAISE EXCEPTION 'expected_body_map_finalized_denial';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_body_map_finalized_denial' THEN RAISE; END IF;
    IF position('Pontos corporais só podem ser alterados em rascunho' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.assessment_template_versions
    SET schema = '{"sections":[{"key":"changed"}]}'::jsonb
    WHERE id = '00000000-0000-0000-0000-000000003101';
    RAISE EXCEPTION 'expected_published_template_immutable';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_published_template_immutable' THEN RAISE; END IF;
    IF position('Versão publicada de avaliação é imutável' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END
$$;

-- Owner/admin have an explicit assessment capability in this fixture, but cannot
-- assign an assessment to professional A: capability is not an impersonation bypass.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000013';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clinical_assessments(id,clinic_id,patient_id,professional_id,appointment_id,template_id,template_version_id)
    VALUES ('00000000-0000-0000-0000-000000004021','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000001101','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003101');
    RAISE EXCEPTION 'expected_owner_impersonation_denial';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_owner_impersonation_denial' THEN RAISE; END IF;
    IF position('professional_id deve ser o profissional autenticado' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END
$$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000014';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clinical_assessments(id,clinic_id,patient_id,professional_id,appointment_id,template_id,template_version_id)
    VALUES ('00000000-0000-0000-0000-000000004022','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000001101','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003101');
    RAISE EXCEPTION 'expected_admin_impersonation_denial';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected_admin_impersonation_denial' THEN RAISE; END IF;
    IF position('professional_id deve ser o profissional autenticado' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END
$$;

RESET request.jwt.claim.sub;
SELECT 'CLINICAL_FOUNDATION_RECONCILIATION_BEHAVIOR_VERIFIED' AS verification;
