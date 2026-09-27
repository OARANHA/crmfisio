#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=commercial_crm_contact_identity_resolution_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "commercial_crm_contact_identity_resolution_test" ]]; then
  echo "Refusing to run Contact identity concurrency proof outside commercial_crm_contact_identity_resolution_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X -qAt)

run_first_then_conflicting_second() {
  local label="$1"
  local first_contact="$2"
  local first_lead="$3"
  local first_phone="$4"
  local second_contact="$5"
  local second_lead="$6"
  local second_phone="$7"

  local dir
  dir="$(mktemp -d)"
  trap 'rm -rf "$dir"' RETURN

  (
    "${PSQL[@]}" >"$dir/first.out" 2>"$dir/first.err" <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
SELECT *
FROM public.create_current_clinic_crm_resolved_prospect(
  '$first_contact',
  '$first_lead',
  'Concurrent First',
  'Concurrent Lead First',
  'create_if_clear',
  '$first_phone'
);
SELECT pg_sleep(2);
COMMIT;
SQL
  ) &
  local first_pid=$!

  sleep 0.35

  set +e
  "${PSQL[@]}" >"$dir/second.out" 2>"$dir/second.err" <<SQL
SET statement_timeout = '8s';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
SELECT *
FROM public.create_current_clinic_crm_resolved_prospect(
  '$second_contact',
  '$second_lead',
  'Concurrent Second',
  'Concurrent Lead Second',
  'create_if_clear',
  '$second_phone'
);
COMMIT;
SQL
  local second_status=$?
  set -e

  wait "$first_pid"

  if [[ "$second_status" -eq 0 ]]; then
    echo "$label: second concurrent create unexpectedly succeeded" >&2
    cat "$dir/second.out" >&2 || true
    exit 1
  fi

  if ! grep -q "crm_contact_identity_resolution_required" "$dir/second.err"; then
    echo "$label: second concurrent create failed for the wrong reason" >&2
    cat "$dir/second.err" >&2 || true
    exit 1
  fi

  local persisted
  persisted="$("${PSQL[@]}" <<SQL
SELECT count(*)
FROM public.contacts
WHERE id IN ('$first_contact'::uuid, '$second_contact'::uuid);
SQL
)"

  if [[ "$persisted" != "1" ]]; then
    echo "$label: expected exactly one persisted Contact, got $persisted" >&2
    exit 1
  fi

  echo "$label: serialized and rechecked correctly"
}

echo "1) different UUID + same exact phone serializes"
run_first_then_conflicting_second   "exact-phone race"   "73000000-0000-0000-0000-000000000101"   "83000000-0000-0000-0000-000000000101"   "+55 51 94444-0101"   "73000000-0000-0000-0000-000000000102"   "83000000-0000-0000-0000-000000000102"   "(51) 94444-0101"

echo "2) different UUID + BR ninth-digit equivalent phone serializes"
run_first_then_conflicting_second   "BR legacy-equivalent phone race"   "73000000-0000-0000-0000-000000000111"   "83000000-0000-0000-0000-000000000111"   "+55 51 93333-0111"   "73000000-0000-0000-0000-000000000112"   "83000000-0000-0000-0000-000000000112"   "+55 51 3333-0111"

echo "3) same phone+email concurrent lock set completes without deadlock"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT

for suffix in a b; do
  (
    "${PSQL[@]}" >"$dir/$suffix.out" 2>"$dir/$suffix.err" <<'SQL'
SET statement_timeout = '8s';
BEGIN;
SELECT public.crm_lock_contact_identity_signals(
  '20000000-0000-0000-0000-000000000001',
  '+55 51 92222-0121',
  'locking@example.test'
);
SELECT pg_sleep(1);
COMMIT;
SQL
  ) &
  pids["$suffix"]=$!
  sleep 0.1
done

wait "${pids[a]}"
wait "${pids[b]}"

if grep -qi "deadlock detected" "$dir/a.err" "$dir/b.err"; then
  echo "deterministic multi-signal locking deadlocked" >&2
  cat "$dir/a.err" "$dir/b.err" >&2
  exit 1
fi

echo "contact identity concurrency proof passed"
