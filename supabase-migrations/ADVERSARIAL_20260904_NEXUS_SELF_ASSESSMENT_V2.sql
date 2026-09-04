-- MedicsPro / Nexus Clinical Engine
-- Harness adversarial autossuficiente para self-assessment.
-- Usa 1 tenant real existente (A) e cria tenant B temporario dentro da transacao.
-- NADA persiste: termina sempre com ROLLBACK quando todos os gates passam.

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Seleciona tenant A real e cria tenant B temporario.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _adv_ctx (
  user_a uuid NOT NULL,
  clinic_a uuid NOT NULL,
  patient_a uuid NOT NULL,
  user_b uuid NOT NULL,
  clinic_b uuid NOT NULL,
  patient_b uuid NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  v_user_a uuid;
  v_clinic_a uuid;
  v_patient_a uuid;
  v_user_b uuid := gen_random_uuid();
  v_clinic_b uuid := gen_random_uuid();
  v_patient_b uuid := gen_random_uuid();
  v_email_b text := 'adv-' || replace(v_user_b::text, '-', '') || '@example.invalid';
BEGIN
  SELECT p.id, p.clinic_id, pa.id
    INTO v_user_a, v_clinic_a, v_patient_a
  FROM public.profiles p
  JOIN LATERAL (
    SELECT x.id
    FROM public.patients x
    WHERE x.clinic_id = p.clinic_id
      AND x.deleted_at IS NULL
      AND coalesce(x.anonimizado, false) IS FALSE
    ORDER BY x.id
    LIMIT 1
  ) pa ON true
  WHERE p.ativo IS TRUE
  ORDER BY p.created_at NULLS LAST, p.id
  LIMIT 1;

  IF v_user_a IS NULL OR v_clinic_a IS NULL OR v_patient_a IS NULL THEN
    RAISE EXCEPTION 'ADVERSARIAL_PRECONDITION_FAILED: e necessario ao menos 1 profile ativo com paciente valido no tenant real';
  END IF;

  INSERT INTO public.clinics (id, name)
  VALUES (v_clinic_b, 'ADV Tenant B - rollback');

  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    v_user_b, 'authenticated', 'authenticated', v_email_b, '',
    now(), jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    '{}'::jsonb, now(), now(), false, false
  );

  INSERT INTO public.profiles (
    id, clinic_id, email, nome, role, ativo, professional_type
  ) VALUES (
    v_user_b, v_clinic_b, v_email_b, 'ADV Professional B', 'fisio', true, 'medico'
  );

  INSERT INTO public.patients (
    id, clinic_id, nome, funil_stage, status, cid10, opt_in_whats, anonimizado
  ) VALUES (
    v_patient_b, v_clinic_b, 'ADV Patient B', 'lead', 'ativo', '{}'::text[], false, false
  );

  INSERT INTO _adv_ctx VALUES (
    v_user_a, v_clinic_a, v_patient_a,
    v_user_b, v_clinic_b, v_patient_b
  );
END $$;

SELECT set_config('medicspro.adv.user_a', user_a::text, true),
       set_config('medicspro.adv.clinic_a', clinic_a::text, true),
       set_config('medicspro.adv.patient_a', patient_a::text, true),
       set_config('medicspro.adv.user_b', user_b::text, true),
       set_config('medicspro.adv.clinic_b', clinic_b::text, true),
       set_config('medicspro.adv.patient_b', patient_b::text, true)
FROM _adv_ctx;

