-- MedicsPro — prontuário SOAP multiprofissional canônico
-- Camada aditiva: preserva physiotherapy_* e cria contrato clínico novo para MedicsPro + Nexus.

BEGIN;

CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  note_type text NOT NULL DEFAULT 'soap' CHECK (note_type = 'soap'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  subjective text NOT NULL DEFAULT '',
  objective text NOT NULL DEFAULT '',
  assessment text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT '',
  structured_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  amends_note_id uuid REFERENCES public.clinical_notes(id) ON DELETE RESTRICT,
  signed_at timestamptz,
  signed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(structured_data) = 'object'),
  CHECK (
    (status = 'draft' AND signed_at IS NULL AND signed_by IS NULL)
    OR (status = 'signed' AND signed_at IS NOT NULL AND signed_by IS NOT NULL)
  )
);

-- Um prontuário primário por atendimento. Adendos usam amends_note_id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinical_notes_primary_appointment
  ON public.clinical_notes(appointment_id)
  WHERE appointment_id IS NOT NULL AND amends_note_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient_created
  ON public.clinical_notes(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_professional_created
  ON public.clinical_notes(professional_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.clinical_note_imports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  nexus_result_id uuid NOT NULL REFERENCES public.nexus_clinical_results(id) ON DELETE RESTRICT,
  target_section text NOT NULL CHECK (target_section IN ('subjective', 'objective', 'assessment', 'plan')),
  suggested_text text NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, nexus_result_id, target_section),
  CHECK (
    (status = 'proposed' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status IN ('accepted', 'rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_clinical_note_imports_note
  ON public.clinical_note_imports(note_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_clinical_note_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid := public.current_clinic_id();
  v_amended public.clinical_notes%ROWTYPE;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_clinic_id;
  ELSIF NEW.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'clinic_id incompatível com o usuário autenticado';
  END IF;

  IF NEW.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'professional_id deve ser o profissional autenticado';
  END IF;

  IF NOT public.has_professional_capability('clinical.soap') THEN
    RAISE EXCEPTION 'Profissional sem capability clinical.soap';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.professional_id
      AND p.clinic_id = v_clinic_id
      AND p.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para esta clínica';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.clinic_id = v_clinic_id
      AND p.deleted_at IS NULL
      AND coalesce(p.anonimizado, false) IS FALSE
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica';
  END IF;

  IF NEW.appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = NEW.appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = NEW.patient_id
  ) THEN
    RAISE EXCEPTION 'Atendimento incompatível com paciente/clínica';
  END IF;

  IF NEW.amends_note_id IS NOT NULL THEN
    SELECT * INTO v_amended
    FROM public.clinical_notes n
    WHERE n.id = NEW.amends_note_id;

    IF v_amended.id IS NULL
       OR v_amended.clinic_id <> v_clinic_id
       OR v_amended.patient_id <> NEW.patient_id
       OR v_amended.status <> 'signed' THEN
      RAISE EXCEPTION 'Adendo deve referenciar prontuário assinado do mesmo paciente/clínica';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_note_context ON public.clinical_notes;
CREATE TRIGGER trg_clinical_note_context
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, professional_id, appointment_id, amends_note_id
ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_note_context();

CREATE OR REPLACE FUNCTION public.guard_clinical_note_signature()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'signed' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Prontuário assinado é imutável; crie um adendo';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'signed' THEN
    IF OLD.professional_id <> auth.uid() OR NEW.professional_id <> auth.uid() THEN
      RAISE EXCEPTION 'Somente o autor pode assinar o prontuário';
    END IF;
    IF NOT public.has_professional_capability('clinical.soap') THEN
      RAISE EXCEPTION 'Profissional sem capability clinical.soap';
    END IF;
    NEW.signed_at := coalesce(NEW.signed_at, now());
    NEW.signed_by := auth.uid();
  ELSIF NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Transição de status inválida';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_note_signature ON public.clinical_notes;
CREATE TRIGGER trg_clinical_note_signature
BEFORE UPDATE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_note_signature();

CREATE OR REPLACE FUNCTION public.validate_clinical_note_import_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note public.clinical_notes%ROWTYPE;
  v_result public.nexus_clinical_results%ROWTYPE;
BEGIN
  SELECT * INTO v_note FROM public.clinical_notes WHERE id = NEW.note_id;
  SELECT * INTO v_result FROM public.nexus_clinical_results WHERE id = NEW.nexus_result_id;

  IF v_note.id IS NULL OR v_result.id IS NULL THEN
    RAISE EXCEPTION 'Prontuário ou resultado Nexus inexistente';
  END IF;

  IF v_note.clinic_id <> public.current_clinic_id()
     OR v_result.clinic_id <> v_note.clinic_id
     OR v_result.patient_id <> v_note.patient_id THEN
    RAISE EXCEPTION 'Importação Nexus incompatível com prontuário/paciente/clínica';
  END IF;

  IF v_note.status <> 'draft' THEN
    RAISE EXCEPTION 'Somente prontuário em rascunho aceita importações';
  END IF;

  IF v_note.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o autor do prontuário pode importar conteúdo';
  END IF;

  IF v_result.status <> 'finalized' THEN
    RAISE EXCEPTION 'Somente resultado Nexus finalizado pode ser importado';
  END IF;

  NEW.clinic_id := v_note.clinic_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_note_import_context ON public.clinical_note_imports;
CREATE TRIGGER trg_clinical_note_import_context
BEFORE INSERT OR UPDATE OF clinic_id, note_id, nexus_result_id
ON public.clinical_note_imports
FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_note_import_context();

CREATE OR REPLACE FUNCTION public.accept_clinical_note_import(p_import_id uuid)
RETURNS public.clinical_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import public.clinical_note_imports%ROWTYPE;
  v_note public.clinical_notes%ROWTYPE;
  v_text text;
BEGIN
  SELECT * INTO v_import
  FROM public.clinical_note_imports i
  WHERE i.id = p_import_id
  FOR UPDATE;

  IF v_import.id IS NULL OR v_import.status <> 'proposed' THEN
    RAISE EXCEPTION 'Importação inexistente ou já revisada';
  END IF;

  SELECT * INTO v_note
  FROM public.clinical_notes n
  WHERE n.id = v_import.note_id
  FOR UPDATE;

  IF v_note.status <> 'draft'
     OR v_note.professional_id <> auth.uid()
     OR v_note.clinic_id <> public.current_clinic_id()
     OR NOT public.has_professional_capability('clinical.soap') THEN
    RAISE EXCEPTION 'Prontuário não pode receber esta importação';
  END IF;

  v_text := trim(v_import.suggested_text);

  IF v_import.target_section = 'subjective' THEN
    UPDATE public.clinical_notes SET subjective = concat_ws(E'\n', nullif(trim(subjective), ''), v_text) WHERE id = v_note.id RETURNING * INTO v_note;
  ELSIF v_import.target_section = 'objective' THEN
    UPDATE public.clinical_notes SET objective = concat_ws(E'\n', nullif(trim(objective), ''), v_text) WHERE id = v_note.id RETURNING * INTO v_note;
  ELSIF v_import.target_section = 'assessment' THEN
    UPDATE public.clinical_notes SET assessment = concat_ws(E'\n', nullif(trim(assessment), ''), v_text) WHERE id = v_note.id RETURNING * INTO v_note;
  ELSIF v_import.target_section = 'plan' THEN
    UPDATE public.clinical_notes SET plan = concat_ws(E'\n', nullif(trim(plan), ''), v_text) WHERE id = v_note.id RETURNING * INTO v_note;
  ELSE
    RAISE EXCEPTION 'Seção SOAP inválida';
  END IF;

  UPDATE public.clinical_note_imports
  SET status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = v_import.id;

  RETURN v_note;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_clinical_note_import(p_import_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import public.clinical_note_imports%ROWTYPE;
  v_note public.clinical_notes%ROWTYPE;
BEGIN
  SELECT * INTO v_import FROM public.clinical_note_imports WHERE id = p_import_id FOR UPDATE;
  IF v_import.id IS NULL OR v_import.status <> 'proposed' THEN
    RAISE EXCEPTION 'Importação inexistente ou já revisada';
  END IF;

  SELECT * INTO v_note FROM public.clinical_notes WHERE id = v_import.note_id;
  IF v_note.status <> 'draft'
     OR v_note.professional_id <> auth.uid()
     OR v_note.clinic_id <> public.current_clinic_id() THEN
    RAISE EXCEPTION 'Prontuário não pode revisar esta importação';
  END IF;

  UPDATE public.clinical_note_imports
  SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = v_import.id;
END;
$$;

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_note_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_notes_read_scope ON public.clinical_notes;
CREATE POLICY clinical_notes_read_scope
ON public.clinical_notes FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner', 'admin')
    OR public.has_professional_capability('clinical.patient_timeline')
    OR professional_id = auth.uid()
  )
);

DROP POLICY IF EXISTS clinical_notes_insert_author ON public.clinical_notes;
CREATE POLICY clinical_notes_insert_author
ON public.clinical_notes FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status = 'draft'
  AND public.has_professional_capability('clinical.soap')
);

DROP POLICY IF EXISTS clinical_notes_update_author ON public.clinical_notes;
CREATE POLICY clinical_notes_update_author
ON public.clinical_notes FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status = 'draft'
  AND public.has_professional_capability('clinical.soap')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status IN ('draft', 'signed')
  AND public.has_professional_capability('clinical.soap')
);

DROP POLICY IF EXISTS clinical_note_imports_read_scope ON public.clinical_note_imports;
CREATE POLICY clinical_note_imports_read_scope
ON public.clinical_note_imports FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.clinical_notes n
    WHERE n.id = note_id
      AND (
        n.professional_id = auth.uid()
        OR public.current_app_role() IN ('owner', 'admin')
        OR public.has_professional_capability('clinical.patient_timeline')
      )
  )
);

DROP POLICY IF EXISTS clinical_note_imports_insert_author ON public.clinical_note_imports;
CREATE POLICY clinical_note_imports_insert_author
ON public.clinical_note_imports FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND status = 'proposed'
  AND EXISTS (
    SELECT 1 FROM public.clinical_notes n
    WHERE n.id = note_id
      AND n.professional_id = auth.uid()
      AND n.status = 'draft'
  )
);

GRANT SELECT, INSERT, UPDATE ON public.clinical_notes TO authenticated;
GRANT SELECT, INSERT ON public.clinical_note_imports TO authenticated;
REVOKE ALL ON FUNCTION public.accept_clinical_note_import(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_clinical_note_import(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_clinical_note_import(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_clinical_note_import(uuid) TO authenticated;

COMMIT;
