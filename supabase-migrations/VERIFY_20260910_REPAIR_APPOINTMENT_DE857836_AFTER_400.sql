-- MEDICSPRO — Read-only verifier for controlled repair after #400
-- Target appointment: de857836-baa0-476f-bd7b-d6f52df33007

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '3s';
SET LOCAL application_name = 'medicspro_verify_repair_400_de857836_20260910';

DO $verify$
DECLARE
    v_target constant uuid := 'de857836-baa0-476f-bd7b-d6f52df33007'::uuid;
    v_expected_clinic constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
    v_expected_assessment constant uuid := '8c2d6398-140b-4769-b6db-2baffa299708'::uuid;
    v_app public.appointments%ROWTYPE;
    v_n bigint;
    v_last_from text;
    v_last_to text;
    v_last_changed_by uuid;
    r record;
BEGIN
    IF current_setting('transaction_read_only') <> 'on' THEN
        RAISE EXCEPTION 'VERIFY FAILED: transaction is not read only';
    END IF;

    SELECT *
      INTO v_app
    FROM public.appointments
    WHERE id = v_target;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VERIFY FAILED: target appointment not found';
    END IF;

    IF v_app.clinic_id IS DISTINCT FROM v_expected_clinic
       OR v_app.status IS DISTINCT FROM 'agendado'
       OR v_app.data <= public.current_clinic_operational_date()
       OR v_app.professional_id IS DISTINCT FROM v_app.fisio_id THEN
        RAISE EXCEPTION 'VERIFY FAILED: appointment final state mismatch';
    END IF;

    SELECT count(*) INTO v_n
    FROM public.appointment_status_history
    WHERE appointment_id = v_target;

    IF v_n <> 2 THEN
        RAISE EXCEPTION 'VERIFY FAILED: expected 2 status history rows, got %', v_n;
    END IF;

    SELECT count(*) INTO v_n
    FROM public.appointment_status_history
    WHERE appointment_id = v_target
      AND clinic_id = v_expected_clinic
      AND from_status = 'agendado'
      AND to_status = 'em_atendimento';

    IF v_n <> 1 THEN
        RAISE EXCEPTION 'VERIFY FAILED: original agendado -> em_atendimento history missing/ambiguous';
    END IF;

    SELECT count(*) INTO v_n
    FROM public.appointment_status_history
    WHERE appointment_id = v_target
      AND clinic_id = v_expected_clinic
      AND from_status = 'em_atendimento'
      AND to_status = 'agendado'
      AND changed_by IS NULL;

    IF v_n <> 1 THEN
        RAISE EXCEPTION 'VERIFY FAILED: repair audit row missing/ambiguous';
    END IF;

    SELECT from_status, to_status, changed_by
      INTO v_last_from, v_last_to, v_last_changed_by
    FROM public.appointment_status_history
    WHERE appointment_id = v_target
    ORDER BY changed_at DESC, id DESC
    LIMIT 1;

    IF v_last_from IS DISTINCT FROM 'em_atendimento'
       OR v_last_to IS DISTINCT FROM 'agendado'
       OR v_last_changed_by IS NOT NULL THEN
        RAISE EXCEPTION 'VERIFY FAILED: latest status history is not the expected maintenance repair';
    END IF;

    SELECT count(*) INTO v_n
    FROM public.clinical_assessments ca
    WHERE ca.id = v_expected_assessment
      AND ca.appointment_id = v_target
      AND ca.clinic_id = v_expected_clinic
      AND ca.patient_id = v_app.paciente_id
      AND ca.professional_id = v_app.professional_id
      AND ca.status = 'draft'
      AND ca.finalized_at IS NULL
      AND ca.answers = '{}'::jsonb
      AND ca.created_at = ca.updated_at;

    IF v_n <> 1 THEN
        RAISE EXCEPTION 'VERIFY FAILED: expected untouched empty clinical assessment not preserved';
    END IF;

    SELECT count(*)
      INTO v_n
    FROM (
        VALUES
          ('trg_audit_appointment_status_transition', 'public.audit_appointment_status_transition()'),
          ('trg_guard_appointment_status_transition', 'public.guard_appointment_status_transition()'),
          ('trg_h_appointment_encounter_temporal_start_update', 'public.guard_appointment_encounter_temporal_start()')
    ) AS expected(trigger_name, function_signature)
    JOIN pg_trigger t
      ON t.tgrelid = 'public.appointments'::regclass
     AND t.tgname = expected.trigger_name
     AND NOT t.tgisinternal
    JOIN pg_proc p
      ON p.oid = t.tgfoid
    WHERE t.tgenabled IN ('O','A')
      AND p.oid = to_regprocedure(expected.function_signature);

    IF v_n <> 3 THEN
        RAISE EXCEPTION 'VERIFY FAILED: critical appointment trigger stack drifted; matched %/3', v_n;
    END IF;

    -- No unexpected appointment_id-linked material may exist after repair.
    FOR r IN
        SELECT n.nspname, c.relname, a.attname, a.atttypid
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r','p')
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attname = 'appointment_id'
    LOOP
        IF r.atttypid <> 'uuid'::regtype THEN
            RAISE EXCEPTION 'VERIFY FAILED: unreviewed non-UUID appointment_id at %.%', r.nspname, r.relname;
        END IF;

        EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1', r.nspname, r.relname, r.attname)
          INTO v_n
          USING v_target;

        IF r.relname = 'appointment_status_history' THEN
            IF v_n <> 2 THEN
                RAISE EXCEPTION 'VERIFY FAILED: status history count=%', v_n;
            END IF;
        ELSIF r.relname = 'clinical_assessments' THEN
            IF v_n <> 1 THEN
                RAISE EXCEPTION 'VERIFY FAILED: clinical assessment count=%', v_n;
            END IF;
        ELSIF v_n <> 0 THEN
            RAISE EXCEPTION 'VERIFY FAILED: unexpected appointment dependency %.% has % row(s)', r.nspname, r.relname, v_n;
        END IF;
    END LOOP;

    RAISE NOTICE 'VERIFY PASSED: appointment restored to agendado; canonical audit present; empty draft assessment preserved';
END
$verify$;

SELECT
    id,
    clinic_id,
    data,
    status,
    updated_at
FROM public.appointments
WHERE id = 'de857836-baa0-476f-bd7b-d6f52df33007'::uuid;

SELECT
    from_status,
    to_status,
    changed_by,
    changed_at
FROM public.appointment_status_history
WHERE appointment_id = 'de857836-baa0-476f-bd7b-d6f52df33007'::uuid
ORDER BY changed_at, id;

SELECT
    id,
    status,
    finalized_at,
    answers = '{}'::jsonb AS answers_empty,
    created_at = updated_at AS untouched_since_insert
FROM public.clinical_assessments
WHERE appointment_id = 'de857836-baa0-476f-bd7b-d6f52df33007'::uuid;

ROLLBACK;
