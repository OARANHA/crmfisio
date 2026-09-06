-- MEDICSPRO — WhatsApp outbox/template lifecycle hardening
-- Final DB boundary: suspended/deleted clinics cannot create new outbound work,
-- including service-role automation race windows. Provider delivery/read status
-- updates for already-created rows remain allowed so the audit trail can complete.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_whatsapp_outbox_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid;
  v_clinic_active boolean := false;
BEGIN
  v_clinic := CASE WHEN TG_OP = 'DELETE' THEN OLD.clinic_id ELSE NEW.clinic_id END;

  SELECT EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.id = v_clinic
      AND c.deleted_at IS NULL
      AND c.lifecycle_status = 'active'
  ) INTO v_clinic_active;

  -- No new outbound work may be created for an inactive tenant, even by
  -- service-role automation that loaded clinic settings before suspension.
  IF TG_OP = 'INSERT' AND NOT v_clinic_active THEN
    RAISE EXCEPTION 'Clínica suspensa ou indisponível' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' AND NOT public.clinic_entitlement_allowed(v_clinic, 'whatsapp.access') THEN
    RAISE EXCEPTION 'Módulo WhatsApp não liberado para esta clínica' USING ERRCODE = '42501';
  END IF;

  -- Provider/webhook status updates remain possible after suspension/disable so
  -- already-sent messages can finish their delivery/read audit trail.
  -- Human review remains a tenant action and therefore requires active clinic + entitlement.
  IF TG_OP = 'UPDATE'
     AND auth.uid() IS NOT NULL
     AND (
       NEW.review_resolution IS DISTINCT FROM OLD.review_resolution
       OR NEW.review_note IS DISTINCT FROM OLD.review_note
       OR NEW.review_resolved_at IS DISTINCT FROM OLD.review_resolved_at
     )
     AND (
       NOT v_clinic_active
       OR NOT public.clinic_entitlement_allowed(v_clinic, 'whatsapp.access')
     ) THEN
    RAISE EXCEPTION 'WhatsApp indisponível para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_whatsapp_outbox_entitlement() FROM PUBLIC, anon, authenticated;

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
  v_clinic_active boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.id = v_clinic
      AND c.deleted_at IS NULL
      AND c.lifecycle_status = 'active'
  ) INTO v_clinic_active;

  IF NOT v_clinic_active THEN
    RAISE EXCEPTION 'Clínica suspensa ou indisponível' USING ERRCODE = '42501';
  END IF;

  IF NOT public.clinic_entitlement_allowed(v_clinic, 'whatsapp.access') THEN
    RAISE EXCEPTION 'Módulo WhatsApp não liberado para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_whatsapp_template_entitlement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_whatsapp_template_entitlement ON public.message_templates;
CREATE TRIGGER trg_guard_whatsapp_template_entitlement
BEFORE INSERT OR UPDATE OR DELETE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.guard_whatsapp_template_entitlement();

COMMIT;
