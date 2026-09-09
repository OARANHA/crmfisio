DROP POLICY IF EXISTS appointments_update_operational ON public.appointments;
CREATE POLICY appointments_update_operational
ON public.appointments
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
)
WITH CHECK (clinic_id = public.current_clinic_id());
