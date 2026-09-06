-- MEDICSPRO — P0 patient column SELECT hardening
-- Finalizes the read boundary after the frontend stopped using patients.select('*').
-- Operational/admin registration fields remain directly readable under existing RLS.
-- Clinical fields are readable only through list_patient_clinical_snapshot().

BEGIN;

-- A table-level SELECT grant would override any column-level restriction, so it
-- must be removed before re-granting the explicit operational projection.
REVOKE SELECT ON TABLE public.patients FROM authenticated;
REVOKE SELECT ON TABLE public.patients FROM anon;

GRANT SELECT (
  id,
  clinic_id,
  nome,
  preferred_name,
  nascimento,
  telefone,
  email,
  cpf,
  convenio,
  insurance_number,
  address_line,
  administrative_notes,
  avatar_path,
  funil_stage,
  status,
  ultima_visita,
  opt_in_whats,
  anonimizado,
  created_at,
  updated_at,
  deleted_at
) ON public.patients TO authenticated;

-- Clinical columns deliberately omitted:
--   queixa_principal, cid10, anamnese
-- Authorized clinical roles use SECURITY DEFINER function
-- public.list_patient_clinical_snapshot(), which validates canonical tenant and
-- application role before returning these fields.

REVOKE ALL ON FUNCTION public.list_patient_clinical_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_patient_clinical_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_patient_clinical_snapshot() TO authenticated;

COMMIT;
