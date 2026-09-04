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
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nexus_self_assessment_invites'
  AND column_name ILIKE '%token%'
ORDER BY column_name;
-- Esperado: apenas token_hash.

-- Não deve haver grants diretos de INSERT/UPDATE para anon/authenticated.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'nexus_self_assessment_invites'
ORDER BY grantee, privilege_type;

-- Constraints de integridade adicionadas pelo hardening.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.nexus_self_assessment_invites'::regclass
  AND conname IN (
    'nexus_self_assessment_scale_key_nonempty',
    'nexus_self_assessment_rule_version_nonempty'
  )
ORDER BY conname;

-- Assinaturas/ACL das funções públicas e autenticadas.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_nexus_self_assessment_invite',
    'resolve_nexus_self_assessment',
    'submit_nexus_self_assessment'
  )
ORDER BY p.proname;

-- Smoke tests funcionais devem ser executados em transação/ambiente de teste:
-- 1. convite com scale_key/rule_version vazios deve falhar;
-- 2. convite para paciente deletado/anonimizado deve falhar;
-- 3. payload sem answers/selectedOptions deve falhar;
-- 4. payload com scaleKey/ruleVersion diferente do convite deve falhar;
-- 5. segunda submissão do mesmo token deve retornar false;
-- 6. token expirado/revogado deve retornar zero linhas em resolve e false em submit.
