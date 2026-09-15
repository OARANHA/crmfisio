#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
EDGE_CONTAINER="${EDGE_CONTAINER:-supabase-edge-functions}"
EVOLUTION_CONTAINER="${EVOLUTION_CONTAINER:-evolution-medicspro-evolution-1}"
SITE_CONTAINER="${SITE_CONTAINER:-medicspro-site-medicspro-site-1}"
WINDOW="${BETA_HEALTH_WINDOW:-24h}"
AUTOMATION_STALE_MINUTES="${AUTOMATION_STALE_MINUTES:-15}"

if [[ ! "$WINDOW" =~ ^[1-9][0-9]*(m|h|d)$ ]]; then
  echo "INFRA|BETA_HEALTH_WINDOW|invalid|FAIL"
  exit 1
fi
if [[ ! "$AUTOMATION_STALE_MINUTES" =~ ^[1-9][0-9]*$ ]]; then
  echo "INFRA|AUTOMATION_STALE_MINUTES|invalid|FAIL"
  exit 1
fi

validate_container_name() {
  local name="$1"
  [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || {
    echo "INFRA|container_name|invalid|FAIL"
    exit 1
  }
}
for container in "$DB_CONTAINER" "$EDGE_CONTAINER" "$EVOLUTION_CONTAINER" "$SITE_CONTAINER"; do
  validate_container_name "$container"
done

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "INFRA|$1|missing|FAIL"
    exit 1
  }
}

need docker
need grep
need sed

container_health() {
  local name="$1"
  local severity="${2:-FAIL}"
  local state
  if ! docker inspect "$name" >/dev/null 2>&1; then
    printf 'CONTAINER|%s|missing|FAIL\n' "$name"
    return 1
  fi

  state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || true)"
  case "$state" in
    healthy|running) printf 'CONTAINER|%s|%s|PASS\n' "$name" "$state" ;;
    *) printf 'CONTAINER|%s|%s|%s\n' "$name" "${state:-unknown}" "$severity"; return 1 ;;
  esac
}

critical_fail=0
for container in "$DB_CONTAINER" "$EDGE_CONTAINER" "$SITE_CONTAINER"; do
  if ! container_health "$container"; then critical_fail=1; fi
done
# Evolution is an external-provider runtime used by messaging. Missing/degraded state is
# operationally important but remains ATTENTION unless correlated with MedicsPro failures.
container_health "$EVOLUTION_CONTAINER" ATTENTION || true

sql_out="$({ docker exec -i "$DB_CONTAINER" psql -X -qAt -F '|' -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
BEGIN READ ONLY;

SELECT 'CLINICAL','future_in_service',count(*),CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END
FROM public.appointments
WHERE status='em_atendimento'
  AND data > public.current_clinic_operational_date();

SELECT 'CLINICAL','finalized_encounter_inconsistent',count(*),CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END
FROM public.clinical_encounter_records cer
LEFT JOIN public.appointments a ON a.id=cer.appointment_id
WHERE cer.status='finalized'
  AND (
    cer.finalized_at IS NULL
    OR cer.evolution_id IS NULL
    OR a.id IS NULL
    OR a.status <> 'finalizado'
    OR NOT EXISTS (
      SELECT 1
      FROM public.physiotherapy_evolutions pe
      WHERE pe.id=cer.evolution_id
        AND pe.session_id=cer.appointment_id
        AND pe.deleted_at IS NULL
    )
  );

SELECT 'CLINICAL','sessions_with_multiple_active_evolutions',count(*),CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END
FROM (
  SELECT pe.session_id
  FROM public.physiotherapy_evolutions pe
  WHERE pe.session_id IS NOT NULL
    AND pe.deleted_at IS NULL
  GROUP BY pe.session_id
  HAVING count(*) > 1
) duplicated;

SELECT 'FINANCE','pending_financial_exceptions',count(*),CASE WHEN count(*)=0 THEN 'PASS' ELSE 'ATTENTION' END
FROM public.appointment_financial_exceptions
WHERE status='pending';

SELECT 'FINANCE','pending_financial_exception_reasons',coalesce(string_agg(reason_code || ':' || n::text, ',' ORDER BY reason_code),'none'),'INFO'
FROM (
  SELECT reason_code,count(*) n
  FROM public.appointment_financial_exceptions
  WHERE status='pending'
  GROUP BY reason_code
) reasons;

SELECT 'AUTOMATION','failed_runs_${WINDOW}',count(*),CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END
FROM public.automation_runs
WHERE started_at >= now()-interval '${WINDOW}'
  AND (
    lower(status) IN ('failed','error')
    OR worker_failed > 0
    OR nullif(btrim(error_message),'') IS NOT NULL
  );

WITH governance AS (
  SELECT
    coalesce(bool_and(enabled) FILTER (WHERE key='automation.enabled'), true) AS master_enabled,
    coalesce(bool_and(enabled) FILTER (WHERE key='automation.core_tick'), true) AS core_tick_enabled
  FROM public.platform_automation_settings
), latest AS (
  SELECT max(started_at) AS started_at FROM public.automation_runs
)
SELECT 'AUTOMATION','last_run_fresh',
       CASE
         WHEN NOT governance.master_enabled THEN 'master_disabled'
         WHEN NOT governance.core_tick_enabled THEN 'core_tick_disabled'
         ELSE coalesce(round(extract(epoch FROM (now()-latest.started_at))/60)::text || 'm','none')
       END,
       CASE
         WHEN NOT governance.master_enabled OR NOT governance.core_tick_enabled THEN 'INFO'
         WHEN latest.started_at IS NULL THEN 'FAIL'
         WHEN latest.started_at < now()-make_interval(mins => ${AUTOMATION_STALE_MINUTES}) THEN 'FAIL'
         ELSE 'PASS'
       END
