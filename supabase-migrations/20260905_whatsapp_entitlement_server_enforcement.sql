-- MEDICSPRO — WhatsApp entitlement server-side enforcement
-- Protects outbound queue creation, message-template mutations and human-review
-- actions without hiding shared wa_logs reads used by other operational flows.
-- Unconfigured clinics remain allowed during controlled rollout.

BEGIN;

CREATE OR REPLACE FUNCTION public.clinic_entitlement_allowed(
  p_clinic_id uuid,
  p_entitlement_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entitlement public.platform_clinic_entitlements%ROWTYPE;
BEGIN
  IF p_clinic_id IS NULL OR p_entitlement_key NOT IN (
    'nexus.access',
    'finance.access',
    'crm.access',
    'reports.access',
    'assessments.custom',
    'whatsapp.access'
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_entitlement
  FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = p_clinic_id
    AND e.entitlement_key = p_entitlement_key;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  RETURN v_entitlement.enabled = true
    AND (v_entitlement.starts_at IS NULL OR v_entitlement.starts_at <= now())
    AND (v_entitlement.expires_at IS NULL OR v_entitlement.expires_at > now());
END;
$$;

REVOKE ALL ON FUNCTION public.clinic_entitlement_allowed(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinic_entitlement_allowed(uuid,text) TO authenticated;

COMMENT ON FUNCTION public.clinic_entitlement_allowed(uuid,text) IS
  'Server-side entitlement predicate for an explicit clinic. Unconfigured remains allowed during controlled rollout.';

CREATE OR REPLACE FUNCTION public.guard_whatsapp_outbox_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid;
BEGIN
  v_clinic := CASE WHEN TG_OP = 'DELETE' THEN OLD.clinic_id ELSE NEW.clinic_id END;

  -- Creating outbound work is forbidden whenever WhatsApp is explicitly not effective.
  -- This applies to authenticated users and internal automations alike.
  IF TG_OP = 'INSERT' AND NOT public.clinic_entitlement_allowed(v_clinic, 'whatsapp.access') THEN
    RAISE EXCEPTION 'Módulo WhatsApp não liberado para esta clínica' USING ERRCODE = '42501';
  END IF;

  -- Provider/webhook status updates must remain possible after a module is disabled so
  -- already-sent messages can finish their audit trail. Human review remains a module action.
  IF TG_OP = 'UPDATE'
     AND auth.uid() IS NOT NULL
     AND (
       NEW.review_resolution IS DISTINCT FROM OLD.review_resolution
       OR NEW.review_note IS DISTINCT FROM OLD.review_note
       OR NEW.review_resolved_at IS DISTINCT FROM OLD.review_resolved_at
     )
     AND NOT public.clinic_entitlement_allowed(v_clinic, 'whatsapp.access') THEN
    RAISE EXCEPTION 'Módulo WhatsApp não liberado para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_whatsapp_outbox_entitlement() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_guard_whatsapp_outbox_entitlement ON public.wa_logs;
CREATE TRIGGER trg_guard_whatsapp_outbox_entitlement
BEFORE INSERT OR UPDATE ON public.wa_logs
FOR EACH ROW
EXECUTE FUNCTION public.guard_whatsapp_outbox_entitlement();

CREATE OR REPLACE FUNCTION public.guard_whatsapp_template_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.clinic_id ELSE NEW.clinic_id END;
BEGIN
  IF NOT public.clinic_entitlement_allowed(v_clinic, 'whatsapp.access') THEN
    RAISE EXCEPTION 'Módulo WhatsApp não liberado para esta clínica' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_whatsapp_template_entitlement() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_guard_whatsapp_template_entitlement ON public.message_templates;
CREATE TRIGGER trg_guard_whatsapp_template_entitlement
BEFORE INSERT OR UPDATE OR DELETE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.guard_whatsapp_template_entitlement();

COMMIT;
