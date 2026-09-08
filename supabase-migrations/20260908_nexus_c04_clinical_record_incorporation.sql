-- MEDICSPRO — Nexus C-04 explicit incorporation into the official clinical record
--
-- A signed Nexus result remains the immutable evidence/result source. This slice
-- creates an immutable, readable clinical-record snapshot only after explicit
-- incorporation by the same authorized clinical author. It never backfills old
-- results and never turns technical processing into a chart entry automatically.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.clinical_record_nexus_incorporations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  nexus_result_id uuid NOT NULL UNIQUE REFERENCES public.nexus_clinical_results(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  module_key text NOT NULL,
  tool_key text NOT NULL,
  rule_key text NOT NULL,
  rule_version text NOT NULL,
  required_capability text NOT NULL,
  clinical_summary text NOT NULL,
  soap_text text,
  total_score numeric,
  max_score numeric,
  classification text,
  severity text CHECK (severity IS NULL OR severity IN ('low', 'moderate', 'high', 'severe')),
  red_flags_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(red_flags_snapshot) = 'array'),
  source_finalized_at timestamptz NOT NULL,
  source_reviewed_at timestamptz NOT NULL,
  source_signed_at timestamptz NOT NULL,
  incorporated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_record_nexus_source_times CHECK (
    source_reviewed_at >= source_finalized_at
    AND source_signed_at >= source_reviewed_at
    AND incorporated_at >= source_signed_at
  )
);

CREATE INDEX IF NOT EXISTS idx_clinical_record_nexus_patient
  ON public.clinical_record_nexus_incorporations(patient_id, incorporated_at DESC);

ALTER TABLE public.clinical_record_nexus_incorporations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clinical_record_nexus_incorporations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.clinical_record_nexus_incorporations TO authenticated, service_role;

DROP POLICY IF EXISTS clinical_record_nexus_read_care_relationship
  ON public.clinical_record_nexus_incorporations;
CREATE POLICY clinical_record_nexus_read_care_relationship
ON public.clinical_record_nexus_incorporations
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
);

CREATE OR REPLACE FUNCTION public.guard_clinical_record_nexus_incorporation_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'nexus_c04_incorporation_immutable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'nexus_c04_incorporation_delete_forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_clinical_record_nexus_incorporation_immutable()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clinical_record_nexus_immutable
  ON public.clinical_record_nexus_incorporations;
CREATE TRIGGER trg_clinical_record_nexus_immutable
BEFORE UPDATE OR DELETE ON public.clinical_record_nexus_incorporations
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_record_nexus_incorporation_immutable();

