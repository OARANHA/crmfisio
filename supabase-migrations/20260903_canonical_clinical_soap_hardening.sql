-- MedicsPro — hardening da assinatura SOAP
-- signed_at e signed_by são sempre definidos pelo servidor no ato da assinatura.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_clinical_note_signature()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'signed' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Prontuário assinado é imutável; crie um adendo';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'signed' THEN
    IF OLD.professional_id <> auth.uid() OR NEW.professional_id <> auth.uid() THEN
      RAISE EXCEPTION 'Somente o autor pode assinar o prontuário';
    END IF;
    IF NOT public.has_professional_capability('clinical.soap') THEN
      RAISE EXCEPTION 'Profissional sem capability clinical.soap';
    END IF;

    -- Nunca aceitar identidade ou horário de assinatura enviados pelo cliente.
    NEW.signed_at := now();
    NEW.signed_by := auth.uid();
  ELSIF NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Transição de status inválida';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMIT;
