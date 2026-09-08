-- MEDICSPRO — Nexus C-02 trusted result write contract
-- required_capability is derived from an exact versioned server-side contract.
-- C-01 read guards and C-06 authorization helpers are prerequisites only.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- C-06 must remain byte-identical.
DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('public.current_clinic_id()', '678fac3c2bb8698a44f8a9d9b282f53d'),
      ('public.current_app_role()', '7b2e6e62d9fb349ba6aa48c0744c34a7'),
      ('public.current_nexus_medical_identity_valid()', '59f4b68dda8c2c166ba803ad62f2b509'),
      ('public.current_nexus_entitlement_allowed()', 'fb31e7618a47bd017ad21ec60b12b084'),
      ('public.has_professional_capability(text)', '501cf03c6f0a99ca970f3f491c64083b'),
      ('public.can_access_patient_clinical_record(uuid)', '6a9314528b66df705c5ff36c3619831d'),
      ('public.list_patient_clinical_snapshot()', '2dfeb251865ec09623324341564b10f9')
    ) AS v(signature, body_md5)
  LOOP
    SELECT p.* INTO actual
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(expected.signature);

    IF NOT FOUND
       OR md5(actual.prosrc) <> expected.body_md5
       OR NOT actual.prosecdef
       OR actual.provolatile <> 's'
       OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'], false)
       OR NOT has_function_privilege('authenticated', actual.oid, 'EXECUTE')
       OR has_function_privilege('anon', actual.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'nexus_c02_c06_helper_drift: %', expected.signature;
    END IF;
  END LOOP;
END;
$$;

-- C-01 policies are inspected exactly as in the proven C-06 guard check.
DO $$
DECLARE
  expected record;
  actual record;
  expr text;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('nexus_clinical_results', 'nexus_results_read_care_relationship', 'nexus_results_read_guard', false),
      ('nexus_red_flags', 'nexus_red_flags_read_care_relationship', 'nexus_red_flags_read_guard', false),
      ('nexus_self_assessment_invites', 'nexus_self_assessment_care_read', 'nexus_self_assessment_read_guard', true)
    ) AS v(table_name, allow_name, guard_name, scales)
  LOOP
    expr := 'clinic_id=current_clinic_idANDcan_access_patient_clinical_recordpatient_idANDhas_professional_capability''nexus.access''';
    IF expected.scales THEN
      expr := expr || 'ANDhas_professional_capability''nexus.scales''';
    END IF;

    FOR actual IN
      SELECT *
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = expected.table_name
        AND policyname IN (expected.allow_name, expected.guard_name)
    LOOP
      IF actual.cmd <> 'SELECT'
         OR actual.with_check IS NOT NULL
         OR actual.permissive <> (
           CASE
             WHEN actual.policyname = expected.guard_name THEN 'RESTRICTIVE'
             ELSE 'PERMISSIVE'
           END
         )
         OR actual.roles <> (
           CASE
             WHEN actual.policyname = expected.guard_name
               THEN ARRAY['public']::name[]
             ELSE ARRAY['authenticated']::name[]
           END
         )
         OR regexp_replace(
              replace(replace(actual.qual, 'public.', ''), '::text', ''),
              '[[:space:]()]', '', 'g'
            ) IS DISTINCT FROM expr THEN
        RAISE EXCEPTION 'nexus_c02_c01_policy_drift: %', actual.policyname;
      END IF;
    END LOOP;

    IF (
      SELECT count(*)
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = expected.table_name
        AND policyname IN (expected.allow_name, expected.guard_name)
    ) <> 2 THEN
      RAISE EXCEPTION 'nexus_c02_c01_policy_missing: %', expected.table_name;
    END IF;
  END LOOP;
END;
$$;

-- Refuse unreviewed write-context drift before replacing the trigger helper.
DO $$
DECLARE
  v_md5 text;
BEGIN
  SELECT md5(p.prosrc) INTO v_md5
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.validate_nexus_result_context()');

  IF v_md5 IS NULL OR v_md5 NOT IN (
    '9951beb5a10ba4b5b9485cd1b1e077d1',
    'd61defde034772ae91a87ed47cb16c03'
  ) THEN
    RAISE EXCEPTION 'nexus_c02_context_helper_drift';
  END IF;
END;
$$;

