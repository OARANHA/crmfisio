-- MedicsPro — Nexus doctor-only + explicit entitlement hardening
-- Nexus is a sensitive medical feature: access fails closed unless the clinic has
-- an explicit effective nexus.access entitlement and the current professional has
-- a valid physician identity (medical professional type + CRM registration context).

BEGIN;

CREATE OR REPLACE FUNCTION public.current_nexus_medical_identity_valid()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo IS TRUE
      AND p.clinic_id = public.current_clinic_id()
      AND lower(trim(coalesce(p.professional_type, ''))) IN ('medico', 'médico', 'medica', 'médica', 'physician', 'doctor')
      AND lower(trim(coalesce(p.council_type, ''))) = 'crm'
      AND nullif(trim(coalesce(p.council_state, '')), '') IS NOT NULL
      AND nullif(trim(coalesce(p.registro, '')), '') IS NOT NULL
  )
$$;

REVOKE ALL ON FUNCTION public.current_nexus_medical_identity_valid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_nexus_medical_identity_valid() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_nexus_entitlement_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_clinic_entitlements e
    WHERE e.clinic_id = public.current_clinic_id()
      AND e.entitlement_key = 'nexus.access'
      AND e.enabled IS TRUE
      AND (e.starts_at IS NULL OR e.starts_at <= now())
      AND (e.expires_at IS NULL OR e.expires_at > now())
  )
$$;

REVOKE ALL ON FUNCTION public.current_nexus_entitlement_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_nexus_entitlement_allowed() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_professional_capability(p_capability text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_role text;
  v_explicit boolean;
  v_is_nexus boolean := coalesce(p_capability, '') LIKE 'nexus.%';
BEGIN
  SELECT p.clinic_id, p.role
    INTO v_clinic_id, v_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Nexus is fail-closed. Neither a legacy role nor an explicit capability grant
  -- can bypass clinic entitlement or verified medical identity.
  IF v_is_nexus THEN
    IF NOT public.current_nexus_entitlement_allowed()
       OR NOT public.current_nexus_medical_identity_valid() THEN
      RETURN false;
    END IF;
  END IF;

  SELECT pc.granted
    INTO v_explicit
  FROM public.professional_capabilities pc
  WHERE pc.clinic_id = v_clinic_id
    AND pc.professional_id = auth.uid()
    AND pc.capability_key = p_capability
  LIMIT 1;

  IF FOUND THEN
    RETURN coalesce(v_explicit, false);
  END IF;

  -- Existing non-Nexus clinical compatibility remains unchanged.
  IF v_role = 'fisio' AND p_capability IN (
    'clinical.assessments',
    'clinical.soap',
    'clinical.patient_timeline'
  ) THEN
    RETURN true;
  END IF;

  -- Temporary role bridge for physicians still represented by role=fisio.
  -- Doctor identity + explicit clinic entitlement were already validated above.
  IF v_role = 'fisio'
     AND v_is_nexus
     AND p_capability IN (
       'nexus.access',
       'nexus.scales',
       'nexus.eem',
       'nexus.cognition',
       'nexus.calculators',
       'nexus.psychopharmacology',
       'nexus.education',
       'nexus.evidence'
     ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.has_professional_capability(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_professional_capability(text) TO authenticated;

-- Nexus records are Nexus data. Clinic owner/admin status or generic clinical
-- timeline access alone must not expose them to a non-physician.
DROP POLICY IF EXISTS nexus_results_read_clinical ON public.nexus_clinical_results;
CREATE POLICY nexus_results_read_clinical
ON public.nexus_clinical_results
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.has_professional_capability('nexus.access')
);

DROP POLICY IF EXISTS nexus_red_flags_read_clinical ON public.nexus_red_flags;
CREATE POLICY nexus_red_flags_read_clinical
ON public.nexus_red_flags
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.has_professional_capability('nexus.access')
);

DROP POLICY IF EXISTS nexus_red_flags_acknowledge ON public.nexus_red_flags;
CREATE POLICY nexus_red_flags_acknowledge
ON public.nexus_red_flags
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND acknowledged_at IS NULL
  AND public.has_professional_capability('nexus.access')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND acknowledged_at IS NOT NULL
  AND acknowledged_by = auth.uid()
  AND public.has_professional_capability('nexus.access')
);

DROP POLICY IF EXISTS nexus_evidence_read_authenticated ON public.nexus_evidence_sources;
CREATE POLICY nexus_evidence_read_authenticated
ON public.nexus_evidence_sources
FOR SELECT TO authenticated
USING (
  active IS TRUE
  AND public.has_professional_capability('nexus.evidence')
);

COMMIT;
