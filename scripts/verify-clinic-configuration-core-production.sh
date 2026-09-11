#!/usr/bin/env bash
set -euo pipefail

VERIFY_FILE="supabase-verifiers/VERIFY_20260911_CLINIC_CONFIGURATION_CORE_PRODUCTION.sql"

if [[ ! -f "$VERIFY_FILE" ]]; then
  echo "Missing production verifier: $VERIFY_FILE" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -X -f "$VERIFY_FILE"