-- Historical rows must already correspond to one of the contracts implemented
-- by the current code. No migration-time guessing/backfill is permitted.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.nexus_clinical_results r
    LEFT JOIN (VALUES
      ('eem'::text, 'eem'::text, 'nexus.eem'::text, 'nexus-eem-2026-09-03'::text, 'nexus.eem'::text),
      ('scales', 'phq9', 'nexus.phq9', 'nexus-2026-09-03', 'nexus.scales'),
      ('scales', 'gad7', 'nexus.gad7', 'nexus-2026-09-03', 'nexus.scales')
    ) AS c(module_key, tool_key, rule_key, rule_version, required_capability)
      ON c.module_key = r.module_key
     AND c.tool_key = r.tool_key
     AND c.rule_key = r.rule_key
     AND c.rule_version = r.rule_version
    WHERE c.module_key IS NULL
       OR r.required_capability IS DISTINCT FROM c.required_capability
  ) THEN
    RAISE EXCEPTION 'nexus_c02_existing_result_contract_unmapped';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.nexus_result_contracts (
  module_key text NOT NULL,
  tool_key text NOT NULL,
  rule_key text NOT NULL,
  rule_version text NOT NULL,
  required_capability text NOT NULL
    REFERENCES public.capability_catalog(capability_key),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_result_contracts_pkey
    PRIMARY KEY (module_key, tool_key, rule_key, rule_version),
  CONSTRAINT nexus_result_contracts_nonblank CHECK (
    module_key = btrim(module_key) AND module_key <> ''
    AND tool_key = btrim(tool_key) AND tool_key <> ''
    AND rule_key = btrim(rule_key) AND rule_key <> ''
    AND rule_version = btrim(rule_version) AND rule_version <> ''
    AND required_capability = btrim(required_capability)
    AND required_capability LIKE 'nexus.%'
  )
);

ALTER TABLE public.nexus_result_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nexus_result_contracts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.nexus_result_contracts TO service_role;

INSERT INTO public.nexus_result_contracts(
  module_key, tool_key, rule_key, rule_version, required_capability
) VALUES
  ('eem', 'eem', 'nexus.eem', 'nexus-eem-2026-09-03', 'nexus.eem'),
  ('scales', 'phq9', 'nexus.phq9', 'nexus-2026-09-03', 'nexus.scales'),
  ('scales', 'gad7', 'nexus.gad7', 'nexus-2026-09-03', 'nexus.scales')
ON CONFLICT (module_key, tool_key, rule_key, rule_version) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.nexus_result_contracts) <> 3
     OR NOT EXISTS (
       SELECT 1 FROM public.nexus_result_contracts
       WHERE module_key='eem' AND tool_key='eem' AND rule_key='nexus.eem'
         AND rule_version='nexus-eem-2026-09-03' AND required_capability='nexus.eem'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.nexus_result_contracts
       WHERE module_key='scales' AND tool_key='phq9' AND rule_key='nexus.phq9'
         AND rule_version='nexus-2026-09-03' AND required_capability='nexus.scales'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.nexus_result_contracts
       WHERE module_key='scales' AND tool_key='gad7' AND rule_key='nexus.gad7'
         AND rule_version='nexus-2026-09-03' AND required_capability='nexus.scales'
     ) THEN
    RAISE EXCEPTION 'nexus_c02_contract_registry_drift';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_nexus_result_required_capability(
  p_module_key text,
  p_tool_key text,
  p_rule_key text,
  p_rule_version text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.required_capability
  FROM public.nexus_result_contracts c
  WHERE c.module_key = nullif(trim(p_module_key), '')
    AND c.tool_key = nullif(trim(p_tool_key), '')
    AND c.rule_key = nullif(trim(p_rule_key), '')
    AND c.rule_version = nullif(trim(p_rule_version), '')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_nexus_result_required_capability(text,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_nexus_result_required_capability(text,text,text,text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_nexus_result_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid := public.current_clinic_id();
  v_required_capability text;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  v_required_capability := public.resolve_nexus_result_required_capability(
    NEW.module_key,
    NEW.tool_key,
    NEW.rule_key,
    NEW.rule_version
  );

  IF v_required_capability IS NULL THEN
    RAISE EXCEPTION 'nexus_result_contract_unknown';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.module_key IS DISTINCT FROM OLD.module_key
    OR NEW.tool_key IS DISTINCT FROM OLD.tool_key
    OR NEW.rule_key IS DISTINCT FROM OLD.rule_key
    OR NEW.rule_version IS DISTINCT FROM OLD.rule_version
    OR NEW.required_capability IS DISTINCT FROM OLD.required_capability
  ) THEN
    RAISE EXCEPTION 'nexus_result_contract_immutable';
  END IF;

  IF NEW.required_capability IS NOT NULL
     AND NEW.required_capability IS DISTINCT FROM v_required_capability THEN
    RAISE EXCEPTION 'nexus_result_required_capability_mismatch';
  END IF;

  NEW.required_capability := v_required_capability;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_clinic_id;
  ELSIF NEW.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'clinic_id incompatível com o usuário autenticado';
  END IF;

  IF NEW.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'professional_id deve ser o profissional autenticado';
  END IF;

  IF NOT public.has_professional_capability(v_required_capability) THEN
    RAISE EXCEPTION 'Profissional sem capability para esta ferramenta Nexus';
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

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.professional_id
      AND p.clinic_id = v_clinic_id
      AND p.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para esta clínica';
  END IF;

  IF NEW.appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = NEW.appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = NEW.patient_id
      AND a.professional_id = NEW.professional_id
  ) THEN
    RAISE EXCEPTION 'Atendimento incompatível com paciente, clínica ou profissional';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_nexus_result_context() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_nexus_result_context ON public.nexus_clinical_results;
CREATE TRIGGER trg_nexus_result_context
BEFORE INSERT OR UPDATE OF
  clinic_id, patient_id, professional_id, appointment_id,
  module_key, tool_key, rule_key, rule_version, required_capability
ON public.nexus_clinical_results
FOR EACH ROW EXECUTE FUNCTION public.validate_nexus_result_context();

DROP POLICY IF EXISTS nexus_results_insert_author ON public.nexus_clinical_results;
CREATE POLICY nexus_results_insert_author
ON public.nexus_clinical_results
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status = 'draft'
  AND public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version) IS NOT NULL
  AND required_capability = public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version)
  AND public.has_professional_capability(
    public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version)
  )
);

