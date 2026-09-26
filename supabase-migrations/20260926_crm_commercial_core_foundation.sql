-- MEDICSPRO — MED-CRM-001 Commercial Core foundation
-- Scope: schema + integrity + read boundaries only.
-- No browser mutation RPC is introduced by this migration.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  phone text,
  phone_normalized text,
  email text,
  email_normalized text,
  patient_id uuid REFERENCES public.patients(id),
  source text,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_metadata) = 'object'),
  anonymized_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_clinic_id_id_key UNIQUE (clinic_id, id),
  CONSTRAINT contacts_anonymized_shape_check CHECK (
    anonymized_at IS NULL OR (
      name = 'Contato anonimizado'
      AND phone IS NULL
      AND phone_normalized IS NULL
      AND email IS NULL
      AND email_normalized IS NULL
      AND patient_id IS NULL
      AND source_metadata = '{}'::jsonb
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_active_patient_unique
  ON public.contacts (clinic_id, patient_id)
  WHERE patient_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_clinic_created_idx
  ON public.contacts (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contacts_clinic_phone_normalized_idx
  ON public.contacts (clinic_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contacts_clinic_email_normalized_idx
  ON public.contacts (clinic_id, email_normalized)
  WHERE email_normalized IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_pipelines_clinic_id_id_key UNIQUE (clinic_id, id),
  CONSTRAINT crm_pipelines_default_not_archived_check
    CHECK (NOT (is_default AND archived_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_pipelines_one_active_default
  ON public.crm_pipelines (clinic_id)
  WHERE is_default = true AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  position integer NOT NULL CHECK (position >= 0),
  stage_kind text NOT NULL CHECK (stage_kind IN ('open', 'won', 'lost')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_stages_clinic_pipeline_fk
    FOREIGN KEY (clinic_id, pipeline_id)
    REFERENCES public.crm_pipelines(clinic_id, id) ON DELETE CASCADE,
  CONSTRAINT crm_stages_clinic_pipeline_id_key UNIQUE (clinic_id, pipeline_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_stages_active_position_unique
  ON public.crm_stages (clinic_id, pipeline_id, position)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  value_cents bigint CHECK (value_cents IS NULL OR value_cents >= 0),
  source text,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_metadata) = 'object'),
  lost_reason_code text,
  lost_reason_detail text,
  closed_at timestamptz,
  converted_patient_id uuid REFERENCES public.patients(id),
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_leads_contact_fk
    FOREIGN KEY (clinic_id, contact_id)
    REFERENCES public.contacts(clinic_id, id),
  CONSTRAINT crm_leads_stage_fk
    FOREIGN KEY (clinic_id, pipeline_id, stage_id)
    REFERENCES public.crm_stages(clinic_id, pipeline_id, id),
  CONSTRAINT crm_leads_clinic_id_id_key UNIQUE (clinic_id, id),
  CONSTRAINT crm_leads_conversion_pair_check CHECK (
    (converted_patient_id IS NULL AND converted_at IS NULL)
    OR (converted_patient_id IS NOT NULL AND converted_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS crm_leads_clinic_pipeline_stage_idx
  ON public.crm_leads (clinic_id, pipeline_id, stage_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_clinic_contact_idx
  ON public.crm_leads (clinic_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_clinic_owner_idx
  ON public.crm_leads (clinic_id, owner_id, updated_at DESC) WHERE owner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (btrim(activity_type) <> ''),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_kind text NOT NULL CHECK (btrim(actor_kind) <> ''),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_lead_activities_lead_fk
    FOREIGN KEY (clinic_id, lead_id)
    REFERENCES public.crm_leads(clinic_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS crm_lead_activities_lead_created_idx
  ON public.crm_lead_activities (clinic_id, lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_crm_contact_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'crm_contact_patient_tenant_mismatch' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_crm_activity_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
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
$;

CREATE OR REPLACE FUNCTION public.guard_crm_lead_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stage_kind text;
BEGIN
  SELECT s.stage_kind
    INTO v_stage_kind
  FROM public.crm_stages s
  WHERE s.id = NEW.stage_id
    AND s.pipeline_id = NEW.pipeline_id
    AND s.clinic_id = NEW.clinic_id;

  IF v_stage_kind IS NULL THEN
    RAISE EXCEPTION 'crm_lead_stage_not_in_pipeline' USING ERRCODE = '23514';
  END IF;

  IF NEW.owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.owner_id
      AND p.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'crm_lead_owner_tenant_mismatch' USING ERRCODE = '23514';
  END IF;

  IF NEW.converted_patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = NEW.converted_patient_id
      AND p.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'crm_lead_patient_tenant_mismatch' USING ERRCODE = '23514';
  END IF;

  IF v_stage_kind = 'open' THEN
    IF NEW.closed_at IS NOT NULL
       OR NEW.lost_reason_code IS NOT NULL
       OR NEW.lost_reason_detail IS NOT NULL
       OR NEW.converted_patient_id IS NOT NULL
       OR NEW.converted_at IS NOT NULL THEN
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
    IF NEW.closed_at IS NULL OR nullif(btrim(coalesce(NEW.lost_reason_code, '')), '') IS NULL THEN
      RAISE EXCEPTION 'crm_lost_lead_reason_and_closed_at_required' USING ERRCODE = '23514';
    END IF;
    IF NEW.converted_patient_id IS NOT NULL OR NEW.converted_at IS NOT NULL THEN
      RAISE EXCEPTION 'crm_lost_lead_conversion_forbidden' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.converted_patient_id IS NOT NULL AND v_stage_kind <> 'won' THEN
    RAISE EXCEPTION 'crm_conversion_requires_won_stage' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_crm_contact_integrity ON public.contacts;
CREATE TRIGGER trg_guard_crm_contact_integrity
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.guard_crm_contact_integrity();

DROP TRIGGER IF EXISTS trg_guard_crm_lead_integrity ON public.crm_leads;
CREATE TRIGGER trg_guard_crm_lead_integrity
BEFORE INSERT OR UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.guard_crm_lead_integrity();

DROP TRIGGER IF EXISTS trg_guard_crm_activity_integrity ON public.crm_lead_activities;
CREATE TRIGGER trg_guard_crm_activity_integrity
BEFORE INSERT OR UPDATE ON public.crm_lead_activities
FOR EACH ROW EXECUTE FUNCTION public.guard_crm_activity_integrity();

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

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_activities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.contacts,
  public.crm_pipelines,
  public.crm_stages,
  public.crm_leads,
  public.crm_lead_activities
FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
  public.contacts,
  public.crm_pipelines,
  public.crm_stages,
  public.crm_leads,
  public.crm_lead_activities
TO service_role;

REVOKE ALL ON FUNCTION public.guard_crm_contact_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_crm_lead_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_crm_activity_integrity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_current_clinic_crm_pipeline_stages()
RETURNS TABLE (
  pipeline_id uuid,
  pipeline_name text,
  pipeline_is_default boolean,
  stage_id uuid,
  stage_name text,
  stage_kind text,
  stage_position integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_clinic IS NULL
     OR v_role NOT IN ('owner', 'admin', 'professional', 'recep', 'financeiro')
     OR public.current_clinic_entitlement_allowed('crm.access') IS NOT TRUE THEN
    RAISE EXCEPTION 'crm_read_access_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.is_default,
    s.id, s.name, s.stage_kind, s.position
  FROM public.crm_pipelines p
  JOIN public.crm_stages s
    ON s.clinic_id = p.clinic_id
   AND s.pipeline_id = p.id
  WHERE p.clinic_id = v_clinic
    AND p.archived_at IS NULL
    AND s.archived_at IS NULL
  ORDER BY p.is_default DESC, p.created_at, s.position, s.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_current_clinic_crm_leads()
RETURNS TABLE (
  lead_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  contact_email text,
  contact_patient_id uuid,
  pipeline_id uuid,
  pipeline_name text,
  stage_id uuid,
  stage_name text,
  stage_kind text,
  stage_position integer,
  owner_id uuid,
  value_cents bigint,
  source text,
  lost_reason_code text,
  lost_reason_detail text,
  closed_at timestamptz,
  converted_patient_id uuid,
  converted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_clinic IS NULL
     OR v_role NOT IN ('owner', 'admin', 'professional', 'recep', 'financeiro')
     OR public.current_clinic_entitlement_allowed('crm.access') IS NOT TRUE THEN
    RAISE EXCEPTION 'crm_read_access_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    c.id,
    c.name,
    CASE WHEN v_role IN ('owner', 'admin', 'recep') THEN c.phone ELSE NULL END,
    CASE WHEN v_role IN ('owner', 'admin', 'recep') THEN c.email ELSE NULL END,
    c.patient_id,
    p.id, p.name,
    s.id, s.name, s.stage_kind, s.position,
    l.owner_id, l.value_cents, l.source,
    l.lost_reason_code, l.lost_reason_detail, l.closed_at,
    l.converted_patient_id, l.converted_at,
    l.created_at, l.updated_at
  FROM public.crm_leads l
  JOIN public.contacts c
    ON c.clinic_id = l.clinic_id AND c.id = l.contact_id
  JOIN public.crm_pipelines p
    ON p.clinic_id = l.clinic_id AND p.id = l.pipeline_id
  JOIN public.crm_stages s
    ON s.clinic_id = l.clinic_id AND s.pipeline_id = l.pipeline_id AND s.id = l.stage_id
  WHERE l.clinic_id = v_clinic
  ORDER BY l.updated_at DESC, l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_current_clinic_crm_pipeline_stages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_crm_pipeline_stages() TO authenticated;

REVOKE ALL ON FUNCTION public.list_current_clinic_crm_leads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_crm_leads() TO authenticated;

COMMENT ON TABLE public.contacts IS
  'Tenant contact identity substrate. Contact is not Lead and not Patient; no clinical payload belongs here.';
COMMENT ON TABLE public.crm_leads IS
  'Commercial opportunity linked to Contact. Outcome is derived from crm_stages.stage_kind.';
COMMENT ON TABLE public.crm_lead_activities IS
  'Append-only commercial activity timeline for CRM domain writers.';
COMMENT ON FUNCTION public.list_current_clinic_crm_leads() IS
  'CRM-safe current-clinic projection. Requires crm.access and a canonical clinic role; exposes no EHR/clinical payload.';

COMMIT;
