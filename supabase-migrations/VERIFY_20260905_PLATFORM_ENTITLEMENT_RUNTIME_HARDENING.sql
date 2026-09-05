-- VERIFY — MEDICSPRO platform entitlement runtime hardening

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'platform_set_clinic_entitlement'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_clinic_id uuid, p_entitlement_key text, p_enabled boolean, p_source text, p_starts_at timestamp with time zone, p_expires_at timestamp with time zone';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'platform_set_clinic_entitlement ausente';
  END IF;

  IF v_def !~* 'ON CONFLICT ON CONSTRAINT platform_clinic_entitlements_pkey' THEN
    RAISE EXCEPTION 'upsert ainda usa conflict target ambíguo';
  END IF;

  IF v_def ~* 'ON CONFLICT[[:space:]]*\([[:space:]]*clinic_id[[:space:]]*,[[:space:]]*entitlement_key[[:space:]]*\)' THEN
    RAISE EXCEPTION 'conflict target ambíguo ainda presente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'platform_clinic_entitlements'
      AND con.conname = 'platform_clinic_entitlements_pkey'
      AND con.contype = 'p'
  ) THEN
    RAISE EXCEPTION 'PK platform_clinic_entitlements_pkey ausente';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.platform_set_clinic_entitlement(uuid,text,boolean,text,timestamptz,timestamptz)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated precisa executar platform_set_clinic_entitlement';
  END IF;

  RAISE NOTICE 'PLATFORM_ENTITLEMENT_RUNTIME_HARDENING_OK ambiguity=false named_constraint=true grants=true';
END;
$$;
