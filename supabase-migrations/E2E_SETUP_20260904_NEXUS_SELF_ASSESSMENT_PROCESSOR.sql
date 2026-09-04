-- Isolated E2E fixture for Nexus self-assessment processor.
-- Creates only synthetic records with fixed test UUIDs; safe to clean by IDs.
\set ON_ERROR_STOP on

BEGIN;

-- Clean a previous interrupted run of this exact fixture.
DELETE FROM public.nexus_red_flags WHERE patient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid;
DELETE FROM public.nexus_self_assessment_invites WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid;
DELETE FROM public.nexus_clinical_results WHERE patient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid;
DELETE FROM public.professional_capabilities WHERE professional_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid;
DELETE FROM public.patients WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid;
DELETE FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid;
DELETE FROM auth.users WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid;
DELETE FROM public.clinics WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid;

INSERT INTO public.clinics (id, name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '__NEXUS_PROCESSOR_E2E__');

INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'authenticated', 'authenticated', 'nexus.processor.e2e@invalid.local',
  '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
);

INSERT INTO public.profiles (
  id, clinic_id, email, nome, role, ativo, professional_type
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'nexus.processor.e2e@invalid.local',
  '__NEXUS_PROCESSOR_E2E_PROFESSIONAL__',
  'fisio', true, 'medico'
);

INSERT INTO public.professional_capabilities (
  clinic_id, professional_id, capability_key, granted
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'nexus.scales', true
);

INSERT INTO public.patients (
  id, clinic_id, nome, status, funil_stage, anonimizado
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '__NEXUS_PROCESSOR_E2E_PATIENT__',
  'ativo', 'tratamento', false
);

INSERT INTO public.nexus_self_assessment_invites (
  id, clinic_id, patient_id, professional_id,
  scale_key, rule_version, token_hash, expires_at,
  submitted_at, status, response_snapshot
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'phq9', 'nexus-2026-09-03',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  now() + interval '1 day', now(), 'submitted',
  jsonb_build_object(
    'scaleKey','phq9',
    'ruleVersion','nexus-2026-09-03',
    'answers',jsonb_build_object(
      'q1',1,'q2',1,'q3',1,'q4',1,'q5',1,'q6',1,'q7',1,'q8',1,'q9',1
    ),
    'selectedOptions',jsonb_build_array()
  )
);

COMMIT;

SELECT id, status, scale_key, rule_version, submitted_at IS NOT NULL AS submitted
FROM public.nexus_self_assessment_invites
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid;
