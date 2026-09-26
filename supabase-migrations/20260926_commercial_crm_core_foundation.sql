-- MEDICSPRO — MED-CRM-001 Commercial Core Foundation
-- Additive foundation only: Contact / Pipeline / Stage / Lead / Activity.
-- No Patient backfill, no Lead->Patient conversion and no product UI in this slice.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  phone_normalized text,
  email text,
  email_normalized text,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  anonymized_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_name_nonempty CHECK (btrim(name) <> ''),
  CONSTRAINT contacts_source_metadata_object CHECK (jsonb_typeof(source_metadata) = 'object'),
  CONSTRAINT contacts_id_clinic_unique UNIQUE (id, clinic_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_active_patient_unique
  ON public.contacts (clinic_id, patient_id)
  WHERE patient_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_clinic_active_idx
  ON public.contacts (clinic_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_phone_normalized_idx
  ON public.contacts (clinic_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_email_normalized_idx
  ON public.contacts (clinic_id, email_normalized)
  WHERE email_normalized IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_pipelines_name_nonempty CHECK (btrim(name) <> ''),
  CONSTRAINT crm_pipelines_id_clinic_unique UNIQUE (id, clinic_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_pipelines_one_active_default_per_clinic
  ON public.crm_pipelines (clinic_id)
  WHERE is_default IS TRUE AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_pipelines_clinic_idx
  ON public.crm_pipelines (clinic_id, created_at);

CREATE TABLE IF NOT EXISTS public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL,
  stage_kind text NOT NULL DEFAULT 'open',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_stages_name_nonempty CHECK (btrim(name) <> ''),
  CONSTRAINT crm_stages_position_nonnegative CHECK (position >= 0),
  CONSTRAINT crm_stages_kind_check CHECK (stage_kind IN ('open', 'won', 'lost')),
  CONSTRAINT crm_stages_pipeline_tenant_fk
    FOREIGN KEY (pipeline_id, clinic_id)
    REFERENCES public.crm_pipelines(id, clinic_id)
    ON DELETE CASCADE,
  CONSTRAINT crm_stages_identity_pipeline_tenant_unique UNIQUE (id, pipeline_id, clinic_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_stages_active_position_unique
  ON public.crm_stages (pipeline_id, position)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_stages_one_active_won_per_pipeline
  ON public.crm_stages (pipeline_id)
  WHERE stage_kind = 'won' AND archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_stages_one_active_lost_per_pipeline
  ON public.crm_stages (pipeline_id)
  WHERE stage_kind = 'lost' AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_stages_clinic_pipeline_idx
  ON public.crm_stages (clinic_id, pipeline_id, position);

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  value_cents bigint,
  source text,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  lost_reason_code text,
  lost_reason_detail text,
  closed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_leads_title_nonempty CHECK (btrim(title) <> ''),
  CONSTRAINT crm_leads_value_nonnegative CHECK (value_cents IS NULL OR value_cents >= 0),
  CONSTRAINT crm_leads_source_metadata_object CHECK (jsonb_typeof(source_metadata) = 'object'),
  CONSTRAINT crm_leads_contact_tenant_fk
    FOREIGN KEY (contact_id, clinic_id)
    REFERENCES public.contacts(id, clinic_id)
    ON DELETE RESTRICT,
  CONSTRAINT crm_leads_pipeline_tenant_fk
    FOREIGN KEY (pipeline_id, clinic_id)
    REFERENCES public.crm_pipelines(id, clinic_id)
    ON DELETE RESTRICT,
  CONSTRAINT crm_leads_stage_pipeline_tenant_fk
    FOREIGN KEY (stage_id, pipeline_id, clinic_id)
    REFERENCES public.crm_stages(id, pipeline_id, clinic_id)
    ON DELETE RESTRICT,
  CONSTRAINT crm_leads_id_clinic_unique UNIQUE (id, clinic_id)
);

CREATE INDEX IF NOT EXISTS crm_leads_clinic_stage_idx
  ON public.crm_leads (clinic_id, stage_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_leads_contact_idx
  ON public.crm_leads (clinic_id, contact_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_leads_owner_idx
  ON public.crm_leads (clinic_id, owner_id, created_at DESC)
  WHERE owner_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  activity_type text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_kind text NOT NULL DEFAULT 'human',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_lead_activities_type_nonempty CHECK (btrim(activity_type) <> ''),
  CONSTRAINT crm_lead_activities_actor_kind_check
    CHECK (actor_kind IN ('human', 'system', 'automation', 'ai', 'api', 'migration')),
  CONSTRAINT crm_lead_activities_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT crm_lead_activities_lead_tenant_fk
    FOREIGN KEY (lead_id, clinic_id)
    REFERENCES public.crm_leads(id, clinic_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS crm_lead_activities_lead_created_idx
  ON public.crm_lead_activities (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS crm_lead_activities_clinic_created_idx
  ON public.crm_lead_activities (clinic_id, created_at DESC);

-- New tables do not receive the historical schema-wide trigger installer.
DROP TRIGGER IF EXISTS update_updated_at ON public.contacts;
CREATE TRIGGER update_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_updated_at ON public.crm_pipelines;
CREATE TRIGGER update_updated_at
BEFORE UPDATE ON public.crm_pipelines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_updated_at ON public.crm_stages;
CREATE TRIGGER update_updated_at
BEFORE UPDATE ON public.crm_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_updated_at ON public.crm_leads;
CREATE TRIGGER update_updated_at
BEFORE UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.guard_crm_contact_patient_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.clinic_id = NEW.clinic_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'crm_contact_patient_tenant_mismatch' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_crm_contact_patient_tenant()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_crm_contact_patient_tenant ON public.contacts;
CREATE TRIGGER trg_guard_crm_contact_patient_tenant
BEFORE INSERT OR UPDATE OF patient_id, clinic_id
ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.guard_crm_contact_patient_tenant();

CREATE OR REPLACE FUNCTION public.guard_crm_lead_semantics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stage_kind text;
  v_stage_archived_at timestamptz;
BEGIN
  SELECT s.stage_kind, s.archived_at
    INTO v_stage_kind, v_stage_archived_at
  FROM public.crm_stages s
  WHERE s.id = NEW.stage_id
    AND s.pipeline_id = NEW.pipeline_id
    AND s.clinic_id = NEW.clinic_id;

  IF v_stage_kind IS NULL THEN
    RAISE EXCEPTION 'crm_lead_stage_not_found' USING ERRCODE = '23514';
  END IF;

  IF (
    TG_OP = 'INSERT'
    OR NEW.stage_id IS DISTINCT FROM OLD.stage_id
    OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
  ) AND v_stage_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'crm_lead_stage_archived' USING ERRCODE = '23514';
  END IF;

  IF (
    TG_OP = 'INSERT'
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
  ) AND NEW.owner_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = NEW.owner_id
        AND p.clinic_id = NEW.clinic_id
        AND p.ativo IS TRUE
    ) THEN
      RAISE EXCEPTION 'crm_lead_owner_tenant_mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_stage_kind = 'open' THEN
    IF NEW.closed_at IS NOT NULL
       OR NEW.lost_reason_code IS NOT NULL
       OR NEW.lost_reason_detail IS NOT NULL THEN
      RAISE EXCEPTION 'crm_open_lead_terminal_fields_forbidden' USING ERRCODE = '23514';
    END IF;
  ELSIF v_stage_kind = 'won' THEN
    IF NEW.closed_at IS NULL THEN
      RAISE EXCEPTION 'crm_won_lead_closed_at_required' USING ERRCODE = '23514';
    END IF;
    IF NEW.lost_reason_code IS NOT NULL OR NEW.lost_reason_detail IS NOT NULL THEN
      RAISE EXCEPTION 'crm_won_lead_lost_reason_forbidden' USING ERRCODE = '23514';
    END IF;
  ELSIF v_stage_kind = 'lost' THEN
    IF NEW.closed_at IS NULL THEN
      RAISE EXCEPTION 'crm_lost_lead_closed_at_required' USING ERRCODE = '23514';
    END IF;
    IF nullif(btrim(coalesce(NEW.lost_reason_code, '')), '') IS NULL
       AND nullif(btrim(coalesce(NEW.lost_reason_detail, '')), '') IS NULL THEN
      RAISE EXCEPTION 'crm_lost_lead_reason_required' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_crm_lead_semantics()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_crm_lead_semantics ON public.crm_leads;
CREATE TRIGGER trg_guard_crm_lead_semantics
BEFORE INSERT OR UPDATE
ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.guard_crm_lead_semantics();

CREATE OR REPLACE FUNCTION public.guard_crm_activity_actor_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.actor_id
      AND p.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'crm_activity_actor_tenant_mismatch' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_crm_activity_actor_tenant()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_crm_activity_actor_tenant ON public.crm_lead_activities;
CREATE TRIGGER trg_guard_crm_activity_actor_tenant
BEFORE INSERT ON public.crm_lead_activities
FOR EACH ROW EXECUTE FUNCTION public.guard_crm_activity_actor_tenant();

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_activities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_pipelines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_stages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_leads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_lead_activities FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_pipelines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_stages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_lead_activities TO service_role;

-- Generic starter pipeline for existing clinics. Names are configuration defaults,
-- not specialty or clinical semantics.
INSERT INTO public.crm_pipelines (clinic_id, name, is_default)
SELECT c.id, 'Comercial', true
FROM public.clinics c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.crm_pipelines p
    WHERE p.clinic_id = c.id
      AND p.is_default IS TRUE
      AND p.archived_at IS NULL
  );

WITH default_stages(name, position, stage_kind) AS (
  VALUES
    ('Novo'::text, 10, 'open'::text),
    ('Contato iniciado'::text, 20, 'open'::text),
    ('Interessado'::text, 30, 'open'::text),
    ('Avaliação a agendar'::text, 40, 'open'::text),
    ('Convertido'::text, 90, 'won'::text),
    ('Perdido'::text, 100, 'lost'::text)
)
INSERT INTO public.crm_stages (clinic_id, pipeline_id, name, position, stage_kind)
SELECT p.clinic_id, p.id, d.name, d.position, d.stage_kind
FROM public.crm_pipelines p
CROSS JOIN default_stages d
WHERE p.is_default IS TRUE
  AND p.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.crm_stages s
    WHERE s.pipeline_id = p.id
      AND s.position = d.position
      AND s.archived_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.crm_current_reader_clinic_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT ap.clinic_id, ap.role::text
    INTO v_clinic, v_role
  FROM public.current_active_profile() AS ap;

  IF v_clinic IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('owner', 'admin', 'professional', 'recep', 'financeiro') THEN
    RAISE EXCEPTION 'crm_read_role_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF public.current_clinic_entitlement_allowed('crm.access') IS NOT TRUE THEN
    RAISE EXCEPTION 'crm_access_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN v_clinic;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_current_reader_clinic_id()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_current_clinic_crm_pipelines()
RETURNS TABLE (
  id uuid,
  name text,
  is_default boolean,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.name, p.is_default, p.archived_at, p.created_at, p.updated_at
  FROM public.crm_pipelines p
  WHERE p.clinic_id = public.crm_current_reader_clinic_id()
  ORDER BY (p.archived_at IS NULL) DESC, p.is_default DESC, lower(p.name), p.created_at
$$;

CREATE OR REPLACE FUNCTION public.list_current_clinic_crm_stages(
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  pipeline_id uuid,
  name text,
  position integer,
  stage_kind text,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.pipeline_id, s.name, s.position, s.stage_kind,
         s.archived_at, s.created_at, s.updated_at
  FROM public.crm_stages s
  WHERE s.clinic_id = public.crm_current_reader_clinic_id()
    AND (p_pipeline_id IS NULL OR s.pipeline_id = p_pipeline_id)
  ORDER BY s.pipeline_id, (s.archived_at IS NULL) DESC, s.position, s.created_at
$$;

CREATE OR REPLACE FUNCTION public.list_current_clinic_crm_leads()
RETURNS TABLE (
  lead_id uuid,
  title text,
  value_cents bigint,
  source text,
  lost_reason_code text,
  lost_reason_detail text,
  closed_at timestamptz,
  lead_created_at timestamptz,
  lead_updated_at timestamptz,
  owner_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  contact_email text,
  contact_patient_id uuid,
  contact_anonymized_at timestamptz,
  pipeline_id uuid,
  pipeline_name text,
  stage_id uuid,
  stage_name text,
  stage_kind text,
  stage_position integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    l.id,
    l.title,
    l.value_cents,
    l.source,
    l.lost_reason_code,
    l.lost_reason_detail,
    l.closed_at,
    l.created_at,
    l.updated_at,
    l.owner_id,
    c.id,
    c.name,
    c.phone,
    c.email,
    c.patient_id,
    c.anonymized_at,
    p.id,
    p.name,
    s.id,
    s.name,
    s.stage_kind,
    s.position
  FROM public.crm_leads l
  JOIN public.contacts c
    ON c.id = l.contact_id
   AND c.clinic_id = l.clinic_id
  JOIN public.crm_pipelines p
    ON p.id = l.pipeline_id
   AND p.clinic_id = l.clinic_id
  JOIN public.crm_stages s
    ON s.id = l.stage_id
   AND s.pipeline_id = l.pipeline_id
   AND s.clinic_id = l.clinic_id
  WHERE l.clinic_id = public.crm_current_reader_clinic_id()
    AND l.deleted_at IS NULL
  ORDER BY l.updated_at DESC, l.created_at DESC
$$;

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
  SELECT a.id, a.activity_type, a.actor_id, a.actor_kind, a.metadata, a.created_at
  FROM public.crm_lead_activities a
  WHERE a.clinic_id = v_clinic
    AND a.lead_id = p_lead_id
  ORDER BY a.created_at DESC, a.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_current_clinic_crm_pipelines()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_crm_pipelines()
TO authenticated;

REVOKE ALL ON FUNCTION public.list_current_clinic_crm_stages(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_crm_stages(uuid)
TO authenticated;

REVOKE ALL ON FUNCTION public.list_current_clinic_crm_leads()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_crm_leads()
TO authenticated;

REVOKE ALL ON FUNCTION public.list_current_clinic_crm_lead_activities(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_crm_lead_activities(uuid)
TO authenticated;

COMMENT ON TABLE public.contacts IS
  'Tenant-scoped commercial/communication identity. Contact is not Patient and carries no clinical record.';
COMMENT ON TABLE public.crm_leads IS
  'Commercial opportunity linked to Contact. Outcome is derived from crm_stages.stage_kind; no competing lead status column.';
COMMENT ON TABLE public.crm_lead_activities IS
  'Commercial operational timeline. Not a clinical history and intentionally unavailable for direct authenticated DML.';
COMMENT ON FUNCTION public.crm_current_reader_clinic_id() IS
  'Internal CRM read guard: active profile + current clinic + crm.access; not exposed as a browser RPC.';
COMMENT ON FUNCTION public.list_current_clinic_crm_leads() IS
  'CRM-safe current-clinic lead projection. Does not expose EHR/CID/evolution/document payloads.';

COMMIT;
