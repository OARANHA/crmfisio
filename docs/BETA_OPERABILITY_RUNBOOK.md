# MedicsPro — Beta Operability Runbook V1

## Purpose

Provide a **read-only, privacy-minimized** operational check for the controlled beta. This is not a replacement for user-facing UX validation, provider-specific monitoring, tracing or a future observability platform.

The V1 deliberately reuses existing canonical signals instead of introducing a new telemetry store:

- clinical state in `appointments`, `clinical_encounter_records` and `physiotherapy_evolutions`;
- expected financial queues in `appointment_financial_exceptions`;
- automation accounting in `automation_runs`;
- messaging delivery/review state in `wa_logs`;
- self-assessment processing state in `nexus_self_assessment_invites`;
- entitlement configuration in `platform_clinic_entitlements`;
- container health and **aggregate** runtime log counters.

No patient names, free-text clinical fields, message bodies, phone numbers, raw identifiers or exception payloads are printed by the canonical check.

## Decision → second review → execution

**Decision:** add centralized beta error telemetry.

**Second review:** the runtime already persists authoritative signals for the highest-risk server-side workflows. A new generic client-error collector would create a fresh PHI/logging boundary, another write path, retention questions and operational cost before proving that it is necessary.

**Revised decision:** first standardize the signals that already exist into one deterministic read-only health check. Keep visual/browser diagnosis as a separate manual step. Add new telemetry later only for gaps observed during the pilot.

## Canonical command

From a host with Docker access to the MedicsPro production containers and a checkout pinned to the release being inspected:

```bash
bash scripts/beta-operability-check.sh
```

Optional environment overrides:

```text
DB_CONTAINER=supabase-db
EDGE_CONTAINER=supabase-edge-functions
EVOLUTION_CONTAINER=evolution-medicspro-evolution-1
SITE_CONTAINER=medicspro-site-medicspro-site-1
BETA_HEALTH_WINDOW=24h
AUTOMATION_STALE_MINUTES=15
```

The overrides are validated before they can reach Docker arguments or SQL interpolation. `BETA_HEALTH_WINDOW` accepts only a positive integer followed by `m`, `h` or `d`; `AUTOMATION_STALE_MINUTES` accepts only a positive integer; container names are restricted to Docker-safe name characters.

The script only performs:

- `docker inspect`;
- `docker logs` with aggregate counts;
- PostgreSQL `BEGIN READ ONLY ... ROLLBACK` queries.

It contains no DML/DDL/RPC mutation.

## Output contract

Each line is pipe-delimited:

```text
DOMAIN|METRIC|VALUE|STATUS
```

Interpretation:

- `PASS` — no anomaly observed for that invariant/window;
- `ATTENTION` — actionable queue or provider symptom that does not by itself prove clinical integrity failure;
- `INFO` — context only;
- `FAIL` — structural or operational condition that should stop beta expansion until understood.

The script exits `2` when a critical `FAIL` is detected, `1` when the check itself cannot execute safely, and `0` when no critical failure is present.

## Clinical invariants

`FAIL` if any of these are non-zero:

1. future appointment in `em_atendimento`;
2. finalized Encounter Record without coherent `finalized_at`, final appointment and active linked Evolution;
3. more than one active Evolution for the same session.

These are integrity signals, not a substitute for the feature-specific verifiers.

## Financial classification

A pending `appointment_financial_exception` is **ATTENTION**, not automatically a platform failure. After #388/#389, an expected coverage problem such as `package_exhausted`, `package_expired` or `package_not_eligible` may legitimately remain in the explicit resolution queue while the clinical finalization stays valid.

Never “fix” an ATTENTION item by editing the queue directly. Resolution remains server-authoritative through the #389 contract.

## Automation and messaging

Automation is a `FAIL` when recent persisted runs contain `failed/error`, `worker_failed > 0`, a non-empty `error_message`, or when the latest run is stale beyond the configured threshold while both `automation.enabled` and `automation.core_tick` are enabled. A deliberately disabled platform master/core switch is reported as `INFO`, not as a stale-run incident.

A failed WhatsApp delivery or open human-review item is `ATTENTION`: the appointment/clinical record must not be rolled back because a communication provider is unavailable.

