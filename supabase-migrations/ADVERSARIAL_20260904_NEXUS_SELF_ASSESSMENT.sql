-- MedicsPro / Nexus Clinical Engine
-- Testes adversariais de tenant/RPC para autoavaliacao segura.
-- NAO PERSISTE ALTERACOES: todo o teste roda dentro de BEGIN ... ROLLBACK.
-- Requer pelo menos 2 clinicas distintas, cada uma com 1 profile ativo e 1 paciente valido.

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Contexto real minimo: dois tenants distintos, sem expor dados pessoais.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _adv_ctx ON COMMIT DROP AS
WITH candidates AS (
  SELECT
    p.id AS user_id,
    p.clinic_id,
    (
      SELECT pa.id
      FROM public.patients pa
      WHERE pa.clinic_id = p.clinic_id
        AND pa.deleted_at IS NULL
        AND coalesce(pa.anonimizado, false) IS FALSE
      ORDER BY pa.id
      LIMIT 1
    ) AS patient_id
  FROM public.profiles p
  WHERE p.ativo IS TRUE
), pairs AS (
  SELECT
    a.user_id AS user_a,
    a.clinic_id AS clinic_a,
    a.patient_id AS patient_a,
    b.user_id AS user_b,
    b.clinic_id AS clinic_b,
    b.patient_id AS patient_b
  FROM candidates a
  JOIN candidates b ON b.clinic_id <> a.clinic_id
  WHERE a.patient_id IS NOT NULL
    AND b.patient_id IS NOT NULL
  ORDER BY a.clinic_id, b.clinic_id
  LIMIT 1
)
SELECT * FROM pairs;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _adv_ctx) THEN
    RAISE EXCEPTION 'ADVERSARIAL_PRECONDITION_FAILED: sao necessarias 2 clinicas distintas, cada uma com profile ativo e paciente valido';
  END IF;
END $$;

SELECT set_config('medicspro.adv.user_a', user_a::text, true),
       set_config('medicspro.adv.clinic_a', clinic_a::text, true),
       set_config('medicspro.adv.patient_a', patient_a::text, true),
       set_config('medicspro.adv.user_b', user_b::text, true),
       set_config('medicspro.adv.clinic_b', clinic_b::text, true),
       set_config('medicspro.adv.patient_b', patient_b::text, true)
FROM _adv_ctx;

-- ACL estrutural: anon nao cria convite; anon/authenticated nao escrevem direto na tabela.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL_FAIL: anon ainda pode executar create_nexus_self_assessment_invite';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL_FAIL: authenticated nao pode criar convite';
  END IF;
  IF has_table_privilege('anon', 'public.nexus_self_assessment_invites', 'INSERT')
     OR has_table_privilege('anon', 'public.nexus_self_assessment_invites', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.nexus_self_assessment_invites', 'INSERT')
     OR has_table_privilege('authenticated', 'public.nexus_self_assessment_invites', 'UPDATE') THEN
    RAISE EXCEPTION 'ACL_FAIL: escrita direta na tabela de convites esta liberada para anon/authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Capability negativa: usuario A explicitamente negado deve falhar.
-- ---------------------------------------------------------------------------
INSERT INTO public.professional_capabilities (
  clinic_id, professional_id, capability_key, granted
)
SELECT clinic_a, user_a, 'nexus.scales', false
FROM _adv_ctx
ON CONFLICT (professional_id, capability_key)
DO UPDATE SET clinic_id = EXCLUDED.clinic_id, granted = false, updated_at = now();

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_a'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_nexus_self_assessment_invite(
      current_setting('medicspro.adv.patient_a')::uuid,
      'phq9', 'adversarial-v1', NULL, 1
    );
    RAISE EXCEPTION 'CAPABILITY_FAIL: convite foi criado sem nexus.scales';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'CAPABILITY_FAIL: convite foi criado sem nexus.scales' THEN RAISE; END IF;
      IF position('Sem capability nexus.scales' in SQLERRM) = 0 THEN
        RAISE EXCEPTION 'CAPABILITY_FAIL: erro inesperado: %', SQLERRM;
      END IF;
  END;
END $$;

RESET ROLE;

