-- MEDICSPRO — ações LGPD autorizadas e auditadas no banco
BEGIN;

CREATE OR REPLACE FUNCTION public.log_patient_data_export(p_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF auth.uid() IS NULL OR v_clinic IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão para exportar dados do titular' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND clinic_id = v_clinic AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Paciente não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (v_clinic, auth.uid(), 'EXPORTACAO_LGPD', format('paciente_id=%s; formato=JSON', p_patient_id));
END;
$$;

REVOKE ALL ON FUNCTION public.log_patient_data_export(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_patient_data_export(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.anonymize_patient_lgpd(p_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  SET nome = 'Paciente Anonizado', cpf = NULL, telefone = NULL, email = NULL,
      queixa_principal = NULL, convenio = NULL, cid10 = '{}', ultima_visita = NULL,
      opt_in_whats = false, status = 'inativo', anonimizado = true,
      anamnese = '{"historia":"","cirurgias":"","medicamentos":"","alergias":"","objetivo":""}'::jsonb,
      updated_at = now()
  WHERE id = p_patient_id AND clinic_id = v_clinic
    AND deleted_at IS NULL AND anonimizado = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Paciente elegível não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (v_clinic, auth.uid(), 'ANONIMIZACAO_LGPD', format('paciente_id=%s; identificadores_diretos_removidos=true', p_patient_id));
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_patient_lgpd(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_patient_lgpd(uuid) TO authenticated;

COMMIT;
