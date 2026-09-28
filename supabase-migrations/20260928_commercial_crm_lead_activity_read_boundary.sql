BEGIN;

CREATE OR REPLACE FUNCTION public.list_current_clinic_crm_lead_activities(
  p_lead_id uuid
)
RETURNS TABLE (
  id uuid,
  activity_type text,
  actor_id uuid,
  actor_kind text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_reader_clinic_id();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_leads l
    WHERE l.id = p_lead_id
      AND l.clinic_id = v_clinic
      AND l.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'crm_lead_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.activity_type,
    NULL::uuid AS actor_id,
    a.actor_kind,
    CASE
      WHEN a.activity_type = 'stage_changed' THEN
        jsonb_strip_nulls(
          jsonb_build_object(
            'from_stage_id',
              CASE
                WHEN jsonb_typeof(a.metadata -> 'from_stage_id') = 'string'
                THEN a.metadata -> 'from_stage_id'
                ELSE NULL
              END,
            'to_stage_id',
              CASE
                WHEN jsonb_typeof(a.metadata -> 'to_stage_id') = 'string'
                THEN a.metadata -> 'to_stage_id'
                ELSE NULL
              END
          )
        )
      WHEN a.activity_type = 'contact_identity_resolved'
       AND a.metadata ->> 'resolution_mode' IN (
         'create_if_clear',
         'explicit_reuse',
         'explicit_distinct'
       ) THEN
        jsonb_build_object(
          'resolution_mode',
          a.metadata ->> 'resolution_mode'
        )
      ELSE '{}'::jsonb
    END AS metadata,
    a.created_at
  FROM public.crm_lead_activities a
  WHERE a.clinic_id = v_clinic
    AND a.lead_id = p_lead_id
  ORDER BY a.created_at DESC, a.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_current_clinic_crm_lead_activities(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_crm_lead_activities(uuid)
TO authenticated;

COMMENT ON FUNCTION public.list_current_clinic_crm_lead_activities(uuid) IS
  'MED-CRM-009 bounded current-clinic Commercial Lead activity projection. Preserves coarse actor provenance while suppressing actor identity and fail-closing activity metadata to reviewed browser fields.';

COMMIT;
