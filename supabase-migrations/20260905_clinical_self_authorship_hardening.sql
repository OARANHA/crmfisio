-- MEDICSPRO — clinical self-authorship hardening
-- Legacy physiotherapy clinical records are clinical acts: authenticated tenant users
-- must not author or alter them on behalf of another professional.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_legacy_clinical_self_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_clinic_id uuid := public.current_clinic_id();
BEGIN
  -- Internal/service operations without tenant app context remain available for
  -- controlled migrations and repair jobs.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_role <> 'fisio' THEN
    RAISE EXCEPTION 'clinical_author_required' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL OR NEW.professional_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'clinical_self_authorship_required' USING ERRCODE = '42501';
  END IF;

  IF v_clinic_id IS NULL OR NEW.clinic_id IS DISTINCT FROM v_clinic_id THEN
    RAISE EXCEPTION 'clinical_tenant_mismatch' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.professional_id IS DISTINCT FROM NEW.professional_id THEN
    RAISE EXCEPTION 'clinical_author_immutable' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_legacy_clinical_self_authorship() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_evaluations_self_authorship ON public.physiotherapy_evaluations;
CREATE TRIGGER trg_evaluations_self_authorship
BEFORE INSERT OR UPDATE ON public.physiotherapy_evaluations
FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_clinical_self_authorship();

DROP TRIGGER IF EXISTS trg_evolutions_self_authorship ON public.physiotherapy_evolutions;
CREATE TRIGGER trg_evolutions_self_authorship
BEFORE INSERT OR UPDATE ON public.physiotherapy_evolutions
FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_clinical_self_authorship();

-- Clinical history must not be hard-deleted from browser sessions. Existing
-- soft-delete semantics for evolutions remain available to the actual author.
REVOKE DELETE ON TABLE public.physiotherapy_evaluations FROM authenticated;
REVOKE DELETE ON TABLE public.physiotherapy_evolutions FROM authenticated;

COMMENT ON FUNCTION public.guard_legacy_clinical_self_authorship() IS
  'Requires authenticated legacy clinical writes to be authored by the current fisio in the current clinic; managers remain read-only and hard delete is denied.';

COMMIT;