-- ---------------------------------------------------------------------------
-- 1. ACL estrutural.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL_FAIL: anon pode criar convite';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL_FAIL: authenticated nao pode criar convite';
  END IF;
  IF NOT has_function_privilege('anon', 'public.resolve_nexus_self_assessment(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.submit_nexus_self_assessment(text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL_FAIL: anon precisa resolver/submeter por token';
  END IF;
  IF has_table_privilege('anon', 'public.nexus_self_assessment_invites', 'INSERT')
     OR has_table_privilege('anon', 'public.nexus_self_assessment_invites', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.nexus_self_assessment_invites', 'INSERT')
     OR has_table_privilege('authenticated', 'public.nexus_self_assessment_invites', 'UPDATE') THEN
    RAISE EXCEPTION 'ACL_FAIL: escrita direta liberada em nexus_self_assessment_invites';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Sem capability: A nao pode criar convite.
-- ---------------------------------------------------------------------------
INSERT INTO public.professional_capabilities (clinic_id, professional_id, capability_key, granted)
SELECT clinic_a, user_a, 'nexus.scales', false FROM _adv_ctx
ON CONFLICT (professional_id, capability_key)
DO UPDATE SET clinic_id = EXCLUDED.clinic_id, granted = false, updated_at = now();

SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_a'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_nexus_self_assessment_invite(
      current_setting('medicspro.adv.patient_a')::uuid, 'phq9', 'adversarial-v1', NULL, 1);
    RAISE EXCEPTION 'CAPABILITY_FAIL: convite criado sem nexus.scales';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'CAPABILITY_FAIL: convite criado sem nexus.scales' THEN RAISE; END IF;
    IF position('Sem capability nexus.scales' in SQLERRM) = 0 THEN
      RAISE EXCEPTION 'CAPABILITY_FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;
END $$;
RESET ROLE;

-- Grants temporarios para os proximos testes.
INSERT INTO public.professional_capabilities (clinic_id, professional_id, capability_key, granted)
SELECT clinic_a, user_a, 'nexus.scales', true FROM _adv_ctx
ON CONFLICT (professional_id, capability_key)
DO UPDATE SET clinic_id = EXCLUDED.clinic_id, granted = true, updated_at = now();

INSERT INTO public.professional_capabilities (clinic_id, professional_id, capability_key, granted)
SELECT clinic_b, user_b, 'nexus.scales', true FROM _adv_ctx
ON CONFLICT (professional_id, capability_key)
DO UPDATE SET clinic_id = EXCLUDED.clinic_id, granted = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Tenant A nao cria convite para paciente B.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_a'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_nexus_self_assessment_invite(
      current_setting('medicspro.adv.patient_b')::uuid, 'phq9', 'adversarial-v1', NULL, 1);
    RAISE EXCEPTION 'TENANT_WRITE_FAIL: A criou convite para paciente B';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TENANT_WRITE_FAIL: A criou convite para paciente B' THEN RAISE; END IF;
    IF position('Paciente inválido' in SQLERRM) = 0 THEN
      RAISE EXCEPTION 'TENANT_WRITE_FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

WITH created AS (
  SELECT * FROM public.create_nexus_self_assessment_invite(
    current_setting('medicspro.adv.patient_a')::uuid, 'phq9', 'adversarial-v1', NULL, 1)
)
SELECT set_config('medicspro.adv.invite_a', invite_id::text, true),
       set_config('medicspro.adv.token_a', token, true)
FROM created;
RESET ROLE;

-- Convite legitimo B para testar leitura cross-tenant.
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_b'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
WITH created AS (
  SELECT * FROM public.create_nexus_self_assessment_invite(
    current_setting('medicspro.adv.patient_b')::uuid, 'phq9', 'adversarial-v1', NULL, 1)
)
SELECT set_config('medicspro.adv.invite_b', invite_id::text, true),
       set_config('medicspro.adv.token_b', token, true)
FROM created;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- 4. RLS: A nao le convite B.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_a'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.nexus_self_assessment_invites
  WHERE id = current_setting('medicspro.adv.invite_b')::uuid;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TENANT_READ_FAIL: A enxergou convite B';
  END IF;
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- 5. anon: nao cria; resolve token valido; payload e binding protegidos.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', jsonb_build_object('role','anon')::text, true);
SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_nexus_self_assessment_invite(
      current_setting('medicspro.adv.patient_a')::uuid, 'phq9', 'adversarial-v1', NULL, 1);
    RAISE EXCEPTION 'ANON_CREATE_FAIL: anon criou convite';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN OTHERS THEN
      IF SQLERRM = 'ANON_CREATE_FAIL: anon criou convite' THEN RAISE; END IF;
  END;
END $$;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.resolve_nexus_self_assessment(current_setting('medicspro.adv.token_a'));
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TOKEN_RESOLVE_FAIL: esperado 1, retornou %', v_count;
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.submit_nexus_self_assessment(
      current_setting('medicspro.adv.token_a'),
      jsonb_build_object('scaleKey','phq9','ruleVersion','adversarial-v1'));
    RAISE EXCEPTION 'PAYLOAD_FAIL: estrutura invalida aceita';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'PAYLOAD_FAIL: estrutura invalida aceita' THEN RAISE; END IF;
    IF position('Estrutura de resposta inválida' in SQLERRM) = 0 THEN
      RAISE EXCEPTION 'PAYLOAD_FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.submit_nexus_self_assessment(
      current_setting('medicspro.adv.token_a'),
      jsonb_build_object(
        'scaleKey','gad7','ruleVersion','adversarial-v999',
        'answers',jsonb_build_object('q1',1),
        'selectedOptions',jsonb_build_array('q1:1')));
    RAISE EXCEPTION 'VERSION_BIND_FAIL: instrumento/versao divergentes aceitos';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'VERSION_BIND_FAIL: instrumento/versao divergentes aceitos' THEN RAISE; END IF;
    IF position('Instrumento/versão não correspondem ao convite' in SQLERRM) = 0 THEN
      RAISE EXCEPTION 'VERSION_BIND_FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

