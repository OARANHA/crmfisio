-- D2-E4 hotfix behavioral fixture. It is loaded only in the disposable PG16 DB.
-- IDs deliberately stay inside the D2 test namespace.

INSERT INTO public.profiles(
  id, clinic_id, role, ativo, must_change_password, nome,
  professional_type, council_type, council_state, registro
) VALUES (
  'd2100000-0000-4000-8000-000000000013',
  'd2000000-0000-4000-8000-000000000002',
  'professional', true, false, 'Psicólogo tenant B',
  'psicologo', 'crp', 'RJ', 'D2-CRP-B'
)
ON CONFLICT (id) DO NOTHING;

-- Fixed-target referral A -> B used first by the pre-fix reproduction and then
-- by the post-fix success case.
INSERT INTO public.clinical_documents(
  id, clinic_id, patient_id, appointment_id, encounter_record_id,
  document_type, template_id, template_version_id, issuer_id, status,
  payload, payload_snapshot, context_snapshot, template_definition_snapshot,
  rendered_snapshot, renderer_version, document_identifier,
  issued_at, issued_by
) VALUES (
  'd4100000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd2200000-0000-4000-8000-000000000001',
  'd2300000-0000-4000-8000-000000000001',
  NULL,
  'referral',
  '12000000-0000-4000-8000-000000000007',
  '12100000-0000-4000-8000-000000000007',
  'd2100000-0000-4000-8000-000000000001',
  'issued',
  '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000003","recipient":{"professional_name":"Fisioterapeuta D2","professional_type":"fisioterapeuta"},"reason":"Continuidade D2-E4"}'::jsonb,
  '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000003","recipient":{"professional_name":"Fisioterapeuta D2","professional_type":"fisioterapeuta"},"reason":"Continuidade D2-E4"}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'fixture referral A to B',
  'fixture-v1',
  'D2-E4-FIXED-TARGET-001',
  now(),
  'd2100000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- A second A -> B referral remains unscheduled so target-C rejection can be
-- tested after the successful fixed-target case.
INSERT INTO public.clinical_documents(
  id, clinic_id, patient_id, appointment_id, document_type,
  template_id, template_version_id, issuer_id, status,
  payload, payload_snapshot, context_snapshot, template_definition_snapshot,
  rendered_snapshot, renderer_version, document_identifier, issued_at, issued_by
) VALUES (
  'd4100000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000001',
  'd2200000-0000-4000-8000-000000000001',
  'd2300000-0000-4000-8000-000000000001',
  'referral',
  '12000000-0000-4000-8000-000000000007',
  '12100000-0000-4000-8000-000000000007',
  'd2100000-0000-4000-8000-000000000001',
  'issued',
  '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000003","recipient":{"professional_name":"Fisioterapeuta D2","professional_type":"fisioterapeuta"},"reason":"Target C negative"}'::jsonb,
  '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000003","recipient":{"professional_name":"Fisioterapeuta D2","professional_type":"fisioterapeuta"},"reason":"Target C negative"}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, 'fixture target C', 'fixture-v1',
  'D2-E4-FIXED-TARGET-002', now(), 'd2100000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Clean cross-tenant referral in clinic B.
INSERT INTO public.clinical_documents(
  id, clinic_id, patient_id, appointment_id, document_type,
  template_id, template_version_id, issuer_id, status,
  payload, payload_snapshot, context_snapshot, template_definition_snapshot,
  rendered_snapshot, renderer_version, document_identifier, issued_at, issued_by
) VALUES (
  'd4100000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000002',
  'd2200000-0000-4000-8000-000000000002',
  'd2300000-0000-4000-8000-000000000004',
  'referral',
  '12000000-0000-4000-8000-000000000007',
  '12100000-0000-4000-8000-000000000007',
  'd2100000-0000-4000-8000-000000000008',
  'issued',
  '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000013","recipient":{"professional_name":"Psicólogo tenant B","professional_type":"psicologo"},"reason":"Cross tenant negative"}'::jsonb,
  '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000013","recipient":{"professional_name":"Psicólogo tenant B","professional_type":"psicologo"},"reason":"Cross tenant negative"}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, 'fixture tenant B', 'fixture-v1',
  'D2-E4-FIXED-TARGET-003', now(), 'd2100000-0000-4000-8000-000000000008'
)
ON CONFLICT (id) DO NOTHING;

-- Internal-service referral: a professional must not gain arbitrary colleague
-- scheduling from the D2-E4 fixed-target exception.
INSERT INTO public.clinical_documents(
  id, clinic_id, patient_id, appointment_id, document_type,
  template_id, template_version_id, issuer_id, status,
  payload, payload_snapshot, context_snapshot, template_definition_snapshot,
  rendered_snapshot, renderer_version, document_identifier, issued_at, issued_by
) VALUES (
  'd4100000-0000-4000-8000-000000000004',
  'd2000000-0000-4000-8000-000000000001',
  'd2200000-0000-4000-8000-000000000001',
  'd2300000-0000-4000-8000-000000000001',
  'referral',
  '12000000-0000-4000-8000-000000000007',
  '12100000-0000-4000-8000-000000000007',
  'd2100000-0000-4000-8000-000000000001',
  'issued',
  '{"destination_scope":"internal_service","recipient":{"professional_type":"psicologo","service":"Psicologia"},"reason":"Internal service negative"}'::jsonb,
  '{"destination_scope":"internal_service","recipient":{"professional_type":"psicologo","service":"Psicologia"},"reason":"Internal service negative"}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, 'fixture internal service', 'fixture-v1',
  'D2-E4-FIXED-TARGET-004', now(), 'd2100000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Corrupted operation fixture: document patient is A but operation patient is B.
-- Browser users cannot create this row; it proves schedule-time revalidation fails
-- closed if persisted operational state ever drifts.
INSERT INTO public.clinical_documents(
  id, clinic_id, patient_id, appointment_id, document_type,
  template_id, template_version_id, issuer_id, status,
  payload, payload_snapshot, context_snapshot, template_definition_snapshot,
  rendered_snapshot, renderer_version, document_identifier, issued_at, issued_by
) VALUES (
  'd4100000-0000-4000-8000-000000000005',
  'd2000000-0000-4000-8000-000000000001',
  'd2200000-0000-4000-8000-000000000001',
  'd2300000-0000-4000-8000-000000000001',
  'referral',
  '12000000-0000-4000-8000-000000000007',
  '12100000-0000-4000-8000-000000000007',
  'd2100000-0000-4000-8000-000000000001',
  'issued',
  '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000003","recipient":{"professional_name":"Fisioterapeuta D2","professional_type":"fisioterapeuta"},"reason":"Patient mismatch negative"}'::jsonb,
  '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000003","recipient":{"professional_name":"Fisioterapeuta D2","professional_type":"fisioterapeuta"},"reason":"Patient mismatch negative"}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, 'fixture patient mismatch', 'fixture-v1',
  'D2-E4-FIXED-TARGET-005', now(), 'd2100000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_referral_operations(
  id, clinic_id, referral_document_id, patient_id, target_profile_id,
  destination_scope, status, created_by
) VALUES
  ('d4200000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d4100000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','internal_professional','received','d2100000-0000-4000-8000-000000000001'),
  ('d4200000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d4100000-0000-4000-8000-000000000002','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','internal_professional','received','d2100000-0000-4000-8000-000000000001'),
  ('d4200000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000002','d4100000-0000-4000-8000-000000000003','d2200000-0000-4000-8000-000000000002','d2100000-0000-4000-8000-000000000013','internal_professional','received','d2100000-0000-4000-8000-000000000008'),
  ('d4200000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','d4100000-0000-4000-8000-000000000004','d2200000-0000-4000-8000-000000000001',NULL,'internal_service','received','d2100000-0000-4000-8000-000000000001'),
  ('d4200000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000001','d4100000-0000-4000-8000-000000000005','d2200000-0000-4000-8000-000000000002','d2100000-0000-4000-8000-000000000003','internal_professional','received','d2100000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;
