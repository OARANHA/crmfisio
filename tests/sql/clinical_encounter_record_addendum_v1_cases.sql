\echo 'Encounter Record Correction/Addendum V1 behavior cases'

CREATE TEMP TABLE _encounter_addendum_baseline AS
SELECT
  to_jsonb(r) AS record_json,
  to_jsonb(a) AS appointment_json,
  to_jsonb(e) AS evolution_json,
  (SELECT count(*) FROM public.physiotherapy_evolutions x WHERE x.session_id = r.appointment_id) AS evolution_count,
  (SELECT count(*) FROM public.payments p WHERE p.appointment_id = r.appointment_id) AS payment_count
FROM public.clinical_encounter_records r
JOIN public.appointments a ON a.id = r.appointment_id
JOIN public.physiotherapy_evolutions e ON e.id = r.evolution_id
WHERE r.appointment_id = '43000000-0000-0000-0000-000000000009';

SELECT set_config('app.addendum_target_record_id', (SELECT id::text FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000009'), false);
SELECT set_config('app.addendum_draft_record_id', (SELECT id::text FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000001'), false);

DO $$
BEGIN
  IF (SELECT count(*) FROM _encounter_addendum_baseline) <> 1 THEN
    RAISE EXCEPTION 'addendum_baseline_finalized_record_missing';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.create_clinical_encounter_record_addendum(
  current_setting('app.addendum_target_record_id')::uuid,
  '60000000-0000-0000-0000-000000000001',
  'addendum',
  'Complemento clínico posterior',
  'Informação complementar registrada sem alterar o ato original.'
);
RESET ROLE;

DO $$
DECLARE
  x public.clinical_encounter_record_addenda%ROWTYPE;
  r public.clinical_encounter_records%ROWTYPE;
BEGIN
  SELECT * INTO x FROM public.clinical_encounter_record_addenda
  WHERE request_id='60000000-0000-0000-0000-000000000001';
  SELECT * INTO r FROM public.clinical_encounter_records WHERE id=x.encounter_record_id;
  IF x.id IS NULL
     OR x.kind <> 'addendum'
     OR x.author_id <> '10000000-0000-0000-0000-000000000001'
     OR x.original_professional_id <> r.professional_id
     OR x.clinic_id <> r.clinic_id
     OR x.patient_id <> r.patient_id
     OR x.appointment_id <> r.appointment_id
     OR x.evolution_id <> r.evolution_id THEN
    RAISE EXCEPTION 'addendum_server_derived_provenance_invalid';
  END IF;
END $$;

\echo '1) author can append without replacing original — PASS'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.create_clinical_encounter_record_addendum(
  current_setting('app.addendum_target_record_id')::uuid,
  '60000000-0000-0000-0000-000000000001',
  'addendum',
  'Complemento clínico posterior',
  'Informação complementar registrada sem alterar o ato original.'
);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.clinical_encounter_record_addenda
      WHERE request_id='60000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'addendum_retry_duplicated';
  END IF;
END $$;

\echo '2) same request/payload is idempotent — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_clinical_encounter_record_addendum(
      current_setting('app.addendum_target_record_id')::uuid,
      '60000000-0000-0000-0000-000000000001',
      'addendum',
      'Complemento clínico posterior',
      'Payload divergente não pode reaproveitar a chave.'
    );
    RAISE EXCEPTION 'expected_addendum_idempotency_conflict';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM NOT LIKE '%clinical_encounter_addendum_idempotency_conflict%' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '3) same request with divergent payload is rejected — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.create_clinical_encounter_record_addendum(
  current_setting('app.addendum_target_record_id')::uuid,
  '60000000-0000-0000-0000-000000000002',
  'correction',
  'Retificação de informação objetiva',
  'A informação correta passa a ser considerada por este ato posterior.'
);
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.clinical_encounter_record_addenda
      WHERE encounter_record_id = (
        SELECT id FROM public.clinical_encounter_records
        WHERE appointment_id='43000000-0000-0000-0000-000000000009'
      )) <> 2 THEN
    RAISE EXCEPTION 'multiple_addenda_cardinality_invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_encounter_record_addenda
    WHERE request_id='60000000-0000-0000-0000-000000000002'
      AND kind='correction'
  ) THEN
    RAISE EXCEPTION 'correction_kind_not_persisted';
  END IF;
