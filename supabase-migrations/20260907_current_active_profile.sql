-- MEDICSPRO — canonical authenticated profile bootstrap
-- Avoids relying on browser-side SELECT against profiles RLS during sign-in.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_active_profile()
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT p.*
    INTO v_profile
  FROM public.profiles p
  JOIN public.clinics c
    ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active_profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.current_active_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_active_profile() TO authenticated;

COMMENT ON FUNCTION public.current_active_profile() IS
  'Returns only auth.uid() active profile when its clinic is active; canonical sign-in bootstrap independent of profiles RLS visibility.';

COMMIT;
