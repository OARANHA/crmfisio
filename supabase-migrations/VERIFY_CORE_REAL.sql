-- Execute após 20260831_core_rls.sql
-- Deve retornar o perfil autenticado pela API; via psql, valide as políticas e helpers.

SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('current_clinic_id', 'current_app_role');

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','patients','appointments','payments','physiotherapy_evolutions')
ORDER BY tablename, policyname;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles','patients','appointments','payments','physiotherapy_evolutions');
