-- Deterministic scenario data only. Runtime helpers and policies come from the
-- canonical migrations loaded by the PostgreSQL 16 harness.
ALTER TABLE public.capability_catalog ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.capability_catalog ADD COLUMN IF NOT EXISTS clinical boolean NOT NULL DEFAULT true;
INSERT INTO public.capability_catalog(capability_key,domain,description,active,clinical)
VALUES ('clinical.timeline.read','clinical','fixture',true,true)
ON CONFLICT (capability_key) DO UPDATE SET active=true,clinical=true;

INSERT INTO public.profiles(id,clinic_id,role,ativo,must_change_password,professional_type,council_type,council_state,registro)
VALUES
 ('00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000001','professional',true,false,'medico','CRM','SP','CARE-READ-APPLY'),
 ('00000000-0000-0000-0000-000000000112','00000000-0000-0000-0000-000000000001','professional',true,false,'medico','CRM','SP','CARE-READ-PROFESSIONAL-ID-ONLY')
ON CONFLICT (id) DO NOTHING;

-- Every professional scenario has an explicit clinical.timeline.read grant or
-- deny; no assertion relies on the professional fallback.
INSERT INTO public.professional_capabilities(clinic_id,professional_id,capability_key,granted) VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000111','clinical.timeline.read',true),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000112','clinical.timeline.read',true),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','clinical.timeline.read',false),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','clinical.timeline.read',true),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','clinical.timeline.read',true),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000106','clinical.timeline.read',true)
ON CONFLICT (professional_id,capability_key) DO UPDATE SET granted=excluded.granted;

-- These independent Nexus grants let the post-reconciliation probe exercise
-- the existing Nexus read policies, which also delegate to the care helper.
INSERT INTO public.professional_capabilities(clinic_id,professional_id,capability_key,granted) VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000111','nexus.access',true),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000111','nexus.scales',true)
ON CONFLICT (professional_id,capability_key) DO UPDATE SET granted=excluded.granted;

-- Positive proof: fisio_id is the care relationship and professional_id is a
-- different professional. Inverse proof: professional 112 appears only in
-- professional_id for the same patient and must not gain appointment access.
INSERT INTO public.appointments(id,clinic_id,paciente_id,fisio_id,professional_id) VALUES
 ('00000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000109'),
 ('00000000-0000-0000-0000-000000000512','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000112')
ON CONFLICT (id) DO NOTHING;
