-- ===================================================================
-- MEDICSPRO / CRM FISIOTERAPIA - Schema Inicial + RLS + Audit
-- Supabase self-hosted (PostgreSQL 15+)
-- Execute no SQL Editor do Supabase Studio: https://studio.medicspro.com.br
-- ===================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================================
-- 1. TABELAS BASE
-- ===================================================================

-- Clínicas (tenants)
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cnpj TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Perfis de usuário (vinculado a auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'fisio' CHECK (role IN ('owner', 'admin', 'fisio', 'recep', 'financeiro')),
  registro TEXT,
  cor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pacientes
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  nome TEXT NOT NULL,
  nascimento DATE NOT NULL,
  telefone TEXT,
  email TEXT,
  cpf TEXT,
  convenio TEXT,
  queixa_principal TEXT,
  cid10 TEXT[],
  funil_stage TEXT NOT NULL DEFAULT 'lead' CHECK (funil_stage IN ('lead', 'avaliacao', 'tratamento', 'alta')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'alta')),
  ultima_visita DATE,
  opt_in_whats BOOLEAN NOT NULL DEFAULT false,
  anonimizado BOOLEAN NOT NULL DEFAULT false,
  anamnese JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Agendamento/Atendimentos
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  paciente_id UUID NOT NULL REFERENCES patients(id),
  fisio_id UUID NOT NULL REFERENCES profiles(id),
  room_id UUID,
  data DATE NOT NULL,
  inicio TIME NOT NULL,
  fim TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'em_atendimento', 'finalizado', 'faltou', 'cancelado')),
  tipo TEXT NOT NULL,
  valor INTEGER NOT NULL, -- centavos
  pacote_id UUID,
  serie_id UUID,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avaliações Fisioterapêuticas (anamnese + plano)
CREATE TABLE IF NOT EXISTS physiotherapy_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  professional_id UUID NOT NULL REFERENCES profiles(id),
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anamnese JSONB NOT NULL,
  objetivos TEXT,
  plano_terapeutico TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evoluções Clínicas (por sessão)
