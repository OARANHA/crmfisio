-- Extends the canonical #387 authorization fixture with the pre-slice financial
-- package contract. The appointments below intentionally include legacy
-- overbooking so the old production failure can be reproduced before migration.

ALTER ROLE service_role BYPASSRLS;

INSERT INTO public.test_entitlements(clinic_id, feature_key, allowed) VALUES
  ('00000000-0000-0000-0000-000000000001', 'finance.access', true),
  ('00000000-0000-0000-0000-000000000002', 'finance.access', true)
ON CONFLICT (clinic_id, feature_key) DO UPDATE SET allowed = excluded.allowed;

INSERT INTO public.profiles(id, clinic_id, role, ativo)
VALUES ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'financeiro', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.session_packages (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  nome text NOT NULL,
  sessoes integer NOT NULL,
  preco integer NOT NULL,
  validade_dias integer NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_packages (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  package_id uuid NOT NULL REFERENCES public.session_packages(id),
  sessoes_totais integer NOT NULL,
  sessoes_usadas integer NOT NULL DEFAULT 0,
  compra_data date NOT NULL,
  validade_ate date,
  valor_pago integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','esgotado','vencido')),
  exhausted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid REFERENCES public.patients(id),
  appointment_id uuid REFERENCES public.appointments(id),
  tipo text NOT NULL CHECK (tipo IN ('receber','pagar')),
  descricao text NOT NULL,
  categoria text NOT NULL,
  valor integer NOT NULL,
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado')),
  metodo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payments_appointment_receivable_uidx
  ON public.payments (clinic_id, appointment_id)
  WHERE tipo = 'receber' AND appointment_id IS NOT NULL;

CREATE TABLE public.package_session_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_package_id uuid NOT NULL REFERENCES public.patient_packages(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_session_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_packages_select_tenant ON public.patient_packages
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY payments_select_financial ON public.payments
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY package_session_usage_select_tenant ON public.package_session_usage
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

REVOKE ALL ON public.patient_packages, public.payments, public.package_session_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_packages, public.payments, public.package_session_usage TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_session_usage TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.payments TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_patient_package_status(p_patient_package_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.patient_packages
  SET status = CASE
        WHEN validade_ate IS NOT NULL AND validade_ate < current_date THEN 'vencido'
        WHEN sessoes_usadas >= sessoes_totais THEN 'esgotado'
        ELSE 'ativo'
      END,
      exhausted_at = CASE
        WHEN sessoes_usadas >= sessoes_totais THEN coalesce(exhausted_at, now())
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = p_patient_package_id;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_patient_package_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_patient_package_status(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_payment_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_role text := public.current_app_role();
BEGIN
  IF NEW.valor <= 0 THEN RAISE EXCEPTION 'Valor financeiro deve ser positivo'; END IF;
  IF NEW.status = 'pago' AND NEW.metodo IS NULL THEN
    RAISE EXCEPTION 'Método é obrigatório para liquidar um lançamento';
  END IF;
  IF TG_OP = 'UPDATE' AND v_role IS NOT NULL AND OLD.status = 'pago' AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.valor IS DISTINCT FROM OLD.valor
    OR NEW.tipo IS DISTINCT FROM OLD.tipo
    OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
    OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
  ) THEN
    RAISE EXCEPTION 'Lançamento liquidado é imutável; registre uma correção auditável'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_payment_integrity
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_integrity();
REVOKE ALL ON FUNCTION public.guard_payment_integrity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_finalized_appointment_receivable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'finalizado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.valor > 0
     AND NEW.pacote_id IS NULL THEN
    INSERT INTO public.payments (
      clinic_id, patient_id, appointment_id, tipo, descricao, categoria,
      valor, vencimento, status, metodo
    ) VALUES (
      NEW.clinic_id, NEW.paciente_id, NEW.id, 'receber',
      'Atendimento: ' || NEW.tipo, 'Atendimento avulso',
      NEW.valor, NEW.data, 'pendente', NULL
    ) ON CONFLICT (clinic_id, appointment_id)
      WHERE tipo = 'receber' AND appointment_id IS NOT NULL
      DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_create_finalized_appointment_receivable
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.create_finalized_appointment_receivable();
REVOKE ALL ON FUNCTION public.create_finalized_appointment_receivable() FROM PUBLIC, anon, authenticated;

-- Effective production behavior before this slice: package business failures
-- raise from the AFTER trigger and roll back the clinically valid status update.
CREATE OR REPLACE FUNCTION public.sync_appointment_package_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_package uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.pacote_id ELSE NULL END;
  v_new_package uuid := NEW.pacote_id;
  v_usage_id uuid;
  v_package public.patient_packages%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'finalizado'
     AND NEW.status = 'finalizado'
     AND OLD.pacote_id IS NOT DISTINCT FROM NEW.pacote_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'finalizado'
     AND (NEW.status <> 'finalizado' OR OLD.pacote_id IS DISTINCT FROM NEW.pacote_id)
     AND v_old_package IS NOT NULL THEN
    PERFORM 1 FROM public.patient_packages WHERE id = v_old_package FOR UPDATE;
    DELETE FROM public.package_session_usage
    WHERE appointment_id = OLD.id AND patient_package_id = v_old_package
    RETURNING id INTO v_usage_id;
    IF v_usage_id IS NOT NULL THEN
      UPDATE public.patient_packages
      SET sessoes_usadas = greatest(0, sessoes_usadas - 1), updated_at = now()
      WHERE id = v_old_package;
      PERFORM public.refresh_patient_package_status(v_old_package);
    END IF;
  END IF;

  IF NEW.status = 'finalizado' AND v_new_package IS NOT NULL THEN
    SELECT * INTO v_package
    FROM public.patient_packages
    WHERE id = v_new_package
      AND clinic_id = NEW.clinic_id
      AND patient_id = NEW.paciente_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Pacote do paciente inválido'; END IF;
    IF v_package.status <> 'ativo'
       OR (v_package.validade_ate IS NOT NULL AND v_package.validade_ate < NEW.data)
       OR v_package.sessoes_usadas >= v_package.sessoes_totais THEN
      RAISE EXCEPTION 'Pacote sem saldo ou fora da validade';
    END IF;

    v_usage_id := NULL;
    INSERT INTO public.package_session_usage (clinic_id, patient_package_id, appointment_id)
    VALUES (NEW.clinic_id, v_new_package, NEW.id)
    ON CONFLICT (appointment_id) DO NOTHING
    RETURNING id INTO v_usage_id;

    IF v_usage_id IS NOT NULL THEN
      UPDATE public.patient_packages
      SET sessoes_usadas = sessoes_usadas + 1, updated_at = now()
      WHERE id = v_new_package;
      PERFORM public.refresh_patient_package_status(v_new_package);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sync_appointment_package_usage
AFTER INSERT OR UPDATE OF status, pacote_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_package_usage();
REVOKE ALL ON FUNCTION public.sync_appointment_package_usage() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_finalized_appointment_financial_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_jwt_role text := coalesce(auth.role(), '');
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF v_jwt_role = 'service_role'
     OR (v_jwt_role = '' AND session_user IN ('postgres','supabase_admin')) THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'finalizado' AND (
    NEW.pacote_id IS DISTINCT FROM OLD.pacote_id
    OR NEW.valor IS DISTINCT FROM OLD.valor
    OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
  ) THEN
    RAISE EXCEPTION 'Atendimento finalizado possui origem financeira imutável; use correção auditável'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_finalized_appointment_financial_source
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_finalized_appointment_financial_source();
REVOKE ALL ON FUNCTION public.guard_finalized_appointment_financial_source() FROM PUBLIC, anon, authenticated;

-- Dedicated test patients.
INSERT INTO public.patients(id, clinic_id, funil_stage, status) VALUES
  ('31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'tratamento', 'ativo'),
  ('31000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'tratamento', 'ativo'),
  ('32000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'tratamento', 'ativo');

INSERT INTO public.session_packages(id, clinic_id, nome, sessoes, preco, validade_dias) VALUES
  ('51000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Unitário', 1, 10000, 30),
  ('51000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Válido', 2, 18000, 30),
  ('51000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Vencido', 1, 10000, 1),
  ('52000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Outro tenant', 1, 10000, 30),
  ('51000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Concorrência', 1, 10000, 30),
  ('51000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Reversão', 1, 10000, 30);

INSERT INTO public.patient_packages(
  id, clinic_id, patient_id, package_id, sessoes_totais, sessoes_usadas,
  compra_data, validade_ate, valor_pago, status
) VALUES
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 1, 0, current_date - 1, current_date + 30, 10000, 'ativo'),
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', 2, 0, current_date - 1, current_date + 30, 18000, 'ativo'),
  ('61000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000003', 1, 0, current_date - 10, current_date - 1, 10000, 'vencido'),
  ('62000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 1, 0, current_date - 1, current_date + 30, 10000, 'ativo'),
  ('61000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000004', 1, 0, current_date - 1, current_date + 30, 10000, 'ativo'),
  ('61000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000005', 1, 0, current_date - 1, current_date + 30, 10000, 'ativo');

-- A and B intentionally reserve the same single-session package before the new
-- server-side reservation boundary exists.
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
  status, tipo, valor, pacote_id
) VALUES
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '09:00', '09:30', 'em_atendimento', 'Consulta A', 10000, '61000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '10:00', '10:30', 'em_atendimento', 'Consulta B', 10000, '61000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '11:00', '11:30', 'em_atendimento', 'Consulta válida', 10000, '61000000-0000-0000-0000-000000000002'),
  ('41000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '12:00', '12:30', 'em_atendimento', 'Consulta avulsa', 15000, NULL),
  ('41000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '13:00', '13:30', 'em_atendimento', 'Consulta vencida', 10000, '61000000-0000-0000-0000-000000000003'),
  ('41000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '14:00', '14:30', 'em_atendimento', 'Consulta pacote estrangeiro', 10000, '62000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '15:00', '15:30', 'em_atendimento', 'Consulta reversão', 10000, '61000000-0000-0000-0000-000000000005');

INSERT INTO public.physiotherapy_evolutions(
  id, clinic_id, patient_id, professional_id, session_id, texto
) VALUES
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Evolução A'),
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'Evolução B'),
  ('71000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003', 'Evolução válida'),
  ('71000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000004', 'Evolução avulsa'),
  ('71000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000005', 'Evolução vencida'),
  ('71000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000006', 'Evolução estrangeira'),
  ('71000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000007', 'Evolução reversão');
