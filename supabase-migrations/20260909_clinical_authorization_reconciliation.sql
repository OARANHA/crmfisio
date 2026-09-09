-- MedicsPro — clinical authorization reconciliation
-- Closes the remaining runtime drift after the fisio -> professional role cutover.
-- Clinical authority is identity + capability + authorship; operational CRM remains separate.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A transaction-scoped proof lets the patients trigger distinguish the canonical
-- journey RPC from an arbitrary browser UPDATE without a forgeable session flag.
ALTER TABLE public.patient_journey_events
  ADD COLUMN IF NOT EXISTS transition_xid bigint;

COMMENT ON COLUMN public.patient_journey_events.transition_xid IS
  'Transaction proof emitted by transition_patient_journey before changing a clinical journey stage; authenticated clients cannot write journey events directly.';

REVOKE INSERT, UPDATE, DELETE ON public.patient_journey_events FROM authenticated;

CREATE OR REPLACE FUNCTION public.transition_patient_journey(
  p_patient_id uuid,
  p_to_stage text,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(patient_id uuid, from_stage text, to_stage text, patient_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_from text;
  v_status text;
  v_is_clinical_transition boolean;
BEGIN
  SELECT * INTO v_actor
  FROM public.profiles
  WHERE id = auth.uid()
    AND ativo = true;

  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'Perfil ativo não encontrado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_patient
  FROM public.patients
  WHERE id = p_patient_id
    AND clinic_id = v_actor.clinic_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado na clínica' USING ERRCODE = 'P0002';
  END IF;

  IF p_to_stage NOT IN ('lead', 'avaliacao', 'tratamento', 'alta') THEN
    RAISE EXCEPTION 'Etapa de jornada inválida';
  END IF;

  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Motivo da transição é obrigatório';
  END IF;

  v_from := v_patient.funil_stage::text;

  IF v_from = p_to_stage THEN
    RAISE EXCEPTION 'Paciente já está nesta etapa';
  END IF;

  v_is_clinical_transition :=
    (v_from = 'avaliacao' AND p_to_stage = 'tratamento')
    OR (v_from = 'tratamento' AND p_to_stage = 'alta')
    OR (v_from = 'alta' AND p_to_stage = 'tratamento');

  -- Lead -> avaliação is an operational CRM handoff. Keep the existing
  -- owner/admin/reception boundary and require the clinic CRM entitlement.
  IF v_from = 'lead' AND p_to_stage = 'avaliacao' THEN
    IF v_actor.role::text NOT IN ('owner', 'admin', 'recep')
       OR public.current_clinic_entitlement_allowed('crm.access') IS NOT TRUE THEN
      RAISE EXCEPTION 'Perfil sem permissão para encaminhar à avaliação' USING ERRCODE = '42501';
    END IF;

  -- Treatment decisions are clinical acts. Operational role never authorizes
  -- them by itself; owner/admin may act only when they independently satisfy
  -- the same clinical identity + capability boundary as any other clinician.
  ELSIF v_is_clinical_transition THEN
    IF public.current_user_has_valid_clinical_identity() IS NOT TRUE
       OR public.current_user_has_clinical_capability('clinical.attend') IS NOT TRUE THEN
      RAISE EXCEPTION 'Autorização clínica necessária para alterar a jornada' USING ERRCODE = '42501';
    END IF;

  ELSE
    RAISE EXCEPTION 'Transição de jornada não permitida: % -> %', v_from, p_to_stage USING ERRCODE = '42501';
  END IF;

  -- Emit the audit/proof row first. If the patient UPDATE fails, PostgreSQL rolls
  -- the whole RPC transaction back, so no orphan proof/event can survive.
  INSERT INTO public.patient_journey_events(
    clinic_id,
    patient_id,
    from_stage,
    to_stage,
    reason,
    notes,
    actor_id,
    actor_role,
    transition_xid
  ) VALUES (
    v_actor.clinic_id,
    v_patient.id,
    v_from,
    p_to_stage,
    trim(p_reason),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_actor.id,
    v_actor.role::text,
    txid_current()
  );

  UPDATE public.patients
  SET
    funil_stage = CASE p_to_stage
      WHEN 'lead' THEN 'lead'
      WHEN 'avaliacao' THEN 'avaliacao'
      WHEN 'tratamento' THEN 'tratamento'
      WHEN 'alta' THEN 'alta'
    END,
    status = CASE WHEN p_to_stage = 'alta' THEN 'alta' ELSE 'ativo' END,
    updated_at = now()
  WHERE id = v_patient.id;

  v_status := CASE WHEN p_to_stage = 'alta' THEN 'alta' ELSE 'ativo' END;

  RETURN QUERY SELECT v_patient.id, v_from, p_to_stage, v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_patient_journey(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_patient_journey(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_patient_crm_stage_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app_role text;
  v_is_clinical_transition boolean;
  v_has_canonical_proof boolean := false;
BEGIN
  -- Trusted internal/service/database maintenance without an authenticated user
  -- keeps the existing maintenance path.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.funil_stage IS NOT DISTINCT FROM OLD.funil_stage THEN
    RETURN NEW;
  END IF;

  IF public.current_clinic_id() IS NULL
     OR NEW.clinic_id IS DISTINCT FROM public.current_clinic_id() THEN
    RAISE EXCEPTION 'Paciente fora da clínica autenticada' USING ERRCODE = '42501';
  END IF;

  v_is_clinical_transition :=
    (OLD.funil_stage::text = 'avaliacao' AND NEW.funil_stage::text = 'tratamento')
    OR (OLD.funil_stage::text = 'tratamento' AND NEW.funil_stage::text = 'alta')
    OR (OLD.funil_stage::text = 'alta' AND NEW.funil_stage::text = 'tratamento');

  IF v_is_clinical_transition THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.patient_journey_events e
      WHERE e.clinic_id = NEW.clinic_id
        AND e.patient_id = NEW.id
        AND e.actor_id = auth.uid()
        AND e.from_stage = OLD.funil_stage::text
        AND e.to_stage = NEW.funil_stage::text
        AND e.transition_xid = txid_current()
    ) INTO v_has_canonical_proof;

    IF NOT v_has_canonical_proof THEN
      RAISE EXCEPTION 'Transição clínica de jornada exige o fluxo canônico' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- Non-clinical funnel edits remain CRM operations. A clinical professional
  -- does not gain general CRM write access merely by holding clinical.attend.
  IF public.current_clinic_entitlement_allowed('crm.access') IS NOT TRUE THEN
    RAISE EXCEPTION 'Módulo CRM não liberado para esta clínica' USING ERRCODE = '42501';
  END IF;

  app_role := public.current_app_role();
  IF app_role IS NULL OR app_role NOT IN ('owner', 'admin', 'recep') THEN
    RAISE EXCEPTION 'Sem permissão para alterar o funil do CRM' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_patient_crm_stage_entitlement() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.guard_patient_crm_stage_entitlement() IS
  'Separates general CRM writes (owner/admin/recep + crm.access) from clinical journey decisions, which require an unforgeable same-transaction event emitted by transition_patient_journey.';

-- Keep direct patient UPDATE operational. Clinical professionals use the journey
-- RPC for clinical stage changes instead of receiving general browser CRM access.
DROP POLICY IF EXISTS patients_update_operational ON public.patients;
CREATE POLICY patients_update_operational
ON public.patients
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
)
WITH CHECK (clinic_id = public.current_clinic_id());

-- Appointment INSERT/UPDATE now recognizes the canonical professional role.
-- A professional may operate only appointments assigned to themselves; owner,
-- admin and reception retain their existing operational agenda boundary.
DROP POLICY IF EXISTS appointments_insert_operational ON public.appointments;
CREATE POLICY appointments_insert_operational
ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner', 'admin', 'recep')
    OR (
      public.current_app_role() = 'professional'
      AND professional_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS appointments_update_operational ON public.appointments;
CREATE POLICY appointments_update_operational
ON public.appointments
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner', 'admin', 'recep')
    OR (
      public.current_app_role() = 'professional'
      AND professional_id = auth.uid()
    )
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner', 'admin', 'recep')
    OR (
      public.current_app_role() = 'professional'
      AND professional_id = auth.uid()
    )
  )
);

CREATE OR REPLACE FUNCTION public.guard_appointment_mutation_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_jwt_role text := coalesce(auth.role(), '');
  v_assigned_professional uuid;
BEGIN
  IF v_jwt_role = 'service_role'
     OR (v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'appointment_active_tenant_role_required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- The compatibility trigger may populate professional_id from fisio_id later
    -- in the BEFORE-trigger chain, so accept either physical alias here while
    -- authorizing against the canonical professional identity.
    v_assigned_professional := coalesce(NEW.professional_id, NEW.fisio_id);
    IF v_role = 'professional'
       AND (auth.uid() IS NULL OR v_assigned_professional IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'appointment_professional_self_assignment_required' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_role = 'professional'
       AND (
         auth.uid() IS NULL
         OR OLD.professional_id IS DISTINCT FROM auth.uid()
         OR NEW.professional_id IS DISTINCT FROM auth.uid()
       ) THEN
      RAISE EXCEPTION 'appointment_professional_self_mutation_required' USING ERRCODE = '42501';
    END IF;

    -- Existing appointments remain structurally immutable for authenticated
    -- users. fisio_id stays listed only because it is a temporary physical alias
    -- that must remain synchronized with professional_id during the cutover.
    IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
       OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
       OR NEW.professional_id IS DISTINCT FROM OLD.professional_id
       OR NEW.fisio_id IS DISTINCT FROM OLD.fisio_id
       OR NEW.room_id IS DISTINCT FROM OLD.room_id
       OR NEW.data IS DISTINCT FROM OLD.data
       OR NEW.inicio IS DISTINCT FROM OLD.inicio
       OR NEW.fim IS DISTINCT FROM OLD.fim
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.pacote_id IS DISTINCT FROM OLD.pacote_id
       OR NEW.serie_id IS DISTINCT FROM OLD.serie_id
       OR NEW.is_fit_in IS DISTINCT FROM OLD.is_fit_in
       OR NEW.rescheduled_from_id IS DISTINCT FROM OLD.rescheduled_from_id THEN
      RAISE EXCEPTION 'appointment_structural_update_requires_canonical_flow' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_mutation_boundary() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.guard_appointment_mutation_boundary() IS
  'Fails closed on inactive tenant roles, cross-professional mutations and authenticated in-place structural changes; professional_id is canonical and fisio_id is compatibility-only.';

CREATE OR REPLACE FUNCTION public.guard_appointment_clinical_self_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_is_clinical_transition boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_clinical_transition := NEW.status IN ('em_atendimento', 'finalizado');

  IF v_is_clinical_transition THEN
    IF public.current_user_has_clinical_capability('clinical.attend') IS NOT TRUE THEN
      RAISE EXCEPTION 'clinical_professional_capability_required' USING ERRCODE = '42501';
    END IF;
    IF auth.uid() IS NULL
       OR OLD.professional_id IS DISTINCT FROM auth.uid()
       OR NEW.professional_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'appointment_clinical_self_transition_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF v_role = 'professional'
     AND (
       auth.uid() IS NULL
       OR OLD.professional_id IS DISTINCT FROM auth.uid()
       OR NEW.professional_id IS DISTINCT FROM auth.uid()
     ) THEN
    RAISE EXCEPTION 'appointment_professional_self_transition_required' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_clinical_self_transition() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app_role text;
  allowed boolean := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  app_role := public.current_app_role();
  IF app_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- Entering or finishing care is always a clinical act, regardless of the
  -- actor's operational role. This prevents owner/admin role bypasses.
  IF NEW.status = 'em_atendimento' THEN
    allowed := OLD.status IN ('agendado', 'confirmado')
      AND public.current_user_has_clinical_capability('clinical.attend')
      AND auth.uid() IS NOT NULL
      AND OLD.professional_id = auth.uid()
      AND NEW.professional_id = auth.uid();
  ELSIF NEW.status = 'finalizado' THEN
    allowed := OLD.status = 'em_atendimento'
      AND public.current_user_has_clinical_capability('clinical.attend')
      AND auth.uid() IS NOT NULL
      AND OLD.professional_id = auth.uid()
      AND NEW.professional_id = auth.uid();
  ELSIF app_role IN ('owner', 'admin') THEN
    allowed := true;
  ELSIF app_role IN ('recep', 'professional') THEN
    allowed :=
      (OLD.status = 'agendado' AND NEW.status IN ('confirmado', 'faltou', 'cancelado'))
      OR (OLD.status = 'confirmado' AND NEW.status IN ('faltou', 'cancelado'));
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Transição de status não permitida para o perfil atual: % -> %', OLD.status, NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_status_transition() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_evolution_before_appointment_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'em_atendimento'
     OR NEW.status IS DISTINCT FROM 'finalizado' THEN
    RETURN NEW;
  END IF;

  IF public.current_app_role() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.current_user_has_clinical_capability('clinical.attend') IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.evolution.write') IS NOT TRUE
     OR auth.uid() IS NULL
     OR NEW.professional_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'clinical_finalize_self_authorship_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.physiotherapy_evolutions e
    WHERE e.session_id = NEW.id
      AND e.clinic_id = NEW.clinic_id
      AND e.patient_id = NEW.paciente_id
      AND e.professional_id = auth.uid()
      AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinical_evolution_required_before_finalize' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_evolution_before_appointment_finalize() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.require_evolution_before_appointment_finalize() IS
  'Finalization requires clinical.attend + clinical.evolution.write, self-authorship via appointments.professional_id and one active evolution for the same session.';

COMMIT;