-- Libera A e B apenas dentro desta transacao para os testes seguintes.
INSERT INTO public.professional_capabilities (
  clinic_id, professional_id, capability_key, granted
)
SELECT clinic_a, user_a, 'nexus.scales', true FROM _adv_ctx
ON CONFLICT (professional_id, capability_key)
DO UPDATE SET clinic_id = EXCLUDED.clinic_id, granted = true, updated_at = now();

INSERT INTO public.professional_capabilities (
  clinic_id, professional_id, capability_key, granted
)
SELECT clinic_b, user_b, 'nexus.scales', true FROM _adv_ctx
ON CONFLICT (professional_id, capability_key)
DO UPDATE SET clinic_id = EXCLUDED.clinic_id, granted = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Tenant A nao pode criar convite para paciente do tenant B.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_a'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_nexus_self_assessment_invite(
      current_setting('medicspro.adv.patient_b')::uuid,
      'phq9', 'adversarial-v1', NULL, 1
    );
    RAISE EXCEPTION 'TENANT_WRITE_FAIL: tenant A criou convite para paciente B';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'TENANT_WRITE_FAIL: tenant A criou convite para paciente B' THEN RAISE; END IF;
      IF position('Paciente invalido' in translate(SQLERRM, 'áàãâéêíóôõúçÁÀÃÂÉÊÍÓÔÕÚÇ', 'aaaaeeiooouccAAAAEEIOOOUCC')) = 0 THEN
        -- Aceita a mensagem original com acentos sem depender do locale do psql.
        IF position('Paciente inválido' in SQLERRM) = 0 THEN
          RAISE EXCEPTION 'TENANT_WRITE_FAIL: erro inesperado: %', SQLERRM;
        END IF;
      END IF;
  END;
END $$;

-- Cria convite legitimo A e guarda token/id apenas em GUC local da transacao.
WITH created AS (
  SELECT * FROM public.create_nexus_self_assessment_invite(
    current_setting('medicspro.adv.patient_a')::uuid,
    'phq9', 'adversarial-v1', NULL, 1
  )
)
SELECT set_config('medicspro.adv.invite_a', invite_id::text, true),
       set_config('medicspro.adv.token_a', token, true)
FROM created;

RESET ROLE;

-- Cria convite legitimo B.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_b'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

WITH created AS (
  SELECT * FROM public.create_nexus_self_assessment_invite(
    current_setting('medicspro.adv.patient_b')::uuid,
    'phq9', 'adversarial-v1', NULL, 1
  )
)
SELECT set_config('medicspro.adv.invite_b', invite_id::text, true),
       set_config('medicspro.adv.token_b', token, true)
FROM created;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 3. RLS: tenant A nao pode ler convite do tenant B.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_a'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.nexus_self_assessment_invites
  WHERE id = current_setting('medicspro.adv.invite_b')::uuid;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TENANT_READ_FAIL: tenant A enxergou convite do tenant B';
  END IF;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 4. Anon nao cria convite, mas pode resolver token valido.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_nexus_self_assessment_invite(
      current_setting('medicspro.adv.patient_a')::uuid,
      'phq9', 'adversarial-v1', NULL, 1
    );
    RAISE EXCEPTION 'ANON_CREATE_FAIL: anon criou convite';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN undefined_function THEN NULL;
    WHEN OTHERS THEN
      IF SQLERRM = 'ANON_CREATE_FAIL: anon criou convite' THEN RAISE; END IF;
      -- Permission denied pode variar conforme PostgREST/Postgres; qualquer erro aqui e esperado.
      NULL;
  END;
END $$;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.resolve_nexus_self_assessment(current_setting('medicspro.adv.token_a'));
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TOKEN_RESOLVE_FAIL: token valido deveria resolver 1 convite, retornou %', v_count;
  END IF;
END $$;

-- Payload estruturalmente invalido deve falhar.
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_nexus_self_assessment(
      current_setting('medicspro.adv.token_a'),
      jsonb_build_object('scaleKey','phq9','ruleVersion','adversarial-v1')
    );
    RAISE EXCEPTION 'PAYLOAD_FAIL: payload sem answers/selectedOptions foi aceito';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'PAYLOAD_FAIL: payload sem answers/selectedOptions foi aceito' THEN RAISE; END IF;
      IF position('Estrutura de resposta inválida' in SQLERRM) = 0 THEN
        RAISE EXCEPTION 'PAYLOAD_FAIL: erro inesperado: %', SQLERRM;
      END IF;
  END;
