-- MEDICSPRO — exportação LGPD server-authoritative
-- A portabilidade não pode depender de providers/estado já carregado no browser.

BEGIN;

CREATE OR REPLACE FUNCTION public.export_patient_data_lgpd(p_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_actor_name text;
  v_patient jsonb;
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_clinic IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão para exportar dados do titular'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.nome
    INTO v_actor_name
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.clinic_id = v_clinic
    AND p.ativo IS TRUE;

  SELECT to_jsonb(p)
    INTO v_patient
  FROM public.patients p
  WHERE p.id = p_patient_id
    AND p.clinic_id = v_clinic
    AND p.deleted_at IS NULL;

  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'formato', 'LGPD-portabilidade-v2',
    'serverAuthoritative', true,
    'exportadoEm', now(),
    'exportadoPor', coalesce(v_actor_name, auth.uid()::text),
    'titular', v_patient,

    'sessoes', coalesce((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.data, a.inicio, a.created_at)
      FROM public.appointments a
      WHERE a.clinic_id = v_clinic
        AND a.paciente_id = p_patient_id
    ), '[]'::jsonb),

    'historicoSessoes', coalesce((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.changed_at)
      FROM public.appointment_status_history h
      JOIN public.appointments a
        ON a.id = h.appointment_id
       AND a.clinic_id = h.clinic_id
      WHERE h.clinic_id = v_clinic
        AND a.paciente_id = p_patient_id
    ), '[]'::jsonb),

    'avaliacoesFisioterapeuticas', coalesce((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.data, e.created_at)
      FROM public.physiotherapy_evaluations e
      WHERE e.clinic_id = v_clinic
        AND e.patient_id = p_patient_id
    ), '[]'::jsonb),

    'evolucoes', coalesce((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at)
      FROM public.physiotherapy_evolutions e
      WHERE e.clinic_id = v_clinic
        AND e.patient_id = p_patient_id
    ), '[]'::jsonb),

    'consentimentos', coalesce((
      SELECT jsonb_agg((to_jsonb(c) - 'assinatura_url') ORDER BY c.created_at)
      FROM public.consent_terms c
      WHERE c.clinic_id = v_clinic
        AND c.patient_id = p_patient_id
    ), '[]'::jsonb),

    'pesquisas', coalesce((
      SELECT jsonb_agg(to_jsonb(n) ORDER BY n.data, n.created_at)
      FROM public.nps_surveys n
      WHERE n.clinic_id = v_clinic
        AND n.patient_id = p_patient_id
    ), '[]'::jsonb),

    'pacotes', coalesce((
      SELECT jsonb_agg(to_jsonb(pp) ORDER BY pp.created_at)
      FROM public.patient_packages pp
      WHERE pp.clinic_id = v_clinic
        AND pp.patient_id = p_patient_id
    ), '[]'::jsonb),

    'financeiro', coalesce((
      SELECT jsonb_agg(to_jsonb(pay) ORDER BY pay.created_at)
      FROM public.payments pay
      WHERE pay.clinic_id = v_clinic
        AND pay.patient_id = p_patient_id
    ), '[]'::jsonb),

    'comunicacoes', coalesce((
      SELECT jsonb_agg(to_jsonb(w) ORDER BY w.created_at)
      FROM public.wa_logs w
      WHERE w.clinic_id = v_clinic
        AND w.patient_id = p_patient_id
    ), '[]'::jsonb),

    'avaliacoesClinicas', coalesce((
      SELECT jsonb_agg(to_jsonb(ca) ORDER BY ca.created_at)
      FROM public.clinical_assessments ca
      WHERE ca.clinic_id = v_clinic
        AND ca.patient_id = p_patient_id
    ), '[]'::jsonb),

    'mapaCorporal', coalesce((
      SELECT jsonb_agg(to_jsonb(bp) ORDER BY bp.created_at)
      FROM public.assessment_body_points bp
      JOIN public.clinical_assessments ca
        ON ca.id = bp.assessment_id
       AND ca.clinic_id = bp.clinic_id
      WHERE bp.clinic_id = v_clinic
        AND ca.patient_id = p_patient_id
    ), '[]'::jsonb),

    'nexusResultados', coalesce((
      SELECT jsonb_agg(to_jsonb(nr) ORDER BY nr.created_at)
      FROM public.nexus_clinical_results nr
      WHERE nr.clinic_id = v_clinic
        AND nr.patient_id = p_patient_id
    ), '[]'::jsonb),

    'nexusRedFlags', coalesce((
      SELECT jsonb_agg(to_jsonb(rf) ORDER BY rf.created_at)
      FROM public.nexus_red_flags rf
      WHERE rf.clinic_id = v_clinic
        AND rf.patient_id = p_patient_id
    ), '[]'::jsonb),

    'nexusAutoavaliacoes', coalesce((
      SELECT jsonb_agg(
        (to_jsonb(si) - 'token_hash')
        ORDER BY si.created_at
      )
      FROM public.nexus_self_assessment_invites si
      WHERE si.clinic_id = v_clinic
        AND si.patient_id = p_patient_id
    ), '[]'::jsonb)
  ) INTO v_payload;

  -- A geração do pacote e a trilha de auditoria pertencem à mesma transação.
  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (
    v_clinic,
    auth.uid(),
    'EXPORTACAO_LGPD',
    format(
      'paciente_id=%s; formato=JSON; contrato=LGPD-portabilidade-v2; server_authoritative=true',
      p_patient_id
    )
  );

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.export_patient_data_lgpd(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_patient_data_lgpd(uuid) TO authenticated;

COMMENT ON FUNCTION public.export_patient_data_lgpd(uuid) IS
  'Gera exportação LGPD server-authoritative tenant-safe e registra auditoria na mesma transação.';

COMMIT;
