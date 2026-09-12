-- MedicsPro — D2-E3 Internal Referral V1
-- Adds a narrow same-clinic professional directory and fail-closed routing validation.
-- Does not grant chart access, care relationship, scheduling, inbox or acceptance state.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.list_clinical_referral_internal_targets()
RETURNS TABLE (
  profile_id uuid,
  name text,
  professional_type text,
  specialty text,
  council_type text,
  council_state text,
  registration text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR public.current_user_can_issue_clinical_document('referral') IS NOT TRUE THEN
    RETURN;
  END IF;

  v_clinic_id := public.current_clinic_id();
  IF v_clinic_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nome,
    btrim(coalesce(p.professional_type, '')),
    btrim(coalesce(p.especialidade, '')),
    btrim(coalesce(p.council_type, '')),
    btrim(coalesce(p.council_state, '')),
    btrim(coalesce(p.registro, ''))
  FROM public.profiles p
  WHERE p.clinic_id = v_clinic_id
    AND p.ativo IS TRUE
    AND p.id IS DISTINCT FROM auth.uid()
    AND nullif(btrim(coalesce(p.professional_type, '')), '') IS NOT NULL
  ORDER BY lower(p.nome), p.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_clinical_referral_internal_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope text;
  v_target_text text;
  v_target_id uuid;
BEGIN
  IF NEW.document_type IS DISTINCT FROM 'referral' THEN RETURN NEW; END IF;

  v_scope := coalesce(nullif(btrim(NEW.payload->>'destination_scope'), ''), 'external');
  v_target_text := btrim(coalesce(NEW.payload->>'target_profile_id', ''));

  IF v_scope NOT IN ('external', 'internal_professional', 'internal_service') THEN
    RAISE EXCEPTION 'clinical_referral_scope_invalid' USING ERRCODE = '22023';
  END IF;

  IF v_scope = 'external' THEN
    IF v_target_text <> '' THEN
      RAISE EXCEPTION 'clinical_referral_target_invalid' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF v_scope = 'internal_service' THEN
    IF NEW.status = 'issued'
       AND nullif(btrim(coalesce(NEW.payload->'recipient'->>'specialty', '')), '') IS NULL
       AND nullif(btrim(coalesce(NEW.payload->'recipient'->>'service', '')), '') IS NULL
       AND nullif(btrim(coalesce(NEW.payload->'recipient'->>'professional_type', '')), '') IS NULL THEN
      RAISE EXCEPTION 'clinical_referral_internal_service_required' USING ERRCODE = '22023';
    END IF;
    IF v_target_text <> '' THEN
      RAISE EXCEPTION 'clinical_referral_target_invalid' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Drafts may be incomplete. Once a target is present it must already be valid,
  -- and issue revalidates it so a disabled/moved professional fails closed.
  IF v_target_text = '' THEN
    IF NEW.status = 'issued' THEN
      RAISE EXCEPTION 'clinical_referral_target_invalid' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  BEGIN
    v_target_id := v_target_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'clinical_referral_target_invalid' USING ERRCODE = '23514';
  END;

  IF v_target_id IS NOT DISTINCT FROM NEW.issuer_id
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = v_target_id
         AND p.clinic_id = NEW.clinic_id
         AND p.ativo IS TRUE
         AND nullif(btrim(coalesce(p.professional_type, '')), '') IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'clinical_referral_target_invalid' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'issued'
     AND nullif(btrim(coalesce(NEW.payload->'recipient'->>'professional_name', '')), '') IS NULL THEN
    RAISE EXCEPTION 'clinical_referral_target_invalid' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_referral_internal_target ON public.clinical_documents;
CREATE TRIGGER trg_clinical_referral_internal_target
BEFORE INSERT OR UPDATE OF payload, status ON public.clinical_documents
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_referral_internal_target();

REVOKE ALL ON FUNCTION public.list_clinical_referral_internal_targets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_clinical_referral_internal_targets() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_clinical_referral_internal_target() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_clinical_referral_internal_target() TO service_role;

COMMIT;
