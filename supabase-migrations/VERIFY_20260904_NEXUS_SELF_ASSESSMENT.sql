-- Execute após 20260904_nexus_self_assessment_secure.sql.

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
  AND column_name ILIKE '%token%';
-- Esperado: apenas token_hash.

-- Não deve haver grants diretos de INSERT/UPDATE para anon/authenticated.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'nexus_self_assessment_invites'
ORDER BY grantee, privilege_type;
