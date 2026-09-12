-- Isolated PostgreSQL 16 fixture for D2-A. It reuses the canonical clinical
-- authorization fixture and provides only structural rows needed by documents.
\i tests/sql/clinical_authorization_reconciliation_fixture.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Clínica de teste';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT 'Profissional de teste';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT 'Paciente de teste';
CREATE TABLE IF NOT EXISTS public.clinical_encounter_records (
  id uuid PRIMARY KEY, clinic_id uuid NOT NULL, appointment_id uuid NOT NULL UNIQUE,
  patient_id uuid NOT NULL, professional_id uuid NOT NULL, status text NOT NULL DEFAULT 'draft'
);

CREATE OR REPLACE FUNCTION public.can_access_patient_clinical_record(p_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.current_clinic_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id=p_patient_id AND p.clinic_id=public.current_clinic_id() AND p.deleted_at IS NULL
  )
$$;

INSERT INTO public.clinics(id,name) VALUES
 ('d2000000-0000-4000-8000-000000000001','Clínica A'),
 ('d2000000-0000-4000-8000-000000000002','Clínica B') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.capability_catalog(capability_key,clinical,active) VALUES
 ('clinical.documents',true,true),('clinical.attend',true,true),('clinical.timeline.read',true,true)
ON CONFLICT (capability_key) DO UPDATE SET active=true,clinical=true;
INSERT INTO public.profiles(id,clinic_id,role,ativo,nome,professional_type,council_type,council_state,registro) VALUES
 ('d2100000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','professional',true,'Médico A','medico','crm','SP','12345'),
 ('d2100000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','professional',true,'Médico sem documentos','medico','crm','SP','23456'),
 ('d2100000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','professional',true,'Fisioterapeuta A','fisioterapeuta','crefito','SP','34567'),
 ('d2100000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','professional',true,'Psicólogo A','psicologo','crp','SP','45678'),
 ('d2100000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000001','owner',true,'Owner sem identidade',NULL,NULL,NULL,NULL),
 ('d2100000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000001','admin',true,'Admin sem identidade',NULL,NULL,NULL,NULL),
 ('d2100000-0000-4000-8000-000000000007','d2000000-0000-4000-8000-000000000001','professional',false,'Profissional inativo','medico','crm','SP','56789'),
 ('d2100000-0000-4000-8000-000000000008','d2000000-0000-4000-8000-000000000002','professional',true,'Médico B','medico','crm','RJ','67890')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.professional_capabilities(clinic_id,professional_id,capability_key,granted) VALUES
 ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','clinical.documents',true),
 ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000002','clinical.documents',false),
 ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','clinical.documents',true),
 ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000004','clinical.documents',true),
 ('d2000000-0000-4000-8000-000000000002','d2100000-0000-4000-8000-000000000008','clinical.documents',true)
ON CONFLICT (professional_id,capability_key) DO UPDATE SET granted=excluded.granted;
INSERT INTO public.patients(id,clinic_id,funil_stage,status,nome) VALUES
 ('d2200000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','tratamento','ativo','Paciente A'),
 ('d2200000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002','tratamento','ativo','Paciente B') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.appointments(id,clinic_id,paciente_id,professional_id,fisio_id,status) VALUES
 ('d2300000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','em_atendimento'),
 ('d2300000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','d2100000-0000-4000-8000-000000000003','em_atendimento'),
 ('d2300000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','finalizado'),
 ('d2300000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000002','d2200000-0000-4000-8000-000000000002','d2100000-0000-4000-8000-000000000008','d2100000-0000-4000-8000-000000000008','em_atendimento'),
 ('d2300000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000004','d2100000-0000-4000-8000-000000000004','em_atendimento') ON CONFLICT (id) DO NOTHING;