END $$;

-- scaleKey/ruleVersion diferentes do convite devem falhar.
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_nexus_self_assessment(
      current_setting('medicspro.adv.token_a'),
      jsonb_build_object(
        'scaleKey','gad7',
        'ruleVersion','adversarial-v999',
        'answers',jsonb_build_object('q1',1),
        'selectedOptions',jsonb_build_array('q1:1')
      )
    );
    RAISE EXCEPTION 'VERSION_BIND_FAIL: payload divergente foi aceito';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'VERSION_BIND_FAIL: payload divergente foi aceito' THEN RAISE; END IF;
      IF position('Instrumento/versão não correspondem ao convite' in SQLERRM) = 0 THEN
        RAISE EXCEPTION 'VERSION_BIND_FAIL: erro inesperado: %', SQLERRM;
      END IF;
  END;
END $$;

-- Submissao valida deve retornar true.
DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.submit_nexus_self_assessment(
    current_setting('medicspro.adv.token_a'),
    jsonb_build_object(
      'scaleKey','phq9',
      'ruleVersion','adversarial-v1',
      'answers',jsonb_build_object('q1',1),
      'selectedOptions',jsonb_build_array('q1:1')
    )
  ) INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SUBMIT_FAIL: primeira submissao valida deveria retornar true';
  END IF;
END $$;

-- Replay do mesmo token deve retornar false.
DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.submit_nexus_self_assessment(
    current_setting('medicspro.adv.token_a'),
    jsonb_build_object(
      'scaleKey','phq9',
      'ruleVersion','adversarial-v1',
      'answers',jsonb_build_object('q1',2),
      'selectedOptions',jsonb_build_array('q1:2')
    )
  ) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'REPLAY_FAIL: segunda submissao deveria retornar false';
  END IF;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 5. Token expirado e revogado ficam inutilizaveis.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('medicspro.adv.user_a'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
WITH created AS (
  SELECT * FROM public.create_nexus_self_assessment_invite(
    current_setting('medicspro.adv.patient_a')::uuid,
    'phq9', 'adversarial-v1', NULL, 1
  )
)
SELECT set_config('medicspro.adv.expired_id', invite_id::text, true),
       set_config('medicspro.adv.expired_token', token, true)
FROM created;

WITH created AS (
  SELECT * FROM public.create_nexus_self_assessment_invite(
    current_setting('medicspro.adv.patient_a')::uuid,
    'phq9', 'adversarial-v1', NULL, 1
  )
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

SELECT set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
SET LOCAL ROLE anon;

DO $$
DECLARE v_count integer; v_ok boolean;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.resolve_nexus_self_assessment(current_setting('medicspro.adv.expired_token'));
  IF v_count <> 0 THEN RAISE EXCEPTION 'EXPIRED_FAIL: token expirado ainda resolve'; END IF;

  SELECT public.submit_nexus_self_assessment(
    current_setting('medicspro.adv.expired_token'),
    jsonb_build_object(
      'scaleKey','phq9','ruleVersion','adversarial-v1',
      'answers',jsonb_build_object('q1',1),
      'selectedOptions',jsonb_build_array('q1:1')
    )
  ) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPIRED_FAIL: token expirado ainda submete'; END IF;

  SELECT count(*) INTO v_count
  FROM public.resolve_nexus_self_assessment(current_setting('medicspro.adv.revoked_token'));
  IF v_count <> 0 THEN RAISE EXCEPTION 'REVOKED_FAIL: token revogado ainda resolve'; END IF;

  SELECT public.submit_nexus_self_assessment(
    current_setting('medicspro.adv.revoked_token'),
    jsonb_build_object(
      'scaleKey','phq9','ruleVersion','adversarial-v1',
      'answers',jsonb_build_object('q1',1),
      'selectedOptions',jsonb_build_array('q1:1')
    )
  ) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'REVOKED_FAIL: token revogado ainda submete'; END IF;
END $$;

RESET ROLE;

SELECT
  'NEXUS_SELF_ASSESSMENT_ADVERSARIAL_OK' AS verification,
  now() AS verified_at;

ROLLBACK;
