-- MEDICSPRO — finance entitlement server-side enforcement
-- Rollout rule: unconfigured clinics remain allowed for backward compatibility;
-- explicitly configured finance.access must be effective.
-- This migration intentionally preserves internal service/trigger flows and
-- does not gate package consumption required by already-sold treatment plans.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_clinic_entitlement_allowed(
  p_entitlement_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_entitlement public.platform_clinic_entitlements%ROWTYPE;
BEGIN
  IF p_entitlement_key NOT IN (
    'nexus.access',
    'finance.access',
    'crm.access',
    'reports.access',
    'assessments.custom',
    'whatsapp.access'
  ) THEN
    RETURN false;
  END IF;

  v_clinic_id := public.current_clinic_id();
  IF v_clinic_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_entitlement
  FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = v_clinic_id
    AND e.entitlement_key = p_entitlement_key;

  -- Backward-compatible rollout: absence of explicit configuration is allowed.
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  RETURN v_entitlement.enabled = true
    AND (v_entitlement.starts_at IS NULL OR v_entitlement.starts_at <= now())
    AND (v_entitlement.expires_at IS NULL OR v_entitlement.expires_at > now());
END;
$$;

REVOKE ALL ON FUNCTION public.current_clinic_entitlement_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_clinic_entitlement_allowed(text) TO authenticated;

COMMENT ON FUNCTION public.current_clinic_entitlement_allowed(text) IS
  'Server-side entitlement predicate for the current clinic. Unconfigured remains allowed during controlled rollout.';

-- Payments: entitlement joins existing tenant + RBAC restrictions.
DROP POLICY IF EXISTS payments_select_tenant ON public.payments;
CREATE POLICY payments_select_tenant
ON public.payments FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_clinic_entitlement_allowed('finance.access')
  AND public.current_app_role() IN ('owner','admin','fisio','recep','financeiro')
);

DROP POLICY IF EXISTS payments_insert_financial ON public.payments;
CREATE POLICY payments_insert_financial
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_clinic_entitlement_allowed('finance.access')
  AND (
    public.current_app_role() IN ('owner','admin','financeiro')
    OR (public.current_app_role() = 'recep' AND tipo = 'receber')
  )
);

DROP POLICY IF EXISTS payments_update_financial ON public.payments;
CREATE POLICY payments_update_financial
ON public.payments FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_clinic_entitlement_allowed('finance.access')
  AND (
    public.current_app_role() IN ('owner','admin','financeiro')
    OR (public.current_app_role() = 'recep' AND tipo = 'receber')
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_clinic_entitlement_allowed('finance.access')
  AND (
    public.current_app_role() IN ('owner','admin','financeiro')
    OR (public.current_app_role() = 'recep' AND tipo = 'receber')
  )
);

DROP POLICY IF EXISTS payment_status_history_select_financial ON public.payment_status_history;
CREATE POLICY payment_status_history_select_financial
ON public.payment_status_history FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_clinic_entitlement_allowed('finance.access')
  AND public.current_app_role() IN ('owner','admin','recep','financeiro')
);

