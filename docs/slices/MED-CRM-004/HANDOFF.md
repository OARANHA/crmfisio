# MED-CRM-004 — Handoff

## Current checkpoint

Always re-resolve current `origin/main`, this branch/PR HEAD, diff, checks and runtime before acting.

```text
canonical repository = OARANHA/crmfisio
audited base = 2bcadc00a730eb9a1c1c063a688ccebf8982ce35
branch = feat/med-crm-004-archived-pipeline-transition-guard
status = IMPLEMENTING

MED-CRM-001 = RELEASED
MED-CRM-002 = RELEASED
MED-CRM-003 = ANALYZED / EXECUTION FORBIDDEN
MED-CRM-004 = prerequisite implementation in progress
```

## Gates

```text
GAPS = CLOSED
CAPABILITY AUTHORITY / REUSE = CLOSED
DECISION = CLOSED
SECOND ADVERSARIAL REVIEW = CLOSED
EXECUTION = STARTED
VALIDATION = PENDING
DOCUMENTATION = IN PROGRESS
```

JEV advisory result: `proceed_fast=0.73`, `deep_review=0.25`, `block=0.01`, `split_task=0.01`, confidence `0.65`.

## Implementation boundary

This slice hardens only the existing `transition_current_clinic_crm_lead_stage(...)` through an additive follow-up migration.

No Board/frontend work. No alternate CRM command. No new role, entitlement, tenant source, table, audit mechanism, provider, automation, AI or Patient-domain behavior.

## Required next gate

1. open/revalidate the PR for this branch;
2. inspect complete diff and current HEAD;
3. require PostgreSQL 16 + 17 guard harness success;
4. require all applicable repository checks on the same HEAD;
5. fix any failure and rerun;
6. only with current-head evidence may MED-CRM-004 become PROVED and be considered for merge;
7. after merge, perform controlled production rollout/readback before RELEASED;
8. only after MED-CRM-004 is RELEASED, reconstruct MED-CRM-003 from current main and rerun its four pre-execution gates.

Do not treat merge as release and do not start MED-CRM-003 Board while this prerequisite is not RELEASED.
