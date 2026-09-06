BEGIN;

CREATE OR REPLACE FUNCTION public.guard_patient_lgpd_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NEW.anonimizado IS DISTINCT FROM OLD.anonimizado THEN
      RAISE EXCEPTION 'Estado de anonimização só pode ser alterado pelo fluxo LGPD auditado' USING ERRCODE = '42501';
    END IF;

    IF OLD.anonimizado = true AND (
      NEW.nome IS DISTINCT FROM OLD.nome
      OR NEW.preferred_name IS DISTINCT FROM OLD.preferred_name
      OR NEW.cpf IS DISTINCT FROM OLD.cpf
      OR NEW.telefone IS DISTINCT FROM OLD.telefone
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.address_line IS DISTINCT FROM OLD.address_line
      OR NEW.convenio IS DISTINCT FROM OLD.convenio
      OR NEW.insurance_number IS DISTINCT FROM OLD.insurance_number
      OR NEW.administrative_notes IS DISTINCT FROM OLD.administrative_notes
      OR NEW.queixa_principal IS DISTINCT FROM OLD.queixa_principal
      OR NEW.cid10 IS DISTINCT FROM OLD.cid10
      OR NEW.anamnese IS DISTINCT FROM OLD.anamnese
      OR NEW.avatar_path IS DISTINCT FROM OLD.avatar_path
    ) THEN
      RAISE EXCEPTION 'Paciente anonimizado não pode ser reidentificado pelo fluxo operacional' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_patient_lgpd_state() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_patient_lgpd_state ON public.patients;
CREATE TRIGGER trg_guard_patient_lgpd_state
BEFORE UPDATE OF anonimizado, nome, preferred_name, cpf, telefone, email, address_line, convenio,
  insurance_number, administrative_notes, queixa_principal, cid10, anamnese, avatar_path
ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.guard_patient_lgpd_state();

CREATE OR REPLACE FUNCTION public.anonymize_patient_lgpd(p_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_updated integer := 0;
BEGIN
  IF auth.uid() IS NULL OR v_clinic IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão para anonimizar paciente' USING ERRCODE = '42501';
  END IF;

  UPDATE public.patients
  SET nome = 'Paciente Anonizado',
      preferred_name = NULL,
      cpf = NULL,
      telefone = NULL,
      email = NULL,
      address_line = NULL,
      convenio = NULL,
      insurance_number = NULL,
      administrative_notes = NULL,
      queixa_principal = NULL,
      cid10 = '{}',
      ultima_visita = NULL,
      avatar_path = NULL,
      opt_in_whats = false,
      status = 'inativo',
      anonimizado = true,
      anamnese = '{"historia":"","cirurgias":"","medicamentos":"","alergias":"","objetivo":""}'::jsonb,
      updated_at = now()
  WHERE id = p_patient_id
    AND clinic_id = v_clinic
    AND deleted_at IS NULL
    AND anonimizado = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Paciente elegível não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (
    v_clinic,
    auth.uid(),
    'ANONIMIZACAO_LGPD',
    format('paciente_id=%s; identificadores_diretos_e_cadastro_v2_removidos=true', p_patient_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_patient_lgpd(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_patient_lgpd(uuid) TO authenticated;

COMMENT ON FUNCTION public.guard_patient_lgpd_state() IS
  'Blocks browser-side spoofing of anonymization state and re-identification of anonymized patients.';
COMMENT ON FUNCTION public.anonymize_patient_lgpd(uuid) IS
  'Owner/admin-only audited LGPD anonymization covering legacy and patient registry v2 identifiers.';

COMMIT;
