\echo 'Clinical Encounter Record #394 behavior cases'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

\echo '1) foundation table exists'
DO $$ BEGIN
  IF to_regclass('public.clinical_encounter_records') IS NULL THEN RAISE EXCEPTION 'clinical_encounter_table_missing'; END IF;
  PERFORM public._clinical_encounter_394_pass(1, 'foundation exists');
END $$;

\echo '2) one canonical Encounter Record per appointment'
SELECT public.save_clinical_encounter_record(
  '43000000-0000-0000-0000-000000000001', 0,
  'Hipertensão e revisão de tratamento', '', '', '', 'Manter acompanhamento', ''
);
RESET ROLE;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.clinical_encounter_records(clinic_id, appointment_id, patient_id, professional_id)
    VALUES ('00000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'duplicate_encounter_record_allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(2, 'one record per appointment');
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

\echo '3) tenant/patient/professional are derived from the appointment and actor'
DO $$ DECLARE r public.clinical_encounter_records%ROWTYPE; BEGIN
  SELECT * INTO r FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000001';
  IF r.clinic_id <> '00000000-0000-0000-0000-000000000001' OR r.patient_id <> '33000000-0000-0000-0000-000000000001' OR r.professional_id <> '10000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'derived_provenance_invalid';
  END IF;
  PERFORM public._clinical_encounter_394_pass(3, 'server-derived provenance');
END $$;

\echo '4) other tenant is denied'
DO $$ BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000005',0,'x','','','','','');
    RAISE EXCEPTION 'cross_tenant_save_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(4, 'other tenant denied');
END $$;

\echo '5) other professional is denied'
DO $$ BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000003',0,'x','','','','','');
    RAISE EXCEPTION 'cross_professional_save_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(5, 'other professional denied');
END $$;

\echo '6) inactive profile is denied'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000009', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000007',0,'x','','','','','');
    RAISE EXCEPTION 'inactive_profile_save_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(6, 'inactive profile denied');
END $$;

\echo '7) missing clinical.attend is denied'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000003',0,'x','','','','','');
    RAISE EXCEPTION 'missing_attend_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(7, 'clinical.attend required');
END $$;

\echo '8) missing clinical.evolution.write is denied'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000008', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000006',0,'x','','','','','');
    RAISE EXCEPTION 'missing_evolution_write_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(8, 'clinical.evolution.write required');
END $$;

\echo '9) appointment not em_atendimento cannot create draft'
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000004',0,'x','','','','','');
    RAISE EXCEPTION 'inactive_appointment_save_allowed';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(9, 'active appointment required');
END $$;

\echo '10) linkage cannot be reassigned by browser payload or direct update'
DO $$ BEGIN
  BEGIN
    UPDATE public.clinical_encounter_records SET professional_id='10000000-0000-0000-0000-000000000002'
    WHERE appointment_id='43000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'direct_linkage_update_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(10, 'linkage reassignment denied');
END $$;

\echo '11) stale revision is rejected without overwriting newer content'
SELECT public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000001',1,'Revisão B','','','','Plano B','');
DO $$ BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000001',1,'ABA A ANTIGA','','','','SOBRESCREVER','');
    RAISE EXCEPTION 'stale_revision_overwrote';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000001' AND reason='ABA A ANTIGA') THEN
    RAISE EXCEPTION 'stale_content_persisted';
  END IF;
  PERFORM public._clinical_encounter_394_pass(11, 'stale revision rejected');
END $$;

\echo '12) correct author can save draft and revision advances'
DO $$ DECLARE r public.clinical_encounter_records%ROWTYPE; BEGIN
  SELECT * INTO r FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000001';
  IF r.status <> 'draft' OR r.revision <> 2 OR r.reason <> 'Revisão B' THEN RAISE EXCEPTION 'draft_save_state_invalid'; END IF;
  PERFORM public._clinical_encounter_394_pass(12, 'author draft save');
END $$;

\echo '13) finalized record is immutable'
SELECT public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000009',0,'Dor lombar','','Exame sem sinais de alarme','','Orientações e retorno','');
SELECT public.finalize_clinical_encounter_record('43000000-0000-0000-0000-000000000009',1);
RESET ROLE;
DO $$ BEGIN
  BEGIN
    UPDATE public.clinical_encounter_records SET plan='mutação destrutiva' WHERE appointment_id='43000000-0000-0000-0000-000000000009';
    RAISE EXCEPTION 'finalized_record_mutable';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(13, 'finalized immutable');
END $$;

\echo '14) browser hard delete and anonymous read are denied'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  BEGIN
    DELETE FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'browser_hard_delete_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(14, 'hard delete browser denied');
END $$;

\echo '15) completely empty content cannot finalize'
SELECT public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000002',0,'','','','','','');
DO $$ BEGIN
  BEGIN
    PERFORM public.finalize_clinical_encounter_record('43000000-0000-0000-0000-000000000002',1);
    RAISE EXCEPTION 'empty_record_finalized';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(15, 'empty finalization denied');
