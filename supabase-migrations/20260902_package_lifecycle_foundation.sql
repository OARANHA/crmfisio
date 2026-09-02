-- MEDICSPRO — fundação de pacotes, renovação e consumo auditável
BEGIN;

-- O catálogo e os pacotes comprados já existem no core. Esta migration os
-- transforma em um domínio operacional sem criar estruturas paralelas.
ALTER TABLE public.session_packages
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.patient_packages
  ADD COLUMN IF NOT EXISTS validade_ate date,
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS renewed_from_id uuid REFERENCES public.patient_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exhausted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.patient_packages pp
SET validade_ate = pp.compra_data + sp.validade_dias
FROM public.session_packages sp
WHERE sp.id = pp.package_id
  AND sp.clinic_id = pp.clinic_id
  AND pp.validade_ate IS NULL;

CREATE INDEX IF NOT EXISTS session_packages_active_idx
  ON public.session_packages (clinic_id, ativo, nome);
CREATE INDEX IF NOT EXISTS patient_packages_health_idx
  ON public.patient_packages (clinic_id, status, validade_ate, patient_id);
CREATE INDEX IF NOT EXISTS patient_packages_renewed_from_idx
  ON public.patient_packages (clinic_id, renewed_from_id)
  WHERE renewed_from_id IS NOT NULL;

-- Ledger: uma sessão finalizada pode consumir no máximo uma unidade do pacote.
CREATE TABLE IF NOT EXISTS public.package_session_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_package_id uuid NOT NULL REFERENCES public.patient_packages(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

CREATE INDEX IF NOT EXISTS package_session_usage_package_idx
  ON public.package_session_usage (clinic_id, patient_package_id, consumed_at DESC);

ALTER TABLE public.package_session_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS package_session_usage_select_tenant ON public.package_session_usage;
CREATE POLICY package_session_usage_select_tenant
ON public.package_session_usage
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

REVOKE ALL ON public.package_session_usage FROM PUBLIC;
GRANT SELECT ON public.package_session_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_session_usage TO service_role;

-- Mantém saldo/status derivados do ledger e da validade, evitando contadores soltos.
CREATE OR REPLACE FUNCTION public.refresh_patient_package_state(p_patient_package_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
BEGIN
  SELECT count(*)::integer INTO v_used
  FROM public.package_session_usage
  WHERE patient_package_id = p_patient_package_id;

  UPDATE public.patient_packages
  SET sessoes_usadas = least(sessoes_totais, coalesce(v_used,0)),
      status = CASE
        WHEN validade_ate IS NOT NULL AND validade_ate < current_date THEN 'vencido'
        WHEN coalesce(v_used,0) >= sessoes_totais THEN 'esgotado'
        ELSE 'ativo'
      END,
      exhausted_at = CASE
        WHEN coalesce(v_used,0) >= sessoes_totais THEN coalesce(exhausted_at, now())
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = p_patient_package_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_patient_package_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_patient_package_state(uuid) TO service_role;

-- Consome/reverte saldo quando uma sessão vinculada muda para/de finalizado.
-- pacote_id é tratado como patient_packages.id; referências legadas a catálogo
-- são ignoradas com segurança até serem normalizadas.
CREATE OR REPLACE FUNCTION public.sync_appointment_package_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_package uuid;
  v_new_package uuid;
BEGIN
  v_old_package := CASE WHEN TG_OP = 'UPDATE' THEN OLD.pacote_id ELSE NULL END;
  v_new_package := NEW.pacote_id;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'finalizado'
     AND (NEW.status <> 'finalizado' OR OLD.pacote_id IS DISTINCT FROM NEW.pacote_id)
     AND v_old_package IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.patient_packages p
       WHERE p.id = v_old_package AND p.clinic_id = OLD.clinic_id AND p.patient_id = OLD.paciente_id
     ) THEN
    DELETE FROM public.package_session_usage
    WHERE appointment_id = OLD.id AND patient_package_id = v_old_package;
    PERFORM public.refresh_patient_package_state(v_old_package);
  END IF;

  IF NEW.status = 'finalizado'
     AND v_new_package IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.patient_packages p
       WHERE p.id = v_new_package
         AND p.clinic_id = NEW.clinic_id
         AND p.patient_id = NEW.paciente_id
         AND p.status IN ('ativo','esgotado')
     ) THEN
    INSERT INTO public.package_session_usage (clinic_id, patient_package_id, appointment_id)
    VALUES (NEW.clinic_id, v_new_package, NEW.id)
    ON CONFLICT (appointment_id) DO UPDATE
      SET patient_package_id = EXCLUDED.patient_package_id,
          clinic_id = EXCLUDED.clinic_id,
          consumed_at = now();
    PERFORM public.refresh_patient_package_state(v_new_package);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_package_usage ON public.appointments;
