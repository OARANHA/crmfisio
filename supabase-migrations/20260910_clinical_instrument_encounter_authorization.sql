-- MedicsPro #399 — multiprofessional clinical instrument authorization foundation
-- Adds an explicit clinical capability, a neutral clinical-instrument exposure
-- catalog, tenant instrument enablement and the first contextual act boundary:
-- apply a configured instrument in the actor's active Encounter.
--
-- This migration does NOT change Nexus RLS/capabilities/result persistence and does
-- not define remote/self-assessment delivery. Nexus remains the technical engine for
-- PHQ-9/GAD-7 identity/version/scoring, but Nexus registry membership never implies
-- multiprofessional clinical exposure.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_existing record;
BEGIN
  IF to_regclass('public.capability_catalog') IS NULL
     OR to_regclass('public.professional_capabilities') IS NULL
     OR to_regclass('public.nexus_result_contracts') IS NULL
     OR to_regclass('public.patients') IS NULL
     OR to_regclass('public.appointments') IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_399_prerequisite_missing';
  END IF;

  IF to_regprocedure('public.current_clinic_id()') IS NULL
     OR to_regprocedure('public.current_app_role()') IS NULL
     OR to_regprocedure('public.current_user_has_valid_clinical_identity()') IS NULL
     OR to_regprocedure('public.current_user_has_clinical_capability(text)') IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_399_helper_prerequisite_missing';
  END IF;

  -- The neutral catalog will explicitly reference these canonical engine contracts.
  -- Their existence proves technical engine provenance only; it does not grant
  -- multiprofessional exposure by itself.
  IF NOT EXISTS (
    SELECT 1
    FROM public.nexus_result_contracts
    WHERE module_key = 'scales'
      AND tool_key = 'phq9'
      AND rule_key = 'nexus.phq9'
      AND rule_version = 'nexus-2026-09-03'
      AND required_capability = 'nexus.scales'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.nexus_result_contracts
    WHERE module_key = 'scales'
      AND tool_key = 'gad7'
      AND rule_key = 'nexus.gad7'
      AND rule_version = 'nexus-2026-09-03'
      AND required_capability = 'nexus.scales'
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_399_canonical_scale_contract_missing';
  END IF;

  SELECT capability_key, domain, clinical, active
    INTO v_existing
  FROM public.capability_catalog
  WHERE capability_key = 'clinical.instrument.apply';

  IF FOUND AND (
    v_existing.domain IS DISTINCT FROM 'clinical'
    OR v_existing.clinical IS NOT TRUE
    OR v_existing.active IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_399_capability_conflict';
  END IF;
END;
$$;

INSERT INTO public.capability_catalog(capability_key, domain, description, clinical, active)
VALUES (
  'clinical.instrument.apply',
  'clinical',
  'Aplicar instrumentos clínicos habilitados pela clínica dentro de boundary assistencial autorizado',
  true,
  true
)
ON CONFLICT (capability_key) DO NOTHING;

-- No professional_capabilities rows are inserted here. Missing row is an explicit
-- fail-closed default and profession/specialty never auto-grants this capability.

-- Neutral exposure catalog. This table answers only: which engine-backed instruments
-- are explicitly approved for the multiprofessional clinical surface? It does not
-- duplicate questions, validation, scoring or Nexus authorization.
CREATE TABLE IF NOT EXISTS public.clinical_instrument_catalog (
  instrument_key text PRIMARY KEY,
  engine_source text NOT NULL,
  engine_module_key text NOT NULL,
  engine_tool_key text NOT NULL,
  engine_rule_key text NOT NULL,
  engine_rule_version text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_instrument_catalog_key_shape CHECK (
    instrument_key = lower(btrim(instrument_key))
    AND instrument_key <> ''
  ),
  CONSTRAINT clinical_instrument_catalog_engine_source CHECK (
    engine_source = 'nexus'
  ),
  CONSTRAINT clinical_instrument_catalog_engine_contract_fkey
    FOREIGN KEY (engine_module_key, engine_tool_key, engine_rule_key, engine_rule_version)
    REFERENCES public.nexus_result_contracts(module_key, tool_key, rule_key, rule_version)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

COMMENT ON TABLE public.clinical_instrument_catalog IS
  'Neutral allowlist for instruments explicitly approved for multiprofessional clinical exposure. Engine linkage does not imply authorization or relevance.';

ALTER TABLE public.clinical_instrument_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clinical_instrument_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.clinical_instrument_catalog TO service_role;

-- Fail closed if a prior/local copy already claimed one of the #399 keys with a
-- different engine mapping. Extra future catalog rows are deliberately not rejected.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clinical_instrument_catalog c
    WHERE c.instrument_key = 'phq9'
      AND (
        c.engine_source IS DISTINCT FROM 'nexus'
        OR c.engine_module_key IS DISTINCT FROM 'scales'
        OR c.engine_tool_key IS DISTINCT FROM 'phq9'
        OR c.engine_rule_key IS DISTINCT FROM 'nexus.phq9'
        OR c.engine_rule_version IS DISTINCT FROM 'nexus-2026-09-03'
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.clinical_instrument_catalog c
    WHERE c.instrument_key = 'gad7'
      AND (
        c.engine_source IS DISTINCT FROM 'nexus'
        OR c.engine_module_key IS DISTINCT FROM 'scales'
        OR c.engine_tool_key IS DISTINCT FROM 'gad7'
        OR c.engine_rule_key IS DISTINCT FROM 'nexus.gad7'
        OR c.engine_rule_version IS DISTINCT FROM 'nexus-2026-09-03'
      )
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_399_catalog_mapping_conflict';
  END IF;
END;
$$;

INSERT INTO public.clinical_instrument_catalog(
  instrument_key,
  engine_source,
  engine_module_key,
  engine_tool_key,
  engine_rule_key,
  engine_rule_version,
  active
) VALUES
  ('phq9', 'nexus', 'scales', 'phq9', 'nexus.phq9', 'nexus-2026-09-03', true),
  ('gad7', 'nexus', 'scales', 'gad7', 'nexus.gad7', 'nexus-2026-09-03', true)
ON CONFLICT (instrument_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.clinic_clinical_instrument_settings (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  instrument_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  configured_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_clinical_instrument_settings_pkey
    PRIMARY KEY (clinic_id, instrument_key),
  CONSTRAINT clinic_clinical_instrument_settings_key_shape CHECK (
    instrument_key = lower(btrim(instrument_key))
    AND instrument_key <> ''
  )
);

COMMENT ON TABLE public.clinic_clinical_instrument_settings IS
  'Tenant-scoped enablement for neutral clinical instruments. Missing rows and enabled=false both deny authorization.';

-- Support safe replay even if a local environment previously ran the draft #399
-- before the neutral catalog blocker was corrected.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clinic_clinical_instrument_settings s
    LEFT JOIN public.clinical_instrument_catalog c
      ON c.instrument_key = s.instrument_key
    WHERE c.instrument_key IS NULL
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_399_existing_setting_not_in_catalog';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.clinic_clinical_instrument_settings'::regclass
      AND conname = 'clinic_clinical_instrument_settings_catalog_fkey'
  ) THEN
    ALTER TABLE public.clinic_clinical_instrument_settings
      ADD CONSTRAINT clinic_clinical_instrument_settings_catalog_fkey
      FOREIGN KEY (instrument_key)
      REFERENCES public.clinical_instrument_catalog(instrument_key)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_clinic_clinical_instrument_enabled
  ON public.clinic_clinical_instrument_settings(clinic_id, instrument_key)
  WHERE enabled IS TRUE;

CREATE OR REPLACE FUNCTION public.validate_clinic_clinical_instrument_setting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.instrument_key IS NULL
     OR NEW.instrument_key <> lower(btrim(NEW.instrument_key))
     OR NEW.instrument_key = '' THEN
    RAISE EXCEPTION 'clinical_instrument_invalid_key' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinical_instrument_catalog c
    WHERE c.instrument_key = NEW.instrument_key
      AND c.active IS TRUE
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_unknown' USING ERRCODE = '22023';
  END IF;

  IF NEW.configured_by IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.configured_by
      AND p.clinic_id = NEW.clinic_id
      AND p.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_configurator_invalid' USING ERRCODE = '42501';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_clinic_clinical_instrument_setting()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_clinic_clinical_instrument_setting
  ON public.clinic_clinical_instrument_settings;
CREATE TRIGGER trg_validate_clinic_clinical_instrument_setting
BEFORE INSERT OR UPDATE OF clinic_id, instrument_key, enabled, configured_by
ON public.clinic_clinical_instrument_settings
FOR EACH ROW
EXECUTE FUNCTION public.validate_clinic_clinical_instrument_setting();

ALTER TABLE public.clinic_clinical_instrument_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_clinical_instrument_settings_read
  ON public.clinic_clinical_instrument_settings;
CREATE POLICY clinic_clinical_instrument_settings_read
ON public.clinic_clinical_instrument_settings
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'professional')
);

REVOKE ALL ON TABLE public.clinic_clinical_instrument_settings
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.clinic_clinical_instrument_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinic_clinical_instrument_settings TO service_role;

CREATE OR REPLACE FUNCTION public.set_clinic_clinical_instrument_enabled(
  p_instrument_key text,
  p_enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_key text := lower(btrim(coalesce(p_instrument_key, '')));
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'clinical_instrument_admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_enabled IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'clinical_instrument_invalid_setting' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'clinical_instrument_active_tenant_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinical_instrument_catalog c
    WHERE c.instrument_key = v_key
      AND c.active IS TRUE
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_unknown' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.clinic_clinical_instrument_settings(
    clinic_id, instrument_key, enabled, configured_by
  ) VALUES (
    v_clinic, v_key, p_enabled, v_uid
  )
  ON CONFLICT (clinic_id, instrument_key) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      configured_by = EXCLUDED.configured_by,
      updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_clinic_clinical_instrument_enabled(text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_clinic_clinical_instrument_enabled(text, boolean)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.set_clinic_clinical_instrument_enabled(text, boolean) IS
  'Tenant-derived owner/admin configuration for an explicitly exposed neutral clinical instrument. No clinic_id is accepted from the browser.';

-- Internal base authorization. It is intentionally NOT executable by authenticated
-- clients because it is not an act boundary and must never be treated as generic
-- authority for every future Instrument Delivery mode.
CREATE OR REPLACE FUNCTION public.clinical_instrument_base_authorized(
  p_patient_id uuid,
  p_instrument_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_key text := lower(btrim(coalesce(p_instrument_key, '')));
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR p_patient_id IS NULL OR v_key = '' THEN
    RETURN false;
  END IF;

  IF public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.instrument.apply') IS NOT TRUE THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.patients p
    JOIN public.clinic_clinical_instrument_settings s
      ON s.clinic_id = p.clinic_id
     AND s.instrument_key = v_key
     AND s.enabled IS TRUE
    JOIN public.clinical_instrument_catalog c
      ON c.instrument_key = s.instrument_key
     AND c.active IS TRUE
    WHERE p.id = p_patient_id
      AND p.clinic_id = v_clinic
      AND p.deleted_at IS NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clinical_instrument_base_authorized(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_instrument_base_authorized(uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.clinical_instrument_base_authorized(uuid, text) IS
  'Internal #399 base authorization only: active clinical identity + explicit clinical.instrument.apply + same-tenant patient + neutral catalog exposure + clinic instrument enabled. Not a generic act authorization endpoint.';

CREATE OR REPLACE FUNCTION public.can_apply_clinical_instrument_in_encounter(
  p_appointment_id uuid,
  p_instrument_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_patient uuid;
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR p_appointment_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT a.paciente_id
    INTO v_patient
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_clinic
    AND a.professional_id = v_uid
    AND a.status = 'em_atendimento'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN public.clinical_instrument_base_authorized(
    v_patient,
    p_instrument_key
  ) IS TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_apply_clinical_instrument_in_encounter(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_apply_clinical_instrument_in_encounter(uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_apply_clinical_instrument_in_encounter(uuid, text) IS
  'Apply-in-Encounter act boundary only. Requires the authenticated actor to be the assigned appointments.professional_id on an em_atendimento appointment; no owner/admin read bypass and no remote-delivery semantics.';

COMMIT;
