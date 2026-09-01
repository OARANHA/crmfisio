-- MedicsPro — corrige aceite e renderiza dados reais no consentimento
BEGIN;

-- O snapshot passa a carregar uma identificação gerada pelo sistema e também
-- aceita placeholders explícitos no modelo, sem alterar o texto-base versionado.
CREATE OR REPLACE FUNCTION public.create_patient_consent(
  p_patient_id uuid,
  p_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_template public.consent_templates%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_eval record;
  v_body text;
  v_header text;
  v_id uuid;
BEGIN
  IF v_role NOT IN ('owner','admin','fisio','recep') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_patient
  FROM public.patients
  WHERE id = p_patient_id
    AND clinic_id = v_clinic
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'patient outside tenant';
  END IF;

  SELECT * INTO v_template
  FROM public.consent_templates
  WHERE id = p_template_id
    AND clinic_id = v_clinic
    AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent template unavailable';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid()
    AND clinic_id = v_clinic;

  SELECT pe.objetivos, pe.plano_terapeutico
  INTO v_eval
  FROM public.physiotherapy_evaluations pe
  WHERE pe.patient_id = p_patient_id
    AND pe.clinic_id = v_clinic
  ORDER BY pe.data DESC, pe.created_at DESC
  LIMIT 1;

  v_body := v_template.conteudo;

  -- Placeholders opcionais para modelos personalizados.
  v_body := replace(v_body, '{{PACIENTE_NOME}}', COALESCE(v_patient.nome, ''));
  v_body := replace(v_body, '{{PACIENTE_CPF}}', COALESCE(v_patient.cpf, ''));
  v_body := replace(v_body, '{{PACIENTE_NASCIMENTO}}', COALESCE(to_char(v_patient.nascimento, 'DD/MM/YYYY'), ''));
  v_body := replace(v_body, '{{PACIENTE_TELEFONE}}', COALESCE(v_patient.telefone, ''));
  v_body := replace(v_body, '{{PACIENTE_EMAIL}}', COALESCE(v_patient.email, ''));
  v_body := replace(v_body, '{{QUEIXA_PRINCIPAL}}', COALESCE(v_patient.queixa_principal, ''));
  v_body := replace(v_body, '{{CID10}}', COALESCE(array_to_string(v_patient.cid10, ', '), ''));
  v_body := replace(v_body, '{{OBJETIVOS_TERAPEUTICOS}}', COALESCE(v_eval.objetivos, ''));
  v_body := replace(v_body, '{{PLANO_TERAPEUTICO}}', COALESCE(v_eval.plano_terapeutico, ''));
  v_body := replace(v_body, '{{PROFISSIONAL_NOME}}', COALESCE(v_profile.nome, ''));
  v_body := replace(v_body, '{{PROFISSIONAL_REGISTRO}}', COALESCE(v_profile.registro, ''));
  v_body := replace(v_body, '{{DATA_ATUAL}}', to_char(CURRENT_DATE, 'DD/MM/YYYY'));

  -- Sempre inclui identificação real no snapshot, mesmo em modelos antigos
  -- que foram cadastrados com linhas em branco em vez de placeholders.
  v_header := concat_ws(E'\n',
    'DADOS VINCULADOS PELO MEDICSPRO',
    'Paciente: ' || COALESCE(v_patient.nome, 'Não informado'),
    'CPF: ' || COALESCE(NULLIF(v_patient.cpf, ''), 'Não informado'),
    'Nascimento: ' || COALESCE(to_char(v_patient.nascimento, 'DD/MM/YYYY'), 'Não informado'),
    'Telefone: ' || COALESCE(NULLIF(v_patient.telefone, ''), 'Não informado'),
    'E-mail: ' || COALESCE(NULLIF(v_patient.email, ''), 'Não informado'),
    'Condição/queixa: ' || COALESCE(NULLIF(v_patient.queixa_principal, ''), 'Não informado'),
    'CID-10: ' || COALESCE(NULLIF(array_to_string(v_patient.cid10, ', '), ''), 'Não informado'),
    'Objetivos terapêuticos: ' || COALESCE(NULLIF(v_eval.objetivos, ''), 'Não informado'),
    'Plano terapêutico: ' || COALESCE(NULLIF(v_eval.plano_terapeutico, ''), 'Não informado'),
    'Profissional responsável pela coleta: ' || COALESCE(v_profile.nome, 'Não informado'),
    'Registro profissional: ' || COALESCE(NULLIF(v_profile.registro, ''), 'Não informado'),
    'Data de geração: ' || to_char(CURRENT_DATE, 'DD/MM/YYYY')
  );

  INSERT INTO public.consent_terms (
    clinic_id, patient_id, nome, versao, assinado,
    template_id, conteudo_snapshot
  ) VALUES (
    v_clinic, p_patient_id, v_template.nome, v_template.versao, false,
    v_template.id, v_header || E'\n\n' || v_body
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_patient_consent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_patient_consent(uuid, uuid) TO authenticated;

-- Corrige o aceite para funcionar independentemente do tipo físico da coluna IP.
-- Quando o frontend não envia IP, preservamos o valor existente e registramos
-- usuário, data/hora e user-agent.
CREATE OR REPLACE FUNCTION public.accept_patient_consent(
  p_consent_id uuid,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_ip_type text;
BEGIN
  IF v_role NOT IN ('owner','admin','fisio','recep') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- A coluna ip pode ser text ou inet dependendo da versão inicial do schema.
  SELECT data_type INTO v_ip_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'consent_terms'
    AND column_name = 'ip';

  IF p_ip IS NULL OR btrim(p_ip) = '' THEN
    UPDATE public.consent_terms
    SET assinado = true,
        data_assinatura = now(),
        accepted_by = auth.uid(),
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = p_consent_id
      AND clinic_id = v_clinic
      AND assinado = false;
  ELSIF v_ip_type = 'inet' THEN
    EXECUTE $q$
      UPDATE public.consent_terms
      SET assinado = true,
          data_assinatura = now(),
          accepted_by = auth.uid(),
          ip = $1::inet,
          user_agent = COALESCE($2, user_agent)
      WHERE id = $3
        AND clinic_id = $4
        AND assinado = false
    $q$ USING p_ip, p_user_agent, p_consent_id, v_clinic;
  ELSE
    UPDATE public.consent_terms
    SET assinado = true,
        data_assinatura = now(),
        accepted_by = auth.uid(),
        ip = p_ip,
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = p_consent_id
      AND clinic_id = v_clinic
      AND assinado = false;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent unavailable or already accepted';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_patient_consent(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_patient_consent(uuid, text, text) TO authenticated;

COMMIT;
