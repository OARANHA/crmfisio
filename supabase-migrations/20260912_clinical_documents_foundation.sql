-- MedicsPro — Clinical Documents Foundation (D2-A)
-- Additive foundation only. It deliberately does not add a Prescription UI,
-- template administration UI, digital signature, external PDF service or any
-- document types other than medication_prescription and therapeutic_guidance.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.clinical_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  owner_type text NOT NULL CHECK (owner_type IN ('platform', 'clinic')),
  document_type text NOT NULL CHECK (document_type IN ('medication_prescription', 'therapeutic_guidance')),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  relevance_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(relevance_metadata) = 'object'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  current_version_id uuid,
  created_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_document_templates_owner_scope CHECK (
    (owner_type = 'platform' AND clinic_id IS NULL)
    OR (owner_type = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.clinical_document_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.clinical_document_templates(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(definition) = 'object'),
  render_definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(render_definition) = 'object'),
  variables_contract jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(variables_contract) = 'array'),
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

ALTER TABLE public.clinical_document_templates
  DROP CONSTRAINT IF EXISTS clinical_document_templates_current_version_fk;
ALTER TABLE public.clinical_document_templates
  ADD CONSTRAINT clinical_document_templates_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.clinical_document_template_versions(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.clinical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  encounter_record_id uuid REFERENCES public.clinical_encounter_records(id) ON DELETE RESTRICT,
  document_type text NOT NULL CHECK (document_type IN ('medication_prescription', 'therapeutic_guidance')),
  template_id uuid NOT NULL REFERENCES public.clinical_document_templates(id) ON DELETE RESTRICT,
  template_version_id uuid NOT NULL REFERENCES public.clinical_document_template_versions(id) ON DELETE RESTRICT,
  issuer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'canceled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  payload_snapshot jsonb,
  context_snapshot jsonb,
  template_definition_snapshot jsonb,
  rendered_snapshot text,
  renderer_version text,
  document_identifier text NOT NULL UNIQUE,
  issued_at timestamptz,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  canceled_at timestamptz,
  canceled_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cancel_reason text,
  supersedes_document_id uuid REFERENCES public.clinical_documents(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_documents_lifecycle_shape CHECK (
    (status = 'draft' AND issued_at IS NULL AND issued_by IS NULL AND canceled_at IS NULL AND canceled_by IS NULL AND cancel_reason IS NULL
      AND payload_snapshot IS NULL AND context_snapshot IS NULL AND template_definition_snapshot IS NULL AND rendered_snapshot IS NULL AND renderer_version IS NULL)
    OR (status = 'issued' AND issued_at IS NOT NULL AND issued_by IS NOT NULL AND canceled_at IS NULL AND canceled_by IS NULL AND cancel_reason IS NULL
      AND payload_snapshot IS NOT NULL AND context_snapshot IS NOT NULL AND template_definition_snapshot IS NOT NULL AND btrim(coalesce(rendered_snapshot, '')) <> '' AND btrim(coalesce(renderer_version, '')) <> '')
    OR (status = 'canceled' AND issued_at IS NOT NULL AND issued_by IS NOT NULL AND canceled_at IS NOT NULL AND canceled_by IS NOT NULL AND btrim(coalesce(cancel_reason, '')) <> ''
      AND payload_snapshot IS NOT NULL AND context_snapshot IS NOT NULL AND template_definition_snapshot IS NOT NULL AND btrim(coalesce(rendered_snapshot, '')) <> '' AND btrim(coalesce(renderer_version, '')) <> '')
  )
);

CREATE TABLE IF NOT EXISTS public.clinical_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.clinical_documents(id) ON DELETE RESTRICT,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created', 'issued', 'canceled')),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_document_templates_available_idx
  ON public.clinical_document_templates (document_type, status, owner_type, clinic_id, name);
CREATE INDEX IF NOT EXISTS clinical_document_template_versions_lookup_idx
  ON public.clinical_document_template_versions (template_id, version DESC);
CREATE INDEX IF NOT EXISTS clinical_documents_appointment_idx
  ON public.clinical_documents (clinic_id, appointment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clinical_documents_patient_history_idx
  ON public.clinical_documents (clinic_id, patient_id, issued_at DESC) WHERE status IN ('issued', 'canceled');
CREATE INDEX IF NOT EXISTS clinical_document_events_document_idx
  ON public.clinical_document_events (document_id, created_at);

ALTER TABLE public.clinical_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_document_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.clinical_document_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.guard_clinical_document_template_version_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'clinical_document_published_version_immutable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'clinical_document_published_version_immutable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_clinical_document_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'clinical_document_delete_denied' USING ERRCODE = '42501';
  END IF;
  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.issuer_id IS DISTINCT FROM OLD.issuer_id
     OR NEW.document_type IS DISTINCT FROM OLD.document_type OR NEW.template_id IS DISTINCT FROM OLD.template_id
     OR NEW.template_version_id IS DISTINCT FROM OLD.template_version_id OR NEW.document_identifier IS DISTINCT FROM OLD.document_identifier THEN
    RAISE EXCEPTION 'clinical_document_provenance_immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status IN ('issued', 'canceled') AND NEW IS DISTINCT FROM OLD THEN
    IF OLD.status = 'issued' AND NEW.status = 'canceled'
       AND NEW.payload IS NOT DISTINCT FROM OLD.payload
       AND NEW.payload_snapshot IS NOT DISTINCT FROM OLD.payload_snapshot
       AND NEW.context_snapshot IS NOT DISTINCT FROM OLD.context_snapshot
       AND NEW.template_definition_snapshot IS NOT DISTINCT FROM OLD.template_definition_snapshot
       AND NEW.rendered_snapshot IS NOT DISTINCT FROM OLD.rendered_snapshot
       AND NEW.renderer_version IS NOT DISTINCT FROM OLD.renderer_version
       AND NEW.issued_at IS NOT DISTINCT FROM OLD.issued_at
       AND NEW.issued_by IS NOT DISTINCT FROM OLD.issued_by THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'clinical_document_issued_immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'issued') THEN
    RAISE EXCEPTION 'clinical_document_invalid_transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_clinical_document_event_append_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'clinical_document_event_append_only' USING ERRCODE = '42501';
END; $$;

DROP TRIGGER IF EXISTS trg_clinical_document_templates_updated_at ON public.clinical_document_templates;
CREATE TRIGGER trg_clinical_document_templates_updated_at BEFORE UPDATE ON public.clinical_document_templates FOR EACH ROW EXECUTE FUNCTION public.clinical_document_set_updated_at();
DROP TRIGGER IF EXISTS trg_clinical_documents_updated_at ON public.clinical_documents;
CREATE TRIGGER trg_clinical_documents_updated_at BEFORE UPDATE ON public.clinical_documents FOR EACH ROW EXECUTE FUNCTION public.clinical_document_set_updated_at();
DROP TRIGGER IF EXISTS trg_clinical_document_template_version_immutable ON public.clinical_document_template_versions;
CREATE TRIGGER trg_clinical_document_template_version_immutable BEFORE UPDATE OR DELETE ON public.clinical_document_template_versions FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_document_template_version_immutable();
DROP TRIGGER IF EXISTS trg_clinical_document_integrity ON public.clinical_documents;
CREATE TRIGGER trg_clinical_document_integrity BEFORE UPDATE OR DELETE ON public.clinical_documents FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_document_integrity();
DROP TRIGGER IF EXISTS trg_clinical_document_event_append_only ON public.clinical_document_events;
CREATE TRIGGER trg_clinical_document_event_append_only BEFORE UPDATE OR DELETE ON public.clinical_document_events FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_document_event_append_only();

CREATE OR REPLACE FUNCTION public.current_user_can_issue_clinical_document(p_document_type text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.profiles%ROWTYPE; v_type text;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id=auth.uid() AND ativo IS TRUE;
  IF p.id IS NULL OR public.current_clinic_id() IS DISTINCT FROM p.clinic_id
     OR public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.documents') IS NOT TRUE THEN RETURN false; END IF;
  IF p_document_type = 'therapeutic_guidance' THEN RETURN true; END IF;
  IF p_document_type <> 'medication_prescription' THEN RETURN false; END IF;
  v_type := lower(trim(coalesce(p.professional_type, '')));
  RETURN v_type IN ('medico','médico','medica','médica','physician','doctor')
     AND lower(trim(coalesce(p.council_type, ''))) = 'crm'
     AND btrim(coalesce(p.council_state, '')) <> '' AND btrim(coalesce(p.registro, '')) <> '';
END; $$;

CREATE OR REPLACE FUNCTION public.assert_clinical_document_actor(p_appointment_id uuid, p_document_type text)
RETURNS public.appointments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.appointments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_can_issue_clinical_document(p_document_type) IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_document_eligibility_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF a.id IS NULL OR a.clinic_id IS DISTINCT FROM public.current_clinic_id() OR a.professional_id IS DISTINCT FROM auth.uid()
     OR a.status IS DISTINCT FROM 'em_atendimento' THEN RAISE EXCEPTION 'clinical_document_own_active_encounter_required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=a.paciente_id AND p.clinic_id=a.clinic_id AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'clinical_document_patient_link_invalid' USING ERRCODE = '23514'; END IF;
  RETURN a;
END; $$;

CREATE OR REPLACE FUNCTION public.render_clinical_document_snapshot(p_document_type text, p_title text, p_payload jsonb, p_context jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_document_type NOT IN ('medication_prescription','therapeutic_guidance') OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'clinical_document_render_contract_invalid' USING ERRCODE = '22023'; END IF;
  -- Plain text is intentional in D2-A: no user supplied HTML/CSS crosses this boundary.
  RETURN concat_ws(E'\n', upper(btrim(p_title)), 'Paciente: ' || coalesce(p_context->'patient'->>'name',''),
    'Profissional: ' || coalesce(p_context->'issuer'->>'name',''), 'Documento: ' || p_document_type, '', jsonb_pretty(p_payload));
END; $$;

CREATE OR REPLACE FUNCTION public.create_clinical_document_draft(p_appointment_id uuid, p_template_version_id uuid, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS public.clinical_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.appointments%ROWTYPE; t public.clinical_document_templates%ROWTYPE; v public.clinical_document_template_versions%ROWTYPE; d public.clinical_documents%ROWTYPE; did uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v FROM public.clinical_document_template_versions WHERE id=p_template_version_id AND published_at IS NOT NULL;
  SELECT * INTO t FROM public.clinical_document_templates WHERE id=v.template_id AND status='active';
  IF t.id IS NULL OR t.current_version_id IS DISTINCT FROM v.id
     OR (t.owner_type='clinic' AND t.clinic_id IS DISTINCT FROM public.current_clinic_id()) THEN RAISE EXCEPTION 'clinical_document_template_unavailable' USING ERRCODE='42501'; END IF;
  a := public.assert_clinical_document_actor(p_appointment_id, t.document_type);
  IF jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'clinical_document_payload_object_required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.clinical_documents(id,clinic_id,patient_id,appointment_id,encounter_record_id,document_type,template_id,template_version_id,issuer_id,payload,document_identifier)
  VALUES(did,a.clinic_id,a.paciente_id,a.id,(SELECT id FROM public.clinical_encounter_records WHERE appointment_id=a.id),t.document_type,t.id,v.id,auth.uid(),p_payload,
    'DOC-' || to_char(current_date,'YYYYMMDD') || '-' || upper(substr(replace(did::text,'-',''),1,8))) RETURNING * INTO d;
  INSERT INTO public.clinical_document_events(document_id,clinic_id,event_type,actor_id) VALUES(d.id,d.clinic_id,'created',auth.uid());
  RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.save_clinical_document_draft(p_document_id uuid, p_payload jsonb)
RETURNS public.clinical_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE d public.clinical_documents%ROWTYPE; a public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.clinical_documents WHERE id=p_document_id FOR UPDATE; IF d.id IS NULL OR d.status <> 'draft' THEN RAISE EXCEPTION 'clinical_document_draft_required' USING ERRCODE='42501'; END IF;
  a := public.assert_clinical_document_actor(d.appointment_id,d.document_type);
  IF a.paciente_id IS DISTINCT FROM d.patient_id OR a.clinic_id IS DISTINCT FROM d.clinic_id OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'clinical_document_context_invalid' USING ERRCODE='42501'; END IF;
  UPDATE public.clinical_documents SET payload=p_payload WHERE id=d.id RETURNING * INTO d; RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.issue_clinical_document(p_document_id uuid)
RETURNS public.clinical_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE d public.clinical_documents%ROWTYPE; a public.appointments%ROWTYPE; p public.profiles%ROWTYPE; c public.clinics%ROWTYPE; v public.clinical_document_template_versions%ROWTYPE; snap jsonb; now_at timestamptz:=now();
BEGIN
  SELECT * INTO d FROM public.clinical_documents WHERE id=p_document_id FOR UPDATE; IF d.id IS NULL OR d.status <> 'draft' THEN RAISE EXCEPTION 'clinical_document_draft_required' USING ERRCODE='42501'; END IF;
  a := public.assert_clinical_document_actor(d.appointment_id,d.document_type); SELECT * INTO p FROM public.profiles WHERE id=auth.uid(); SELECT * INTO c FROM public.clinics WHERE id=d.clinic_id; SELECT * INTO v FROM public.clinical_document_template_versions WHERE id=d.template_version_id AND template_id=d.template_id AND published_at IS NOT NULL;
  IF v.id IS NULL THEN RAISE EXCEPTION 'clinical_document_published_version_required' USING ERRCODE='23514'; END IF;
  snap := jsonb_build_object('patient',jsonb_build_object('id',d.patient_id,'name',(SELECT nome FROM public.patients WHERE id=d.patient_id)),'clinic',jsonb_build_object('id',c.id,'name',c.name),'issuer',jsonb_build_object('id',p.id,'name',p.nome,'professional_type',p.professional_type,'council_type',p.council_type,'council_state',p.council_state,'registro',p.registro),'appointment_id',a.id,'encounter_record_id',d.encounter_record_id,'issued_at',now_at);
  UPDATE public.clinical_documents SET status='issued',payload_snapshot=d.payload,context_snapshot=snap,template_definition_snapshot=jsonb_build_object('definition',v.definition,'render_definition',v.render_definition,'variables_contract',v.variables_contract),rendered_snapshot=public.render_clinical_document_snapshot(d.document_type,(SELECT name FROM public.clinical_document_templates WHERE id=d.template_id),d.payload,snap),renderer_version='d2-a/plain-text-v1',issued_at=now_at,issued_by=auth.uid() WHERE id=d.id RETURNING * INTO d;
  INSERT INTO public.clinical_document_events(document_id,clinic_id,event_type,actor_id) VALUES(d.id,d.clinic_id,'issued',auth.uid()); RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_clinical_document(p_document_id uuid, p_reason text)
RETURNS public.clinical_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE d public.clinical_documents%ROWTYPE;
BEGIN
  IF nullif(btrim(coalesce(p_reason,'')),'') IS NULL THEN RAISE EXCEPTION 'clinical_document_cancel_reason_required' USING ERRCODE='22023'; END IF;
  SELECT * INTO d FROM public.clinical_documents WHERE id=p_document_id FOR UPDATE; IF d.id IS NULL OR d.status <> 'issued' THEN RAISE EXCEPTION 'clinical_document_issued_required' USING ERRCODE='42501'; END IF;
  PERFORM public.assert_clinical_document_actor(d.appointment_id,d.document_type);
  UPDATE public.clinical_documents SET status='canceled',canceled_at=now(),canceled_by=auth.uid(),cancel_reason=btrim(p_reason) WHERE id=d.id RETURNING * INTO d;
  INSERT INTO public.clinical_document_events(document_id,clinic_id,event_type,actor_id,metadata) VALUES(d.id,d.clinic_id,'canceled',auth.uid(),jsonb_build_object('reason',d.cancel_reason)); RETURN d;
END; $$;

DROP POLICY IF EXISTS clinical_document_templates_read_available ON public.clinical_document_templates;
CREATE POLICY clinical_document_templates_read_available ON public.clinical_document_templates FOR SELECT TO authenticated USING (public.current_clinic_id() IS NOT NULL AND status='active' AND public.current_user_can_issue_clinical_document(document_type) AND (owner_type='platform' OR (owner_type='clinic' AND clinic_id=public.current_clinic_id())));
DROP POLICY IF EXISTS clinical_document_template_versions_read_available ON public.clinical_document_template_versions;
CREATE POLICY clinical_document_template_versions_read_available ON public.clinical_document_template_versions FOR SELECT TO authenticated USING (published_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.clinical_document_templates t WHERE t.id=template_id AND t.status='active' AND public.current_user_can_issue_clinical_document(t.document_type) AND (t.owner_type='platform' OR (t.owner_type='clinic' AND t.clinic_id=public.current_clinic_id()))));
DROP POLICY IF EXISTS clinical_documents_read_clinical ON public.clinical_documents;
CREATE POLICY clinical_documents_read_clinical ON public.clinical_documents FOR SELECT TO authenticated USING (clinic_id=public.current_clinic_id() AND public.can_access_patient_clinical_record(patient_id));
DROP POLICY IF EXISTS clinical_document_events_read_clinical ON public.clinical_document_events;
CREATE POLICY clinical_document_events_read_clinical ON public.clinical_document_events FOR SELECT TO authenticated USING (clinic_id=public.current_clinic_id() AND EXISTS (SELECT 1 FROM public.clinical_documents d WHERE d.id=document_id AND public.can_access_patient_clinical_record(d.patient_id)));

REVOKE ALL ON public.clinical_document_templates, public.clinical_document_template_versions, public.clinical_documents, public.clinical_document_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.clinical_document_templates, public.clinical_document_template_versions, public.clinical_documents, public.clinical_document_events TO authenticated;
GRANT ALL ON public.clinical_document_templates, public.clinical_document_template_versions, public.clinical_documents, public.clinical_document_events TO service_role;
REVOKE ALL ON FUNCTION public.current_user_can_issue_clinical_document(text), public.assert_clinical_document_actor(uuid,text), public.render_clinical_document_snapshot(text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_clinical_document_draft(uuid,uuid,jsonb), public.save_clinical_document_draft(uuid,jsonb), public.issue_clinical_document(uuid), public.cancel_clinical_document(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clinical_document_draft(uuid,uuid,jsonb), public.save_clinical_document_draft(uuid,jsonb), public.issue_clinical_document(uuid), public.cancel_clinical_document(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_can_issue_clinical_document(text) TO authenticated, service_role;

-- Curated platform library. D1 found only a historical default prescription layout;
-- these four are new controlled MedicsPro structures, not imported historical seeds.
INSERT INTO public.clinical_document_templates(id,owner_type,document_type,name,description,relevance_metadata,status)
VALUES
 ('12000000-0000-4000-8000-000000000001','platform','medication_prescription','Receita simples','Estrutura MedicsPro para prescrição confirmada pelo profissional.','{"relevance":"general"}','active'),
 ('12000000-0000-4000-8000-000000000002','platform','medication_prescription','Receita com orientações','Estrutura MedicsPro para prescrição e orientações complementares.','{"relevance":"general"}','active'),
 ('12000000-0000-4000-8000-000000000003','platform','therapeutic_guidance','Orientação terapêutica geral','Estrutura para orientações terapêuticas contextualizadas.','{"relevance":"general"}','active'),
 ('12000000-0000-4000-8000-000000000004','platform','therapeutic_guidance','Orientações pós-atendimento','Estrutura para cuidados e orientações após o atendimento.','{"relevance":"general"}','active')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.clinical_document_template_versions(id,template_id,version,definition,render_definition,variables_contract,published_at)
VALUES
 ('12100000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',1,'{"kind":"medication_prescription","fields":["items","observations"]}','{"layout":"clinical-document/plain-text-v1"}','["patient.name","issuer.name","issuer.registro","appointment.id"]',now()),
 ('12100000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000002',1,'{"kind":"medication_prescription","fields":["items","observations"]}','{"layout":"clinical-document/plain-text-v1"}','["patient.name","issuer.name","issuer.registro","appointment.id"]',now()),
 ('12100000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000003',1,'{"kind":"therapeutic_guidance","fields":["title","items","patient_instructions","observations"]}','{"layout":"clinical-document/plain-text-v1"}','["patient.name","issuer.name","issuer.registro","appointment.id"]',now()),
 ('12100000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000004',1,'{"kind":"therapeutic_guidance","fields":["title","items","patient_instructions","observations"]}','{"layout":"clinical-document/plain-text-v1"}','["patient.name","issuer.name","issuer.registro","appointment.id"]',now())
ON CONFLICT (id) DO NOTHING;
UPDATE public.clinical_document_templates t SET current_version_id=v.id FROM public.clinical_document_template_versions v WHERE v.template_id=t.id AND v.version=1 AND t.id IN ('12000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000004') AND t.current_version_id IS NULL;

COMMIT;