-- Primeira submissao true; replay false.
DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.submit_nexus_self_assessment(
    current_setting('medicspro.adv.token_a'),
    jsonb_build_object(
      'scaleKey','phq9','ruleVersion','adversarial-v1',
      'answers',jsonb_build_object('q1',1),
      'selectedOptions',jsonb_build_array('q1:1'))
  ) INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'SUBMIT_FAIL: primeira submissao nao retornou true'; END IF;

  SELECT public.submit_nexus_self_assessment(
    current_setting('medicspro.adv.token_a'),
    jsonb_build_object(
      'scaleKey','phq9','ruleVersion','adversarial-v1',
      'answers',jsonb_build_object('q1',2),
      'selectedOptions',jsonb_build_array('q1:2'))
  ) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'REPLAY_FAIL: segunda submissao nao retornou false'; END IF;
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- 6. Token expirado e revogado nao resolvem nem submetem.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_a'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
WITH created AS (
  SELECT * FROM public.create_nexus_self_assessment_invite(
    current_setting('medicspro.adv.patient_a')::uuid, 'phq9', 'adversarial-v1', NULL, 1)
)
SELECT set_config('medicspro.adv.expired_id', invite_id::text, true),
       set_config('medicspro.adv.expired_token', token, true)
FROM created;
WITH created AS (
  SELECT * FROM public.create_nexus_self_assessment_invite(
    current_setting('medicspro.adv.patient_a')::uuid, 'phq9', 'adversarial-v1', NULL, 1)
)
SELECT set_config('medicspro.adv.revoked_id', invite_id::text, true),
       set_config('medicspro.adv.revoked_token', token, true)
FROM created;
RESET ROLE;

UPDATE public.nexus_self_assessment_invites
SET expires_at = now() - interval '1 minute', status = 'expired', updated_at = now()
WHERE id = current_setting('medicspro.adv.expired_id')::uuid;

UPDATE public.nexus_self_assessment_invites
SET revoked_at = now(), status = 'revoked', updated_at = now()
WHERE id = current_setting('medicspro.adv.revoked_id')::uuid;

SELECT set_config('request.jwt.claims', jsonb_build_object('role','anon')::text, true);
SET LOCAL ROLE anon;
DO $$
DECLARE v_count integer; v_ok boolean;
BEGIN
  SELECT count(*) INTO v_count FROM public.resolve_nexus_self_assessment(current_setting('medicspro.adv.expired_token'));
  IF v_count <> 0 THEN RAISE EXCEPTION 'EXPIRED_FAIL: token expirado resolveu'; END IF;
  SELECT public.submit_nexus_self_assessment(
    current_setting('medicspro.adv.expired_token'),
    jsonb_build_object('scaleKey','phq9','ruleVersion','adversarial-v1','answers','{}'::jsonb,'selectedOptions','[]'::jsonb)
  ) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPIRED_FAIL: token expirado submeteu'; END IF;

  SELECT count(*) INTO v_count FROM public.resolve_nexus_self_assessment(current_setting('medicspro.adv.revoked_token'));
  IF v_count <> 0 THEN RAISE EXCEPTION 'REVOKED_FAIL: token revogado resolveu'; END IF;
  SELECT public.submit_nexus_self_assessment(
    current_setting('medicspro.adv.revoked_token'),
    jsonb_build_object('scaleKey','phq9','ruleVersion','adversarial-v1','answers','{}'::jsonb,'selectedOptions','[]'::jsonb)
  ) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'REVOKED_FAIL: token revogado submeteu'; END IF;
END $$;
RESET ROLE;

SELECT 'NEXUS_SELF_ASSESSMENT_ADVERSARIAL_OK' AS verification, now() AS verified_at;

ROLLBACK;