END $$;

\echo '4) multiple append-only acts can coexist — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_clinical_encounter_record_addendum(
      current_setting('app.addendum_draft_record_id')::uuid,
      '60000000-0000-0000-0000-000000000003',
      'addendum',
      'Não deveria aceitar draft',
      'Draft não pode receber adendo.'
    );
    RAISE EXCEPTION 'expected_finalized_record_required';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%clinical_encounter_addendum_finalized_record_required%' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '5) draft Encounter Record cannot receive addendum — PASS'

-- Give professional #2 the missing attend capability so this negative proves
-- original-author enforcement rather than failing earlier on capability.
UPDATE public.professional_capabilities
SET granted = true
WHERE professional_id='10000000-0000-0000-0000-000000000002'
  AND capability_key='clinical.attend';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_clinical_encounter_record_addendum(
      current_setting('app.addendum_target_record_id')::uuid,
      '60000000-0000-0000-0000-000000000004',
      'addendum',
      'Tentativa por outro profissional',
      'Não deve ser aceita.'
    );
    RAISE EXCEPTION 'expected_original_author_required';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%clinical_encounter_addendum_original_author_required%' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '6) another fully capable professional cannot amend the original author record — PASS'

-- Make the clinic owner clinically eligible in this isolated fixture. The RPC
-- still must deny amendment of another professional's finalized record.
UPDATE public.profiles
SET professional_type='medico', council_type='CRM', council_state='RS', registro='OWNER-TESTE'
WHERE id='10000000-0000-0000-0000-000000000005';
INSERT INTO public.professional_capabilities(clinic_id,professional_id,capability_key,granted) VALUES
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','clinical.attend',true),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','clinical.evolution.write',true)
ON CONFLICT (professional_id, capability_key) DO UPDATE SET granted=excluded.granted;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_clinical_encounter_record_addendum(
      current_setting('app.addendum_target_record_id')::uuid,
      '60000000-0000-0000-0000-000000000005',
      'correction',
      'Owner não substitui autoria',
      'Mesmo owner clínico não corrige registro de terceiro.'
    );
    RAISE EXCEPTION 'expected_owner_no_bypass';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%clinical_encounter_addendum_original_author_required%' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '7) clinically eligible owner has no authorship bypass — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_clinical_encounter_record_addendum(
      current_setting('app.addendum_target_record_id')::uuid,
      '60000000-0000-0000-0000-000000000006',
      'addendum',
      'Cross tenant',
      'Não deve atravessar tenant.'
    );
    RAISE EXCEPTION 'expected_cross_tenant_denial';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%clinical_encounter_addendum_tenant_mismatch%' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '8) cross-tenant actor is denied — PASS'

-- The reduced #394 fixture revokes browser table grants after its own cases.
-- Production still has author UPDATE on Evolutions; restore that exact reachability
-- only for this negative test so the new immutable trigger, not a missing grant,
-- is what blocks rewriting the official finalized Evolution.
GRANT SELECT, UPDATE ON public.physiotherapy_evolutions TO authenticated;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  evo_id uuid;
BEGIN
  SELECT evolution_id INTO evo_id
  FROM public.clinical_encounter_records
  WHERE appointment_id='43000000-0000-0000-0000-000000000009';
  BEGIN
    UPDATE public.physiotherapy_evolutions
    SET texto = texto || ' MUTACAO INDEVIDA'
    WHERE id=evo_id;
    RAISE EXCEPTION 'expected_finalized_evolution_immutable';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%clinical_encounter_evolution_finalized_immutable%' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;
REVOKE UPDATE, SELECT ON public.physiotherapy_evolutions FROM authenticated;

