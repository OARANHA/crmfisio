CREATE OR REPLACE FUNCTION public.transition_patient_journey(
  p_patient_id uuid,
  p_to_stage text,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(patient_id uuid, from_stage text, to_stage text, patient_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.current_app_role() <> 'fisio' THEN
    RAISE EXCEPTION 'legacy role required' USING ERRCODE = '42501';
  END IF;
  RETURN;
END;
$$;
