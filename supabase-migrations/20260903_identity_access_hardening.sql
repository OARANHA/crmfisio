-- MEDICSPRO — P0 identity and access hardening
-- Active profiles are mandatory for tenant/role resolution. Profile mutations
-- remain server-side through admin-team (service role), never direct from clients.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_clinic_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;

-- Management roles may read clinical records, but clinical authorship belongs
-- exclusively to care professionals. Client-side deletes are intentionally absent.
DROP POLICY IF EXISTS evaluations_write_clinical ON public.physiotherapy_evaluations;
CREATE POLICY evaluations_insert_clinical ON public.physiotherapy_evaluations
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
);
CREATE POLICY evaluations_update_clinical ON public.physiotherapy_evaluations
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
);

DROP POLICY IF EXISTS evolutions_write_clinical ON public.physiotherapy_evolutions;
CREATE POLICY evolutions_insert_clinical ON public.physiotherapy_evolutions
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
);
CREATE POLICY evolutions_update_clinical ON public.physiotherapy_evolutions
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
);

COMMIT;