CREATE TABLE IF NOT EXISTS physiotherapy_evolutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  professional_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID REFERENCES appointments(id),
  texto TEXT NOT NULL,
  anexos TEXT[] DEFAULT '{}',
  crefito TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Financeiro (Contas a receber/pagar)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID REFERENCES patients(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('receber', 'pagar')),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor INTEGER NOT NULL, -- centavos
  vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado')),
  metodo TEXT CHECK (metodo IN ('pix', 'cartao', 'dinheiro', 'boleto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pacotes de sessões (catálogo)
CREATE TABLE IF NOT EXISTS session_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  nome TEXT NOT NULL,
  sessoes INTEGER NOT NULL,
  preco INTEGER NOT NULL, -- centavos
  validade_dias INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pacotes comprados por pacientes
CREATE TABLE IF NOT EXISTS patient_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  package_id UUID NOT NULL REFERENCES session_packages(id),
  sessoes_totais INTEGER NOT NULL,
  sessoes_usadas INTEGER NOT NULL DEFAULT 0,
  compra_data DATE NOT NULL,
  valor_pago INTEGER NOT NULL, -- centavos
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'esgotado', 'vencido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Termos de consentimento (LGPD)
CREATE TABLE IF NOT EXISTS consent_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  nome TEXT NOT NULL,
  versao TEXT NOT NULL,
  assinado BOOLEAN NOT NULL DEFAULT false,
  data_assinatura TIMESTAMPTZ,
  hash TEXT,
  assinatura_url TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pesquisas NPS
CREATE TABLE IF NOT EXISTS nps_surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  nota INTEGER CHECK (nota >= 0 AND nota <= 10),
  comentario TEXT,
  data DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Logs de WhatsApp
CREATE TABLE IF NOT EXISTS wa_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  template TEXT NOT NULL CHECK (template IN ('confirmacao', 'nps', 'reativacao')),
  mensagem TEXT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviando' CHECK (status IN ('enviando', 'enviado', 'entregue', 'lido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auditoria (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id UUID NOT NULL,
  acao TEXT NOT NULL,
  detalhe TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_patients_funil ON patients(clinic_id, funil_stage);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_data ON appointments(clinic_id, data);
CREATE INDEX IF NOT EXISTS idx_appointments_fisio_data ON appointments(fisio_id, data);
CREATE INDEX IF NOT EXISTS idx_evolutions_patient ON physiotherapy_evolutions(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_clinic_status ON payments(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_clinic_ts ON audit_log(clinic_id, ts DESC);

-- ===================================================================
-- 3. TRIGGERS DE AUDITORIA E UPDATED_AT
-- ===================================================================

-- Função para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger updated_at para todas as tabelas
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('audit_log') LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_updated_at ON %I;
      CREATE TRIGGER update_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', tbl, tbl);
  END LOOP;
END $$;

-- Função de auditoria genérica
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  acao TEXT;
  detalhe JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    acao := 'CREATE';
    detalhe := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    acao := 'UPDATE';
    detalhe := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    acao := 'DELETE';
    detalhe := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (
    COALESCE(NEW.clinic_id, OLD.clinic_id),
    COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'),
    acao || ' ' || TG_TABLE_NAME,
    detalhe::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers de auditoria para tabelas críticas
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(array['patients', 'physiotherapy_evaluations', 'physiotherapy_evolutions', 'appointments', 'payments', 'consent_terms']) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS audit_trigger ON %I;
      CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    ', tbl, tbl);
  END LOOP;
END $$;

-- ===================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ===================================================================

-- Habilitar RLS em todas as tabelas
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'auth%' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- Política de isolamento por clínica (padrão para todas as tabelas com clinic_id)
-- Nota: O aplicativo deve setar app.current_clinic via RPC ou header

CREATE POLICY "Isolamento por clínica - selecionar" ON patients
  FOR SELECT USING (
    clinic_id = COALESCE(
      NULLIF(current_setting('app.current_clinic', true), '')::uuid,
      (SELECT clinic_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "Isolamento por clínica - inserir" ON patients
  FOR INSERT WITH CHECK (
    clinic_id = COALESCE(
      NULLIF(current_setting('app.current_clinic', true), '')::uuid,
      (SELECT clinic_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "Isolamento por clínica - atualizar" ON patients
  FOR UPDATE USING (
    clinic_id = COALESCE(
      NULLIF(current_setting('app.current_clinic', true), '')::uuid,
      (SELECT clinic_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "Isolamento por clínica - deletar (soft)" ON patients
  FOR DELETE USING (
    clinic_id = COALESCE(
      NULLIF(current_setting('app.current_clinic', true), '')::uuid,
      (SELECT clinic_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

-- Repetir para outras tabelas críticas (simplificado aqui, idealmente uma função geraria)
CREATE POLICY "Isolamento por clínica - appointments" ON appointments
  FOR ALL USING (
    clinic_id = COALESCE(
      NULLIF(current_setting('app.current_clinic', true), '')::uuid,
      (SELECT clinic_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "Isolamento por clínica - physiotherapy_evolutions" ON physiotherapy_evolutions
  FOR ALL USING (
    clinic_id = COALESCE(
      NULLIF(current_setting('app.current_clinic', true), '')::uuid,
      (SELECT clinic_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "Isolamento por clínica - payments" ON payments
  FOR ALL USING (
    clinic_id = COALESCE(
      NULLIF(current_setting('app.current_clinic', true), '')::uuid,
      (SELECT clinic_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

-- ===================================================================
-- 5. POLÍTICAS ESPECÍFICAS POR PERFIL (RBAC)
-- ===================================================================

-- Admin: acesso total à própria clínica
CREATE POLICY "Admin full access patients" ON patients
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
        AND profiles.clinic_id = patients.clinic_id
    )
  );

-- Fisio: leitura completa, escrita apenas em evoluções da própria clínica
CREATE POLICY "Fisio read patients" ON patients
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'fisio'
        AND profiles.clinic_id = patients.clinic_id
    )
  );

CREATE POLICY "Fisio write evolutions" ON physiotherapy_evolutions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('fisio', 'admin', 'owner')
        AND profiles.clinic_id = physiotherapy_evolutions.clinic_id
    )
  );

-- Recep: agenda e pacientes, sem acesso clínico
CREATE POLICY "Recep read appointments" ON appointments
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('recep', 'admin', 'owner')
        AND profiles.clinic_id = appointments.clinic_id
    )
  );

-- ===================================================================
-- 6. FUNÇÃO HELPER PARA SETAR CONTEXTO
-- ===================================================================

CREATE OR REPLACE FUNCTION set_app_context(p_clinic_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_clinic', p_clinic_id::text, true);
  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', p_user_id::text, true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- 7. STORAGE BUCKETS (ANEXOS CLÍNICOS)
-- ===================================================================

-- Bucket privado para anexos clínicos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-attachments',
  'clinical-attachments',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: apenas usuários autenticados da mesma clínica
CREATE POLICY "Acesso clínico a anexos" ON storage.objects
  FOR ALL TO authenticated USING (
    bucket_id = 'clinical-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.clinic_id = (storage.foldername(name))::uuid
    )
  );

-- ===================================================================
-- 8. DADOS INICIAIS (SEED)
-- ===================================================================

-- Criar clínica padrão (se não existir)
INSERT INTO clinics (id, name, cnpj)
VALUES ('00000000-0000-0000-0000-000000000001', 'Clínica MedicsPro Demo', '00.000.000/0001-00')
ON CONFLICT DO NOTHING;

-- Pacote de sessões padrão
INSERT INTO session_packages (clinic_id, nome, sessoes, preco, validade_dias)
VALUES ('00000000-0000-0000-0000-000000000001', 'Pacote 10 sessões', 10, 150000, 90)
ON CONFLICT DO NOTHING;

-- ===================================================================
-- FIM DO SCRIPT
-- ===================================================================
