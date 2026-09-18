-- MEDICSPRO — Clinic Communication Configuration V1
-- Product entitlement remains above clinic configuration. Existing settings stay
-- readable for the tenant, but mutations require the effective WhatsApp product.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP POLICY IF EXISTS automation_settings_write_admin
  ON public.automation_settings;

CREATE POLICY automation_settings_write_admin
ON public.automation_settings
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
  AND public.current_clinic_entitlement_allowed('whatsapp.access')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
  AND public.current_clinic_entitlement_allowed('whatsapp.access')
);

COMMIT;
