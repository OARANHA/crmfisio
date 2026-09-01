-- MedicsPro — Clinical workflow hardening
-- Safe, idempotent migration for the premium clinical workspace.
-- Ensures clinical records inherit the authenticated user's clinic_id
-- and cannot be attributed to a professional from another clinic.

BEGIN;

CREATE OR REPLACE FUNCTION public.fill_clinical_tenant_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT p.clinic_id
    INTO v_clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo = true
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado sem clínica ativa';
  END IF;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_clinic_id;
  ELSIF NEW.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'clinic_id incompatível com o usuário autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles professional
    WHERE professional.id = NEW.professional_id
      AND professional.clinic_id = v_clinic_id
      AND professional.ativo = true
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para esta clínica';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluations_tenant_context ON public.physiotherapy_evaluations;
CREATE TRIGGER trg_evaluations_tenant_context
BEFORE INSERT OR UPDATE OF clinic_id, professional_id
ON public.physiotherapy_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.fill_clinical_tenant_context();

DROP TRIGGER IF EXISTS trg_evolutions_tenant_context ON public.physiotherapy_evolutions;
CREATE TRIGGER trg_evolutions_tenant_context
BEFORE INSERT OR UPDATE OF clinic_id, professional_id
ON public.physiotherapy_evolutions
FOR EACH ROW
EXECUTE FUNCTION public.fill_clinical_tenant_context();

-- Prevent two clinical evolutions for the same session. This keeps the
-- session/evolution relationship deterministic for automation and future AI.
CREATE UNIQUE INDEX IF NOT EXISTS uq_evolution_active_session
ON public.physiotherapy_evolutions(session_id)
WHERE session_id IS NOT NULL AND deleted_at IS NULL;

-- Helpful indexes for longitudinal clinical views.
CREATE INDEX IF NOT EXISTS idx_evaluations_patient_data
ON public.physiotherapy_evaluations(patient_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_evolutions_patient_created
ON public.physiotherapy_evolutions(patient_id, created_at DESC)
WHERE deleted_at IS NULL;

COMMIT;
