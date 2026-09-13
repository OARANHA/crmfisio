#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinic_referral_authoring_policy_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinic_referral_authoring_policy_v1_test" ]]; then
  echo "Refusing to run referral policy harness outside isolated test database" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -f tests/sql/clinic_referral_authoring_policy_v1_fixture.sql >/dev/null
"${PSQL[@]}" -f supabase-migrations/20260913_clinic_referral_authoring_policy_v1.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINIC_REFERRAL_AUTHORING_POLICY_V1.sql >/dev/null
"${PSQL[@]}" -f tests/sql/clinic_referral_authoring_policy_v1_cases.sql >/dev/null

# Replay must preserve an explicit disabled setting instead of resetting it to the
# default. This proves ON CONFLICT DO NOTHING is part of the rollout contract.
"${PSQL[@]}" <<'SQL' >/dev/null
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT * FROM public.update_current_clinic_clinical_flow_settings(false);
RESET ROLE;
SQL

"${PSQL[@]}" -f supabase-migrations/20260913_clinic_referral_authoring_policy_v1.sql >/dev/null
"${PSQL[@]}" <<'SQL' >/dev/null
DO $$
BEGIN
  IF (SELECT referral_authoring_enabled
      FROM public.clinic_clinical_flow_settings
      WHERE clinic_id='20000000-0000-0000-0000-000000000001') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'migration_replay_reset_explicit_policy';
  END IF;
END $$;
SQL
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINIC_REFERRAL_AUTHORING_POLICY_V1.sql >/dev/null

echo 'CLINIC REFERRAL AUTHORING POLICY V1 POSTGRESQL 16 PASS'
