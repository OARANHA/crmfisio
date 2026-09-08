-- MEDICSPRO — Nexus C-03 lifecycle guard rollout correction
-- Additive correction for environments where the historical C-03 migration was
-- already committed with the pre-canonical UPDATE guard ordering.
-- Intentionally changes only the trigger function body; no table, constraint,
-- trigger, RLS, ACL, data, role, writer or backfill changes are performed here.

CREATE OR REPLACE FUNCTION public.validate_nexus_result_clinical_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_delete_forbidden';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_signed_immutable';
  END IF;

  SELECT r.clinic_id, r.professional_id, r.status, r.finalized_at
  INTO v_result
  FROM public.nexus_clinical_results r
  WHERE r.id = NEW.result_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_result_missing';
  END IF;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_result.clinic_id;
  ELSIF NEW.clinic_id <> v_result.clinic_id THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_clinic_mismatch';
  END IF;

  IF NEW.processed_at IS NOT NULL
     AND (v_result.status <> 'finalized' OR v_result.finalized_at IS NULL) THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_requires_frozen_result';
  END IF;

  IF (NEW.reviewed_at IS NULL) <> (NEW.reviewed_by IS NULL) THEN
    RAISE EXCEPTION 'nexus_clinical_review_pair_required';
  END IF;

  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by <> v_result.professional_id THEN
    RAISE EXCEPTION 'nexus_clinical_review_author_mismatch';
  END IF;

  IF (NEW.signed_at IS NULL) <> (NEW.signed_by IS NULL) THEN
    RAISE EXCEPTION 'nexus_clinical_sign_pair_required';
  END IF;

  IF NEW.signed_at IS NOT NULL AND NEW.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'nexus_clinical_sign_requires_review';
  END IF;

  IF NEW.signed_by IS NOT NULL AND NEW.signed_by <> v_result.professional_id THEN
    RAISE EXCEPTION 'nexus_clinical_sign_author_mismatch';
  END IF;

  IF NEW.reviewed_at IS NOT NULL AND NEW.processed_at IS NULL THEN
    RAISE EXCEPTION 'nexus_clinical_review_requires_processing';
  END IF;

  IF NEW.reviewed_at IS NOT NULL AND NEW.reviewed_at < NEW.processed_at THEN
    RAISE EXCEPTION 'nexus_clinical_review_timestamp_invalid';
  END IF;

  IF NEW.signed_at IS NOT NULL AND NEW.signed_at < NEW.reviewed_at THEN
    RAISE EXCEPTION 'nexus_clinical_sign_timestamp_invalid';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
