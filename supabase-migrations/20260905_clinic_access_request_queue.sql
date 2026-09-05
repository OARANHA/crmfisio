-- MEDICSPRO — public clinic interest queue + Platform Admin review
BEGIN;

CREATE TABLE IF NOT EXISTS public.clinic_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  clinic_name text NOT NULL CHECK (length(trim(clinic_name)) BETWEEN 2 AND 160),
  cnpj text,
  owner_name text NOT NULL CHECK (length(trim(owner_name)) BETWEEN 2 AND 160),
  owner_email text NOT NULL CHECK (length(trim(owner_email)) BETWEEN 5 AND 254),
  owner_phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rejected','provisioned')),
  review_note text,
  reviewed_by uuid REFERENCES public.platform_admins(user_id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  provisioning_request_id uuid REFERENCES public.clinic_provisioning_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinic_access_requests_status_created_idx
  ON public.clinic_access_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS clinic_access_requests_owner_email_idx
  ON public.clinic_access_requests (lower(owner_email), created_at DESC);

ALTER TABLE public.clinic_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinic_access_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.clinic_access_requests TO service_role;

CREATE OR REPLACE FUNCTION public.platform_list_clinic_access_requests(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  request_id uuid,
  public_id uuid,
  clinic_name text,
  cnpj text,
  owner_name text,
  owner_email text,
  owner_phone text,
  status text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  provisioning_request_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE='42501';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('pending','rejected','provisioned') THEN
    RAISE EXCEPTION 'invalid_request_status' USING ERRCODE='22023';
  END IF;
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'invalid_limit' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  SELECT r.id, r.public_id, r.clinic_name, r.cnpj, r.owner_name, r.owner_email,
         r.owner_phone, r.status, r.review_note, r.reviewed_by, r.reviewed_at,
         r.provisioning_request_id, r.created_at, r.updated_at
  FROM public.clinic_access_requests r
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END, r.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_clinic_access_requests(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_clinic_access_requests(text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_reject_clinic_access_request(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.clinic_access_requests%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_request
  FROM public.clinic_access_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'access_request_not_found' USING ERRCODE='22023';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'access_request_not_pending' USING ERRCODE='22023';
  END IF;

  UPDATE public.clinic_access_requests
  SET status='rejected', review_note=nullif(trim(coalesce(p_note,'')), ''),
      reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
  WHERE id=p_request_id;

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, target_type, target_id, entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'CLINIC_ACCESS_REQUEST_REJECTED', 'clinic_access_request', p_request_id,
    'clinic_access_request', p_request_id::text,
    jsonb_build_object('clinic_name', v_request.clinic_name, 'owner_email', lower(trim(v_request.owner_email)), 'note', nullif(trim(coalesce(p_note,'')), ''))
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_reject_clinic_access_request(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_reject_clinic_access_request(uuid,text) TO authenticated;

COMMIT;