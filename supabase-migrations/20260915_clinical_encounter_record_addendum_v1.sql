-- MEDICSPRO — Encounter Record Correction/Addendum V1
-- Append-only correction ledger for finalized #394 records.
-- Original Encounter Record and linked official Evolution remain immutable.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.clinical_encounter_record_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  encounter_record_id uuid NOT NULL REFERENCES public.clinical_encounter_records(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  evolution_id uuid NOT NULL REFERENCES public.physiotherapy_evolutions(id) ON DELETE RESTRICT,
  original_professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('addendum','correction')),
  reason text NOT NULL CHECK (nullif(btrim(reason), '') IS NOT NULL),
  content text NOT NULL CHECK (nullif(btrim(content), '') IS NOT NULL),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_encounter_record_addenda_author_v1 CHECK (author_id = original_professional_id),
  CONSTRAINT clinical_encounter_record_addenda_request_unique UNIQUE (clinic_id, request_id)
);
CREATE INDEX IF NOT EXISTS clinical_encounter_record_addenda_record_idx
  ON public.clinical_encounter_record_addenda (encounter_record_id, created_at, id);
CREATE INDEX IF NOT EXISTS clinical_encounter_record_addenda_patient_idx
  ON public.clinical_encounter_record_addenda (clinic_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clinical_encounter_record_addenda_evolution_idx
  ON public.clinical_encounter_record_addenda (evolution_id, created_at, id);

ALTER TABLE public.clinical_encounter_record_addenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinical_encounter_record_addenda_select_clinical
  ON public.clinical_encounter_record_addenda;
CREATE POLICY clinical_encounter_record_addenda_select_clinical
ON public.clinical_encounter_record_addenda
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
);

REVOKE ALL ON public.clinical_encounter_record_addenda FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.clinical_encounter_record_addenda TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_finalized_encounter_evolution_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clinical_encounter_records r
    WHERE r.evolution_id = OLD.id
      AND r.status = 'finalized'
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_finalized_immutable'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_finalized_encounter_evolution_immutable()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_finalized_encounter_evolution_immutable() TO service_role;

DROP TRIGGER IF EXISTS trg_01_finalized_encounter_evolution_immutable
  ON public.physiotherapy_evolutions;
CREATE TRIGGER trg_01_finalized_encounter_evolution_immutable
BEFORE UPDATE OR DELETE ON public.physiotherapy_evolutions
FOR EACH ROW EXECUTE FUNCTION public.guard_finalized_encounter_evolution_immutable();

CREATE OR REPLACE FUNCTION public.validate_clinical_encounter_record_addendum_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record public.clinical_encounter_records%ROWTYPE;
BEGIN
  SELECT r.* INTO v_record
  FROM public.clinical_encounter_records r
  WHERE r.id = NEW.encounter_record_id;

  IF v_record.id IS NULL
     OR v_record.status IS DISTINCT FROM 'finalized'
     OR v_record.clinic_id IS DISTINCT FROM NEW.clinic_id
     OR v_record.appointment_id IS DISTINCT FROM NEW.appointment_id
     OR v_record.patient_id IS DISTINCT FROM NEW.patient_id
     OR v_record.evolution_id IS DISTINCT FROM NEW.evolution_id
     OR v_record.professional_id IS DISTINCT FROM NEW.original_professional_id
     OR NEW.author_id IS DISTINCT FROM v_record.professional_id THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_provenance_invalid'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_clinical_encounter_record_addendum_provenance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_clinical_encounter_record_addendum_provenance()
  TO service_role;

DROP TRIGGER IF EXISTS trg_validate_clinical_encounter_record_addendum_provenance
  ON public.clinical_encounter_record_addenda;
CREATE TRIGGER trg_validate_clinical_encounter_record_addendum_provenance
BEFORE INSERT ON public.clinical_encounter_record_addenda
FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_encounter_record_addendum_provenance();

CREATE OR REPLACE FUNCTION public.guard_clinical_encounter_record_addendum_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'clinical_encounter_addendum_immutable'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_clinical_encounter_record_addendum_immutable()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_clinical_encounter_record_addendum_immutable()
  TO service_role;

DROP TRIGGER IF EXISTS trg_guard_clinical_encounter_record_addendum_immutable
  ON public.clinical_encounter_record_addenda;
CREATE TRIGGER trg_guard_clinical_encounter_record_addendum_immutable
BEFORE UPDATE OR DELETE ON public.clinical_encounter_record_addenda
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_encounter_record_addendum_immutable();

