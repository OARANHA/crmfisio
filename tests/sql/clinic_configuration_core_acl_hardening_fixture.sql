\set ON_ERROR_STOP on

-- Reproduce the production drift that existed before #406: the validator
-- already existed with an explicit anon EXECUTE grant. CREATE OR REPLACE in
-- the main migration must preserve that explicit ACL so the hotfix can prove
-- it removes the leak.
CREATE OR REPLACE FUNCTION public.is_valid_iana_timezone(p_timezone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names
    WHERE name = p_timezone
  );
$$;

REVOKE ALL ON FUNCTION public.is_valid_iana_timezone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_iana_timezone(TEXT) TO anon;