FROM governance CROSS JOIN latest;

SELECT 'MESSAGING','failed_wa_rows_${WINDOW}',count(*),CASE WHEN count(*)=0 THEN 'PASS' ELSE 'ATTENTION' END
FROM public.wa_logs
WHERE created_at >= now()-interval '${WINDOW}'
  AND (status='falhou' OR failed_at IS NOT NULL);

SELECT 'MESSAGING','human_review_open',count(*),CASE WHEN count(*)=0 THEN 'PASS' ELSE 'ATTENTION' END
FROM public.wa_logs
WHERE needs_human IS TRUE
  AND review_resolved_at IS NULL;

SELECT 'INSTRUMENTS','self_assessment_processing_errors',count(*),CASE WHEN count(*)=0 THEN 'PASS' ELSE 'ATTENTION' END
FROM public.nexus_self_assessment_invites
WHERE nullif(btrim(last_processing_error),'') IS NOT NULL;

SELECT 'ENTITLEMENT','explicit_states',
       coalesce(string_agg(entitlement_key || ':' || enabled::text || ':' || n::text, ',' ORDER BY entitlement_key,enabled::text),'none'),
       'INFO'
FROM (
  SELECT entitlement_key,enabled,count(*) n
  FROM public.platform_clinic_entitlements
  GROUP BY entitlement_key,enabled
) e;

ROLLBACK;
SQL
} 2>&1)" || {
  echo "DATABASE|read_only_probe|failed|FAIL"
  exit 1
}

printf '%s\n' "$sql_out"
if printf '%s\n' "$sql_out" | grep -q '|FAIL$'; then critical_fail=1; fi

count_logs() {
  local container="$1"
  local pattern="$2"
  docker logs --since "$WINDOW" "$container" 2>&1 | grep -Eic "$pattern" || true
}

edge_wall="$(count_logs "$EDGE_CONTAINER" 'wall clock.*warning|wall.?clock.*exceed')"
edge_termination="$(count_logs "$EDGE_CONTAINER" 'early termination')"
edge_boot="$(count_logs "$EDGE_CONTAINER" 'worker boot.*error|boot error')"
edge_uncaught="$(count_logs "$EDGE_CONTAINER" 'uncaught|panic|fatal')"
edge_app_errors="$(count_logs "$EDGE_CONTAINER" '\[(medicspro-automation|evolution-worker|clinical-instrument-clinician-assisted|nexus-self-assessment-processor)\].*(error|failed|exception)')"
evolution_5xx="$(count_logs "$EVOLUTION_CONTAINER" '"(code|status|statusCode|status_code)"[[:space:]]*:[[:space:]]*"?5[0-9]{2}"?|HTTP[^0-9]*5[0-9]{2}|internal server error|bad gateway|service unavailable')"
site_5xx="$(count_logs "$SITE_CONTAINER" '(^|[[:space:]])5[0-9]{2}([[:space:]]|$)|internal server error|bad gateway|service unavailable')"

printf 'RUNTIME|edge_wall_clock_warnings_%s|%s|INFO\n' "$WINDOW" "$edge_wall"
printf 'RUNTIME|edge_early_terminations_%s|%s|INFO\n' "$WINDOW" "$edge_termination"
printf 'RUNTIME|edge_worker_boot_errors_%s|%s|%s\n' "$WINDOW" "$edge_boot" "$([ "$edge_boot" -eq 0 ] && echo PASS || echo FAIL)"
printf 'RUNTIME|edge_uncaught_or_fatal_%s|%s|%s\n' "$WINDOW" "$edge_uncaught" "$([ "$edge_uncaught" -eq 0 ] && echo PASS || echo FAIL)"
printf 'RUNTIME|medicspro_edge_error_prefixes_%s|%s|%s\n' "$WINDOW" "$edge_app_errors" "$([ "$edge_app_errors" -eq 0 ] && echo PASS || echo FAIL)"
printf 'RUNTIME|evolution_5xx_like_%s|%s|%s\n' "$WINDOW" "$evolution_5xx" "$([ "$evolution_5xx" -eq 0 ] && echo PASS || echo ATTENTION)"
printf 'RUNTIME|frontend_5xx_like_%s|%s|%s\n' "$WINDOW" "$site_5xx" "$([ "$site_5xx" -eq 0 ] && echo PASS || echo FAIL)"

if [ "$edge_boot" -gt 0 ] || [ "$edge_uncaught" -gt 0 ] || [ "$edge_app_errors" -gt 0 ] || [ "$site_5xx" -gt 0 ]; then
  critical_fail=1
fi

if [ "$critical_fail" -ne 0 ]; then
  echo 'SUMMARY|beta_operability|critical_failure|FAIL'
  exit 2
fi

echo 'SUMMARY|beta_operability|no_critical_failure|PASS'
