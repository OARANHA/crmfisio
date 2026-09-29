# MED-CRM-010 — HANDOFF

## Current checkpoint

**Slice:** MED-CRM-010 — Pipeline / Stage Administration Contract V1  
**Institutional status after this docs PR merges:** DESIGNED  
**Current canonical main before this docs PR:** `7be73d0c51c8633d829776913645681adcf35785`  
**Execution:** NOT AUTHORIZED  
**Branch:** `docs/med-crm-010-implementation-plan-review`

PR #563 is merged. Its protected squash result is `main@7be73d0c51c8633d829776913645681adcf35785`.

This branch is documentation only. It records the closed Implementation Plan Review and does not implement any migration, RPC, frontend or runtime mutation.

## Gate status

```text
REAL NOW / PROVEN EVIDENCE       CLOSED FOR DESIGN
GAPS                             CLOSED
CAPABILITY AUTHORITY / REUSE     CLOSED
DECISION                         CLOSED: DESIGN CONTRACT SELECTED
SECOND ADVERSARIAL REVIEW        CLOSED FOR DESIGN
EXECUTION                        NOT AUTHORIZED
VALIDATION                       REPOSITORY/DESIGN EVIDENCE ONLY
DOCUMENTATION                    THIS DOCS-ONLY BRANCH
```

## Canonical design

Read first:

1. [README.md](README.md)
2. [DECISION.md](DECISION.md)
3. [EVIDENCE.md](EVIDENCE.md)
4. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

The exact public configuration surface is:

- `create_current_clinic_crm_pipeline(uuid,text,jsonb)`
- `rename_current_clinic_crm_pipeline(uuid,timestamptz,text)`
- `set_current_clinic_crm_default_pipeline(uuid,uuid)`
- `archive_current_clinic_crm_pipeline(uuid,timestamptz,uuid)`
- `restore_current_clinic_crm_pipeline(uuid,timestamptz)`
- `create_current_clinic_crm_stage(uuid,uuid,text,text)`
- `rename_current_clinic_crm_stage(uuid,timestamptz,text)`
- `archive_current_clinic_crm_stage(uuid,timestamptz)`
- `restore_current_clinic_crm_stage(uuid,timestamptz)`
- `reorder_current_clinic_crm_stages(uuid,uuid[],uuid[])`

Internal authority helper:

- `crm_lock_current_configurator_clinic() RETURNS uuid`
- owner/admin only;
- `crm.access`;
- server-derived current clinic;
- current clinic row `FOR UPDATE`;
- no authenticated EXECUTE.

Do not reuse `crm_current_mutator_clinic_id()` directly for configuration because it intentionally includes `recep`.

## Lock hierarchy

Admin:

```text
clinic FOR UPDATE
→ Pipeline
→ Stage
```

Lead create hardening:

```text
existing lead_retry advisory
→ clinic FOR SHARE
→ selected Pipeline FOR SHARE
→ selected initial Stage FOR SHARE
```

Real stage transition hardening:

```text
Lead FOR UPDATE
→ Pipeline FOR SHARE
→ target Stage re-read FOR SHARE
```

Keep exact same-stage retry before the real-transition lifecycle locks.

Lead Details stays:

```text
Lead FOR UPDATE
→ Contact FOR SHARE
→ Pipeline FOR SHARE
→ Stage FOR SHARE
```

Never implement the rejected `target Stage lock → Pipeline lock` transition order.

## Product invariants carried into implementation

- `Contact != Lead != Patient`;
- no Patient authority or implicit conversion;
- owner/admin configure; reception remains operational-only;
- exactly one active default while active Pipelines exist;
- first Pipeline becomes default;
- Pipeline archive blocks any nondeleted Lead not provably terminal;
- Stage archive blocks any nondeleted Lead reference;
- last active Pipeline and last active open Stage cannot be archived;
- `stage_kind` immutable after creation;
- no authenticated physical delete;
- Pipeline creation is atomic with a usable initial Stage set;
- reorder is one atomic server operation;
- archived Pipeline freezes Stage configuration;
- config-only changes write `audit_log`, never `crm_lead_activities`.

## Planned implementation artifacts

- `supabase-migrations/20260929_commercial_crm_pipeline_stage_admin.sql`
- `supabase-verifiers/VERIFY_20260929_COMMERCIAL_CRM_PIPELINE_STAGE_ADMIN.sql`
- `tests/sql/commercial_crm_pipeline_stage_admin_cases.sql`
- `scripts/test-commercial-crm-pipeline-stage-admin.sh`
- `scripts/test-commercial-crm-pipeline-stage-admin-concurrency.sh`
- `.github/workflows/commercial-crm-pipeline-stage-admin.yml`

The migration may add `crm_leads_clinic_pipeline_active_idx` for the bounded Pipeline archive predicate. Prove necessity/shape in implementation; do not broaden it casually.

## Required implementation validation

Use the existing isolated Commercial CRM harness pattern on PostgreSQL 16 and 17.

Must include:

- migration applied twice;
- new structural verifier;
- MED-CRM-002/004/006/008/009 regressions;
- Contact Identity concurrency regression;
- owner/admin positive;
- recep/professional/financeiro negative;
- disabled `crm.access`;
- cross-tenant negative;
- anon/raw-DML closure;
- exact retry and stale conflict matrix;
- default/archive/restore/last-open invariants;
- config audit and zero config-only Lead activities;
- both orderings of Lead-create ↔ default/archive races;
- both orderings of transition ↔ target-Stage archive;
- Pipeline archive ↔ transition;
- reorder/Stage lifecycle ↔ transition no-deadlock proof.

Do not declare PROVED from static review alone.

## Next safe gate

Before implementation:

1. revalidate `origin/main`, this branch/PR exact HEAD, checks and merge state;
2. merge this docs-only design only if it is current, 0 behind, mergeable and all applicable checks pass;
3. confirm resulting main SHA;
4. reread the integrated [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md);
5. only then create a dedicated implementation branch from that exact main;
6. implement the bounded plan without expanding authority;
7. validate fully before documentation of PROVED/RELEASED.

No migration, RPC, frontend or production mutation is authorized by this handoff.
