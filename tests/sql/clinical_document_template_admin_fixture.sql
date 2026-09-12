-- D2-B.2A scenario rows only. D2-A canonical runtime/functions remain untouched.
-- Seed one foreign-tenant clinic template as postgres so tenant-boundary probes
-- do not require inventing an additional browser identity.

INSERT INTO public.clinical_document_templates(
  id, clinic_id, owner_type, document_type, name, description,
  relevance_metadata, status, created_by
) VALUES (
  'd2500000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000002',
  'clinic', 'medication_prescription', 'Modelo tenant B', 'Cross-tenant fixture',
  '{}'::jsonb, 'active', 'd2100000-0000-4000-8000-000000000008'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_document_template_versions(
  id, template_id, version, definition, render_definition,
  variables_contract, published_at, published_by
) VALUES (
  'd2510000-0000-4000-8000-000000000001',
  'd2500000-0000-4000-8000-000000000001',
  1,
  '{"kind":"medication_prescription","fields":["items","observations"]}'::jsonb,
  '{"layout":"clinical-document/plain-text-v1"}'::jsonb,
  '["patient.name","issuer.name","issuer.registro","appointment.id"]'::jsonb,
  now(),
  'd2100000-0000-4000-8000-000000000008'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.clinical_document_templates
SET current_version_id = 'd2510000-0000-4000-8000-000000000001'
WHERE id = 'd2500000-0000-4000-8000-000000000001';