DROP POLICY IF EXISTS nexus_results_update_author ON public.nexus_clinical_results;
CREATE POLICY nexus_results_update_author
ON public.nexus_clinical_results
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status = 'draft'
  AND public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version) IS NOT NULL
  AND required_capability = public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version)
  AND public.has_professional_capability(
    public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version)
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status IN ('draft', 'finalized')
  AND public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version) IS NOT NULL
  AND required_capability = public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version)
  AND public.has_professional_capability(
    public.resolve_nexus_result_required_capability(module_key, tool_key, rule_key, rule_version)
  )
);

-- Postconditions: exact reviewed helper bodies and trigger columns.
DO $$
DECLARE
  actual record;
  trigger_def text;
BEGIN
  SELECT p.* INTO actual
  FROM pg_proc p
  WHERE p.oid='public.resolve_nexus_result_required_capability(text,text,text,text)'::regprocedure;
  IF NOT FOUND
     OR md5(actual.prosrc) <> '3c780dc05d82c9d1b4e087f563892e40'
     OR NOT actual.prosecdef
     OR actual.provolatile <> 's'
     OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'], false)
     OR NOT has_function_privilege('authenticated', actual.oid, 'EXECUTE')
     OR has_function_privilege('anon', actual.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'nexus_c02_resolver_postcondition_failed';
  END IF;

  SELECT p.* INTO actual
  FROM pg_proc p
  WHERE p.oid='public.validate_nexus_result_context()'::regprocedure;
  IF NOT FOUND
     OR md5(actual.prosrc) <> 'd61defde034772ae91a87ed47cb16c03'
     OR NOT actual.prosecdef
     OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'], false) THEN
    RAISE EXCEPTION 'nexus_c02_context_postcondition_failed';
  END IF;

  SELECT pg_get_triggerdef(t.oid) INTO trigger_def
  FROM pg_trigger t
  WHERE t.tgrelid='public.nexus_clinical_results'::regclass
    AND t.tgname='trg_nexus_result_context'
    AND NOT t.tgisinternal;

  IF trigger_def IS NULL
     OR position('module_key' IN trigger_def)=0
     OR position('tool_key' IN trigger_def)=0
     OR position('rule_key' IN trigger_def)=0
     OR position('rule_version' IN trigger_def)=0
     OR position('required_capability' IN trigger_def)=0 THEN
    RAISE EXCEPTION 'nexus_c02_context_trigger_postcondition_failed';
  END IF;
END;
$$;

COMMIT;
