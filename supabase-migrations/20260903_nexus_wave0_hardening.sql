-- MedicsPro / Nexus Clinical Engine — hardening da Onda 0
-- Red flags são evidência clínica histórica: reconhecimento não pode reescrever origem/conteúdo.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_nexus_red_flag_acknowledgement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.result_id IS DISTINCT FROM OLD.result_id
     OR NEW.flag_code IS DISTINCT FROM OLD.flag_code
     OR NEW.severity IS DISTINCT FROM OLD.severity
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.required_action IS DISTINCT FROM OLD.required_action
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Conteúdo/origem de red flag Nexus é imutável';
  END IF;

  IF OLD.acknowledged_at IS NOT NULL THEN
    RAISE EXCEPTION 'Red flag Nexus já foi reconhecida e não pode ser alterada';
  END IF;

  IF NEW.acknowledged_at IS NULL OR NEW.acknowledged_by IS NULL THEN
    RAISE EXCEPTION 'Reconhecimento exige data e profissional responsável';
  END IF;

  IF NEW.acknowledged_by <> auth.uid() THEN
    RAISE EXCEPTION 'acknowledged_by deve ser o usuário autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.acknowledged_by
      AND p.clinic_id = OLD.clinic_id
      AND p.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Profissional responsável pelo reconhecimento é inválido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexus_red_flag_ack_guard ON public.nexus_red_flags;
CREATE TRIGGER trg_nexus_red_flag_ack_guard
BEFORE UPDATE ON public.nexus_red_flags
FOR EACH ROW EXECUTE FUNCTION public.guard_nexus_red_flag_acknowledgement();

COMMIT;
