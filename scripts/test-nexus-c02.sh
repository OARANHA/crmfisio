#!/usr/bin/env bash
# Disposable local/CI PostgreSQL only. Never target production.
set -euo pipefail

if [[ "${PGDATABASE:-}" != nexus_c02_test || ! "${PGHOST:-}" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  echo 'Use PGDATABASE=nexus_c02_test and PGHOST=127.0.0.1 for a disposable database.' >&2
  exit 2
fi

cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

python3 scripts/build-nexus-c02-sql-test.py > "$tmp/c02.sql"
if ! psql -X -v ON_ERROR_STOP=1 -f "$tmp/c02.sql" > "$tmp/c02.log" 2>&1; then
  tail -n 80 "$tmp/c02.log" >&2
  exit 1
fi

grep -F 'NEXUS_C02_EXPLOIT_REPRODUCED' "$tmp/c02.log"
grep -F 'NEXUS_C02_BEHAVIOR_OK' "$tmp/c02.log"

psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql \
  > "$tmp/verifier.log"
grep -F 'NEXUS_C02_VERIFIED' "$tmp/verifier.log"

# C-06 remains authoritative for its helper fingerprints and C-01 read guards.
psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql \
  > "$tmp/c06-verifier.log"
grep -F 'NEXUS_C06_VERIFIED' "$tmp/c06-verifier.log"

# Prove the exception assertion is sensitive to the historical trigger itself.
# This mutation is confined to the disposable database; failure rolls back the
# attempted data change inside the assertion DO block.
psql -X -v ON_ERROR_STOP=1 -c \
  'ALTER TABLE public.nexus_clinical_results DISABLE TRIGGER trg_nexus_result_immutable'
if psql -X -v ON_ERROR_STOP=1 -f tests/sql/nexus_c02_finalized_guard.sql > "$tmp/guard-behavior.log" 2>&1; then
  echo 'Finalized assertion accepted a disabled guard.' >&2
  exit 1
fi
grep -F 'finalized mutation escaped: ROWS:1' "$tmp/guard-behavior.log"
if psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql > "$tmp/guard-verifier.log" 2>&1; then
  echo 'Verifier accepted a disabled finalized guard.' >&2
  exit 1
fi
grep -F 'nexus_c02_finalized_trigger_missing_or_drift' "$tmp/guard-verifier.log"
psql -X -v ON_ERROR_STOP=1 -c \
  'ALTER TABLE public.nexus_clinical_results ENABLE TRIGGER trg_nexus_result_immutable'
psql -X -v ON_ERROR_STOP=1 -f tests/sql/nexus_c02_finalized_guard.sql

# Registry drift must be rejected by the C-02 verifier.
psql -X -v ON_ERROR_STOP=1 -c \
  "UPDATE public.nexus_result_contracts SET required_capability='nexus.access' WHERE module_key='eem' AND tool_key='eem' AND rule_key='nexus.eem' AND rule_version='nexus-eem-2026-09-03'"
if psql -X -v ON_ERROR_STOP=1 \
    -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql \
    > "$tmp/registry-drift.log" 2>&1; then
  echo 'C-02 verifier accepted trusted registry drift.' >&2
  exit 1
fi
grep -F 'nexus_c02_contract_registry_drift' "$tmp/registry-drift.log"
psql -X -v ON_ERROR_STOP=1 -c \
  "UPDATE public.nexus_result_contracts SET required_capability='nexus.eem' WHERE module_key='eem' AND tool_key='eem' AND rule_key='nexus.eem' AND rule_version='nexus-eem-2026-09-03'"

# Resolver body drift must also be rejected.
psql -X -At -v ON_ERROR_STOP=1 \
  -c "SELECT pg_get_functiondef('public.resolve_nexus_result_required_capability(text,text,text,text)'::regprocedure)" \
  > "$tmp/resolver.sql"
psql -X -v ON_ERROR_STOP=1 -c \
  "CREATE OR REPLACE FUNCTION public.resolve_nexus_result_required_capability(p_module_key text,p_tool_key text,p_rule_key text,p_rule_version text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS 'SELECT ''nexus.access''::text'"
if psql -X -v ON_ERROR_STOP=1 \
    -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql \
    > "$tmp/resolver-drift.log" 2>&1; then
  echo 'C-02 verifier accepted resolver drift.' >&2
  exit 1
fi
grep -F 'nexus_c02_helper_drift: public.resolve_nexus_result_required_capability' "$tmp/resolver-drift.log"
psql -X -v ON_ERROR_STOP=1 -f "$tmp/resolver.sql"

psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql \
  > "$tmp/final-verifier.log"
grep -F 'NEXUS_C02_VERIFIED' "$tmp/final-verifier.log"

echo 'NEXUS_C02_POSTGRES16_OK'