CREATE TRIGGER trg_sync_appointment_package_usage
AFTER INSERT OR UPDATE OF status, pacote_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_package_usage();

REVOKE ALL ON FUNCTION public.sync_appointment_package_usage() FROM PUBLIC;

-- Catálogo administrável pela própria clínica.
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
  IF v_clinic IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
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

-- Venda/renovação transacional: cria o pacote do paciente e o recebível juntos.
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
  IF v_clinic IS NULL OR v_role NOT IN ('owner','admin','recep','financeiro') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
  END IF;
  IF p_payment_status NOT IN ('pendente','pago') THEN RAISE EXCEPTION 'Status financeiro inválido'; END IF;
  IF p_payment_method IS NOT NULL AND p_payment_method NOT IN ('pix','cartao','dinheiro','boleto') THEN
    RAISE EXCEPTION 'Método financeiro inválido';
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

-- Quando o recebível associado é quitado, consolida o valor efetivamente pago.
CREATE OR REPLACE FUNCTION public.sync_patient_package_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo='receber' AND NEW.status='pago' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.patient_packages
    SET valor_pago=NEW.valor, updated_at=now()
    WHERE payment_id=NEW.id AND clinic_id=NEW.clinic_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_patient_package_payment ON public.payments;
CREATE TRIGGER trg_sync_patient_package_payment
AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.sync_patient_package_payment();
REVOKE ALL ON FUNCTION public.sync_patient_package_payment() FROM PUBLIC;

-- Expira pacotes vencidos e devolve candidatos de renovação/churn para a UI.
CREATE OR REPLACE FUNCTION public.get_package_renewal_candidates(
  p_remaining_threshold integer DEFAULT 2,
  p_expiry_days integer DEFAULT 15
)
RETURNS TABLE (
  patient_package_id uuid,
  patient_id uuid,
  patient_name text,
  package_id uuid,
  package_name text,
  sessions_total integer,
  sessions_used integer,
  sessions_remaining integer,
  valid_until date,
  days_to_expiry integer,
  risk_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
BEGIN
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='42501'; END IF;

  UPDATE public.patient_packages
  SET status='vencido', updated_at=now()
  WHERE clinic_id=v_clinic AND status='ativo' AND validade_ate IS NOT NULL AND validade_ate < current_date;

  RETURN QUERY
  SELECT pp.id, pp.patient_id, p.nome, pp.package_id, sp.nome,
         pp.sessoes_totais, pp.sessoes_usadas,
         greatest(pp.sessoes_totais-pp.sessoes_usadas,0),
         pp.validade_ate,
         CASE WHEN pp.validade_ate IS NULL THEN NULL ELSE (pp.validade_ate-current_date)::integer END,
         CASE
           WHEN pp.status='vencido' THEN 'vencido'
           WHEN greatest(pp.sessoes_totais-pp.sessoes_usadas,0) <= greatest(0,p_remaining_threshold) THEN 'saldo_baixo'
           WHEN pp.validade_ate IS NOT NULL AND pp.validade_ate <= current_date + greatest(0,p_expiry_days) THEN 'validade_proxima'
           ELSE 'continuidade'
         END
  FROM public.patient_packages pp
  JOIN public.patients p ON p.id=pp.patient_id AND p.clinic_id=pp.clinic_id
  JOIN public.session_packages sp ON sp.id=pp.package_id AND sp.clinic_id=pp.clinic_id
  WHERE pp.clinic_id=v_clinic
    AND p.deleted_at IS NULL
    AND p.anonimizado=false
    AND p.status <> 'alta'
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_packages newer
      WHERE newer.clinic_id=pp.clinic_id
        AND newer.patient_id=pp.patient_id
        AND newer.id<>pp.id
        AND newer.created_at>pp.created_at
        AND newer.status='ativo'
    )
    AND (
      pp.status IN ('esgotado','vencido')
      OR greatest(pp.sessoes_totais-pp.sessoes_usadas,0) <= greatest(0,p_remaining_threshold)
      OR (pp.validade_ate IS NOT NULL AND pp.validade_ate <= current_date + greatest(0,p_expiry_days))
    )
  ORDER BY
    CASE WHEN pp.status IN ('esgotado','vencido') THEN 0 ELSE 1 END,
    greatest(pp.sessoes_totais-pp.sessoes_usadas,0),
    pp.validade_ate NULLS LAST,
    p.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.get_package_renewal_candidates(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_package_renewal_candidates(integer,integer) TO authenticated;

COMMIT;
