-- MED-CRM-006 — Contact Identity Resolution V1
-- Backend authority only. No Patient matching, Contact merge/dedupe or frontend authority.

BEGIN;

CREATE OR REPLACE FUNCTION public.crm_normalize_contact_phone(
  p_phone text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trim text := btrim(coalesce(p_phone, ''));
  v_digits text;
  v_national text;
BEGIN
  IF v_trim = '' THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(v_trim, '\D', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  -- Explicit international form. BR still validates its national length.
  IF left(v_trim, 1) = '+' THEN
    IF length(v_digits) < 8 OR length(v_digits) > 15 THEN
      RETURN NULL;
    END IF;

    IF left(v_digits, 2) = '55' THEN
      v_national := substr(v_digits, 3);
      IF length(v_national) NOT IN (10, 11) THEN
        RETURN NULL;
      END IF;
    END IF;

    RETURN '+' || v_digits;
  END IF;

  -- BR country code without plus.
  IF left(v_digits, 2) = '55' AND length(v_digits) IN (12, 13) THEN
    RETURN '+' || v_digits;
  END IF;

  -- V1 clinic-country assumption: unprefixed 10/11 digit input is BR national.
  IF length(v_digits) IN (10, 11) THEN
    RETURN '+55' || v_digits;
  END IF;

  -- Ambiguous/unusable input remains display data only, not an identity signal.
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_normalize_contact_phone(text)
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_normalize_contact_phone(text) IS
  'Internal MED-CRM-006 canonical Contact phone storage normalizer. Storage normalization is distinct from candidate equivalence.';

CREATE OR REPLACE FUNCTION public.crm_contact_phone_candidate_variants(
  p_phone text
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_canonical text := public.crm_normalize_contact_phone(p_phone);
  v_national text;
  v_legacy text;
BEGIN
  IF v_canonical IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  IF v_canonical ~ '^\+55[0-9]{10,11}$' THEN
    v_national := substr(v_canonical, 4);

    IF length(v_national) = 11 AND substr(v_national, 3, 1) = '9' THEN
      v_legacy := '+55' || substr(v_national, 1, 2) || substr(v_national, 4);
    ELSIF length(v_national) = 10 THEN
      v_legacy := '+55' || substr(v_national, 1, 2) || '9' || substr(v_national, 3);
    END IF;
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT v
    FROM unnest(ARRAY[v_canonical, v_legacy]) AS u(v)
    WHERE v IS NOT NULL
    ORDER BY v
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_contact_phone_candidate_variants(text)
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_contact_phone_candidate_variants(text) IS
  'Internal MED-CRM-006 phone candidate signals. BR ninth-digit variants are candidate evidence only, never identity truth.';

CREATE OR REPLACE FUNCTION public.crm_normalize_contact_email(
  p_email text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := btrim(coalesce(p_email, ''));
  v_local text;
  v_domain text;
BEGIN
  IF v_email = '' THEN
    RETURN NULL;
  END IF;

  IF length(v_email) - length(replace(v_email, '@', '')) <> 1 THEN
    RETURN NULL;
  END IF;

  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);

  IF v_local = '' OR v_domain = '' OR v_local ~ '[[:space:]]' OR v_domain ~ '[[:space:]]' THEN
    RETURN NULL;
  END IF;

  RETURN v_local || '@' || lower(v_domain);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_normalize_contact_email(text)
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_normalize_contact_email(text) IS
  'Internal MED-CRM-006 canonical Contact email normalizer: trim, preserve local-part, lowercase domain only.';

CREATE OR REPLACE FUNCTION public.crm_contact_identity_lock_key(
  p_clinic_id uuid,
  p_kind text,
  p_value text
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hash bytea;
BEGIN
  IF p_kind NOT IN ('lead_retry', 'phone', 'email') THEN
    RAISE EXCEPTION 'crm_identity_lock_kind_invalid' USING ERRCODE = '22023';
  END IF;

  IF nullif(btrim(p_value), '') IS NULL THEN
    RAISE EXCEPTION 'crm_identity_lock_value_required' USING ERRCODE = '22023';
  END IF;

  v_hash := sha256(convert_to(
    'medicspro.crm.contact_identity.v1|' ||
    p_clinic_id::text || '|' ||
    p_kind || '|' ||
    p_value,
    'UTF8'
  ));

  -- Positive 63-bit key from the first 8 SHA-256 bytes. The hash is only a
  -- serialization key; identity is always decided from a post-lock DB recheck.
  RETURN
      ((get_byte(v_hash, 0)::bigint & 127) << 56)
    |  (get_byte(v_hash, 1)::bigint << 48)
    |  (get_byte(v_hash, 2)::bigint << 40)
    |  (get_byte(v_hash, 3)::bigint << 32)
    |  (get_byte(v_hash, 4)::bigint << 24)
    |  (get_byte(v_hash, 5)::bigint << 16)
    |  (get_byte(v_hash, 6)::bigint << 8)
    |   get_byte(v_hash, 7)::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_contact_identity_lock_key(uuid,text,text)
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_contact_identity_lock_key(uuid,text,text) IS
  'Internal deterministic MED-CRM-006 advisory-lock key. Includes clinic and resource kind; hash never decides identity.';

CREATE OR REPLACE FUNCTION public.crm_lock_contact_identity_signals(
  p_clinic_id uuid,
  p_phone text,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := public.crm_normalize_contact_email(p_email);
  v_key bigint;
BEGIN
  FOR v_key IN
    SELECT DISTINCT q.lock_key
    FROM (
      SELECT public.crm_contact_identity_lock_key(p_clinic_id, 'phone', v) AS lock_key
      FROM unnest(public.crm_contact_phone_candidate_variants(p_phone)) AS p(v)

      UNION ALL

      SELECT public.crm_contact_identity_lock_key(p_clinic_id, 'email', v_email)
      WHERE v_email IS NOT NULL
    ) q
    ORDER BY q.lock_key
  LOOP
    PERFORM pg_advisory_xact_lock(v_key);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_lock_contact_identity_signals(uuid,text,text)
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_lock_contact_identity_signals(uuid,text,text) IS
  'Internal MED-CRM-006 transaction-scoped signal locking. Locks every candidate-equivalent phone variant and exact canonical email in deterministic key order.';

CREATE OR REPLACE FUNCTION public.crm_contact_identity_candidates_for_clinic(
  p_clinic_id uuid,
  p_phone text,
  p_email text
)
RETURNS TABLE (
  contact_id uuid,
  display_name text,
  phone text,
  email text,
  match_reasons text[],
  open_lead_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH input AS (
    SELECT
      public.crm_normalize_contact_phone(p_phone) AS phone_exact,
      public.crm_contact_phone_candidate_variants(p_phone) AS phone_variants,
      public.crm_normalize_contact_email(p_email) AS email_exact
  ),
  contact_signals AS (
    SELECT
      c.id,
      c.name,
      c.phone,
      c.email,
      c.phone_normalized,
      c.email_normalized,
      public.crm_normalize_contact_phone(c.phone) AS raw_phone_normalized,
      public.crm_normalize_contact_email(c.email) AS raw_email_normalized
    FROM public.contacts c
    WHERE c.clinic_id = p_clinic_id
      AND c.deleted_at IS NULL
      AND c.anonymized_at IS NULL
  ),
  matched AS (
    SELECT
      c.*,
      ARRAY(
        SELECT reason
        FROM (
          VALUES
            (
              'phone_exact'::text,
              i.phone_exact IS NOT NULL
              AND (
                c.phone_normalized = i.phone_exact
                OR c.raw_phone_normalized = i.phone_exact
              )
            ),
            (
              'phone_br_legacy_variant'::text,
              EXISTS (
                SELECT 1
                FROM unnest(i.phone_variants) AS pv(v)
                WHERE pv.v IS DISTINCT FROM i.phone_exact
                  AND (
                    c.phone_normalized = pv.v
                    OR c.raw_phone_normalized = pv.v
                  )
              )
            ),
            (
              'email_exact'::text,
              i.email_exact IS NOT NULL
              AND (
                c.email_normalized = i.email_exact
                OR c.raw_email_normalized = i.email_exact
              )
            )
        ) AS reasons(reason, matched)
        WHERE matched
        ORDER BY reason
      ) AS reasons
    FROM contact_signals c
    CROSS JOIN input i
  )
  SELECT
    m.id,
    m.name,
    m.phone,
    m.email,
    m.reasons,
    (
      SELECT count(*)::bigint
      FROM public.crm_leads l
      JOIN public.crm_pipelines p
        ON p.id = l.pipeline_id
       AND p.clinic_id = l.clinic_id
      JOIN public.crm_stages s
        ON s.id = l.stage_id
       AND s.pipeline_id = l.pipeline_id
       AND s.clinic_id = l.clinic_id
      WHERE l.clinic_id = p_clinic_id
        AND l.contact_id = m.id
        AND l.deleted_at IS NULL
        AND l.closed_at IS NULL
        AND p.archived_at IS NULL
        AND s.archived_at IS NULL
        AND s.stage_kind = 'open'
    ) AS open_lead_count
  FROM matched m
  WHERE cardinality(m.reasons) > 0
  ORDER BY lower(m.name), m.id
$$;

REVOKE ALL ON FUNCTION public.crm_contact_identity_candidates_for_clinic(uuid,text,text)
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_contact_identity_candidates_for_clinic(uuid,text,text) IS
  'Internal current-clinic Contact candidate projection for MED-CRM-006. No Patient join/input/output.';

CREATE OR REPLACE FUNCTION public.list_current_clinic_crm_contact_identity_candidates(
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS TABLE (
  contact_id uuid,
  display_name text,
  phone text,
  email text,
  match_reasons text[],
  open_lead_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_mutator_clinic_id();
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.crm_contact_identity_candidates_for_clinic(
    v_clinic,
    p_phone,
    p_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_current_clinic_crm_contact_identity_candidates(text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_crm_contact_identity_candidates(text,text)
TO authenticated;

COMMENT ON FUNCTION public.list_current_clinic_crm_contact_identity_candidates(text,text) IS
  'Authenticated writer-scoped Contact identity candidate preview. Returns CRM-safe Contact data only and never chooses a winner.';

CREATE OR REPLACE FUNCTION public.crm_create_contact_internal(
  p_clinic_id uuid,
  p_contact_id uuid,
  p_name text,
  p_phone text,
  p_phone_normalized text,
  p_email text,
  p_email_normalized text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_existing public.contacts%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  IF p_clinic_id IS NULL OR p_contact_id IS NULL THEN
    RAISE EXCEPTION 'crm_contact_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'crm_contact_name_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.contacts (
    id,
    clinic_id,
    name,
    phone,
    phone_normalized,
    email,
    email_normalized
  ) VALUES (
    p_contact_id,
    p_clinic_id,
    v_name,
    v_phone,
    p_phone_normalized,
    v_email,
    p_email_normalized
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT *
      INTO v_existing
    FROM public.contacts c
    WHERE c.id = p_contact_id;

    IF NOT FOUND
       OR v_existing.clinic_id IS DISTINCT FROM p_clinic_id
       OR v_existing.deleted_at IS NOT NULL
       OR v_existing.anonymized_at IS NOT NULL
       OR v_existing.patient_id IS NOT NULL
       OR v_existing.name IS DISTINCT FROM v_name
       OR v_existing.phone IS DISTINCT FROM v_phone
       OR v_existing.email IS DISTINCT FROM v_email
       OR (
         v_existing.phone_normalized IS NOT NULL
         AND v_existing.phone_normalized IS DISTINCT FROM p_phone_normalized
       )
       OR (
         v_existing.email_normalized IS NOT NULL
         AND v_existing.email_normalized IS DISTINCT FROM p_email_normalized
       ) THEN
      RAISE EXCEPTION 'crm_contact_idempotency_conflict' USING ERRCODE = '23505';
    END IF;

    RETURN p_contact_id;
  END IF;

  INSERT INTO public.audit_log (
    clinic_id,
    usuario_id,
    acao,
    detalhe
  ) VALUES (
    p_clinic_id,
    auth.uid(),
    'CRM_CONTACT_CREATED',
    format('contact_id=%s', p_contact_id)
  );

  RETURN p_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_create_contact_internal(uuid,uuid,text,text,text,text,text)
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_create_contact_internal(uuid,uuid,text,text,text,text,text) IS
  'Internal shared Contact insert/idempotency/audit core. Clinic must come from a canonical server-side wrapper.';

CREATE OR REPLACE FUNCTION public.create_current_clinic_crm_contact(
  p_contact_id uuid,
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_mutator_clinic_id();
  v_phone_normalized text := public.crm_normalize_contact_phone(p_phone);
  v_email_normalized text := public.crm_normalize_contact_email(p_email);
BEGIN
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'crm_contact_id_required' USING ERRCODE = '22023';
  END IF;

  -- Keep the released fail-closed lifecycle guard visible at the public
  -- command boundary while the shared internal core remains the single
  -- insert/idempotency/audit implementation.
  IF EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = p_contact_id
      AND c.anonymized_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'crm_contact_idempotency_conflict' USING ERRCODE = '23505';
  END IF;

  -- Preserve exact same-ID retry before candidate resolution. The shared core
  -- performs the complete persisted-contract comparison without mutation.
  IF EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = p_contact_id
  ) THEN
    RETURN public.crm_create_contact_internal(
      v_clinic,
      p_contact_id,
      p_name,
      p_phone,
      v_phone_normalized,
      p_email,
      v_email_normalized
    );
  END IF;

  PERFORM public.crm_lock_contact_identity_signals(v_clinic, p_phone, p_email);

  IF EXISTS (
    SELECT 1
    FROM public.crm_contact_identity_candidates_for_clinic(v_clinic, p_phone, p_email)
  ) THEN
    RAISE EXCEPTION 'crm_contact_identity_resolution_required' USING ERRCODE = '23514';
  END IF;

  RETURN public.crm_create_contact_internal(
    v_clinic,
    p_contact_id,
    p_name,
    p_phone,
    v_phone_normalized,
    p_email,
    v_email_normalized
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_current_clinic_crm_contact(uuid,text,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_current_clinic_crm_contact(uuid,text,text,text)
TO authenticated;

COMMENT ON FUNCTION public.create_current_clinic_crm_contact(uuid,text,text,text) IS
  'Canonical authenticated current-clinic Contact create-if-clear. Exact UUID retry remains idempotent; identity candidates require explicit MED-CRM-006 resolution.';

CREATE OR REPLACE FUNCTION public.create_current_clinic_crm_lead(
  p_lead_id uuid,
  p_contact_id uuid,
  p_title text,
  p_pipeline_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_value_cents bigint DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_mutator_clinic_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_source text := nullif(btrim(coalesce(p_source, '')), '');
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_stage_kind text;
  v_existing public.crm_leads%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  IF p_lead_id IS NULL OR p_contact_id IS NULL THEN
    RAISE EXCEPTION 'crm_lead_and_contact_id_required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    public.crm_contact_identity_lock_key(
      v_clinic,
      'lead_retry',
      p_lead_id::text
    )
  );

  IF v_title = '' THEN
    RAISE EXCEPTION 'crm_lead_title_required' USING ERRCODE = '22023';
  END IF;

  IF p_value_cents IS NOT NULL AND p_value_cents < 0 THEN
    RAISE EXCEPTION 'crm_lead_value_negative' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = p_contact_id
      AND c.clinic_id = v_clinic
      AND c.deleted_at IS NULL
      AND c.anonymized_at IS NULL
  ) THEN
    RAISE EXCEPTION 'crm_contact_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_pipeline_id IS NULL THEN
    SELECT p.id
      INTO v_pipeline_id
    FROM public.crm_pipelines p
    WHERE p.clinic_id = v_clinic
      AND p.is_default IS TRUE
      AND p.archived_at IS NULL
    ORDER BY p.created_at, p.id
    LIMIT 1;
  ELSE
    SELECT p.id
      INTO v_pipeline_id
    FROM public.crm_pipelines p
    WHERE p.id = p_pipeline_id
      AND p.clinic_id = v_clinic
      AND p.archived_at IS NULL;
  END IF;

  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'crm_pipeline_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_stage_id IS NULL THEN
    SELECT s.id, s.stage_kind
      INTO v_stage_id, v_stage_kind
    FROM public.crm_stages s
    WHERE s.clinic_id = v_clinic
      AND s.pipeline_id = v_pipeline_id
      AND s.archived_at IS NULL
      AND s.stage_kind = 'open'
    ORDER BY s.position, s.created_at, s.id
    LIMIT 1;
  ELSE
    SELECT s.id, s.stage_kind
      INTO v_stage_id, v_stage_kind
    FROM public.crm_stages s
    WHERE s.id = p_stage_id
      AND s.clinic_id = v_clinic
      AND s.pipeline_id = v_pipeline_id
      AND s.archived_at IS NULL;
  END IF;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'crm_stage_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_stage_kind <> 'open' THEN
    RAISE EXCEPTION 'crm_lead_initial_stage_must_be_open' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.crm_leads (
    id,
    clinic_id,
    contact_id,
    pipeline_id,
    stage_id,
    owner_id,
    title,
    value_cents,
    source
  ) VALUES (
    p_lead_id,
    v_clinic,
    p_contact_id,
    v_pipeline_id,
    v_stage_id,
    p_owner_id,
    v_title,
    p_value_cents,
    v_source
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT *
      INTO v_existing
    FROM public.crm_leads l
    WHERE l.id = p_lead_id;

    IF NOT FOUND
       OR v_existing.clinic_id IS DISTINCT FROM v_clinic
       OR v_existing.deleted_at IS NOT NULL
       OR v_existing.contact_id IS DISTINCT FROM p_contact_id
       OR v_existing.pipeline_id IS DISTINCT FROM v_pipeline_id
       OR v_existing.stage_id IS DISTINCT FROM v_stage_id
       OR v_existing.owner_id IS DISTINCT FROM p_owner_id
       OR v_existing.title IS DISTINCT FROM v_title
       OR v_existing.value_cents IS DISTINCT FROM p_value_cents
       OR v_existing.source IS DISTINCT FROM v_source THEN
      RAISE EXCEPTION 'crm_lead_idempotency_conflict' USING ERRCODE = '23505';
    END IF;

    RETURN p_lead_id;
  END IF;

  INSERT INTO public.crm_lead_activities (
    clinic_id,
    lead_id,
    activity_type,
    actor_id,
    actor_kind,
    metadata
  ) VALUES (
    v_clinic,
    p_lead_id,
    'lead_created',
    auth.uid(),
    'human',
    jsonb_build_object(
      'contact_id', p_contact_id,
      'pipeline_id', v_pipeline_id,
      'stage_id', v_stage_id
    )
  );

  INSERT INTO public.audit_log (
    clinic_id,
    usuario_id,
    acao,
    detalhe
  ) VALUES (
    v_clinic,
    auth.uid(),
    'CRM_LEAD_CREATED',
    format(
      'lead_id=%s; contact_id=%s; pipeline_id=%s; stage_id=%s',
      p_lead_id,
      p_contact_id,
      v_pipeline_id,
      v_stage_id
    )
  );

  RETURN p_lead_id;
END;
$$;


REVOKE ALL ON FUNCTION public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)
TO authenticated;

COMMENT ON FUNCTION public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text) IS
  'Canonical authenticated Lead creation for the current clinic. Existing MED-CRM-002 authority is preserved and same Lead UUID is transaction-serialized.';

CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_contact_identity_resolution_once
  ON public.crm_lead_activities (lead_id)
  WHERE activity_type = 'contact_identity_resolved';

CREATE OR REPLACE FUNCTION public.create_current_clinic_crm_resolved_prospect(
  p_contact_id uuid,
  p_lead_id uuid,
  p_name text,
  p_title text,
  p_resolution_mode text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_override_reason text DEFAULT NULL,
  p_pipeline_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_value_cents bigint DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS TABLE (
  contact_id uuid,
  lead_id uuid,
  resolution_mode text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_mutator_clinic_id();
  v_mode text := nullif(btrim(coalesce(p_resolution_mode, '')), '');
  v_name text := btrim(coalesce(p_name, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_phone_normalized text := public.crm_normalize_contact_phone(p_phone);
  v_email_normalized text := public.crm_normalize_contact_email(p_email);
  v_reason text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_source text := nullif(btrim(coalesce(p_source, '')), '');
  v_candidate_ids uuid[] := ARRAY[]::uuid[];
  v_match_reasons text[] := ARRAY[]::text[];
  v_candidate_count integer := 0;
  v_resolution jsonb;
  v_existing_lead public.crm_leads%ROWTYPE;
  v_existing_contact public.contacts%ROWTYPE;
  v_created_stage uuid;
BEGIN
  IF p_contact_id IS NULL OR p_lead_id IS NULL THEN
    RAISE EXCEPTION 'crm_contact_and_lead_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'crm_contact_name_required' USING ERRCODE = '22023';
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'crm_lead_title_required' USING ERRCODE = '22023';
  END IF;

  IF v_mode NOT IN ('create_if_clear', 'explicit_reuse', 'explicit_distinct') THEN
    RAISE EXCEPTION 'crm_identity_resolution_mode_invalid' USING ERRCODE = '22023';
  END IF;

  IF v_mode = 'explicit_distinct' THEN
    IF v_reason NOT IN (
      'shared_contact_channel',
      'stale_or_reassigned_contact_detail',
      'operator_verified_distinct_identity'
    ) THEN
      RAISE EXCEPTION 'crm_explicit_distinct_reason_required' USING ERRCODE = '23514';
    END IF;
  ELSIF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'crm_identity_resolution_reason_forbidden' USING ERRCODE = '23514';
  END IF;

  IF p_value_cents IS NOT NULL AND p_value_cents < 0 THEN
    RAISE EXCEPTION 'crm_lead_value_negative' USING ERRCODE = '22023';
  END IF;

  -- Stable orchestration retry authority.
  PERFORM pg_advisory_xact_lock(
    public.crm_contact_identity_lock_key(
      v_clinic,
      'lead_retry',
      p_lead_id::text
    )
  );

  SELECT a.metadata
    INTO v_resolution
  FROM public.crm_lead_activities a
  WHERE a.clinic_id = v_clinic
    AND a.lead_id = p_lead_id
    AND a.activity_type = 'contact_identity_resolved'
  LIMIT 1;

  IF FOUND THEN
    IF (v_resolution->>'contact_id')::uuid IS DISTINCT FROM p_contact_id
       OR v_resolution->>'resolution_mode' IS DISTINCT FROM v_mode
       OR nullif(v_resolution->>'override_reason', '') IS DISTINCT FROM v_reason THEN
      RAISE EXCEPTION 'crm_prospect_resolution_idempotency_conflict' USING ERRCODE = '23505';
    END IF;

    SELECT *
      INTO v_existing_lead
    FROM public.crm_leads l
    WHERE l.id = p_lead_id;

    IF NOT FOUND
       OR v_existing_lead.clinic_id IS DISTINCT FROM v_clinic
       OR v_existing_lead.deleted_at IS NOT NULL
       OR v_existing_lead.contact_id IS DISTINCT FROM p_contact_id
       OR v_existing_lead.owner_id IS DISTINCT FROM p_owner_id
       OR v_existing_lead.title IS DISTINCT FROM v_title
       OR v_existing_lead.value_cents IS DISTINCT FROM p_value_cents
       OR v_existing_lead.source IS DISTINCT FROM v_source
       OR (
         p_pipeline_id IS NOT NULL
         AND v_existing_lead.pipeline_id IS DISTINCT FROM p_pipeline_id
       ) THEN
      RAISE EXCEPTION 'crm_prospect_resolution_idempotency_conflict' USING ERRCODE = '23505';
    END IF;

    IF p_stage_id IS NOT NULL THEN
      SELECT (a.metadata->>'stage_id')::uuid
        INTO v_created_stage
      FROM public.crm_lead_activities a
      WHERE a.clinic_id = v_clinic
        AND a.lead_id = p_lead_id
        AND a.activity_type = 'lead_created'
      ORDER BY a.created_at, a.id
      LIMIT 1;

      IF v_created_stage IS DISTINCT FROM p_stage_id THEN
        RAISE EXCEPTION 'crm_prospect_resolution_idempotency_conflict' USING ERRCODE = '23505';
      END IF;
    END IF;

    IF v_mode IN ('create_if_clear', 'explicit_distinct') THEN
      SELECT *
        INTO v_existing_contact
      FROM public.contacts c
      WHERE c.id = p_contact_id;

      IF NOT FOUND
         OR v_existing_contact.clinic_id IS DISTINCT FROM v_clinic
         OR v_existing_contact.deleted_at IS NOT NULL
         OR v_existing_contact.anonymized_at IS NOT NULL
         OR v_existing_contact.patient_id IS NOT NULL
         OR v_existing_contact.name IS DISTINCT FROM v_name
         OR v_existing_contact.phone IS DISTINCT FROM v_phone
         OR v_existing_contact.email IS DISTINCT FROM v_email THEN
        RAISE EXCEPTION 'crm_prospect_resolution_idempotency_conflict' USING ERRCODE = '23505';
      END IF;
    END IF;

    RETURN QUERY SELECT p_contact_id, p_lead_id, v_mode;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.crm_leads l
    WHERE l.id = p_lead_id
  ) THEN
    RAISE EXCEPTION 'crm_prospect_resolution_idempotency_conflict' USING ERRCODE = '23505';
  END IF;

  PERFORM public.crm_lock_contact_identity_signals(v_clinic, p_phone, p_email);

  SELECT
    coalesce(array_agg(c.contact_id ORDER BY c.contact_id), ARRAY[]::uuid[]),
    coalesce(
      ARRAY(
        SELECT DISTINCT reason
        FROM public.crm_contact_identity_candidates_for_clinic(v_clinic, p_phone, p_email) c2,
             unnest(c2.match_reasons) AS r(reason)
        ORDER BY reason
      ),
      ARRAY[]::text[]
    ),
    count(*)::integer
    INTO v_candidate_ids, v_match_reasons, v_candidate_count
  FROM public.crm_contact_identity_candidates_for_clinic(v_clinic, p_phone, p_email) c;

  IF v_mode = 'create_if_clear' THEN
    IF v_candidate_count <> 0 THEN
      RAISE EXCEPTION 'crm_contact_identity_resolution_required' USING ERRCODE = '23514';
    END IF;

    PERFORM public.crm_create_contact_internal(
      v_clinic,
      p_contact_id,
      v_name,
      v_phone,
      v_phone_normalized,
      v_email,
      v_email_normalized
    );

  ELSIF v_mode = 'explicit_reuse' THEN
    IF v_candidate_count = 0 OR NOT (p_contact_id = ANY(v_candidate_ids)) THEN
      RAISE EXCEPTION 'crm_selected_contact_not_identity_candidate' USING ERRCODE = '23514';
    END IF;

    PERFORM 1
    FROM public.contacts c
    WHERE c.id = p_contact_id
      AND c.clinic_id = v_clinic
      AND c.deleted_at IS NULL
      AND c.anonymized_at IS NULL
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'crm_contact_not_found' USING ERRCODE = 'P0002';
    END IF;

  ELSE
    IF v_candidate_count = 0 THEN
      RAISE EXCEPTION 'crm_explicit_distinct_requires_candidate' USING ERRCODE = '23514';
    END IF;

    PERFORM public.crm_create_contact_internal(
      v_clinic,
      p_contact_id,
      v_name,
      v_phone,
      v_phone_normalized,
      v_email,
      v_email_normalized
    );
  END IF;

  PERFORM public.create_current_clinic_crm_lead(
    p_lead_id,
    p_contact_id,
    v_title,
    p_pipeline_id,
    p_stage_id,
    p_owner_id,
    p_value_cents,
    v_source
  );

  INSERT INTO public.crm_lead_activities (
    clinic_id,
    lead_id,
    activity_type,
    actor_id,
    actor_kind,
    metadata
  ) VALUES (
    v_clinic,
    p_lead_id,
    'contact_identity_resolved',
    auth.uid(),
    'human',
    jsonb_strip_nulls(
      jsonb_build_object(
        'resolution_mode', v_mode,
        'contact_id', p_contact_id,
        'candidate_ids', to_jsonb(v_candidate_ids),
        'match_reasons', to_jsonb(v_match_reasons),
        'override_reason', CASE
          WHEN v_mode = 'explicit_distinct' THEN v_reason
          ELSE NULL
        END
      )
    )
  );

  INSERT INTO public.audit_log (
    clinic_id,
    usuario_id,
    acao,
    detalhe
  ) VALUES (
    v_clinic,
    auth.uid(),
    'CRM_CONTACT_IDENTITY_RESOLVED',
    format(
      'lead_id=%s; contact_id=%s; resolution_mode=%s; candidate_count=%s%s',
      p_lead_id,
      p_contact_id,
      v_mode,
      v_candidate_count,
      CASE
        WHEN v_mode = 'explicit_distinct'
          THEN format('; override_reason=%s', v_reason)
        ELSE ''
      END
    )
  );

  RETURN QUERY SELECT p_contact_id, p_lead_id, v_mode;
END;
$$;

REVOKE ALL ON FUNCTION public.create_current_clinic_crm_resolved_prospect(
  uuid,uuid,text,text,text,text,text,text,uuid,uuid,uuid,bigint,text
)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_current_clinic_crm_resolved_prospect(
  uuid,uuid,text,text,text,text,text,text,uuid,uuid,uuid,bigint,text
)
TO authenticated;

COMMENT ON FUNCTION public.create_current_clinic_crm_resolved_prospect(
  uuid,uuid,text,text,text,text,text,text,uuid,uuid,uuid,bigint,text
) IS
  'MED-CRM-006 final current-clinic Contact identity resolution authority. Atomically rechecks identity candidates, creates/reuses Contact, creates a new Lead, and emits bounded resolution evidence. No Patient authority.';

COMMIT;
