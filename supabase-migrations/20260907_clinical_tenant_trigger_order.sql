-- MEDICSPRO — clinical tenant trigger ordering fix
--
-- PostgreSQL fires triggers with the same timing/event in name order. The
-- self-authorship/session-linkage guards added on 2026-09-05 run before the
-- legacy tenant-context trigger because `self...`/`session...` sort before
-- `tenant...`. Browser inserts intentionally omit clinic_id and rely on
-- fill_clinical_tenant_context(), so the guards can observe clinic_id = NULL
-- and fail closed with SQLSTATE 42501 / HTTP 403 before tenant context is set.
--
-- Keep the same security model; only make the tenant-context trigger execute
-- first by giving it an explicit ordering prefix.

BEGIN;

DROP TRIGGER IF EXISTS trg_evaluations_tenant_context ON public.physiotherapy_evaluations;
DROP TRIGGER IF EXISTS trg_00_evaluations_tenant_context ON public.physiotherapy_evaluations;
CREATE TRIGGER trg_00_evaluations_tenant_context
BEFORE INSERT OR UPDATE OF clinic_id, professional_id
ON public.physiotherapy_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.fill_clinical_tenant_context();

DROP TRIGGER IF EXISTS trg_evolutions_tenant_context ON public.physiotherapy_evolutions;
DROP TRIGGER IF EXISTS trg_00_evolutions_tenant_context ON public.physiotherapy_evolutions;
CREATE TRIGGER trg_00_evolutions_tenant_context
BEFORE INSERT OR UPDATE OF clinic_id, professional_id
ON public.physiotherapy_evolutions
FOR EACH ROW
EXECUTE FUNCTION public.fill_clinical_tenant_context();

COMMENT ON TRIGGER trg_00_evaluations_tenant_context ON public.physiotherapy_evaluations IS
  'Runs tenant autofill before clinical authorship guards so browser inserts fail closed only after clinic context is resolved.';

COMMENT ON TRIGGER trg_00_evolutions_tenant_context ON public.physiotherapy_evolutions IS
  'Runs tenant autofill before authorship/session-linkage guards so evolution inserts receive clinic_id before validation.';

COMMIT;
