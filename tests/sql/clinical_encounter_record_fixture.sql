-- #394 fixture extension loaded after the canonical #387/#388/#389 stack.
-- The reduced #387 fixture omits Evolution.created_at; restore the production
-- column/default so #394 proves real record-creation timestamps.
ALTER TABLE public.physiotherapy_evolutions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.can_access_patient_clinical_record(p_patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR v_role IS NULL OR p_patient_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.clinic_id = v_clinic AND p.deleted_at IS NULL) THEN RETURN false; END IF;
  IF v_role IN ('owner','admin') THEN RETURN true; END IF;
  IF v_role <> 'professional' OR public.current_user_has_valid_clinical_identity() IS NOT TRUE THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.clinic_id = v_clinic AND a.paciente_id = p_patient_id AND a.professional_id = v_uid
  ) OR EXISTS (
    SELECT 1 FROM public.physiotherapy_evolutions e
    WHERE e.clinic_id = v_clinic AND e.patient_id = p_patient_id AND e.professional_id = v_uid AND e.deleted_at IS NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_patient_clinical_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_patient_clinical_record(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public._clinical_encounter_394_results (
  assertion_no integer PRIMARY KEY,
  assertion_name text NOT NULL,
  passed boolean NOT NULL DEFAULT true
);
REVOKE ALL ON public._clinical_encounter_394_results FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public._clinical_encounter_394_results TO service_role;

CREATE OR REPLACE FUNCTION public._clinical_encounter_394_pass(p_no integer, p_name text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public._clinical_encounter_394_results(assertion_no, assertion_name, passed)
  VALUES (p_no, p_name, true)
  ON CONFLICT (assertion_no) DO UPDATE SET assertion_name = excluded.assertion_name, passed = true
$$;
REVOKE ALL ON FUNCTION public._clinical_encounter_394_pass(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._clinical_encounter_394_pass(integer,text) TO authenticated, anon, service_role;

INSERT INTO public.profiles(id, clinic_id, role, ativo, professional_type, council_type, council_state, registro) VALUES
  ('10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','professional',true,'medico','CRM','RS','TESTE-8'),
  ('10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','professional',false,'medico','CRM','RS','TESTE-9')
ON CONFLICT (id) DO UPDATE SET ativo = excluded.ativo;

INSERT INTO public.professional_capabilities(clinic_id, professional_id, capability_key, granted) VALUES
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000008','clinical.attend',true),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000008','clinical.evolution.write',false),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000009','clinical.attend',true),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000009','clinical.evolution.write',true)
ON CONFLICT (professional_id, capability_key) DO UPDATE SET granted = excluded.granted;

INSERT INTO public.patients(id, clinic_id, funil_stage, status) VALUES
  ('33000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','tratamento','ativo'),
  ('33000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','tratamento','ativo'),
  ('33000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','tratamento','ativo')
ON CONFLICT (id) DO NOTHING;

-- Current-date #394 appointments use the isolated 00:00–06:00 synthetic window;
-- the reused #388 fixture occupies 09:00–15:30. This keeps the real agenda
-- conflict trigger active during all behavior cases without fixture collisions.
INSERT INTO public.appointments(id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim, status, tipo, valor, pacote_id) VALUES
  ('43000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'00:00','00:30','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'00:30','01:00','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',current_date,'01:00','01:30','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'01:30','02:00','agendado','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',current_date,'02:00','02:30','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000008',current_date,'02:30','03:00','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000009',current_date,'03:00','03:30','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'03:30','04:00','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'04:00','04:30','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'04:30','05:00','em_atendimento','Consulta',0,NULL),
  ('43000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date - 10,'14:00','14:30','em_atendimento','Consulta antiga',0,NULL),
  ('43000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'05:00','05:30','em_atendimento','Concorrência',0,NULL),
  ('43000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'05:30','06:00','em_atendimento','Legacy Evolution #394',0,NULL)
ON CONFLICT (id) DO NOTHING;

-- Dedicated legacy compatibility fixture for case 23. This Evolution is created
-- through the pre-#394 legacy path while the appointment is still in progress.
-- No clinical_encounter_record exists for this appointment at fixture time.
INSERT INTO public.physiotherapy_evolutions(
  id, clinic_id, patient_id, professional_id, session_id, texto
) VALUES (
  '53000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '43000000-0000-0000-0000-000000000014',
  'Evolution legada dedicada ao #394'
)
ON CONFLICT (id) DO NOTHING;
