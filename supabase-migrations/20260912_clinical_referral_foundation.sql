-- MedicsPro — D2-E0 Referral / Encaminhamento Canonical Foundation
-- Adds referral as an explicit multiprofessional Clinical Documents type.
-- Backend-only: no Encounter UI, external network integration or automatic referral.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.clinical_document_templates
  DROP CONSTRAINT IF EXISTS clinical_document_templates_document_type_check;
ALTER TABLE public.clinical_document_templates
  ADD CONSTRAINT clinical_document_templates_document_type_check
  CHECK (document_type IN ('medication_prescription', 'therapeutic_guidance', 'exam_order', 'referral'));

ALTER TABLE public.clinical_documents
  DROP CONSTRAINT IF EXISTS clinical_documents_document_type_check;
ALTER TABLE public.clinical_documents
  ADD CONSTRAINT clinical_documents_document_type_check
  CHECK (document_type IN ('medication_prescription', 'therapeutic_guidance', 'exam_order', 'referral'));

-- Referral is multiprofessional by design. The common clinical boundary remains
-- authoritative: active same-tenant profile + valid clinical identity +
-- clinical.documents. Medication prescriptions and exam orders keep their
-- additional medical/CRM boundary. No owner/admin/platform bypass exists.
CREATE OR REPLACE FUNCTION public.current_user_can_issue_clinical_document(p_document_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  v_type text;
BEGIN
  SELECT * INTO p
  FROM public.profiles
  WHERE id = auth.uid() AND ativo IS TRUE
  LIMIT 1;

  IF p.id IS NULL
     OR public.current_clinic_id() IS DISTINCT FROM p.clinic_id
     OR public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.documents') IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF p_document_type IN ('therapeutic_guidance', 'referral') THEN
    RETURN true;
  END IF;

  IF p_document_type NOT IN ('medication_prescription', 'exam_order') THEN
    RETURN false;
  END IF;

  v_type := lower(trim(coalesce(p.professional_type, '')));
  RETURN v_type IN ('medico','médico','medica','médica','physician','doctor')
     AND lower(trim(coalesce(p.council_type, ''))) = 'crm'
     AND btrim(coalesce(p.council_state, '')) <> ''
     AND btrim(coalesce(p.registro, '')) <> '';
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_clinical_document_payload_ready(
  p_document_type text,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'clinical_document_payload_object_required' USING ERRCODE = '22023';
  END IF;

  IF p_document_type = 'medication_prescription' THEN
    IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'clinical_document_medication_items_required' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_payload->'items') = 0 THEN
      RAISE EXCEPTION 'clinical_document_medication_items_required' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload->'items') AS item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
         OR nullif(btrim(coalesce(item->>'medication_name', '')), '') IS NULL
    ) THEN
      RAISE EXCEPTION 'clinical_document_medication_item_invalid' USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;

  IF p_document_type = 'therapeutic_guidance' THEN
    IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'clinical_document_guidance_items_required' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_payload->'items') = 0 THEN
      RAISE EXCEPTION 'clinical_document_guidance_items_required' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload->'items') AS item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
         OR nullif(btrim(coalesce(item->>'guidance', '')), '') IS NULL
    ) THEN
      RAISE EXCEPTION 'clinical_document_guidance_item_invalid' USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;

  IF p_document_type = 'exam_order' THEN
    IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'clinical_document_exam_items_required' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_payload->'items') = 0 THEN
      RAISE EXCEPTION 'clinical_document_exam_items_required' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload->'items') AS item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
         OR nullif(btrim(coalesce(item->>'exam_name', '')), '') IS NULL
         OR (item ? 'code' AND jsonb_typeof(item->'code') IS DISTINCT FROM 'string')
         OR (item ? 'category' AND jsonb_typeof(item->'category') IS DISTINCT FROM 'string')
         OR (item ? 'instructions' AND jsonb_typeof(item->'instructions') IS DISTINCT FROM 'string')
         OR (item ? 'urgent' AND jsonb_typeof(item->'urgent') IS DISTINCT FROM 'boolean')
    ) THEN
      RAISE EXCEPTION 'clinical_document_exam_item_invalid' USING ERRCODE = '22023';
    END IF;

    IF p_payload ? 'priority'
       AND (
         jsonb_typeof(p_payload->'priority') IS DISTINCT FROM 'string'
         OR p_payload->>'priority' NOT IN ('routine', 'high', 'urgent')
       ) THEN
      RAISE EXCEPTION 'clinical_document_exam_priority_invalid' USING ERRCODE = '22023';
    END IF;

    IF (p_payload ? 'clinical_indication' AND jsonb_typeof(p_payload->'clinical_indication') IS DISTINCT FROM 'string')
       OR (p_payload ? 'impression' AND jsonb_typeof(p_payload->'impression') IS DISTINCT FROM 'string')
       OR (p_payload ? 'observations' AND jsonb_typeof(p_payload->'observations') IS DISTINCT FROM 'string') THEN
      RAISE EXCEPTION 'clinical_document_exam_payload_invalid' USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;

  IF p_document_type = 'referral' THEN
    IF jsonb_typeof(p_payload->'recipient') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'clinical_document_referral_recipient_required' USING ERRCODE = '22023';
    END IF;

    IF nullif(btrim(coalesce(p_payload->>'reason', '')), '') IS NULL THEN
      RAISE EXCEPTION 'clinical_document_referral_reason_required' USING ERRCODE = '22023';
    END IF;

    IF nullif(btrim(coalesce(p_payload->'recipient'->>'professional_name', '')), '') IS NULL
       AND nullif(btrim(coalesce(p_payload->'recipient'->>'professional_type', '')), '') IS NULL
       AND nullif(btrim(coalesce(p_payload->'recipient'->>'specialty', '')), '') IS NULL
       AND nullif(btrim(coalesce(p_payload->'recipient'->>'service', '')), '') IS NULL
       AND nullif(btrim(coalesce(p_payload->'recipient'->>'facility', '')), '') IS NULL THEN
      RAISE EXCEPTION 'clinical_document_referral_recipient_required' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_each(p_payload->'recipient') AS entry(key, value)
      WHERE entry.key IN ('professional_name','professional_type','specialty','service','facility','contact')
        AND jsonb_typeof(entry.value) IS DISTINCT FROM 'string'
    )
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(p_payload->'recipient') AS key
         WHERE key NOT IN ('professional_name','professional_type','specialty','service','facility','contact')
       ) THEN
      RAISE EXCEPTION 'clinical_document_referral_recipient_invalid' USING ERRCODE = '22023';
    END IF;

    IF p_payload ? 'priority'
       AND (
         jsonb_typeof(p_payload->'priority') IS DISTINCT FROM 'string'
         OR p_payload->>'priority' NOT IN ('routine', 'high', 'urgent')
       ) THEN
      RAISE EXCEPTION 'clinical_document_referral_priority_invalid' USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string'
       OR (p_payload ? 'clinical_summary' AND jsonb_typeof(p_payload->'clinical_summary') IS DISTINCT FROM 'string')
       OR (p_payload ? 'requested_action' AND jsonb_typeof(p_payload->'requested_action') IS DISTINCT FROM 'string')
       OR (p_payload ? 'observations' AND jsonb_typeof(p_payload->'observations') IS DISTINCT FROM 'string') THEN
      RAISE EXCEPTION 'clinical_document_referral_payload_invalid' USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'clinical_document_type_invalid' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.render_clinical_document_snapshot(
  p_document_type text,
  p_title text,
  p_payload jsonb,
  p_context jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_document_type NOT IN ('medication_prescription','therapeutic_guidance','exam_order','referral')
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'clinical_document_render_contract_invalid' USING ERRCODE = '22023';
  END IF;

  RETURN concat_ws(
    E'\n',
    upper(btrim(p_title)),
    'Paciente: ' || coalesce(p_context->'patient'->>'name',''),
    'Profissional: ' || coalesce(p_context->'issuer'->>'name',''),
    'Documento: ' || CASE
      WHEN p_document_type = 'exam_order' THEN 'Pedido de exames'
      WHEN p_document_type = 'referral' THEN 'Encaminhamento clínico'
      ELSE p_document_type
    END,
    '',
    jsonb_pretty(p_payload)
  );
END;
$$;

-- 000001..000006 are occupied by the existing curated Clinical Documents
-- templates. Referral starts at 000007 to preserve all prior identities.
INSERT INTO public.clinical_document_templates(
  id, owner_type, document_type, name, description, relevance_metadata, status
)
VALUES (
  '12000000-0000-4000-8000-000000000007',
  'platform',
  'referral',
  'Encaminhamento clínico',
  'Estrutura MedicsPro multiprofissional para encaminhamento clínico a outro profissional, especialidade ou serviço.',
  '{"relevance":"general"}'::jsonb,
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_document_template_versions(
  id, template_id, version, definition, render_definition, variables_contract,
  published_at, published_by
)
VALUES (
  '12100000-0000-4000-8000-000000000007',
  '12000000-0000-4000-8000-000000000007',
  1,
  '{"kind":"referral","fields":["recipient","reason","clinical_summary","requested_action","priority","observations"]}'::jsonb,
  '{"layout":"clinical-document/plain-text-v1"}'::jsonb,
  '["patient.name","issuer.name","issuer.professional_type","issuer.registro","appointment.id"]'::jsonb,
  now(),
  NULL
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.clinical_document_templates t
SET current_version_id = v.id
FROM public.clinical_document_template_versions v
WHERE t.id = '12000000-0000-4000-8000-000000000007'::uuid
  AND v.id = '12100000-0000-4000-8000-000000000007'::uuid
  AND v.template_id = t.id
  AND t.current_version_id IS NULL;

DO $$
DECLARE
  t public.clinical_document_templates%ROWTYPE;
  v public.clinical_document_template_versions%ROWTYPE;
BEGIN
  SELECT * INTO t
  FROM public.clinical_document_templates
  WHERE id = '12000000-0000-4000-8000-000000000007'::uuid;

  IF t.id IS NULL
     OR t.owner_type IS DISTINCT FROM 'platform'
     OR t.clinic_id IS NOT NULL
     OR t.document_type IS DISTINCT FROM 'referral'
     OR t.name IS DISTINCT FROM 'Encaminhamento clínico'
     OR t.status IS DISTINCT FROM 'active'
     OR t.current_version_id IS DISTINCT FROM '12100000-0000-4000-8000-000000000007'::uuid THEN
    RAISE EXCEPTION 'clinical_referral_template_seed_drift' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v
  FROM public.clinical_document_template_versions
  WHERE id = '12100000-0000-4000-8000-000000000007'::uuid;

  IF v.id IS NULL
     OR v.template_id IS DISTINCT FROM t.id
     OR v.version IS DISTINCT FROM 1
     OR v.published_at IS NULL
     OR v.definition->>'kind' IS DISTINCT FROM 'referral'
     OR v.definition->'fields' IS DISTINCT FROM '["recipient","reason","clinical_summary","requested_action","priority","observations"]'::jsonb
     OR v.render_definition IS DISTINCT FROM '{"layout":"clinical-document/plain-text-v1"}'::jsonb
     OR v.variables_contract IS DISTINCT FROM '["patient.name","issuer.name","issuer.professional_type","issuer.registro","appointment.id"]'::jsonb THEN
    RAISE EXCEPTION 'clinical_referral_template_version_seed_drift' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_issue_clinical_document(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_clinical_document_payload_ready(text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.render_clinical_document_snapshot(text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_issue_clinical_document(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_clinical_document_payload_ready(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.render_clinical_document_snapshot(text,text,jsonb,jsonb) TO service_role;

COMMIT;
