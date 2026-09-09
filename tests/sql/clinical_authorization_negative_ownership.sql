CREATE OR REPLACE FUNCTION public.guard_appointment_clinical_self_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('em_atendimento', 'finalizado')
     AND public.current_user_has_clinical_capability('clinical.attend') IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_professional_capability_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
