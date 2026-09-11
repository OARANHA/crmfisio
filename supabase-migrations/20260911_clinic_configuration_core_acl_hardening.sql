BEGIN;

REVOKE ALL ON FUNCTION public.is_valid_iana_timezone(TEXT)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_valid_iana_timezone(TEXT)
TO authenticated, service_role;

COMMIT;
