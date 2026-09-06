-- MEDICSPRO — consent terms mutation boundary
-- Consent lifecycle mutations must go through the audited SECURITY DEFINER RPCs.

BEGIN;

-- Browser roles may read consent records according to RLS, but must not create,
-- mutate or delete consent rows directly. Creation, acceptance and cancellation
-- remain available through create_patient_consent, accept_patient_consent and
-- cancel_patient_consent respectively.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.consent_terms FROM anon, authenticated;
GRANT SELECT ON TABLE public.consent_terms TO authenticated;

-- Keep the canonical lifecycle RPCs explicitly available to authenticated users.
REVOKE ALL ON FUNCTION public.create_patient_consent(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_patient_consent(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_patient_consent(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_patient_consent(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_patient_consent(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_patient_consent(uuid, text) TO authenticated;

COMMENT ON TABLE public.consent_terms IS
  'Patient consent ledger. Browser sessions are read-only; lifecycle mutations are RPC-only.';

COMMIT;
