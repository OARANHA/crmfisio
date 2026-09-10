#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_encounter_record_production_verifier_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_encounter_record_production_verifier_test" ]]; then
  echo "Refusing to run #395 verifier harness outside clinical_encounter_record_production_verifier_test" >&2
  exit 1
fi

VERIFIER="supabase-verifiers/VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

# Static safety proof for the production verifier itself. Catalog-inspection
# strings may mention product DML text, so reject executable statement-leading
# mutators rather than harmless quoted text used to inspect pg_get_functiondef().
python3 - "$VERIFIER" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
lines = [line.strip() for line in text.splitlines() if line.strip() and not line.lstrip().startswith("--")]

if lines[:2] != ["BEGIN;", "SET TRANSACTION READ ONLY;"]:
    raise SystemExit("production verifier must begin with BEGIN; + SET TRANSACTION READ ONLY;")
if lines[-1] != "ROLLBACK;":
    raise SystemExit("production verifier must end with ROLLBACK;")

forbidden_statement = re.compile(
    r"^\s*(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|GRANT|REVOKE)\b",
    re.IGNORECASE | re.MULTILINE,
)
if forbidden_statement.search(text):
    raise SystemExit("production verifier contains a forbidden mutating/DDL statement")
if re.search(r"\bset_config\s*\(", text, re.IGNORECASE):
    raise SystemExit("production verifier must not impersonate application users")
if re.search(r"\b(?:select|perform)\s+public\.(?:save|finalize)_clinical_encounter_record\s*\(", text, re.IGNORECASE):
    raise SystemExit("production verifier must not invoke mutating Encounter RPCs")
if re.search(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", text, re.IGNORECASE):
    raise SystemExit("production verifier contains a synthetic UUID")
if "clinical_encounter_record_cases.sql" in text or "clinical_encounter_record_hardening_cases.sql" in text:
    raise SystemExit("production verifier must not depend on behavior-case fixtures")
if re.search(r"^\s*\\(?:i|ir)\b", text, re.IGNORECASE | re.MULTILINE):
    raise SystemExit("production verifier must not include fixture SQL")

print("static safety: READ ONLY envelope; no DML/DDL, impersonation, mutating RPC calls, fixture includes or synthetic UUIDs")
PY

# Minimal production-shape prerequisite scaffold for a clean PostgreSQL 16 DB.
# This creates only roles, auth helper signatures and the tables/functions that
# already exist before #394. It intentionally inserts zero application rows.
"${PSQL[@]}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA auth;

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::uuid
$$;

CREATE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::text
$$;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  lifecycle_status text NOT NULL DEFAULT 'active'
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  deleted_at timestamptz
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  paciente_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'agendado',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.physiotherapy_evolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  session_id uuid REFERENCES public.appointments(id),
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::uuid
$$;

CREATE FUNCTION public.current_user_has_valid_clinical_identity()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false
$$;

CREATE FUNCTION public.current_user_has_clinical_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false
$$;

CREATE FUNCTION public.can_access_patient_clinical_record(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false
$$;
SQL

# Prove the isolated DB contains no behavior-harness result ledger or synthetic
# application rows before #394 is installed.
"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF to_regclass('public._clinical_encounter_394_results') IS NOT NULL THEN
    RAISE EXCEPTION 'behavior_result_ledger_present_before_migration';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clinics)
     OR EXISTS (SELECT 1 FROM public.profiles)
     OR EXISTS (SELECT 1 FROM public.patients)
     OR EXISTS (SELECT 1 FROM public.appointments)
     OR EXISTS (SELECT 1 FROM public.physiotherapy_evolutions) THEN
    RAISE EXCEPTION 'synthetic_application_data_present_before_migration';
  END IF;
END $$;
SQL

# Apply only the #394 product migration, then run the production verifier by
# itself. No #394 fixture, behavior cases, hardening cases or temporary grants
# are loaded in this workflow.
"${PSQL[@]}" -f supabase-migrations/20260910_clinical_encounter_record_foundation.sql
"${PSQL[@]}" -f "$VERIFIER"

# The production migration/verifier must neither require nor create behavior
# harness state, and the schema-only test must remain free of application rows.
"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF to_regclass('public._clinical_encounter_394_results') IS NOT NULL THEN
    RAISE EXCEPTION 'behavior_result_ledger_created_by_production_path';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clinics)
     OR EXISTS (SELECT 1 FROM public.profiles)
     OR EXISTS (SELECT 1 FROM public.patients)
     OR EXISTS (SELECT 1 FROM public.appointments)
     OR EXISTS (SELECT 1 FROM public.physiotherapy_evolutions)
     OR EXISTS (SELECT 1 FROM public.clinical_encounter_records) THEN
    RAISE EXCEPTION 'production_verifier_path_wrote_application_data';
  END IF;
END $$;
SQL

echo "production verifier: standalone READ ONLY inspection passed with zero application rows and no behavior harness state"
