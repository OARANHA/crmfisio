-- MEDICSPRO — Controlled repair after #400
-- Target appointment: de857836-baa0-476f-bd7b-d6f52df33007
-- Expected repair: em_atendimento -> agendado
-- This is a one-off operational repair, not a schema migration.
-- Fail-closed: any drift aborts the transaction.

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL application_name = 'medicspro_repair_400_de857836_20260910';

DO $repair$
DECLARE
    v_target constant uuid := 'de857836-baa0-476f-bd7b-d6f52df33007'::uuid;
    v_expected_clinic constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
    v_expected_assessment constant uuid := '8c2d6398-140b-4769-b6db-2baffa299708'::uuid;

    v_app public.appointments%ROWTYPE;
    v_app_before jsonb;
    v_app_after jsonb;

    v_assessment_before jsonb;
    v_assessment_after jsonb;
    v_assessment_status text;
    v_assessment_answers jsonb;
    v_assessment_finalized_at timestamptz;
    v_assessment_created_at timestamptz;
    v_assessment_updated_at timestamptz;
    v_assessment_clinic uuid;
    v_assessment_patient uuid;
    v_assessment_professional uuid;

    v_history_before bigint;
    v_history_after bigint;
    v_from_status text;
    v_to_status text;
    v_history_clinic uuid;

    v_n bigint;
    v_updated bigint;
    r record;