The Edge Runtime may emit generic `wall clock duration warning` / `early termination` messages as isolate-level runtime signals. V1 reports them as `INFO`; they become actionable when correlated with persisted failed automation runs, app-specific Edge error prefixes, worker boot failures, uncaught/fatal events or user-visible impact.

A missing/degraded Evolution provider container and structured provider HTTP 5xx signals are `ATTENTION`, because the clinical database can remain internally consistent while messaging is degraded, and that provider runtime may serve traffic outside the specific MedicsPro outbox being inspected. Correlate them with `wa_logs` and `automation_runs` before declaring a MedicsPro incident.

## Entitlement diagnosis

The global check only reports aggregate explicit entitlement states. It does **not** decide whether a particular user should have a module.

For an incident involving “module unavailable”:

1. confirm the tenant and active profile;
2. inspect the effective clinic entitlement through the existing Platform Admin/read model;
3. inspect the relevant professional capability/identity boundary;
4. inspect resource/Encounter context;
5. only then classify the issue as entitlement, authorization or UX.

Preserve:

```text
PLATFORM ENTITLEMENT
        ↓
CLINIC CONFIGURATION
        ↓
USER AUTHORIZATION / CAPABILITY
        ↓
RESOURCE / ENCOUNTER CONTEXT
```

Do not infer authorization from hidden menus or `PresentationContext`.

## UX/browser diagnosis remains manual

V1 does **not** claim that browser UX is centrally observable. Frontend errors are still surfaced through fail-closed UI states, toasts and console/network diagnostics.

When a professional reports a UI problem:

1. record the route and user role/context without copying clinical free text;
2. reproduce with a controlled account/data set when possible;
3. inspect browser console/network for the failing request;
4. classify whether server state is healthy using this runbook;
5. if the server is healthy and the UI remains broken, classify as frontend/UX rather than rewriting backend contracts.

A future client telemetry slice is justified only if pilot evidence shows this manual workflow is insufficient. Any such telemetry must whitelist fields, avoid clinical payloads and define retention/access explicitly.

## Production observation on 2026-09-15

The exact reviewed script was copied to the production host and its SHA-256 was verified before execution:

```text
3d68cfdf9edf71b84e642e8b7aeb41e0077ff88d48a55570e92ce1eb75621457
```

It then ran read-only and exited `0` with:

```text
CLINICAL|future_in_service|0|PASS
CLINICAL|finalized_encounter_inconsistent|0|PASS
CLINICAL|sessions_with_multiple_active_evolutions|0|PASS
FINANCE|pending_financial_exceptions|1|ATTENTION
FINANCE|pending_financial_exception_reasons|package_exhausted:1|INFO
AUTOMATION|failed_runs_24h|0|PASS
AUTOMATION|last_run_fresh|3m|PASS
MESSAGING|failed_wa_rows_24h|0|PASS
MESSAGING|human_review_open|0|PASS
INSTRUMENTS|self_assessment_processing_errors|0|PASS
RUNTIME|edge_wall_clock_warnings_24h|812|INFO
RUNTIME|edge_early_terminations_24h|814|INFO
RUNTIME|edge_worker_boot_errors_24h|0|PASS
RUNTIME|edge_uncaught_or_fatal_24h|0|PASS
RUNTIME|medicspro_edge_error_prefixes_24h|0|PASS
RUNTIME|evolution_5xx_like_24h|2|ATTENTION
RUNTIME|frontend_5xx_like_24h|0|PASS
SUMMARY|beta_operability|no_critical_failure|PASS
```

The only persisted application queue requiring attention was the expected #389 financial resolution item (`package_exhausted:1`). The Edge isolate warnings remain informational because persisted automation/messaging and app-specific error signals were green. Evolution structured 5xx signals remain **ATTENTION** and must be correlated with `wa_logs`/user-visible impact before declaring a MedicsPro messaging incident. The counter intentionally matches structured HTTP/status fields (including quoted status values) instead of bare three-digit numbers, avoiding stack-line false positives.

## What this closes — and what it does not

This runbook closes the **minimum operability/triage contract** for a controlled beta once its script is reviewed and available from the canonical repository.

It does not close:

- #389 real `CHARGE`/`WAIVE` smoke;
- #396 visual/mobile/direct-URL smoke;
- UX validation by professionals;
- full provider health by tenant/instance;
- centralized frontend telemetry/tracing;
- incident paging/SLOs for larger-scale rollout.

Those remain separate evidence or future scale requirements.