-- Financial package administration/sales are blocked when finance is disabled,
-- while historical package reads/consumption remain available to clinical flow.
CREATE OR REPLACE FUNCTION public.upsert_session_package(
  p_id uuid DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_sessoes integer DEFAULT NULL,
  p_preco integer DEFAULT NULL,
  p_validade_dias integer DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_ativo boolean DEFAULT true
)
RETURNS public.session_packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_row public.session_packages%ROWTYPE;
BEGIN
  IF v_clinic IS NULL
     OR NOT public.current_clinic_entitlement_allowed('finance.access')
     OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Perfil ou módulo sem permissão' USING ERRCODE='42501';
  END IF;
  IF coalesce(trim(p_nome),'') = '' OR coalesce(p_sessoes,0) <= 0 OR coalesce(p_preco,0) < 0 OR coalesce(p_validade_dias,0) <= 0 THEN
    RAISE EXCEPTION 'Dados do pacote inválidos';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.session_packages (clinic_id,nome,sessoes,preco,validade_dias,descricao,ativo,updated_at)
    VALUES (v_clinic,trim(p_nome),p_sessoes,p_preco,p_validade_dias,nullif(trim(p_descricao),''),coalesce(p_ativo,true),now())
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.session_packages
    SET nome=trim(p_nome), sessoes=p_sessoes, preco=p_preco, validade_dias=p_validade_dias,
        descricao=nullif(trim(p_descricao),''), ativo=coalesce(p_ativo,true), updated_at=now()
    WHERE id=p_id AND clinic_id=v_clinic
    RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado'; END IF;
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_session_package(uuid,text,integer,integer,integer,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_session_package(uuid,text,integer,integer,integer,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.sell_session_package(
  p_patient_id uuid,
  p_package_id uuid,
  p_due_date date DEFAULT current_date,
  p_payment_status text DEFAULT 'pendente',
  p_payment_method text DEFAULT NULL,
  p_renewed_from_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_package public.session_packages%ROWTYPE;
  v_patient_package public.patient_packages%ROWTYPE;
  v_payment public.payments%ROWTYPE;
BEGIN
  IF v_clinic IS NULL
     OR NOT public.current_clinic_entitlement_allowed('finance.access')
     OR v_role NOT IN ('owner','admin','recep','financeiro') THEN
    RAISE EXCEPTION 'Perfil ou módulo sem permissão' USING ERRCODE='42501';
  END IF;
  IF p_payment_status NOT IN ('pendente','pago') THEN RAISE EXCEPTION 'Status financeiro inválido'; END IF;
  IF p_payment_method IS NOT NULL AND p_payment_method NOT IN ('pix','cartao','dinheiro','boleto') THEN
    RAISE EXCEPTION 'Método financeiro inválido';
  END IF;
  IF p_payment_status='pago' AND p_payment_method IS NULL THEN
    RAISE EXCEPTION 'Método obrigatório para pagamento já liquidado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id=p_patient_id AND clinic_id=v_clinic AND deleted_at IS NULL AND anonimizado=false
  ) THEN RAISE EXCEPTION 'Paciente inválido'; END IF;

  SELECT * INTO v_package
  FROM public.session_packages
  WHERE id=p_package_id AND clinic_id=v_clinic AND ativo=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pacote indisponível'; END IF;

  IF p_renewed_from_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patient_packages
    WHERE id=p_renewed_from_id AND clinic_id=v_clinic AND patient_id=p_patient_id
  ) THEN RAISE EXCEPTION 'Pacote anterior inválido'; END IF;

  INSERT INTO public.payments (
    clinic_id, patient_id, tipo, descricao, categoria, valor, vencimento, status, metodo
  ) VALUES (
    v_clinic, p_patient_id, 'receber', 'Pacote: ' || v_package.nome, 'Pacote de sessões',
    v_package.preco, coalesce(p_due_date,current_date), p_payment_status,
    CASE WHEN p_payment_status='pago' THEN p_payment_method ELSE NULL END
  ) RETURNING * INTO v_payment;

  INSERT INTO public.patient_packages (
    clinic_id, patient_id, package_id, sessoes_totais, sessoes_usadas,
    compra_data, validade_ate, valor_pago, status, payment_id, renewed_from_id, updated_at
  ) VALUES (
    v_clinic, p_patient_id, v_package.id, v_package.sessoes, 0,
    current_date, current_date + v_package.validade_dias,
    CASE WHEN p_payment_status='pago' THEN v_package.preco ELSE 0 END,
    'ativo', v_payment.id, p_renewed_from_id, now()
  ) RETURNING * INTO v_patient_package;

  RETURN jsonb_build_object(
    'patient_package_id', v_patient_package.id,
    'payment_id', v_payment.id,
    'package_id', v_package.id,
    'sessions', v_package.sessoes,
    'amount', v_package.preco,
    'valid_until', v_patient_package.validade_ate,
    'renewal', p_renewed_from_id IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sell_session_package(uuid,uuid,date,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_session_package(uuid,uuid,date,text,text,uuid) TO authenticated;

COMMIT;
