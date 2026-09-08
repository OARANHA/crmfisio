-- Nexus C-03 neutral signed-lifecycle immutability probe.
-- The lifecycle row is already signed by nexus_c03_cases.sql. This probe changes
-- only updated_at, so no review/sign timestamp constraint can intercept before the
-- terminal immutability guard. Direct UPDATE is granted only in this disposable DB.

GRANT UPDATE ON public.nexus_result_clinical_lifecycle TO service_role;

SET ROLE service_role;
DO $$
BEGIN
  BEGIN
    UPDATE public.nexus_result_clinical_lifecycle
       SET updated_at = updated_at + interval '1 second'
     WHERE result_id = '00000000-0000-0000-0000-000000000910';
    RAISE EXCEPTION 'C03 neutral signed lifecycle mutation escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%nexus_clinical_lifecycle_signed_immutable%' THEN
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

REVOKE UPDATE ON public.nexus_result_clinical_lifecycle FROM service_role;

SELECT 'NEXUS_C03_SIGNED_IMMUTABILITY_NEUTRAL_PROBE_OK' AS result;