CREATE OR REPLACE FUNCTION public.incorporate_nexus_result_into_clinical_record(p_result_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_result public.nexus_clinical_results%ROWTYPE;
  v_lifecycle public.nexus_result_clinical_lifecycle%ROWTYPE;
  v_existing uuid;
  v_incorporation_id uuid;
  v_red_flags jsonb := '[]'::jsonb;
  v_summary text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nexus_c04_authenticated_tenant_required' USING ERRCODE = '42501';
  END IF;
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'nexus_c04_active_clinical_context_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.clinics c ON c.id = p.clinic_id
    WHERE p.id = v_uid
      AND p.clinic_id = v_clinic
      AND p.ativo IS TRUE
      AND c.deleted_at IS NULL
      AND coalesce(c.lifecycle_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'nexus_c04_active_clinical_context_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_result
  FROM public.nexus_clinical_results r
  WHERE r.id = p_result_id;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'nexus_c04_result_missing';
  END IF;
  IF v_result.clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'nexus_c04_tenant_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_result.patient_id IS NULL THEN
    RAISE EXCEPTION 'nexus_c04_patient_required';
  END IF;
  IF v_result.professional_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'nexus_c04_author_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_result.status <> 'finalized' OR v_result.finalized_at IS NULL THEN
    RAISE EXCEPTION 'nexus_c04_processed_result_required' USING ERRCODE = '23514';
  END IF;
  IF NOT public.can_access_patient_clinical_record(v_result.patient_id) THEN
    RAISE EXCEPTION 'nexus_c04_care_relationship_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_professional_capability('nexus.access')
     OR NOT public.has_professional_capability(v_result.required_capability) THEN
    RAISE EXCEPTION 'nexus_c04_nexus_authorization_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lifecycle
  FROM public.nexus_result_clinical_lifecycle l
  WHERE l.result_id = v_result.id;

  IF v_lifecycle.result_id IS NULL
     OR v_lifecycle.processed_at IS NULL
     OR v_lifecycle.reviewed_at IS NULL
     OR v_lifecycle.reviewed_by IS DISTINCT FROM v_uid
     OR v_lifecycle.signed_at IS NULL
     OR v_lifecycle.signed_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'nexus_c04_signed_lifecycle_required' USING ERRCODE = '23514';
  END IF;

  SELECT i.id INTO v_existing
  FROM public.clinical_record_nexus_incorporations i
  WHERE i.nexus_result_id = v_result.id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'flagCode', f.flag_code,
           'severity', f.severity,
           'title', f.title,
           'message', f.message,
           'requiredAction', f.required_action,
           'acknowledgedAt', f.acknowledged_at,
           'acknowledgedBy', f.acknowledged_by
         ) ORDER BY f.created_at), '[]'::jsonb)
    INTO v_red_flags
  FROM public.nexus_red_flags f
  WHERE f.result_id = v_result.id
    AND f.clinic_id = v_result.clinic_id
    AND f.patient_id = v_result.patient_id;

  v_summary := concat_ws(
    ' · ',
    upper(v_result.tool_key),
    CASE
      WHEN v_result.total_score IS NOT NULL AND v_result.max_score IS NOT NULL
        THEN format('escore %s/%s', v_result.total_score, v_result.max_score)
      WHEN v_result.total_score IS NOT NULL
        THEN format('escore %s', v_result.total_score)
      ELSE NULL
    END,
    nullif(v_result.classification, ''),
    nullif(v_result.interpretation, '')
  );
  IF btrim(coalesce(v_summary, '')) = '' THEN
    v_summary := format('Resultado Nexus %s revisado e assinado.', v_result.tool_key);
  END IF;

  INSERT INTO public.clinical_record_nexus_incorporations(
    clinic_id, patient_id, professional_id, nexus_result_id, appointment_id,
    module_key, tool_key, rule_key, rule_version, required_capability,
    clinical_summary, soap_text, total_score, max_score, classification, severity,
    red_flags_snapshot, source_finalized_at, source_reviewed_at, source_signed_at
  ) VALUES (
    v_result.clinic_id, v_result.patient_id, v_uid, v_result.id, v_result.appointment_id,
    v_result.module_key, v_result.tool_key, v_result.rule_key, v_result.rule_version,
    v_result.required_capability, v_summary, nullif(v_result.soap_text, ''),
    v_result.total_score, v_result.max_score, nullif(v_result.classification, ''),
    v_result.severity, v_red_flags, v_result.finalized_at,
    v_lifecycle.reviewed_at, v_lifecycle.signed_at
  )
  ON CONFLICT (nexus_result_id) DO NOTHING
  RETURNING id INTO v_incorporation_id;

  IF v_incorporation_id IS NULL THEN
    SELECT i.id INTO v_incorporation_id
    FROM public.clinical_record_nexus_incorporations i
    WHERE i.nexus_result_id = v_result.id;
  END IF;

  RETURN v_incorporation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.incorporate_nexus_result_into_clinical_record(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.incorporate_nexus_result_into_clinical_record(uuid)
  TO authenticated;

COMMENT ON TABLE public.clinical_record_nexus_incorporations IS
  'Immutable official-record snapshots explicitly incorporated from C-03 reviewed/signed Nexus results. One row per source result; no automatic historical backfill.';
COMMENT ON FUNCTION public.incorporate_nexus_result_into_clinical_record(uuid) IS
  'Explicit, idempotent C-04 clinical act. Requires the current result author, active tenant/care relationship, Nexus access/tool capability and complete signed C-03 lifecycle; copies only readable clinical/provenance fields into an immutable chart snapshot.';

COMMIT;
