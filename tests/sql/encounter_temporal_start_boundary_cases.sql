-- MedicsPro #400 — behavioral temporal start matrix.
-- Runs only in the disposable PostgreSQL 16 harness assembled by
-- scripts/build-encounter-temporal-start-sql-test.py.

-- 1) Assigned professional + clinical.attend cannot start tomorrow's appointment.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET status='em_atendimento'
    WHERE id='00000000-0000-0000-0000-000000000801';
    RAISE EXCEPTION 'CI400 future professional start escaped';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'appointment_future_encounter_start_forbidden' THEN
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

-- 2) Same-day appointment remains startable under the already-existing clinical rules.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
UPDATE public.appointments
SET status='em_atendimento'
WHERE id='00000000-0000-0000-0000-000000000802';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE id='00000000-0000-0000-0000-000000000802'
      AND status='em_atendimento'
  ) THEN RAISE EXCEPTION 'CI400 same-day start was not preserved'; END IF;
END $$;

-- 3) A normal actor cannot create a future appointment directly in em_atendimento.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments(
      id, clinic_id, paciente_id, fisio_id, professional_id, status, data
    ) VALUES (
      '00000000-0000-0000-0000-000000000807',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000103',
      'em_atendimento',
      timezone('America/Sao_Paulo', now())::date + 1
    );
    RAISE EXCEPTION 'CI400 future direct active insert escaped';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'appointment_future_encounter_start_forbidden' THEN
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

-- 4) A clinically eligible assigned owner has no temporal bypass.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000104',false);
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET status='em_atendimento'
    WHERE id='00000000-0000-0000-0000-000000000803';
    RAISE EXCEPTION 'CI400 owner temporal bypass escaped';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'appointment_future_encounter_start_forbidden' THEN
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

-- 5) A clinically eligible assigned admin has no temporal bypass either.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000105',false);
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET status='em_atendimento'
    WHERE id='00000000-0000-0000-0000-000000000804';
    RAISE EXCEPTION 'CI400 admin temporal bypass escaped';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'appointment_future_encounter_start_forbidden' THEN
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

-- 6) Controlled Supabase service_role remains available for repair/migration.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','',false);
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, fisio_id, professional_id, status, data
) VALUES (
  '00000000-0000-0000-0000-000000000808',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000103',
  'em_atendimento',
  timezone('America/Sao_Paulo', now())::date + 1
);
RESET ROLE;

-- 7) A direct trusted postgres maintenance session also preserves its bypass.
SELECT set_config('request.jwt.claim.role','',false);
SELECT set_config('request.jwt.claim.sub','',false);
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, fisio_id, professional_id, status, data
) VALUES (
  '00000000-0000-0000-0000-000000000809',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000103',
  'em_atendimento',
  timezone('America/Sao_Paulo', now())::date + 2
);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.appointments WHERE id IN (
      '00000000-0000-0000-0000-000000000808',
      '00000000-0000-0000-0000-000000000809'
    ) AND status='em_atendimento') <> 2 THEN
    RAISE EXCEPTION 'CI400 controlled internal bypass did not survive';
  END IF;
END $$;

-- 8) Defense in depth: a future physical em_atendimento row never authorizes #399 Apply now.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
DO $$ BEGIN
  IF public.can_apply_clinical_instrument_in_encounter(
      '00000000-0000-0000-0000-000000000808','phq9'
  ) THEN RAISE EXCEPTION 'CI400 future legacy state authorized #399 Apply now'; END IF;
END $$;
RESET ROLE;

-- 9) Equivalent same-day active Encounter stays authorized when every #399 prerequisite holds.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
DO $$ BEGIN
  IF NOT public.can_apply_clinical_instrument_in_encounter(
      '00000000-0000-0000-0000-000000000802','phq9'
  ) THEN RAISE EXCEPTION 'CI400 same-day #399 Apply now regression'; END IF;
END $$;
RESET ROLE;

-- 10) Cross-tenant active Encounter remains false.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
DO $$ BEGIN
  IF public.can_apply_clinical_instrument_in_encounter(
      '00000000-0000-0000-0000-000000000805','phq9'
  ) THEN RAISE EXCEPTION 'CI400 cross-tenant #399 boundary regression'; END IF;
END $$;
RESET ROLE;

-- 11) Another professional's same-day active Encounter remains false.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
DO $$ BEGIN
  IF public.can_apply_clinical_instrument_in_encounter(
      '00000000-0000-0000-0000-000000000806','phq9'
  ) THEN RAISE EXCEPTION 'CI400 cross-professional #399 boundary regression'; END IF;
END $$;
RESET ROLE;

-- 12) Past-date start semantics are deliberately unchanged by #400.
SELECT set_config('request.jwt.claim.role','',false);
SELECT set_config('request.jwt.claim.sub','',false);
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, fisio_id, professional_id, status, data
) VALUES (
  '00000000-0000-0000-0000-000000000810',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000103',
  'agendado',
  timezone('America/Sao_Paulo', now())::date - 1
);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
UPDATE public.appointments
SET status='em_atendimento'
WHERE id='00000000-0000-0000-0000-000000000810';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE id='00000000-0000-0000-0000-000000000810'
      AND status='em_atendimento'
  ) THEN RAISE EXCEPTION 'CI400 past-date semantics changed'; END IF;
END $$;

SELECT 'ENCOUNTER_TEMPORAL_START_400_BEHAVIOR_OK_12_CASES' AS result;
