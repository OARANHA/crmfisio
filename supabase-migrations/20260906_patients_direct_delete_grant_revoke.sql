BEGIN;

REVOKE DELETE ON TABLE public.patients FROM authenticated;
REVOKE DELETE ON TABLE public.patients FROM anon;

COMMENT ON TABLE public.patients IS
  'Patient registry. Direct browser DELETE is revoked; lifecycle removal must use audited soft-delete RPCs.';

COMMIT;
