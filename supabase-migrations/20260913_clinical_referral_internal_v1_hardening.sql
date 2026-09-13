-- MedicsPro — D2-E3.1 Internal Referral V1 hardening
-- Restricts internal referral routing to canonical clinical professions.
-- Keeps role separate from profession and does not expand chart/care authorization.

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
    btrim(coalesce(to_jsonb(p)->>'especialidade', to_jsonb(p)->>'specialty', '')),
    btrim(coalesce(p.council_type, '')),
    btrim(coalesce(p.council_state, '')),
    btrim(coalesce(p.registro, ''))
  FROM public.profiles p
  WHERE p.clinic_id = v_clinic_id
    AND p.ativo IS TRUE
    AND p.id IS DISTINCT FROM auth.uid()
    AND lower(btrim(coalesce(p.professional_type, ''))) IN (
      'medico',
      'fisioterapeuta',
      'psicologo',
      'quiropraxista'
    )
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
  v_service_specialty text;
  v_service_name text;
  v_service_professional_type text;
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
    IF v_target_text <> '' THEN
      RAISE EXCEPTION 'clinical_referral_target_invalid' USING ERRCODE = '23514';
    END IF;

    v_service_specialty := btrim(coalesce(NEW.payload->'recipient'->>'specialty', ''));
    v_service_name := btrim(coalesce(NEW.payload->'recipient'->>'service', ''));
    v_service_professional_type := btrim(coalesce(NEW.payload->'recipient'->>'professional_type', ''));

    IF v_service_specialty = '' AND v_service_name = '' AND v_service_professional_type = '' THEN
      IF NEW.status = 'issued' THEN
        RAISE EXCEPTION 'clinical_referral_internal_service_required' USING ERRCODE = '22023';
      END IF;
      RETURN NEW;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.clinic_id = NEW.clinic_id
        AND p.ativo IS TRUE
        AND p.id IS DISTINCT FROM NEW.issuer_id
        AND lower(btrim(coalesce(p.professional_type, ''))) IN (
          'medico',
          'fisioterapeuta',
          'psicologo',
          'quiropraxista'
        )
        AND (
          (
            v_service_professional_type <> ''
            AND lower(btrim(coalesce(p.professional_type, ''))) = lower(v_service_professional_type)
          )
          OR (
            v_service_specialty <> ''
            AND lower(btrim(coalesce(to_jsonb(p)->>'especialidade', to_jsonb(p)->>'specialty', ''))) = lower(v_service_specialty)
          )
          OR (
            v_service_name <> ''
            AND lower(btrim(coalesce(to_jsonb(p)->>'especialidade', to_jsonb(p)->>'specialty', ''))) = lower(v_service_name)
          )
        )
    ) THEN
      RAISE EXCEPTION 'clinical_referral_internal_service_invalid' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

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
         AND lower(btrim(coalesce(p.professional_type, ''))) IN (
           'medico',
           'fisioterapeuta',
           'psicologo',
           'quiropraxista'
         )
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

REVOKE ALL ON FUNCTION public.list_clinical_referral_internal_targets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_clinical_referral_internal_targets() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_clinical_referral_internal_target() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_clinical_referral_internal_target() TO service_role;

COMMIT;
