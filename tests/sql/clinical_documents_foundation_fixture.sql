-- D2-A scenario data only. Runtime authorization is reconstructed by the
-- PostgreSQL 16 harness from the canonical migrations/builders and #426.
-- This fixture MUST NOT redefine can_access_patient_clinical_record(),
-- current_clinic_id(), current_app_role(), clinical identity, or capabilities.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Clínica de teste';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT 'Profissional de teste';
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT 'Paciente de teste';
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'agendado';

CREATE TABLE IF NOT EXISTS public.clinical_encounter_records (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  appointment_id uuid NOT NULL UNIQUE,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
);

ALTER TABLE public.capability_catalog
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.capability_catalog
  ADD COLUMN IF NOT EXISTS clinical boolean NOT NULL DEFAULT true;

INSERT INTO public.clinics(id, lifecycle_status, deleted_at, name) VALUES
  ('d2000000-0000-4000-8000-000000000001','active',NULL,'Clínica D2 A'),
  ('d2000000-0000-4000-8000-000000000002','active',NULL,'Clínica D2 B')
ON CONFLICT (id) DO UPDATE SET lifecycle_status='active', deleted_at=NULL;

INSERT INTO public.capability_catalog(capability_key, clinical, active) VALUES
  ('clinical.documents', true, true),
  ('clinical.timeline.read', true, true),
  ('clinical.attend', true, true)
ON CONFLICT (capability_key) DO UPDATE SET active=true, clinical=true;

INSERT INTO public.profiles(
  id, clinic_id, role, ativo, must_change_password, nome,
  professional_type, council_type, council_state, registro
) VALUES
  ('d2100000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','professional',true,false,'Médico emissor A','medico','crm','SP','D2-CRM-1'),
  ('d2100000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','professional',true,false,'Médico sem documentos','medico','crm','SP','D2-CRM-2'),
  ('d2100000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','professional',true,false,'Fisioterapeuta D2','fisioterapeuta','crefito','SP','D2-CREFITO'),
  ('d2100000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','professional',true,false,'Psicóloga D2','psicologo','crp','SP','D2-CRP'),
  ('d2100000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000001','owner',true,false,'Owner D2',NULL,NULL,NULL,NULL),
  ('d2100000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000001','admin',true,false,'Admin D2',NULL,NULL,NULL,NULL),
  ('d2100000-0000-4000-8000-000000000007','d2000000-0000-4000-8000-000000000001','professional',false,false,'Profissional inativo','medico','crm','SP','D2-CRM-7'),
  ('d2100000-0000-4000-8000-000000000008','d2000000-0000-4000-8000-000000000002','professional',true,false,'Médico tenant B','medico','crm','RJ','D2-CRM-8'),
  ('d2100000-0000-4000-8000-000000000009','d2000000-0000-4000-8000-000000000001','professional',true,false,'Médico sem timeline','medico','crm','SP','D2-CRM-9'),
  ('d2100000-0000-4000-8000-000000000010','d2000000-0000-4000-8000-000000000001','professional',true,false,'Médico professional-id only','medico','crm','SP','D2-CRM-10'),
  ('d2100000-0000-4000-8000-000000000011','d2000000-0000-4000-8000-000000000001','recep',true,false,'Recepção D2',NULL,NULL,NULL,NULL),
  ('d2100000-0000-4000-8000-000000000012','d2000000-0000-4000-8000-000000000001','financeiro',true,false,'Financeiro D2',NULL,NULL,NULL,NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.professional_capabilities(
  clinic_id, professional_id, capability_key, granted
) VALUES
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','clinical.documents',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','clinical.timeline.read',true),
  ('d2000000-0000-4000-8000-000000000002','d2100000-0000-4000-8000-000000000008','clinical.documents',true),
  ('d2000000-0000-4000-8000-000000000002','d2100000-0000-4000-8000-000000000008','clinical.timeline.read',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000002','clinical.documents',false),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000002','clinical.timeline.read',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','clinical.documents',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','clinical.timeline.read',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000004','clinical.documents',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000004','clinical.timeline.read',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000009','clinical.documents',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000009','clinical.timeline.read',false),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000010','clinical.documents',true),
  ('d2000000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000010','clinical.timeline.read',true)
ON CONFLICT (professional_id, capability_key)
DO UPDATE SET clinic_id=excluded.clinic_id, granted=excluded.granted;

INSERT INTO public.patients(id, clinic_id, deleted_at, nome) VALUES
  ('d2200000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',NULL,'Paciente D2 A'),
  ('d2200000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002',NULL,'Paciente D2 B')
ON CONFLICT (id) DO NOTHING;

-- Positive owner divergence: issuer owns the Encounter through fisio_id while
-- professional_id deliberately points at another professional.
-- Negative inverse: appointment 7 contains the issuer only in professional_id.
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, fisio_id, professional_id, status
) VALUES
  ('d2300000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000010','em_atendimento'),
  ('d2300000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','d2100000-0000-4000-8000-000000000003','em_atendimento'),
  ('d2300000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','finalizado'),
  ('d2300000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000002','d2200000-0000-4000-8000-000000000002','d2100000-0000-4000-8000-000000000008','d2100000-0000-4000-8000-000000000008','em_atendimento'),
  ('d2300000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000004','d2100000-0000-4000-8000-000000000004','em_atendimento'),
  ('d2300000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000009','d2100000-0000-4000-8000-000000000009','em_atendimento'),
  ('d2300000-0000-4000-8000-000000000007','d2000000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','d2100000-0000-4000-8000-000000000001','em_atendimento')
ON CONFLICT (id) DO UPDATE SET status=excluded.status;

INSERT INTO public.clinical_encounter_records(
  id, clinic_id, appointment_id, patient_id, professional_id, status
) VALUES
  ('d2400000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000001','draft'),
  ('d2400000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000002','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000003','draft'),
  ('d2400000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000005','d2200000-0000-4000-8000-000000000001','d2100000-0000-4000-8000-000000000004','draft')
ON CONFLICT (id) DO NOTHING;