END $$;

\echo '16) materialization omits empty sections'
DO $$ DECLARE t text; BEGIN
  t := public.materialize_clinical_encounter_evolution('Motivo X','','','Avaliação X','','');
  IF t <> E'Motivo / demandas\nMotivo X\n\nAvaliação clínica / problemas\nAvaliação X' OR position('História atual' in t) > 0 OR position('Observações' in t) > 0 THEN
    RAISE EXCEPTION 'materialization_empty_sections_not_omitted: %', t;
  END IF;
  PERFORM public._clinical_encounter_394_pass(16, 'empty sections omitted');
END $$;

\echo '17) materialization invents no content'
DO $$ DECLARE t text; BEGIN
  t := public.materialize_clinical_encounter_evolution('','','','','','Nota objetiva');
  IF t <> E'Observações\nNota objetiva' OR t ILIKE '%não informado%' OR t ILIKE '%N/A%' THEN RAISE EXCEPTION 'materialization_invented_content'; END IF;
  PERFORM public._clinical_encounter_394_pass(17, 'no invented content');
END $$;

\echo '18) generated Evolution has exact clinic/patient/professional/session'
DO $$ DECLARE e public.physiotherapy_evolutions%ROWTYPE; r public.clinical_encounter_records%ROWTYPE; BEGIN
  SELECT * INTO r FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000009';
  SELECT * INTO e FROM public.physiotherapy_evolutions WHERE id=r.evolution_id;
  IF e.clinic_id<>r.clinic_id OR e.patient_id<>r.patient_id OR e.professional_id<>r.professional_id OR e.session_id<>r.appointment_id THEN RAISE EXCEPTION 'generated_evolution_provenance_invalid'; END IF;
  PERFORM public._clinical_encounter_394_pass(18, 'exact generated evolution provenance');
END $$;

\echo '19) Evolution exists before appointment transition completes'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.physiotherapy_evolutions e JOIN public.appointments a ON a.id=e.session_id WHERE a.id='43000000-0000-0000-0000-000000000009' AND a.status='finalizado') THEN RAISE EXCEPTION 'evolution_not_materialized_before_final_state'; END IF;
  PERFORM public._clinical_encounter_394_pass(19, 'evolution precedes final state');
END $$;

\echo '20) transactional finalization satisfies require_evolution_before_finalize'
DO $$ BEGIN
  IF (SELECT status FROM public.appointments WHERE id='43000000-0000-0000-0000-000000000009') <> 'finalizado' THEN RAISE EXCEPTION 'appointment_not_finalized'; END IF;
  IF (SELECT status FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000009') <> 'finalized' THEN RAISE EXCEPTION 'record_not_finalized'; END IF;
  PERFORM public._clinical_encounter_394_pass(20, 'require evolution boundary satisfied');
END $$;

\echo '21) double finalize creates no second Evolution'
SELECT public.finalize_clinical_encounter_record('43000000-0000-0000-0000-000000000009',1);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.physiotherapy_evolutions WHERE session_id='43000000-0000-0000-0000-000000000009' AND deleted_at IS NULL) <> 1 THEN RAISE EXCEPTION 'double_finalize_duplicate_evolution'; END IF;
  PERFORM public._clinical_encounter_394_pass(21, 'double finalize no duplicate');
END $$;

\echo '22) retry is idempotent and preserves the same evolution link'
DO $$ DECLARE before_id uuid; after_id uuid; BEGIN
  SELECT evolution_id INTO before_id FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000009';
  SELECT evolution_id INTO after_id FROM public.finalize_clinical_encounter_record('43000000-0000-0000-0000-000000000009',1);
  IF before_id IS NULL OR after_id IS DISTINCT FROM before_id THEN RAISE EXCEPTION 'finalize_retry_not_idempotent'; END IF;
  PERFORM public._clinical_encounter_394_pass(22, 'retry idempotent');
END $$;