CREATE OR REPLACE FUNCTION public.create_clinical_encounter_record_addendum(
  p_encounter_record_id uuid,
  p_request_id uuid,
  p_kind text,
  p_reason text,
  p_content text
)
RETURNS public.clinical_encounter_record_addenda
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_record public.clinical_encounter_records%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_evolution public.physiotherapy_evolutions%ROWTYPE;
  v_existing public.clinical_encounter_record_addenda%ROWTYPE;
  v_result public.clinical_encounter_record_addenda%ROWTYPE;
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_content text := btrim(coalesce(p_content, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_auth_required' USING ERRCODE = '42501';
  END IF;
  IF p_encounter_record_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_reference_required' USING ERRCODE = '22023';
  END IF;
  IF v_kind NOT IN ('addendum','correction') THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_kind_invalid' USING ERRCODE = '22023';
  END IF;
  IF v_reason = '' OR v_content = '' THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_content_required' USING ERRCODE = '22023';
  END IF;

  SELECT p.* INTO v_actor
  FROM public.profiles p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active';
  IF v_actor.id IS NULL
     OR public.current_clinic_id() IS DISTINCT FROM v_actor.clinic_id THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_active_profile_required' USING ERRCODE = '42501';
  END IF;
  IF public.current_user_has_valid_clinical_identity() IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_valid_identity_required' USING ERRCODE = '42501';
  END IF;
  IF public.current_user_has_clinical_capability('clinical.attend') IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_attend_capability_required' USING ERRCODE = '42501';
  END IF;
  IF public.current_user_has_clinical_capability('clinical.evolution.write') IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_evolution_capability_required' USING ERRCODE = '42501';
  END IF;

  SELECT r.* INTO v_record
  FROM public.clinical_encounter_records r
  WHERE r.id = p_encounter_record_id;
  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_record_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.clinical_encounter_advisory_lock(v_record.appointment_id);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'medicspro:clinical-encounter-addendum:' || p_request_id::text, 480
  ));
  SELECT r.* INTO v_record
  FROM public.clinical_encounter_records r
  WHERE r.id = p_encounter_record_id
  FOR UPDATE;

  IF v_record.status IS DISTINCT FROM 'finalized'
     OR v_record.finalized_at IS NULL
     OR v_record.evolution_id IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_finalized_record_required' USING ERRCODE = '23514';
  END IF;
  IF v_record.clinic_id IS DISTINCT FROM v_actor.clinic_id THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_tenant_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_record.professional_id IS DISTINCT FROM v_actor.id THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_original_author_required' USING ERRCODE = '42501';
  END IF;

  SELECT a.* INTO v_appointment
  FROM public.appointments a
  WHERE a.id = v_record.appointment_id
  FOR SHARE;
  IF v_appointment.id IS NULL
     OR v_appointment.status IS DISTINCT FROM 'finalizado'
     OR v_appointment.clinic_id IS DISTINCT FROM v_record.clinic_id
     OR v_appointment.paciente_id IS DISTINCT FROM v_record.patient_id
     OR v_appointment.professional_id IS DISTINCT FROM v_record.professional_id THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_appointment_invalid' USING ERRCODE = '23514';
  END IF;
  SELECT e.* INTO v_evolution
  FROM public.physiotherapy_evolutions e
  WHERE e.id = v_record.evolution_id
    AND e.deleted_at IS NULL
  FOR SHARE;
  IF v_evolution.id IS NULL
     OR v_evolution.session_id IS DISTINCT FROM v_record.appointment_id
     OR v_evolution.clinic_id IS DISTINCT FROM v_record.clinic_id
     OR v_evolution.patient_id IS DISTINCT FROM v_record.patient_id
     OR v_evolution.professional_id IS DISTINCT FROM v_record.professional_id THEN
    RAISE EXCEPTION 'clinical_encounter_addendum_evolution_invalid' USING ERRCODE = '23514';
  END IF;

  SELECT x.* INTO v_existing
  FROM public.clinical_encounter_record_addenda x
  WHERE x.clinic_id = v_record.clinic_id
    AND x.request_id = p_request_id
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.encounter_record_id = v_record.id
       AND v_existing.author_id = v_actor.id
       AND v_existing.kind = v_kind
       AND v_existing.reason = v_reason
       AND v_existing.content = v_content THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'clinical_encounter_addendum_idempotency_conflict' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.clinical_encounter_record_addenda (
    clinic_id,
    encounter_record_id,
    appointment_id,
    patient_id,
    evolution_id,
    original_professional_id,
    author_id,
    request_id,
    kind,
    reason,
    content
  ) VALUES (
    v_record.clinic_id,
    v_record.id,
    v_record.appointment_id,
    v_record.patient_id,
    v_record.evolution_id,
    v_record.professional_id,
    v_actor.id,
    p_request_id,
    v_kind,
    v_reason,
    v_content
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_clinical_encounter_record_addendum(uuid,uuid,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clinical_encounter_record_addendum(uuid,uuid,text,text,text)
  TO authenticated, service_role;

COMMENT ON TABLE public.clinical_encounter_record_addenda IS
  'Append-only correction/addendum ledger for finalized #394 Encounter Records; original record and linked Evolution remain immutable.';
COMMENT ON FUNCTION public.create_clinical_encounter_record_addendum(uuid,uuid,text,text,text) IS
  'Author-only RPC for an immutable finalized Encounter Record. Requires valid clinical identity plus clinical.attend and clinical.evolution.write; preserves original record/evolution and has no appointment or financial side effect.';
COMMENT ON FUNCTION public.guard_finalized_encounter_evolution_immutable() IS
  'Freezes UPDATE/DELETE of the official Evolution once it is linked to a finalized Encounter Record; unrelated legacy Evolutions keep their existing lifecycle.';

COMMIT;
