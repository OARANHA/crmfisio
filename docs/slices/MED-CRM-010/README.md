# MED-CRM-010 — Pipeline / Stage Administration Contract V1

**Status:** DESIGNED  
**Execution:** NOT AUTHORIZED  
**Owner domain:** Commercial CRM  
**Canonical repository:** `OARANHA/crmfisio`  
**Discovery baseline:** `main@ef4011f138585de71910ecbe6c1fa815208d0dee`  
**Product-contract baseline:** `main@17298d78e910951e8c719906b3305579d24ce0b0`  
**Design baseline:** `main@7be73d0c51c8633d829776913645681adcf35785`  
**Created:** 2026-09-28

## Objective

Define the smallest safe clinic-admin contract for administering Commercial CRM pipelines and stages without creating a parallel Commercial authority, widening tenant/RBAC access or changing `Contact != Lead != Patient`.

The Product Contract is **APPROVED** and the Implementation Plan Review is now **DESIGNED**. Execution remains NOT AUTHORIZED; no migration, RPC, frontend or production mutation is authorized by this docs-only review.

## REAL NOW / PROVEN EVIDENCE

- MED-CRM-001..009 are RELEASED.
- PR #561 was revalidated on exact HEAD `0e3dd1768bed6f821984bf5bb027fa76f9e06aab`: 8/8 associated workflows completed successfully, 0 behind, docs-only, no reviews/threads, mergeable; it was protected-squash-merged as `main@ef4011f138585de71910ecbe6c1fa815208d0dee`.
- No MED-CRM-010 PR or branch existed before this analysis branch.
- `crm_pipelines`, `crm_stages`, canonical read projections and Board consumption exist.
- No canonical Pipeline/Stage administrative writer set is present in the Commercial CRM migrations on current main.
- Raw authenticated DML on Commercial Core tables remains closed; only service_role has table DML grants.
- Production readback capability is intentionally hash-pinned. No ad-hoc discovery SQL was executed and no operator target was used to bypass that boundary.

## GAPS

### Persistence already present

`crm_pipelines`:
- `id`, `clinic_id`, `name`, `is_default`, `archived_at`, timestamps;
- one active default per clinic is enforced as a **maximum** by partial unique index;
- no invariant currently guarantees at least one active default.

`crm_stages`:
- `id`, `clinic_id`, `pipeline_id`, `name`, `position`, `stage_kind`, `archived_at`, timestamps;
- active positions are unique per pipeline;
- at most one active `won` and one active `lost` stage per pipeline;
- no invariant guarantees at least one active `open` stage.

`crm_leads`:
- tenant-safe FKs reference Contact, Pipeline and Stage;
- pipeline/stage deletion is restricted by live Lead references;
- Lead creation requires an active pipeline and active open initial stage.

### Read authority already present

- `crm_current_reader_clinic_id()` derives tenant server-side from active profile;
- reader roles: owner/admin/professional/recep/financeiro;
- `crm.access` required;
- `list_current_clinic_crm_pipelines()`;
- `list_current_clinic_crm_stages(uuid)`;
- `list_current_clinic_crm_leads()`;
- SECURITY DEFINER + explicit search_path;
- authenticated executes RPCs, not raw table reads/writes.

### Administrative write authority missing

No canonical current-clinic command set was found for:
- create/edit/archive Pipeline;
- set/change default Pipeline;
- create/edit/archive Stage;
- reorder Stages;
- restore/reactivate Pipeline/Stage;
- safe handling of live Leads during lifecycle changes.

## CAPABILITY AUTHORITY / REUSE GATE

### Reuse

- current active profile / tenant derivation;
- `crm.access`;
- existing Pipeline/Stage schema and read projections;
- Commercial Board projections;
- `audit_log` for configuration mutations;
- updated_at semantics;
- Archived Pipeline Transition Guard as a compatibility constraint;
- existing raw browser DML closure.

### Do not reuse directly

`crm_current_mutator_clinic_id()` is an **operational** Commercial writer guard and allows owner/admin/recep.

Pipeline/Stage administration is clinic configuration. Existing MedicsPro configuration patterns are owner/admin-only. Reusing the operational helper directly would grant reception configuration authority by convenience.

If implementation is later authorized, the design should reuse the same canonical tenant/profile/entitlement primitives while expressing a distinct **owner/admin-only CRM configuration guard**, not a second tenant source or new role/entitlement.

### Do not create

- raw authenticated DML for `crm_pipelines` or `crm_stages`;
- Patient authority or Patient joins;
- platform_admin tenant access;
- a second CRM entitlement;
- a parallel audit system;
- Lead activity events for mere configuration changes unless a future command actually mutates Leads.

## DECISION

Pipeline / Stage Administration is the correct next Commercial CRM slice to analyze because it is a proven operability gap on top of already-released schema/read/Board foundations.

It is more reusable and narrower than Follow-up, Inbox/Conversation or Attribution, which require new aggregates/engines. Lost-reason taxonomy remains valid but the current free-form lost path is operational; Pipeline/Stage configuration is already modeled yet not operable by an authorized clinic administrator.

