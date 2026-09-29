# MED-CRM-010 — HANDOFF

## Current checkpoint

**Slice:** MED-CRM-010 — Pipeline / Stage Administration Contract V1  
**Institutional status:** DESIGNED  
**Canonical main:** `19d1f2dabbab99827f1ed854fff61c5486863247`  
**Execution:** NOT AUTHORIZED by repository state alone  
**Handoff branch:** `docs/med-crm-010-post-design-handoff`

PR #563 merged the APPROVED Product Contract. PR #564 merged the DESIGNED Implementation Plan after exact-HEAD revalidation and 20/20 successful workflows.

Protected squash result of PR #564:

`main@19d1f2dabbab99827f1ed854fff61c5486863247`

No migration, RPC, frontend, schema or runtime mutation has been executed for MED-CRM-010 yet.

## Gate status

```text
REAL NOW / PROVEN EVIDENCE       CLOSED FOR DESIGN
GAPS                             CLOSED
CAPABILITY AUTHORITY / REUSE     CLOSED
DECISION                         CLOSED: DESIGN CONTRACT SELECTED
SECOND ADVERSARIAL REVIEW        CLOSED FOR DESIGN
EXECUTION                        AWAITS EXPLICIT HUMAN AUTHORIZATION
VALIDATION                       NOT STARTED FOR IMPLEMENTATION
DOCUMENTATION                    DESIGN INTEGRATED; THIS HANDOFF REFRESHES CONTINUITY
```

## Canonical design authority

Read in this order:

1. [README.md](README.md)
2. [DECISION.md](DECISION.md)
3. [EVIDENCE.md](EVIDENCE.md)
4. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
5. this HANDOFF

The exact implementation surface is frozen by `IMPLEMENTATION_PLAN.md`. Do not redesign or widen it during execution unless a fresh gap forces the process back through GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW.

## Exact configuration surface

Public owner/admin commands:

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

Internal helper:

- `crm_lock_current_configurator_clinic() RETURNS uuid`
- server-derived current clinic;
- owner/admin only;
- `crm.access`;
- current clinic row `FOR UPDATE`;
- no authenticated EXECUTE.

Do not reuse `crm_current_mutator_clinic_id()` directly for configuration because it intentionally includes `recep`.

## Lock hierarchy that must not regress

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

Preserve exact same-stage retry before those real-transition lifecycle locks.

Lead Details remains:

```text
Lead FOR UPDATE
→ Contact FOR SHARE
→ Pipeline FOR SHARE
→ Stage FOR SHARE
```

Never implement the rejected inverse `target Stage → Pipeline` order.

## Product/security invariants

- `Contact != Lead != Patient`;
- no Patient authority or implicit Lead→Patient conversion;
- owner/admin configure; `recep` remains operational CRM writer only;
- server-derived tenant, no browser clinic selector;
- `crm.access` remains the entitlement;
- exactly one active default while active Pipelines exist;
- first active Pipeline becomes default;
- Pipeline archive blocks any nondeleted Lead not provably terminal;
- terminal means referenced Stage kind `won|lost` **and** `closed_at IS NOT NULL`;
- Stage archive blocks any nondeleted Lead reference;
- last active Pipeline and last active open Stage cannot be archived;
- `stage_kind` immutable after creation;
- no authenticated physical delete;
- reorder is one atomic server command;
- archived Pipeline freezes Stage configuration;
- configuration-only mutations write `audit_log`, never `crm_lead_activities`;
- raw authenticated DML remains closed.

## Planned implementation artifacts

- `supabase-migrations/20260929_commercial_crm_pipeline_stage_admin.sql`
- `supabase-verifiers/VERIFY_20260929_COMMERCIAL_CRM_PIPELINE_STAGE_ADMIN.sql`
- `tests/sql/commercial_crm_pipeline_stage_admin_cases.sql`
- `scripts/test-commercial-crm-pipeline-stage-admin.sh`
- `scripts/test-commercial-crm-pipeline-stage-admin-concurrency.sh`
- `.github/workflows/commercial-crm-pipeline-stage-admin.yml`

A bounded supporting index `crm_leads_clinic_pipeline_active_idx` may be added only if the implementation proof still justifies the exact partial shape documented in the plan.

## Required implementation validation

Use the existing isolated Commercial CRM harness pattern on PostgreSQL 16 and 17.

Mandatory:

- apply new migration twice;
- structural verifier;
- released regressions for MED-CRM-002/004/006/008/009;
- Contact Identity concurrency regression;
- owner/admin positive;
- recep/professional/financeiro negative;
- disabled `crm.access`;
- cross-tenant negative;
- anon/raw-DML closure;
- exact retry/stale conflict matrix;
- default/archive/restore/last-open invariants;
- bounded config audit and zero config-only Lead activities;
- both orderings of Lead-create ↔ default/archive races;
- both orderings of transition ↔ target-Stage archive;
- Pipeline archive ↔ real transition;
- reorder/Stage lifecycle ↔ transition no-deadlock proof.

Do not declare PROVED from static review or green TypeScript alone.

## Next chat / execution gate

The next chat must first reconstruct the current state again from `origin/main`, this handoff PR if still open, code/schema/tests and GitHub checks.

If the user sends an explicit message authorizing EXECUTION, that message is the human authorization to start the bounded implementation. Then:

1. revalidate this handoff branch/PR and integrate it if current, docs-only, 0 behind, mergeable and all applicable checks are successful;
2. confirm the resulting `main` SHA;
3. reread integrated `IMPLEMENTATION_PLAN.md`;
4. create a dedicated implementation branch from that exact `main`;
5. implement only the planned migration/verifier/tests/workflow and compatibility hardening;
6. run the full PostgreSQL 16/17 validation matrix and regressions;
7. repeat SECOND ADVERSARIAL REVIEW on the implemented diff before claiming PROVED;
8. update README/DECISION/EVIDENCE/HANDOFF/LEDGER/CURRENT_STATE only from validated facts;
9. do not deploy to production or claim RELEASED unless runtime rollout is separately authorized and observed.

If any new structural gap appears, stop EXECUTION for that new capability and return to the four pre-execution gates. Do not create parallel authority as a shortcut.
