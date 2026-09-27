#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=updated_at_helper_reconciliation_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "updated_at_helper_reconciliation_test" ]]; then
  echo "Refusing to run updated_at helper reconciliation harness outside updated_at_helper_reconciliation_test" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -c "DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260927_updated_at_helper_reconciliation.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260927_updated_at_helper_reconciliation.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260927_UPDATED_AT_HELPER_RECONCILIATION.sql"

"${PSQL[@]}" <<'SQL'
CREATE TABLE public.updated_at_helper_probe (
  id integer PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payload text
);

CREATE TRIGGER update_updated_at
BEFORE UPDATE ON public.updated_at_helper_probe
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.updated_at_helper_probe (id, payload) VALUES (1, 'before');
SELECT pg_sleep(0.02);
UPDATE public.updated_at_helper_probe SET payload = 'after' WHERE id = 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.updated_at_helper_probe
    WHERE id = 1
      AND payload = 'after'
      AND updated_at > created_at
  ) THEN
    RAISE EXCEPTION 'updated_at_helper_behavior_failed';
  END IF;
END
$$;

DROP TABLE public.updated_at_helper_probe;
SQL

echo "updated_at helper reconciliation: PostgreSQL verifier and behavior proof passed"
