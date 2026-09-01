-- MEDICSPRO — Core RLS migration
-- Safe helper functions avoid recursive policies on profiles.

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
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_clinic_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physiotherapy_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physiotherapy_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Remove policies from the initial prototype so the rules below are deterministic.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'clinics','profiles','patients','appointments','physiotherapy_evaluations',
        'physiotherapy_evolutions','payments','session_packages','patient_packages',
        'consent_terms','nps_surveys','wa_logs','audit_log'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Tenant identity.
CREATE POLICY clinics_select_same_tenant ON public.clinics
FOR SELECT TO authenticated
USING (id = public.current_clinic_id());

CREATE POLICY profiles_select_same_tenant ON public.profiles
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY profiles_update_self_or_admin ON public.profiles
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (id = auth.uid() OR public.current_app_role() IN ('owner','admin'))
)
WITH CHECK (clinic_id = public.current_clinic_id());

-- Patients.
CREATE POLICY patients_select_tenant ON public.patients
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id() AND deleted_at IS NULL);

CREATE POLICY patients_insert_operational ON public.patients
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio','recep')
);

CREATE POLICY patients_update_operational ON public.patients
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio','recep')
)
WITH CHECK (clinic_id = public.current_clinic_id());

-- Appointments.
CREATE POLICY appointments_select_tenant ON public.appointments
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY appointments_insert_operational ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio','recep')
);

CREATE POLICY appointments_update_operational ON public.appointments
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio','recep')
)
WITH CHECK (clinic_id = public.current_clinic_id());

-- Clinical data: only clinical staff and administrators.
CREATE POLICY evaluations_select_clinical ON public.physiotherapy_evaluations
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio')
);

CREATE POLICY evaluations_write_clinical ON public.physiotherapy_evaluations
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio')
);

CREATE POLICY evolutions_select_clinical ON public.physiotherapy_evolutions
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND deleted_at IS NULL
  AND public.current_app_role() IN ('owner','admin','fisio')
);

CREATE POLICY evolutions_write_clinical ON public.physiotherapy_evolutions
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio')
);

-- Financial data.
CREATE POLICY payments_select_tenant ON public.payments
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio','recep','financeiro')
);

CREATE POLICY payments_write_financial ON public.payments
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','recep','financeiro')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','recep','financeiro')
);

-- Packages.
CREATE POLICY session_packages_select_tenant ON public.session_packages
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY session_packages_write_admin ON public.session_packages
FOR ALL TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin'))
WITH CHECK (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin'));

CREATE POLICY patient_packages_select_tenant ON public.patient_packages
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY patient_packages_write_operational ON public.patient_packages
FOR ALL TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','recep'))
WITH CHECK (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','recep'));

-- Consent / NPS / communications.
CREATE POLICY consent_select_tenant ON public.consent_terms
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY consent_write_operational ON public.consent_terms
FOR ALL TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','fisio','recep'))
WITH CHECK (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','fisio','recep'));

CREATE POLICY nps_select_tenant ON public.nps_surveys
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY nps_write_operational ON public.nps_surveys
FOR ALL TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','recep'))
WITH CHECK (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','recep'));

CREATE POLICY wa_logs_select_tenant ON public.wa_logs
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY wa_logs_write_operational ON public.wa_logs
FOR ALL TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','recep'))
WITH CHECK (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','recep'));

-- Audit is append-only from the application perspective.
CREATE POLICY audit_select_admin ON public.audit_log
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin'));

CREATE POLICY audit_insert_tenant ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.current_clinic_id());

GRANT SELECT ON public.clinics, public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.patients, public.appointments, public.physiotherapy_evaluations,
  public.physiotherapy_evolutions, public.payments, public.session_packages, public.patient_packages,
  public.consent_terms, public.nps_surveys, public.wa_logs TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;

COMMIT;