BEGIN
    -- 0. Controlled maintenance context only.
    IF current_database() <> 'postgres' THEN
        RAISE EXCEPTION 'REPAIR ABORTED: unexpected database %', current_database();
    END IF;

    IF session_user <> 'postgres' OR current_user <> 'postgres' THEN
        RAISE EXCEPTION 'REPAIR ABORTED: direct postgres session required; session_user=%, current_user=%', session_user, current_user;
    END IF;

    IF current_setting('transaction_read_only') <> 'off' THEN
        RAISE EXCEPTION 'REPAIR ABORTED: transaction is read only';
    END IF;

    IF auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'REPAIR ABORTED: unexpected auth.uid()=%', auth.uid();
    END IF;

    IF public.current_app_role() IS NOT NULL THEN
        RAISE EXCEPTION 'REPAIR ABORTED: unexpected application role=%', public.current_app_role();
    END IF;

    -- 1. Effective trigger stack must remain enabled and canonical.
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
        RAISE EXCEPTION 'REPAIR ABORTED: critical appointment trigger stack drifted; matched %/3', v_n;
    END IF;

    -- 2. Lock the exact target and assert the known state.
    SELECT *
      INTO v_app
    FROM public.appointments
    WHERE id = v_target
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REPAIR ABORTED: target appointment not found';
    END IF;

    v_app_before := to_jsonb(v_app);

    IF v_app.clinic_id IS DISTINCT FROM v_expected_clinic THEN
        RAISE EXCEPTION 'REPAIR ABORTED: clinic drift';
    END IF;

    IF v_app.status IS DISTINCT FROM 'em_atendimento' THEN
        RAISE EXCEPTION 'REPAIR ABORTED: status drifted to %', v_app.status;
    END IF;

    IF v_app.data <= public.current_clinic_operational_date() THEN
        RAISE EXCEPTION 'REPAIR ABORTED: target is no longer future; appointment_date=%, operational_date=%', v_app.data, public.current_clinic_operational_date();
    END IF;

    IF v_app.professional_id IS DISTINCT FROM v_app.fisio_id THEN
        RAISE EXCEPTION 'REPAIR ABORTED: professional compatibility drift';
    END IF;

    -- 3. Primary history must still prove one unique agendado -> em_atendimento transition.
    SELECT count(*)
      INTO v_history_before
    FROM public.appointment_status_history
    WHERE appointment_id = v_target;

    IF v_history_before <> 1 THEN
        RAISE EXCEPTION 'REPAIR ABORTED: expected exactly 1 status history row before repair, got %', v_history_before;
    END IF;

    SELECT from_status, to_status, clinic_id
      INTO v_from_status, v_to_status, v_history_clinic
    FROM public.appointment_status_history
    WHERE appointment_id = v_target;

    IF v_from_status IS DISTINCT FROM 'agendado'
       OR v_to_status IS DISTINCT FROM 'em_atendimento'
       OR v_history_clinic IS DISTINCT FROM v_expected_clinic THEN
        RAISE EXCEPTION 'REPAIR ABORTED: historical predecessor drift; got % -> %, clinic=%', v_from_status, v_to_status, v_history_clinic;
    END IF;

    -- 4. The only known linked clinical assessment must remain an untouched empty draft.
    SELECT count(*)
      INTO v_n
    FROM public.clinical_assessments
    WHERE appointment_id = v_target;

    IF v_n <> 1 THEN
        RAISE EXCEPTION 'REPAIR ABORTED: expected exactly 1 clinical assessment, got %', v_n;
    END IF;

    SELECT
        to_jsonb(ca),
        ca.status,
        ca.answers,
        ca.finalized_at,
        ca.created_at,
        ca.updated_at,
        ca.clinic_id,
        ca.patient_id,
        ca.professional_id
      INTO
        v_assessment_before,
        v_assessment_status,
        v_assessment_answers,
        v_assessment_finalized_at,
        v_assessment_created_at,
        v_assessment_updated_at,
        v_assessment_clinic,
        v_assessment_patient,
        v_assessment_professional
    FROM public.clinical_assessments ca
    WHERE ca.id = v_expected_assessment
      AND ca.appointment_id = v_target
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REPAIR ABORTED: expected clinical assessment not found';
    END IF;

    IF v_assessment_status IS DISTINCT FROM 'draft'
       OR v_assessment_finalized_at IS NOT NULL
       OR v_assessment_answers IS DISTINCT FROM '{}'::jsonb
       OR v_assessment_created_at IS DISTINCT FROM v_assessment_updated_at THEN
        RAISE EXCEPTION 'REPAIR ABORTED: assessment is no longer an untouched empty draft';
    END IF;

    IF v_assessment_clinic IS DISTINCT FROM v_app.clinic_id
       OR v_assessment_patient IS DISTINCT FROM v_app.paciente_id
       OR v_assessment_professional IS DISTINCT FROM v_app.professional_id THEN
        RAISE EXCEPTION 'REPAIR ABORTED: clinical assessment context drift';
    END IF;

    -- 5. No dependent rows may hang from the assessment.
    FOR r IN
        SELECT
            con.conname,
            rn.nspname,
            rc.relname,
            ra.attname,
            ra.atttypid,
            cardinality(con.conkey) AS key_count
        FROM pg_constraint con
        JOIN pg_class rc ON rc.oid = con.conrelid
        JOIN pg_namespace rn ON rn.oid = rc.relnamespace
        JOIN pg_attribute ra
          ON ra.attrelid = con.conrelid
         AND ra.attnum = con.conkey[1]
        WHERE con.contype = 'f'
          AND con.confrelid = 'public.clinical_assessments'::regclass
    LOOP
        IF r.key_count <> 1 THEN
            RAISE EXCEPTION 'REPAIR ABORTED: unreviewed multi-column FK % -> clinical_assessments', r.conname;
        END IF;

        IF r.atttypid <> 'uuid'::regtype THEN
            RAISE EXCEPTION 'REPAIR ABORTED: unexpected non-UUID assessment FK %.%.%', r.nspname, r.relname, r.attname;
        END IF;

        EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1', r.nspname, r.relname, r.attname)
          INTO v_n
          USING v_expected_assessment;

        IF v_n <> 0 THEN
            RAISE EXCEPTION 'REPAIR ABORTED: assessment has % dependent row(s) in %.%', v_n, r.nspname, r.relname;
        END IF;
    END LOOP;

    -- 6. Dynamic appointment_id inventory: only canonical history + the empty assessment may exist.
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
            RAISE EXCEPTION 'REPAIR ABORTED: unreviewed non-UUID appointment_id at %.%', r.nspname, r.relname;
        END IF;

        EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1', r.nspname, r.relname, r.attname)
          INTO v_n
          USING v_target;

        IF r.relname = 'appointment_status_history' THEN
            IF v_n <> 1 THEN
                RAISE EXCEPTION 'REPAIR ABORTED: status history drift: % rows', v_n;
            END IF;
        ELSIF r.relname = 'clinical_assessments' THEN
            IF v_n <> 1 THEN
                RAISE EXCEPTION 'REPAIR ABORTED: assessment count drift: % rows', v_n;
            END IF;
        ELSIF v_n <> 0 THEN
            RAISE EXCEPTION 'REPAIR ABORTED: unexpected appointment dependency %.% has % row(s)', r.nspname, r.relname, v_n;
        END IF;
    END LOOP;

    -- 7. Dynamic FK inventory to appointments catches differently named linkage columns as well.
    FOR r IN
        SELECT
            con.conname,
            rn.nspname,
            rc.relname,
            ra.attname,
            ra.atttypid,
            cardinality(con.conkey) AS key_count
        FROM pg_constraint con
        JOIN pg_class rc ON rc.oid = con.conrelid
        JOIN pg_namespace rn ON rn.oid = rc.relnamespace
        JOIN pg_attribute ra
          ON ra.attrelid = con.conrelid
         AND ra.attnum = con.conkey[1]
        WHERE con.contype = 'f'
          AND con.confrelid = 'public.appointments'::regclass
    LOOP
        IF r.key_count <> 1 THEN
            RAISE EXCEPTION 'REPAIR ABORTED: unreviewed multi-column appointment FK %', r.conname;
        END IF;

        IF r.atttypid <> 'uuid'::regtype THEN
            RAISE EXCEPTION 'REPAIR ABORTED: unexpected appointment FK type %.%.%', r.nspname, r.relname, r.attname;
        END IF;

        EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1', r.nspname, r.relname, r.attname)
          INTO v_n
          USING v_target;

        IF r.relname = 'appointment_status_history' THEN
            IF v_n <> 1 THEN
                RAISE EXCEPTION 'REPAIR ABORTED: FK history count drift=%', v_n;
            END IF;
        ELSIF r.relname = 'clinical_assessments' THEN
            IF v_n <> 1 THEN
                RAISE EXCEPTION 'REPAIR ABORTED: FK assessment count drift=%', v_n;
            END IF;
        ELSIF v_n <> 0 THEN
            RAISE EXCEPTION 'REPAIR ABORTED: FK %.% contains % target row(s)', r.nspname, r.relname, v_n;
        END IF;
    END LOOP;

    -- 8. The only business mutation in this repair.
    UPDATE public.appointments
       SET status = 'agendado'
     WHERE id = v_target
       AND clinic_id = v_expected_clinic
       AND status = 'em_atendimento'
       AND data > public.current_clinic_operational_date();

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated <> 1 THEN
        RAISE EXCEPTION 'REPAIR ABORTED: expected one appointment update, got %', v_updated;
    END IF;

    -- 9. Appointment postcheck: only status and an eventual generic updated_at may differ.
    SELECT to_jsonb(a)
      INTO v_app_after
    FROM public.appointments a
    WHERE a.id = v_target;

    IF (v_app_after ->> 'status') IS DISTINCT FROM 'agendado' THEN
        RAISE EXCEPTION 'REPAIR ABORTED: post-update status is not agendado';
    END IF;

    IF (v_app_after - 'status' - 'updated_at') IS DISTINCT FROM (v_app_before - 'status' - 'updated_at') THEN
        RAISE EXCEPTION 'REPAIR ABORTED: another appointment field changed';
    END IF;

    -- 10. Canonical audit trail must add exactly one em_atendimento -> agendado event.
    SELECT count(*)
      INTO v_history_after
    FROM public.appointment_status_history
    WHERE appointment_id = v_target;

    IF v_history_after <> v_history_before + 1 THEN
        RAISE EXCEPTION 'REPAIR ABORTED: expected exactly one new audit row; before=%, after=%', v_history_before, v_history_after;
    END IF;

    SELECT count(*)
      INTO v_n
    FROM public.appointment_status_history
    WHERE appointment_id = v_target
      AND clinic_id = v_expected_clinic
      AND from_status = 'em_atendimento'
      AND to_status = 'agendado'
      AND changed_by IS NULL;

    IF v_n <> 1 THEN
        RAISE EXCEPTION 'REPAIR ABORTED: canonical repair audit row missing/ambiguous; count=%', v_n;
    END IF;

    -- 11. Assessment must remain byte-for-byte unchanged.
    SELECT to_jsonb(ca)
      INTO v_assessment_after
    FROM public.clinical_assessments ca
    WHERE ca.id = v_expected_assessment;

    IF v_assessment_after IS DISTINCT FROM v_assessment_before THEN
        RAISE EXCEPTION 'REPAIR ABORTED: clinical assessment changed during repair';
    END IF;

    -- 12. Dynamic post-update inventory: history=2, assessment=1, all other appointment_id tables=0.
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
            RAISE EXCEPTION 'REPAIR ABORTED: postcheck non-UUID appointment_id %.%', r.nspname, r.relname;
        END IF;

        EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1', r.nspname, r.relname, r.attname)
          INTO v_n
          USING v_target;

        IF r.relname = 'appointment_status_history' THEN
            IF v_n <> 2 THEN
                RAISE EXCEPTION 'REPAIR ABORTED: expected 2 status history rows after repair, got %', v_n;
            END IF;
        ELSIF r.relname = 'clinical_assessments' THEN
            IF v_n <> 1 THEN
                RAISE EXCEPTION 'REPAIR ABORTED: assessment count changed to %', v_n;
            END IF;
        ELSIF v_n <> 0 THEN
            RAISE EXCEPTION 'REPAIR ABORTED: post-update dependency %.% has % row(s)', r.nspname, r.relname, v_n;
        END IF;
    END LOOP;

    RAISE NOTICE 'REPAIR VERIFIED: % em_atendimento -> agendado; canonical audit created; assessment preserved', v_target;
END
$repair$;

SELECT
    id,
    clinic_id,
    data,
    status,
    updated_at
FROM public.appointments
WHERE id = 'de857836-baa0-476f-bd7b-d6f52df33007'::uuid;

SELECT
    id,
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
    created_at,
    updated_at
FROM public.clinical_assessments
WHERE appointment_id = 'de857836-baa0-476f-bd7b-d6f52df33007'::uuid;

COMMIT;
