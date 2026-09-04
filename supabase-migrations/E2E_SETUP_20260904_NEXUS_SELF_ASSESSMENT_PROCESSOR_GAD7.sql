\set ON_ERROR_STOP on

BEGIN;

DELETE FROM public.audit_log WHERE clinic_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid;
DELETE FROM public.nexus_red_flags WHERE patient_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid;
DELETE FROM public.nexus_self_assessment_invites WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid;
DELETE FROM public.nexus_clinical_results WHERE patient_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid;
DELETE FROM public.professional_capabilities WHERE professional_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid;
DELETE FROM public.patients WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid;
DELETE FROM public.profiles WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid;
DELETE FROM auth.users WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid;
DELETE FROM public.clinics WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid;

INSERT INTO public.clinics (id, name)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid, 'E2E Nexus GAD7 Processor');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
  'authenticated', 'authenticated', 'e2e-gad7-processor@invalid.local',
  crypt('not-used-e2e-only', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now(), false, false
);

INSERT INTO public.profiles (
  id, clinic_id, email, nome, role, ativo, professional_type
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
  'e2e-gad7-processor@invalid.local',
  'E2E GAD7 Professional', 'fisio', true, 'medico'
);

INSERT INTO public.professional_capabilities (
  clinic_id, professional_id, capability_key, granted
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
  'nexus.scales', true
);

INSERT INTO public.patients (
  id, clinic_id, nome, status, funil_stage, anonimizado
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
  'E2E GAD7 Patient', 'ativo', 'avaliacao', false
);

INSERT INTO public.nexus_self_assessment_invites (
  id, clinic_id, patient_id, professional_id, scale_key, rule_version,
  token_hash, expires_at, submitted_at, status, response_snapshot
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
  'gad7', 'nexus-2026-09-03',
  encode(digest('e2e-gad7-token-20260904', 'sha256'), 'hex'),
  now() + interval '1 hour', now(), 'submitted',
  '{
    "scaleKey":"gad7",
    "ruleVersion":"nexus-2026-09-03",
    "answers":{"q1":2,"q2":2,"q3":2,"q4":2,"q5":1,"q6":1,"q7":1},
    "selectedOptions":[]
  }'::jsonb
);

COMMIT;

SELECT id, status, scale_key, rule_version, submitted_at IS NOT NULL AS submitted
FROM public.nexus_self_assessment_invites
WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid;