**Implementation is NOT authorized yet.**

## PRODUCT CONTRACT DECISIONS — APPROVED

### 1. Archive Pipeline with referenced Leads

Pipeline archive is allowed only when **no nondeleted nonterminal Lead** remains in that Pipeline.

- terminal historical Leads may remain referenced and become frozen/read-only while the Pipeline is archived;
- any open/nonterminal Lead blocks archive;
- V1 does not move Leads across Pipelines;
- if a clinic later needs to retire a Pipeline that still has active Leads, that requires a separate explicit reassignment/migration capability;
- the last active Pipeline cannot be archived while `crm.access` is the active Commercial CRM contract;
- archiving the active default requires an explicit replacement active Pipeline in the same transaction;
- archive clears `is_default` on the archived Pipeline.

### 2. Archive Stage with referenced Leads

Stage archive is rejected while **any nondeleted Lead** references that Stage.

- no implicit reassignment;
- no hidden cross-Stage migration inside archive;
- archiving the last active `open` Stage is rejected;
- a future reassignment capability, if justified, must be explicit and atomic;
- legacy archived-stage references that predate this contract are not silently rewritten.

This prevents the admin path from creating the current UI/server asymmetry. The existing same-Pipeline transition behavior for a legacy archived current Stage remains a compatibility/recovery fact, not authority for creating new archived-stage references.

### 3. Default Pipeline

While active Pipelines exist, the canonical admin contract maintains **exactly one active default**.

- first active Pipeline becomes default;
- setting a new default is one atomic server-side operation;
- target must be active and same-tenant;
- exact retry is side-effect free;
- stale expected-default state returns a conflict instead of silently overwriting a newer admin decision;
- archiving the default requires an explicit replacement in the same transaction;
- restored Pipelines do not silently reclaim default status.

### 4. Pipeline creation lifecycle

V1 does **not** introduce a draft lifecycle and does not overload `archived_at` as draft.

Pipeline creation is atomic:

`Pipeline + ordered initial Stage set`

The initial set must:

- be non-empty;
- contain at least one active `open` Stage;
- respect the existing at-most-one active `won` and `lost` invariants;
- use caller-supplied stable UUIDs for retry-safe creation;
- become visible as active only as one committed unit.

### 5. Stage kind lifecycle

`stage_kind` is **immutable after Stage creation in V1**.

Changing `open | won | lost` underneath existing Leads can reinterpret `closed_at`, loss semantics and reporting without touching the Lead row. Renaming, ordering, archive and restore are separate operations; changing kind requires creating a replacement Stage under a future explicit migration decision.

### 6. Reorder

Stage reorder is a single server-side atomic command.

Contract:

- frontend never becomes authority through multiple row updates;
- scope is one active Pipeline in the current clinic;
- command receives the expected current active-stage order plus the requested order;
- after locks are acquired, expected order must still match or the command fails with a stale/conflict result;
- an exact already-applied target order is idempotent;
- all active Stage IDs must appear exactly once;
- archived or cross-Pipeline Stage IDs are rejected;
- positions are rewritten collision-safely in two phases and normalized by the server.

### 7. Delete vs Archive / Restore

V1 exposes **archive + restore**, not authenticated physical DELETE.

- no browser/application delete command for Pipeline or Stage;
- physical deletion remains outside this Product Contract and would require a separate data-lifecycle decision;
- Stage configuration changes require an active parent Pipeline;
- an archived Pipeline freezes its Stage configuration;
- restoring a Pipeline requires a usable Stage set with at least one active `open` Stage and restores it as non-default unless a separate atomic default command is requested;
- restoring a Stage requires an active parent Pipeline and must preserve kind/position uniqueness; restore may append/reposition explicitly rather than blindly reviving an occupied position.

## CONFIGURATION AUTHORITY

Future commands must reuse:

- active current profile / canonical current clinic;
- `crm.access`;
- existing Pipeline/Stage tables and read projections;
- existing `audit_log`;
- existing raw-table browser DML closure.

The configuration guard must be narrow/internal and allow **owner/admin only**. It must not reuse `crm_current_mutator_clinic_id()` directly because that helper intentionally includes `recep` for operational Commercial writes.

Do not add:

- a second tenant source;
- a new role;
- a new CRM entitlement;
- platform_admin bypass;
- Patient authority;
- raw authenticated table DML;
- a second audit system.

Configuration-only changes emit `audit_log` events. They do not emit `crm_lead_activities` unless a future command actually changes Leads.

## CONCURRENCY / COMPATIBILITY REQUIREMENTS DISCOVERED BY ADVERSARIAL REVIEW

The Product Contract is not safe if only the new admin commands lock rows. Existing RELEASED writers must serialize with lifecycle changes.

Required design input for the next gate:

1. all CRM configuration commands acquire the current clinic row `FOR UPDATE` first, then Pipeline/Stage rows in deterministic order;
2. `create_current_clinic_crm_lead(...)` must be hardened so real creation acquires compatible locks for the clinic/default decision and selected active Pipeline + initial Stage before INSERT;
3. because Prospect Intake / identity resolution composes `create_current_clinic_crm_lead(...)`, hardening that canonical command covers that ingress without a parallel authority;
4. `transition_current_clinic_crm_lead_stage(...)` already protects the current Pipeline for state changes, but target Stage selection must also acquire a compatible row lock so Stage archive cannot race a transition into that Stage;
5. `update_current_clinic_crm_lead_details(...)` already locks current Pipeline and Stage `FOR SHARE` before real changes and is the compatibility pattern to preserve.

These are changes to existing authorities, not new authorities. Their exact SQL signatures/lock order/migration composition remain a **DESIGN gate**, so EXECUTION is still not authorized.

## MINIMUM COMMAND INVENTORY FOR DESIGN REVIEW

The next gate must turn the approved semantics into exact contracts for:

- internal owner/admin current-clinic CRM configuration guard;
- create Pipeline with initial Stage set;
- rename/update Pipeline metadata allowed by V1;
- set default Pipeline;
- archive Pipeline;
- restore Pipeline;
- create Stage;
- rename Stage;
- archive Stage;
- restore Stage;
- reorder active Stages;
- compatibility hardening of existing Lead create and stage transition commands.

No generic CRM writer is permitted.

## SECOND ADVERSARIAL REVIEW

A fresh deterministic review attacked the approved contract and found one additional structural class of risk: **concurrent RELEASED writers crossing an admin lifecycle mutation**.

Specifically:

- `create_current_clinic_crm_lead(...)` currently validates active Pipeline/open Stage but does not lock those configuration rows;
- Prospect Intake composes that same Lead command;
- `transition_current_clinic_crm_lead_stage(...)` locks the current Pipeline for a real state change, but its target Stage lookup is not currently a locking read;
- `update_current_clinic_crm_lead_details(...)` already uses `FOR SHARE` on current Pipeline and Stage and therefore demonstrates the intended compatibility pattern.

Without hardening Lead creation and target-Stage transition reads, an archive/default/stage-archive command could pass its own checks while a concurrent writer commits against the pre-archive view.

The contract therefore includes the compatibility requirements above and does **not** authorize implementation until the exact migration/locking plan proves those races closed without deadlock or authority expansion.

Other adversarial checks close at Product Contract level:

- `recep` does not gain configuration authority;
- open Leads cannot be stranded by Pipeline archive;
- new archived-Stage-with-Lead states cannot be created by the admin path;
- default transfer cannot intentionally leave zero active defaults;
- active Pipeline creation cannot expose an unusable zero-open-stage Pipeline;
- `stage_kind` cannot reinterpret existing Leads;
- reorder cannot be a client sequence;
- restore must revalidate active/default/kind/position invariants;
- cross-tenant IDs remain filtered by server-derived clinic;
- browser raw DML remains closed;
- `Contact != Lead != Patient` remains intact.

JEV was used as advisory input. Its routing remained conservative (`deep_review`/later `block` probability) because execution is intentionally still blocked; deterministic repository evidence controls the status transition.

## IMPLEMENTATION PLAN REVIEW — DESIGNED

The exact implementation contract is recorded in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

It closes:

- exact helper/RPC names and SQL signatures;
- owner/admin-only current-clinic configuration authority;
- server-derived tenant and `crm.access`;
- deterministic clinic → Pipeline → Stage config lock order;
- compatible hardening of existing Lead-create and real stage-transition paths without signature or authority expansion;
- desired-state retry and stale-precondition semantics;
- collision-safe two-phase Stage reorder;
- bounded `audit_log` events with zero configuration-only `crm_lead_activities`;
- additive migration/verifier/harness composition;
- PostgreSQL 16/17 behavioral, RBAC, tenant, entitlement, raw-DML, regression and concurrency matrix.

The adversarial review corrected a potentially deadlock-prone target-Stage-before-Pipeline design. Real stage transitions must preserve the exact same-stage retry branch, then acquire `Pipeline FOR SHARE` before re-reading/locking the active target Stage `FOR SHARE`.

Canonical Pipeline/Stage readers already expose `updated_at`, so no parallel admin reader is required.

JEV advisory initially requested `deep_review`; after the deeper deterministic review, its completion review returned `complete`. Repository evidence remains authoritative.

## NEXT SAFE GATE

MED-CRM-010 is **DESIGNED / EXECUTION NOT AUTHORIZED**.

Before any implementation:

1. integrate this docs-only design PR after exact-HEAD checks pass;
2. reconstruct the then-current `origin/main`;
3. re-read this slice and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md);
4. create a dedicated implementation branch only after the design is institutional on main;
5. implement exactly the bounded migration/verifier/tests/workflow contract;
6. validate before documenting PROVED/RELEASED.

No migration, RPC, frontend or production mutation is authorized by this documentation branch.
