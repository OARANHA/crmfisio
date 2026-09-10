-- MEDICSPRO #394 — Encounter Clinical Record Foundation
-- Additive only. No historical backfill. No production execution in this PR.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.clinical_encounter_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL DEFAULT '',
  history text NOT NULL DEFAULT '',
  findings text NOT NULL DEFAULT '',
  assessment text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT '',
  additional_notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  evolution_id uuid REFERENCES public.physiotherapy_evolutions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CONSTRAINT clinical_encounter_records_appointment_unique UNIQUE (appointment_id),
  CONSTRAINT clinical_encounter_records_evolution_unique UNIQUE (evolution_id),
  CONSTRAINT clinical_encounter_records_finalization_shape CHECK (
    (status = 'draft' AND evolution_id IS NULL AND finalized_at IS NULL)
    OR
    (status = 'finalized' AND evolution_id IS NOT NULL AND finalized_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS clinical_encounter_records_patient_history_idx
  ON public.clinical_encounter_records (clinic_id, patient_id, finalized_at DESC)
  WHERE status = 'finalized';

ALTER TABLE public.clinical_encounter_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_encounter_records_select_clinical ON public.clinical_encounter_records;
CREATE POLICY clinical_encounter_records_select_clinical
ON public.clinical_encounter_records
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
);

REVOKE ALL ON public.clinical_encounter_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.clinical_encounter_records TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_encounter_records TO service_role;

CREATE OR REPLACE FUNCTION public.clinical_encounter_advisory_lock(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_appointment_id IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_appointment_required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('medicspro:clinical-encounter:' || p_appointment_id::text, 394));
END;
$$;

REVOKE ALL ON FUNCTION public.clinical_encounter_advisory_lock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_encounter_advisory_lock(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.lock_linked_evolution_encounter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    PERFORM public.clinical_encounter_advisory_lock(NEW.session_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_lock_linked_evolution_encounter ON public.physiotherapy_evolutions;
CREATE TRIGGER trg_00_lock_linked_evolution_encounter
BEFORE INSERT ON public.physiotherapy_evolutions
FOR EACH ROW EXECUTE FUNCTION public.lock_linked_evolution_encounter();

REVOKE ALL ON FUNCTION public.lock_linked_evolution_encounter() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_linked_evolution_encounter() TO service_role;

CREATE OR REPLACE FUNCTION public.guard_clinical_encounter_record_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF coalesce(auth.role(), '') <> 'service_role'
       AND NOT (coalesce(auth.role(), '') = '' AND session_user IN ('postgres', 'supabase_admin')) THEN
      RAISE EXCEPTION 'clinical_encounter_record_delete_denied' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
       OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
      RAISE EXCEPTION 'clinical_encounter_record_provenance_immutable' USING ERRCODE = '42501';
    END IF;

    IF OLD.status = 'finalized' AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'clinical_encounter_record_finalized_immutable' USING ERRCODE = '42501';
    END IF;

    IF OLD.status = 'draft' AND NEW.status = 'finalized' THEN
      IF NEW.evolution_id IS NULL OR NEW.finalized_at IS NULL THEN
        RAISE EXCEPTION 'clinical_encounter_record_finalization_link_required' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'clinical_encounter_record_invalid_status_transition' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_clinical_encounter_record_integrity ON public.clinical_encounter_records;
CREATE TRIGGER trg_guard_clinical_encounter_record_integrity
BEFORE UPDATE OR DELETE ON public.clinical_encounter_records
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_encounter_record_integrity();

REVOKE ALL ON FUNCTION public.guard_clinical_encounter_record_integrity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_clinical_encounter_record_integrity() TO service_role;

CREATE OR REPLACE FUNCTION public.materialize_clinical_encounter_evolution(
  p_reason text,
  p_history text,
  p_findings text,
  p_assessment text,
  p_plan text,
  p_additional_notes text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT array_to_string(
    array_remove(ARRAY[
      CASE WHEN nullif(btrim(coalesce(p_reason, '')), '') IS NOT NULL
        THEN 'Motivo / demandas' || E'\n' || btrim(p_reason) END,
      CASE WHEN nullif(btrim(coalesce(p_history, '')), '') IS NOT NULL
        THEN 'História atual' || E'\n' || btrim(p_history) END,
      CASE WHEN nullif(btrim(coalesce(p_findings, '')), '') IS NOT NULL
        THEN 'Achados / exame' || E'\n' || btrim(p_findings) END,
      CASE WHEN nullif(btrim(coalesce(p_assessment, '')), '') IS NOT NULL
        THEN 'Avaliação clínica / problemas' || E'\n' || btrim(p_assessment) END,
      CASE WHEN nullif(btrim(coalesce(p_plan, '')), '') IS NOT NULL
        THEN 'Plano / conduta' || E'\n' || btrim(p_plan) END,
      CASE WHEN nullif(btrim(coalesce(p_additional_notes, '')), '') IS NOT NULL
        THEN 'Observações' || E'\n' || btrim(p_additional_notes) END
    ], NULL),
    E'\n\n'
  )
$$;

REVOKE ALL ON FUNCTION public.materialize_clinical_encounter_evolution(text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_clinical_encounter_evolution(text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.assert_clinical_encounter_actor(p_appointment_id uuid)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  SELECT p.* INTO v_actor
  FROM public.profiles p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active';

  IF v_actor.id IS NULL OR public.current_clinic_id() IS DISTINCT FROM v_actor.clinic_id THEN
    RAISE EXCEPTION 'clinical_encounter_active_profile_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_has_valid_clinical_identity() THEN
    RAISE EXCEPTION 'clinical_encounter_valid_identity_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_has_clinical_capability('clinical.attend') THEN
    RAISE EXCEPTION 'clinical_encounter_attend_capability_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_has_clinical_capability('clinical.evolution.write') THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_capability_required' USING ERRCODE = '42501';
  END IF;

  SELECT a.* INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
  FOR UPDATE;

  IF v_appointment.id IS NULL
     OR v_appointment.clinic_id IS DISTINCT FROM v_actor.clinic_id
     OR v_appointment.professional_id IS DISTINCT FROM v_actor.id
     OR v_appointment.fisio_id IS DISTINCT FROM v_actor.id THEN
    RAISE EXCEPTION 'clinical_encounter_own_appointment_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = v_appointment.paciente_id
      AND p.clinic_id = v_actor.clinic_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_patient_link_invalid' USING ERRCODE = '23514';
  END IF;

  RETURN v_appointment;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_clinical_encounter_actor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_clinical_encounter_actor(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.save_clinical_encounter_record(
  p_appointment_id uuid,
  p_expected_revision integer,
  p_reason text DEFAULT '',
  p_history text DEFAULT '',
  p_findings text DEFAULT '',
  p_assessment text DEFAULT '',
  p_plan text DEFAULT '',
  p_additional_notes text DEFAULT ''
)
RETURNS public.clinical_encounter_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_record public.clinical_encounter_records%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_auth_required' USING ERRCODE = '42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'clinical_encounter_expected_revision_required' USING ERRCODE = '22023';
  END IF;

  PERFORM public.clinical_encounter_advisory_lock(p_appointment_id);
  v_appointment := public.assert_clinical_encounter_actor(p_appointment_id);

  IF v_appointment.status IS DISTINCT FROM 'em_atendimento' THEN
    RAISE EXCEPTION 'clinical_encounter_active_appointment_required' USING ERRCODE = '23514';
  END IF;

  SELECT r.* INTO v_record
  FROM public.clinical_encounter_records r
  WHERE r.appointment_id = p_appointment_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.physiotherapy_evolutions e
    WHERE e.session_id = p_appointment_id AND e.deleted_at IS NULL
  ) THEN
    IF v_record.id IS NULL THEN
      RAISE EXCEPTION 'clinical_encounter_legacy_evolution_exists' USING ERRCODE = '23514';
    END IF;
    RAISE EXCEPTION 'clinical_encounter_evolution_conflict' USING ERRCODE = '40001';
  END IF;

  IF v_record.id IS NULL THEN
    IF p_expected_revision <> 0 THEN
      RAISE EXCEPTION 'clinical_encounter_revision_conflict' USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.clinical_encounter_records (
      clinic_id, appointment_id, patient_id, professional_id,
      reason, history, findings, assessment, plan, additional_notes,
      status, revision
    ) VALUES (
      v_appointment.clinic_id, v_appointment.id, v_appointment.paciente_id, auth.uid(),
      coalesce(p_reason, ''), coalesce(p_history, ''), coalesce(p_findings, ''),
      coalesce(p_assessment, ''), coalesce(p_plan, ''), coalesce(p_additional_notes, ''),
      'draft', 1
    ) RETURNING * INTO v_record;

    RETURN v_record;
  END IF;

  IF v_record.clinic_id IS DISTINCT FROM v_appointment.clinic_id
     OR v_record.patient_id IS DISTINCT FROM v_appointment.paciente_id
     OR v_record.professional_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'clinical_encounter_record_link_invalid' USING ERRCODE = '23514';
  END IF;
  IF v_record.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'clinical_encounter_record_finalized_immutable' USING ERRCODE = '42501';
  END IF;
  IF v_record.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'clinical_encounter_revision_conflict' USING ERRCODE = '40001';
  END IF;

  UPDATE public.clinical_encounter_records
  SET reason = coalesce(p_reason, ''),
      history = coalesce(p_history, ''),
      findings = coalesce(p_findings, ''),
      assessment = coalesce(p_assessment, ''),
      plan = coalesce(p_plan, ''),
      additional_notes = coalesce(p_additional_notes, ''),
      revision = revision + 1,
      updated_at = now()
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

REVOKE ALL ON FUNCTION public.save_clinical_encounter_record(uuid,integer,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_clinical_encounter_record(uuid,integer,text,text,text,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalize_clinical_encounter_record(
  p_appointment_id uuid,
  p_expected_revision integer
)
RETURNS public.clinical_encounter_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_record public.clinical_encounter_records%ROWTYPE;
  v_evolution public.physiotherapy_evolutions%ROWTYPE;
  v_text text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_auth_required' USING ERRCODE = '42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 1 THEN
    RAISE EXCEPTION 'clinical_encounter_expected_revision_required' USING ERRCODE = '22023';
  END IF;

  PERFORM public.clinical_encounter_advisory_lock(p_appointment_id);
  v_appointment := public.assert_clinical_encounter_actor(p_appointment_id);

  SELECT r.* INTO v_record
  FROM public.clinical_encounter_records r
  WHERE r.appointment_id = p_appointment_id
  FOR UPDATE;

  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_record_required' USING ERRCODE = 'P0002';
  END IF;
  IF v_record.clinic_id IS DISTINCT FROM v_appointment.clinic_id
     OR v_record.patient_id IS DISTINCT FROM v_appointment.paciente_id
     OR v_record.professional_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'clinical_encounter_record_link_invalid' USING ERRCODE = '23514';
  END IF;

  IF v_record.status = 'finalized' THEN
    SELECT e.* INTO v_evolution
    FROM public.physiotherapy_evolutions e
    WHERE e.id = v_record.evolution_id
      AND e.session_id = v_record.appointment_id
      AND e.clinic_id = v_record.clinic_id
      AND e.patient_id = v_record.patient_id
      AND e.professional_id = v_record.professional_id
      AND e.deleted_at IS NULL;
    IF v_appointment.status = 'finalizado' AND v_evolution.id IS NOT NULL THEN
      RETURN v_record;
    END IF;
    RAISE EXCEPTION 'clinical_encounter_finalized_state_inconsistent' USING ERRCODE = '23514';
  END IF;

  IF v_appointment.status IS DISTINCT FROM 'em_atendimento' THEN
    RAISE EXCEPTION 'clinical_encounter_active_appointment_required' USING ERRCODE = '23514';
  END IF;
  IF v_record.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'clinical_encounter_revision_conflict' USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.physiotherapy_evolutions e
    WHERE e.session_id = p_appointment_id AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_conflict' USING ERRCODE = '40001';
  END IF;

  v_text := public.materialize_clinical_encounter_evolution(
    v_record.reason, v_record.history, v_record.findings,
    v_record.assessment, v_record.plan, v_record.additional_notes
  );
  IF nullif(btrim(coalesce(v_text, '')), '') IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_content_required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.physiotherapy_evolutions (
    id, clinic_id, patient_id, professional_id, session_id, texto, created_at
  ) VALUES (
    gen_random_uuid(), v_record.clinic_id, v_record.patient_id, v_record.professional_id,
    v_record.appointment_id, v_text,
    (v_appointment.data::timestamp + interval '12 hours') AT TIME ZONE 'UTC'
  ) RETURNING * INTO v_evolution;

  UPDATE public.clinical_encounter_records
  SET status = 'finalized',
      evolution_id = v_evolution.id,
      finalized_at = now(),
      updated_at = now(),
      revision = revision + 1
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  -- Keep the existing clinical and financial trigger chain authoritative.
  -- No exception handler is allowed here: unexpected integrity failures roll
  -- back the Evolution and Encounter Record together with this status update.
  UPDATE public.appointments
  SET status = 'finalizado', updated_at = now()
  WHERE id = v_appointment.id;

  RETURN v_record;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_clinical_encounter_record(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_clinical_encounter_record(uuid,integer) TO authenticated, service_role;

COMMENT ON TABLE public.clinical_encounter_records IS
  'Mutable encounter-scoped draft that is deterministically materialized into one canonical physiotherapy_evolutions row at explicit finalization.';
COMMENT ON FUNCTION public.save_clinical_encounter_record(uuid,integer,text,text,text,text,text,text) IS
  'RPC-only optimistic save for the exact current professional own active appointment.';
COMMENT ON FUNCTION public.finalize_clinical_encounter_record(uuid,integer) IS
  'Transactional explicit finalization: materializes Evolution first, freezes encounter record, then finalizes appointment through existing clinical/financial guards.';

COMMIT;