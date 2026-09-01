#!/bin/sh
set -eu

: "${PGHOST:=supabase-db}"
: "${PGPORT:=5432}"
: "${PGDATABASE:=postgres}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:?SUPABASE_DB_PASSWORD/PGPASSWORD not configured}"

export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

echo "[migrate] waiting for PostgreSQL at ${PGHOST}:${PGPORT}/${PGDATABASE}..."
for i in $(seq 1 60); do
  if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "[migrate] PostgreSQL did not become ready" >&2
    exit 1
  fi
  sleep 2
done

psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public._medicspro_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

for file in /migrations/*.sql; do
  [ -f "$file" ] || continue
  name=$(basename "$file")
  applied=$(psql -Atqc "SELECT 1 FROM public._medicspro_migrations WHERE filename = '$name' LIMIT 1")
  if [ "$applied" = "1" ]; then
    echo "[migrate] skip $name (already applied)"
    continue
  fi

  echo "[migrate] applying $name"
  psql -v ON_ERROR_STOP=1 -f "$file"
  psql -v ON_ERROR_STOP=1 -c "INSERT INTO public._medicspro_migrations(filename) VALUES ('$name')"
  echo "[migrate] applied $name"
done

echo "[migrate] database is up to date"
