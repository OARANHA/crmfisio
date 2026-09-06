BEGIN;

CREATE OR REPLACE FUNCTION public.guard_patient_deleted_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Exclusão lógica de paciente só pode ser alterada pelo fluxo auditado' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_patient_deleted_state() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_patient_deleted_state ON public.patients;
CREATE TRIGGER trg_guard_patient_deleted_state
BEFORE UPDATE OF deleted_at ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.guard_patient_deleted_state();

CREATE OR REPLACE FUNCTION public.soft_delete_patient(
  p_patient_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_reason text := nullif(trim(p_reason), '');
  v_updated integer := 0;
BEGIN
  IF auth.uid() IS NULL OR v_clinic IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão para excluir paciente' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Motivo da exclusão lógica é obrigatório' USING ERRCODE = '22023';
  END IF;

  UPDATE public.patients
  SET deleted_at = now(),
      status = 'inativo',
      opt_in_whats = false,
      updated_at = now()
  WHERE id = p_patient_id
    AND clinic_id = v_clinic
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Paciente elegível não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (
    v_clinic,
    auth.uid(),
    'EXCLUSAO_LOGICA_PACIENTE',
    jsonb_build_object('patient_id', p_patient_id, 'reason', v_reason)::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_soft_deleted_patient(
  p_patient_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_reason text := nullif(trim(p_reason), '');
  v_updated integer := 0;
BEGIN
  IF auth.uid() IS NULL OR v_clinic IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão para restaurar paciente' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Motivo da restauração é obrigatório' USING ERRCODE = '22023';
  END IF;

  UPDATE public.patients
  SET deleted_at = NULL,
      updated_at = now()
  WHERE id = p_patient_id
    AND clinic_id = v_clinic
    AND deleted_at IS NOT NULL
    AND anonimizado = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Paciente excluído elegível não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (
    v_clinic,
    auth.uid(),
    'RESTAURACAO_PACIENTE',
    jsonb_build_object('patient_id', p_patient_id, 'reason', v_reason)::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_patient(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_soft_deleted_patient(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_patient(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_soft_deleted_patient(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.guard_patient_deleted_state() IS
  'Blocks browser-side changes to patients.deleted_at; soft-delete lifecycle must use audited RPCs.';
COMMENT ON FUNCTION public.soft_delete_patient(uuid, text) IS
  'Owner/admin-only tenant-scoped audited logical deletion of a patient.';
COMMENT ON FUNCTION public.restore_soft_deleted_patient(uuid, text) IS
  'Owner/admin-only tenant-scoped audited restoration of a non-anonymized soft-deleted patient.';

COMMIT;