\echo '23) legacy Evolution is preserved and not duplicated'
DO $$ BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000014',0,'não criar','','','','','');
    RAISE EXCEPTION 'legacy_evolution_received_encounter_record';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  UPDATE public.appointments SET status='finalizado' WHERE id='43000000-0000-0000-0000-000000000014';
  IF (SELECT count(*) FROM public.physiotherapy_evolutions WHERE session_id='43000000-0000-0000-0000-000000000014' AND deleted_at IS NULL) <> 1 THEN RAISE EXCEPTION 'legacy_evolution_duplicated'; END IF;
  IF EXISTS (SELECT 1 FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000014') THEN RAISE EXCEPTION 'legacy_record_backfilled'; END IF;
  PERFORM public._clinical_encounter_394_pass(23, 'legacy evolution compatibility');
END $$;

\echo '24) draft plus competing Evolution fails closed'
SELECT public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000008',0,'Rascunho concorrente','','','','','');
RESET ROLE;
INSERT INTO public.physiotherapy_evolutions(id,clinic_id,patient_id,professional_id,session_id,texto,created_at)
VALUES ('53000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000008','Evolution externa',now());
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.finalize_clinical_encounter_record('43000000-0000-0000-0000-000000000008',1);
    RAISE EXCEPTION 'competing_evolution_silently_won';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
  END;
  IF (SELECT status FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000008') <> 'draft' THEN RAISE EXCEPTION 'competing_evolution_changed_draft'; END IF;
  IF (SELECT count(*) FROM public.physiotherapy_evolutions WHERE session_id='43000000-0000-0000-0000-000000000008') <> 1 THEN RAISE EXCEPTION 'competing_evolution_duplicated'; END IF;
  PERFORM public._clinical_encounter_394_pass(24, 'draft plus evolution conflict');
END $$;

\echo '25) expected package coverage failure keeps clinical finalization and records finance exception'
RESET ROLE;
INSERT INTO public.session_packages(id,clinic_id,nome,sessoes,preco,validade_dias,ativo)
VALUES ('54000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','#394 pacote',1,10000,30,true);
INSERT INTO public.patient_packages(id,clinic_id,patient_id,package_id,sessoes_totais,sessoes_usadas,compra_data,validade_ate,valor_pago,status)
VALUES ('64000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001',1,0,current_date,current_date+30,10000,'ativo');
INSERT INTO public.appointments(id,clinic_id,paciente_id,professional_id,fisio_id,data,inicio,fim,status,tipo,valor,pacote_id)
VALUES ('43000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date,'13:00','13:30','em_atendimento','Consulta',10000,'64000000-0000-0000-0000-000000000001');
UPDATE public.patient_packages SET sessoes_usadas=1,status='esgotado' WHERE id='64000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000011',0,'Retorno','','','','Conduta','');
SELECT public.finalize_clinical_encounter_record('43000000-0000-0000-0000-000000000011',1);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM public.appointments WHERE id='43000000-0000-0000-0000-000000000011') <> 'finalizado' THEN RAISE EXCEPTION 'expected_coverage_rolled_back_clinical'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appointment_financial_exceptions WHERE appointment_id='43000000-0000-0000-0000-000000000011' AND reason_code='package_exhausted') THEN RAISE EXCEPTION 'expected_coverage_exception_missing'; END IF;
  PERFORM public._clinical_encounter_394_pass(25, 'expected coverage failure preserved');
END $$;

\echo '26) unexpected financial integrity failure aborts the complete transaction'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.save_clinical_encounter_record('43000000-0000-0000-0000-000000000010',0,'Teste rollback','','','','Conduta','');
RESET ROLE;
CREATE OR REPLACE FUNCTION public._394_raise_unexpected_financial_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.id='43000000-0000-0000-0000-000000000010' AND OLD.status='em_atendimento' AND NEW.status='finalizado' THEN
    RAISE EXCEPTION 'unexpected_financial_integrity_failure' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_zz_394_unexpected_financial_integrity
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public._394_raise_unexpected_financial_integrity();
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.finalize_clinical_encounter_record('43000000-0000-0000-0000-000000000010',1);
    RAISE EXCEPTION 'unexpected_financial_error_swallowed';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  PERFORM public._clinical_encounter_394_pass(26, 'unexpected finance remains fail-closed');
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM public.appointments WHERE id='43000000-0000-0000-0000-000000000010') <> 'em_atendimento' THEN RAISE EXCEPTION 'unexpected_finance_did_not_rollback_appointment'; END IF;
  IF (SELECT status FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000010') <> 'draft' THEN RAISE EXCEPTION 'unexpected_finance_did_not_rollback_record'; END IF;
  IF EXISTS (SELECT 1 FROM public.physiotherapy_evolutions WHERE session_id='43000000-0000-0000-0000-000000000010') THEN RAISE EXCEPTION 'unexpected_finance_did_not_rollback_evolution'; END IF;
END $$;
DROP TRIGGER trg_zz_394_unexpected_financial_integrity ON public.appointments;
DROP FUNCTION public._394_raise_unexpected_financial_integrity();

\echo '27) tenant/RLS isolation, anonymous and non-clinical reception reads are denied'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000009') THEN RAISE EXCEPTION 'cross_tenant_record_visible'; END IF;
  PERFORM public._clinical_encounter_394_pass(27, 'tenant and nonclinical read isolation');
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000009') THEN RAISE EXCEPTION 'reception_clinical_record_visible'; END IF;
END $$;
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.clinical_encounter_records LIMIT 1;
    RAISE EXCEPTION 'anonymous_record_read_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;

\echo '28) finalized record remains readable through current clinical history boundary'
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000009' AND status='finalized') THEN RAISE EXCEPTION 'finalized_record_not_readable'; END IF;
  PERFORM public._clinical_encounter_394_pass(28, 'finalized record history read');
END $$;

RESET ROLE;