CREATE OR REPLACE FUNCTION public.sync_appointment_package_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'finalizado' AND NEW.pacote_id IS NOT NULL THEN
    RAISE EXCEPTION 'Pacote sem saldo ou fora da validade';
  END IF;
  RETURN NEW;
END;
$$;
