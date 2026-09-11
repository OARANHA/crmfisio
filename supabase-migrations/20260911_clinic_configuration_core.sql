BEGIN;

-- Clinic Configuration Core V1
-- Timezone is stored as an IANA identifier. UTC is a conservative bootstrap for
-- existing clinics; it is not a permanent regional assumption. A later slice may
-- consume this value from current_clinic_operational_date() without changing #400 here.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT;

UPDATE public.clinics
SET timezone = 'UTC'
WHERE timezone IS NULL OR btrim(timezone) = '';

ALTER TABLE public.clinics
  ALTER COLUMN timezone SET DEFAULT 'UTC',
  ALTER COLUMN timezone SET NOT NULL;

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
GRANT EXECUTE ON FUNCTION public.is_valid_iana_timezone(TEXT) TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clinics_timezone_iana_check'
      AND conrelid = 'public.clinics'::regclass
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_timezone_iana_check
      CHECK (public.is_valid_iana_timezone(timezone));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.clinic_opening_hours (
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT false,
  opens_at TIME WITHOUT TIME ZONE,
  closes_at TIME WITHOUT TIME ZONE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, day_of_week),
  CONSTRAINT clinic_opening_hours_day_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT clinic_opening_hours_interval_check CHECK (
    (is_open = false AND opens_at IS NULL AND closes_at IS NULL)
    OR
    (is_open = true AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)
  )
);

COMMENT ON COLUMN public.clinic_opening_hours.day_of_week IS '0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday';
COMMENT ON COLUMN public.clinics.timezone IS 'IANA timezone for clinic-local operational rules; future input for current_clinic_operational_date().';

CREATE INDEX IF NOT EXISTS idx_clinic_opening_hours_clinic
  ON public.clinic_opening_hours(clinic_id, day_of_week);

DROP TRIGGER IF EXISTS trg_clinic_opening_hours_updated_at ON public.clinic_opening_hours;
CREATE TRIGGER trg_clinic_opening_hours_updated_at
BEFORE UPDATE ON public.clinic_opening_hours
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clinic_opening_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_opening_hours_select_tenant ON public.clinic_opening_hours;
CREATE POLICY clinic_opening_hours_select_tenant ON public.clinic_opening_hours
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS clinic_opening_hours_insert_admin ON public.clinic_opening_hours;
CREATE POLICY clinic_opening_hours_insert_admin ON public.clinic_opening_hours
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
);

DROP POLICY IF EXISTS clinic_opening_hours_update_admin ON public.clinic_opening_hours;
CREATE POLICY clinic_opening_hours_update_admin ON public.clinic_opening_hours
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
);

DROP POLICY IF EXISTS clinic_opening_hours_delete_admin ON public.clinic_opening_hours;
CREATE POLICY clinic_opening_hours_delete_admin ON public.clinic_opening_hours
FOR DELETE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
);

REVOKE ALL ON TABLE public.clinic_opening_hours FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinic_opening_hours TO authenticated;
GRANT ALL ON TABLE public.clinic_opening_hours TO service_role;

-- Existing clinics get an explicit seven-day closed schedule. The UI may then
-- opt days into a valid single interval without inventing hidden regional hours.
INSERT INTO public.clinic_opening_hours (clinic_id, day_of_week, is_open, opens_at, closes_at)
SELECT c.id, d.day_of_week, false, NULL, NULL
FROM public.clinics c
CROSS JOIN generate_series(0, 6) AS d(day_of_week)
ON CONFLICT (clinic_id, day_of_week) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_current_clinic_identity()
RETURNS TABLE (
  id UUID,
  name TEXT,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id UUID;
BEGIN
  v_clinic_id := public.current_clinic_id();
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'active clinic access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.cnpj, c.phone, c.email, c.address, c.timezone
  FROM public.clinics c
  WHERE c.id = v_clinic_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_current_clinic_identity(
  p_name TEXT,
  p_cnpj TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id UUID;
  v_role TEXT;
BEGIN
  v_clinic_id := public.current_clinic_id();
  v_role := public.current_app_role();

  IF v_clinic_id IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'clinic owner/admin access required' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'clinic name is required' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_valid_iana_timezone(p_timezone) THEN
    RAISE EXCEPTION 'invalid IANA timezone' USING ERRCODE = '22023';
  END IF;

  UPDATE public.clinics c
  SET
    name = btrim(p_name),
    cnpj = NULLIF(btrim(p_cnpj), ''),
    phone = NULLIF(btrim(p_phone), ''),
    email = NULLIF(btrim(p_email), ''),
    address = NULLIF(btrim(p_address), ''),
    timezone = p_timezone,
    updated_at = now()
  WHERE c.id = v_clinic_id;

  RETURN QUERY
  SELECT c.id, c.name, c.cnpj, c.phone, c.email, c.address, c.timezone
  FROM public.clinics c
  WHERE c.id = v_clinic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_clinic_identity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_current_clinic_identity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_clinic_identity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_current_clinic_identity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
