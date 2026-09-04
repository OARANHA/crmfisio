-- Execute após:
--   20260904_nexus_self_assessment_secure.sql
--   20260904_nexus_self_assessment_hardening.sql

SELECT to_regclass('public.nexus_self_assessment_invites') AS invites_table;

SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN (
  'create_nexus_self_assessment_invite',
  'resolve_nexus_self_assessment',
  'submit_nexus_self_assessment'
)
ORDER BY proname;

SELECT relname, relrowsecurity
FROM pg_class
WHERE oid = 'public.nexus_self_assessment_invites'::regclass;

SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'nexus_self_assessment_invites'
ORDER BY policyname;

-- O token bruto nunca deve existir em coluna persistente.
DO $$
DECLARE
  v_token_columns text[];
BEGIN
  SELECT array_agg(column_name ORDER BY column_name)
    INTO v_token_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'nexus_self_assessment_invites'
    AND column_name ILIKE '%token%';

  IF v_token_columns IS DISTINCT FROM ARRAY['token_hash']::text[] THEN
    RAISE EXCEPTION 'Colunas de token inesperadas: %', coalesce(array_to_string(v_token_columns, ', '), '<nenhuma>');
  END IF;
END $$;

-- Não deve haver grants diretos de INSERT/UPDATE/DELETE para anon/authenticated.
DO $$
DECLARE
  v_bad_grants integer;
BEGIN
  SELECT count(*) INTO v_bad_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'nexus_self_assessment_invites'
    AND grantee IN ('anon','authenticated')
    AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER');

  IF v_bad_grants <> 0 THEN
    RAISE EXCEPTION 'Grants diretos indevidos na tabela de convites: %', v_bad_grants;
  END IF;
END $$;

-- Constraints de integridade adicionadas pelo hardening.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_constraint
  WHERE conrelid = 'public.nexus_self_assessment_invites'::regclass
    AND conname IN (
      'nexus_self_assessment_scale_key_nonempty',
      'nexus_self_assessment_rule_version_nonempty'
    );

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Constraints de integridade incompletas: %/2', v_count;
  END IF;
END $$;

-- ACL: criar convite é somente autenticado; resolver/submeter podem ser públicos por token.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon não pode executar create_nexus_self_assessment_invite';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated sem EXECUTE em create_nexus_self_assessment_invite';
  END IF;

  IF NOT has_function_privilege('anon', 'public.resolve_nexus_self_assessment(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon sem EXECUTE em resolve_nexus_self_assessment';
  END IF;

  IF NOT has_function_privilege('anon', 'public.submit_nexus_self_assessment(text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon sem EXECUTE em submit_nexus_self_assessment';
  END IF;
END $$;

SELECT
  'NEXUS_SELF_ASSESSMENT_OK' AS verification,
  now() AS verified_at;

-- Smoke tests funcionais devem ser executados em transação/ambiente de teste:
-- 1. convite com scale_key/rule_version vazios deve falhar;
-- 2. convite para paciente deletado/anonimizado deve falhar;
-- 3. payload sem answers/selectedOptions deve falhar;
-- 4. payload com scaleKey/ruleVersion diferente do convite deve falhar;
-- 5. segunda submissão do mesmo token deve retornar false;
-- 6. token expirado/revogado deve retornar zero linhas em resolve e false em submit.
