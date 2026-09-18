-- MEDICSPRO — Clinic Communication Configuration ACL Hardening
-- Supabase self-hosted production grants broad default table privileges in public.
-- Keep RLS as the row boundary, but reduce the SQL privilege surface explicitly.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE ALL ON TABLE public.automation_settings
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.automation_settings
TO authenticated;

GRANT ALL
ON TABLE public.automation_settings
TO service_role;

COMMIT;