\echo '9) authenticated original author cannot rewrite finalized official Evolution — PASS'

DO $$
BEGIN
  UPDATE public.physiotherapy_evolutions
  SET texto = 'Evolution legada continua fora do freeze #394'
  WHERE id='53000000-0000-0000-0000-000000000014';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'legacy_evolution_fixture_missing';
  END IF;
END $$;

\echo '10) unrelated legacy Evolution lifecycle is not frozen incidentally — PASS'

DO $$
DECLARE
  addendum_id uuid;
BEGIN
  SELECT id INTO addendum_id
  FROM public.clinical_encounter_record_addenda
  WHERE request_id='60000000-0000-0000-0000-000000000001';
  BEGIN
    UPDATE public.clinical_encounter_record_addenda
    SET content='tentativa de sobrescrita'
    WHERE id=addendum_id;
    RAISE EXCEPTION 'expected_addendum_update_immutable';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%clinical_encounter_addendum_immutable%' THEN
      RAISE;
    END IF;
  END;
  BEGIN
    DELETE FROM public.clinical_encounter_record_addenda
    WHERE id=addendum_id;
    RAISE EXCEPTION 'expected_addendum_delete_immutable';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%clinical_encounter_addendum_immutable%' THEN
      RAISE;
    END IF;
  END;
END $$;

\echo '11) correction/addendum ledger is append-only — PASS'

DO $$
DECLARE
  baseline _encounter_addendum_baseline%ROWTYPE;
  r public.clinical_encounter_records%ROWTYPE;
  a public.appointments%ROWTYPE;
  e public.physiotherapy_evolutions%ROWTYPE;
BEGIN
  SELECT * INTO baseline FROM _encounter_addendum_baseline;
  SELECT * INTO r FROM public.clinical_encounter_records
  WHERE appointment_id='43000000-0000-0000-0000-000000000009';
  SELECT * INTO a FROM public.appointments WHERE id=r.appointment_id;
  SELECT * INTO e FROM public.physiotherapy_evolutions WHERE id=r.evolution_id;
  IF to_jsonb(r) IS DISTINCT FROM baseline.record_json
     OR to_jsonb(a) IS DISTINCT FROM baseline.appointment_json
     OR to_jsonb(e) IS DISTINCT FROM baseline.evolution_json THEN
    RAISE EXCEPTION 'addendum_mutated_original_clinical_state';
  END IF;
  IF (SELECT count(*) FROM public.physiotherapy_evolutions x WHERE x.session_id=r.appointment_id)
       IS DISTINCT FROM baseline.evolution_count THEN
    RAISE EXCEPTION 'addendum_created_second_evolution';
  END IF;
  IF (SELECT count(*) FROM public.payments p WHERE p.appointment_id=r.appointment_id)
       IS DISTINCT FROM baseline.payment_count THEN
    RAISE EXCEPTION 'addendum_changed_financial_effects';
  END IF;
END $$;

\echo '12) addendum has zero appointment/Evolution/financial side effects — PASS'

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.clinical_encounter_record_addenda','INSERT')
     OR has_table_privilege('authenticated','public.clinical_encounter_record_addenda','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_encounter_record_addenda','DELETE') THEN
    RAISE EXCEPTION 'authenticated_direct_addendum_write_grant_present';
  END IF;
  IF NOT has_table_privilege('authenticated','public.clinical_encounter_record_addenda','SELECT') THEN
    RAISE EXCEPTION 'authenticated_addendum_read_grant_missing';
  END IF;
END $$;

\echo '13) browser writes are RPC-only — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clinical_encounter_record_addenda
    WHERE patient_id='33000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'cross_tenant_addendum_visible';
  END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clinical_encounter_record_addenda
    WHERE patient_id='33000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'reception_addendum_visible';
  END IF;
END $$;
RESET ROLE;

\echo '14) RLS hides addenda from cross-tenant and reception actors — PASS'

\echo 'Encounter Record Correction/Addendum V1 behavior PASS'
