# MED-CRM-010 — Implementation Plan Review

**Status:** DESIGNED  
**Execution authorized:** NO  
**Canonical design baseline:** `main@7be73d0c51c8633d829776913645681adcf35785`  
**Date:** 2026-09-29

## Scope

This document closes the DESIGN gate for **Pipeline / Stage Administration Contract V1**. It defines the exact authority, command surface, lock ordering, retry/precondition semantics, additive migration composition and validation plan.

It does **not** authorize migration, RPC, frontend or production execution.

## Authority

### Internal configuration guard

Exact helper:

```sql
public.crm_lock_current_configurator_clinic()
RETURNS uuid
```

Contract:

- `SECURITY DEFINER`;
- `SET search_path = public, pg_temp`;
- derive the actor from `current_active_profile()`;
- allow only `owner` / `admin`;
- require `current_clinic_entitlement_allowed('crm.access') IS TRUE`;
- revalidate the current clinic as active and acquire its `public.clinics` row `FOR UPDATE`;
- return only the server-derived `clinic_id`;
- internal only: no `authenticated` EXECUTE grant.

This helper is a configuration guard, not a replacement tenant authority. It reuses the canonical profile/clinic/entitlement chain. It does not reuse `crm_current_mutator_clinic_id()` directly because that operational guard includes `recep`.

### Browser/application command boundary

Every public admin command is:

- current-clinic only;
- owner/admin only through the internal guard;
- `crm.access` gated;
- `SECURITY DEFINER`;
- pinned `search_path`;
- executable by `authenticated`, never by `anon`;
- tenant-filtered on every referenced identifier;
- audited through existing `audit_log`;
- denied raw table DML for `authenticated`.

No command introduces Patient authority, platform-admin tenant bypass, a second CRM entitlement, a second audit mechanism or a generic CRM writer.

## Exact command inventory

### Pipeline

```sql
public.create_current_clinic_crm_pipeline(
  p_pipeline_id uuid,
  p_name text,
  p_initial_stages jsonb
) RETURNS uuid
```

`p_initial_stages` is an ordered JSON array whose objects contain exactly `id`, `name`, `stage_kind`. Unknown keys, duplicate IDs, empty names or invalid kinds are rejected. Position is server-derived from array ordinality, starting at 0.

Required initial state:

- non-empty Stage array;
- at least one `open`;
- at most one `won`;
- at most one `lost`;
- stable caller-supplied UUIDs;
- active Pipeline + Stages become visible atomically;
- if there are no active Pipelines, the new Pipeline becomes default;
- if active Pipelines exist, the existing active-default invariant must already be valid.

Same Pipeline UUID + exact desired active name/Stage set is side-effect-free. Any incompatible reuse of the UUID is `23505`.

```sql
public.rename_current_clinic_crm_pipeline(
  p_pipeline_id uuid,
  p_expected_updated_at timestamptz,
  p_name text
) RETURNS uuid
```

Exact desired-state replay returns before lifecycle/stale rejection. A real change requires an active Pipeline and matching `updated_at`; stale state is `40001`.

```sql
public.set_current_clinic_crm_default_pipeline(
  p_pipeline_id uuid,
  p_expected_default_pipeline_id uuid DEFAULT NULL
) RETURNS uuid
```

The target must be active and same-tenant. If it is already the active default, retry is side-effect-free before the stale check. Otherwise the current active default must equal `p_expected_default_pipeline_id`; `NULL` is allowed only as an explicit expectation that no active default exists. Transfer is atomic.

```sql
public.archive_current_clinic_crm_pipeline(
  p_pipeline_id uuid,
  p_expected_updated_at timestamptz,
  p_replacement_default_pipeline_id uuid DEFAULT NULL
) RETURNS uuid
```

Rules:

- exact already-archived desired state is side-effect-free;
- real archive requires current `updated_at`;
- reject the last active Pipeline;
- if target is default, replacement is mandatory, active, same-tenant and different;
- if target is not default, replacement must be `NULL`;
- reject if any nondeleted Lead is not provably terminal;
- a Lead is terminal for this guard only when its referenced Stage kind is `won|lost` **and** `closed_at IS NOT NULL`;
- any inconsistent/ambiguous Lead state blocks archive;
- archive clears `is_default`;
- terminal historical Leads may remain referenced/frozen;
- no Lead is moved.

```sql
public.restore_current_clinic_crm_pipeline(
  p_pipeline_id uuid,
  p_expected_updated_at timestamptz
) RETURNS uuid
```

Rules:

- exact already-active non-default desired state is side-effect-free;
- real restore requires matching `updated_at`;
- Stage configuration is not mutated during restore;
- the Pipeline must already have at least one active `open` Stage;
- the clinic must already have one valid active default;
- restore sets `archived_at = NULL` and `is_default = FALSE`;
- legacy invariant-broken states fail closed rather than being silently repaired.

### Stage

```sql
public.create_current_clinic_crm_stage(
  p_stage_id uuid,
  p_pipeline_id uuid,
  p_name text,
  p_stage_kind text
) RETURNS uuid
```

Parent Pipeline must be active. `stage_kind` is one of `open|won|lost`; active `won/lost` uniqueness is preserved. Position is appended server-side after the current maximum active position. Exact UUID replay with the same immutable identity/name/kind is side-effect-free.

```sql
public.rename_current_clinic_crm_stage(
  p_stage_id uuid,
  p_expected_updated_at timestamptz,
  p_name text
) RETURNS uuid
```

Exact name replay is side-effect-free. Real change requires an active Stage, active parent Pipeline and matching `updated_at`.

```sql
public.archive_current_clinic_crm_stage(
  p_stage_id uuid,
  p_expected_updated_at timestamptz
) RETURNS uuid
```

Rules:

- exact already-archived replay is side-effect-free;
- real archive requires active parent Pipeline and matching `updated_at`;
- reject if any nondeleted Lead references the Stage;
- if kind is `open`, reject archive of the last active open Stage;
- no reassignment is performed.

```sql
public.restore_current_clinic_crm_stage(
  p_stage_id uuid,
  p_expected_updated_at timestamptz
) RETURNS uuid
```

Rules:

- exact already-active replay is side-effect-free;
- active parent Pipeline required;
- matching `updated_at` required for a real restore;
- preserve active `won/lost` uniqueness;
- append at the end of the active order instead of blindly restoring the historical position;
- `stage_kind` never changes.

```sql
public.reorder_current_clinic_crm_stages(
  p_pipeline_id uuid,
  p_expected_stage_ids uuid[],
  p_stage_ids uuid[]
) RETURNS uuid[]
```

Rules:

- active same-tenant Pipeline only;
- lock all active Stages deterministically by UUID;
- read canonical current order by `position, created_at, id`;
- if current order already equals `p_stage_ids`, return side-effect-free before stale rejection;
- otherwise current order must exactly equal `p_expected_stage_ids`, else `40001`;
- desired array must contain every active Stage exactly once, with no duplicates or foreign/archived IDs;
- rewrite positions in two phases using a checked temporary positive offset, then normalize to 0..N-1;
- frontend never performs row-by-row reorder authority.

## Lock order and compatibility proof

### New admin commands

Global order inside this slice:

```text
current clinic FOR UPDATE
→ parent/affected Pipeline lock
→ affected Stage lock(s)
→ plain invariant reads
→ mutation
→ audit
```

Pipeline lifecycle/default operations lock all affected Pipeline rows `FOR UPDATE` in deterministic UUID order.

Stage operations lock the parent Pipeline `FOR SHARE`, then target/all Stage rows `FOR UPDATE` in deterministic UUID order.

Admin commands do not acquire Lead row locks. Lead-reference checks are plain reads after lifecycle locks.

### Harden existing Lead creation without changing its signature or authority

Keep:

```sql
public.create_current_clinic_crm_lead(
  uuid, uuid, text, uuid, uuid, uuid, bigint, text
) RETURNS uuid
```

Keep the existing `lead_retry` advisory lock and operational `crm_current_mutator_clinic_id()` authority.

For real creation, add:

```text
lead_retry advisory lock
→ current clinic row FOR SHARE
→ selected active Pipeline FOR SHARE
→ selected active initial Stage FOR SHARE
→ INSERT Lead
```

The clinic lock is acquired before choosing the default Pipeline. Multiple Lead creates remain mutually compatible; configuration commands serialize through clinic `FOR UPDATE`.

Contact Identity Resolution continues composing this canonical Lead-create command and receives the hardening automatically.

### Harden existing stage transition without changing signature/authority

Keep the current Lead `FOR UPDATE` and exact same-stage retry semantics.

For a real state change:

```text
Lead FOR UPDATE
→ current Pipeline FOR SHARE
→ target active Stage re-read FOR SHARE
→ revalidate target/reason
→ UPDATE Lead
```

The target may be read non-locking earlier only for the existing exact same-stage retry branch. A real transition must re-read it under `FOR SHARE` **after** the Pipeline lock.

This avoids the deadlock-prone inverse order `Stage → Pipeline` while closing transition-vs-Stage-archive races.

### Existing Lead Details

Do not reorder or weaken the RELEASED lock sequence:

```text
Lead FOR UPDATE
→ Contact FOR SHARE
→ Pipeline FOR SHARE
→ Stage FOR SHARE
```

No admin command waits on Lead rows, so the new `clinic → Pipeline → Stage` config hierarchy does not create a Pipeline/Stage-to-Lead cycle.

## Retry and conflict semantics

Use existing repository conventions:

- `42501`: authorization/entitlement denied;
- `P0002`: same-tenant resource not found;
- `22023`: invalid input shape/value;
- `23514`: lifecycle/invariant violation;
- `23505`: incompatible stable-ID/idempotency reuse;
- `40001`: optimistic stale/precondition conflict.

Desired-state retries return before audit/activity emission and before stale rejection where explicitly defined above.

Configuration commands never emit `crm_lead_activities`.

## Audit contract

Use existing `audit_log` only.

Actions:

- `CRM_PIPELINE_CREATED`
- `CRM_PIPELINE_RENAMED`
- `CRM_PIPELINE_DEFAULT_CHANGED`
- `CRM_PIPELINE_ARCHIVED`
- `CRM_PIPELINE_RESTORED`
- `CRM_STAGE_CREATED`
- `CRM_STAGE_RENAMED`
- `CRM_STAGE_ARCHIVED`
- `CRM_STAGE_RESTORED`
- `CRM_STAGES_REORDERED`

`detalhe` is bounded technical text containing only necessary configuration IDs, counts and changed-field labels. Do not include Lead title/value/source, Contact data, Patient data or free-form Stage/Pipeline names unless a later audit requirement explicitly justifies them.

## Additive migration composition

Proposed implementation artifacts:

- `supabase-migrations/20260929_commercial_crm_pipeline_stage_admin.sql`
- `supabase-verifiers/VERIFY_20260929_COMMERCIAL_CRM_PIPELINE_STAGE_ADMIN.sql`
- `tests/sql/commercial_crm_pipeline_stage_admin_cases.sql`
- `scripts/test-commercial-crm-pipeline-stage-admin.sh`
- `scripts/test-commercial-crm-pipeline-stage-admin-concurrency.sh`
- `.github/workflows/commercial-crm-pipeline-stage-admin.yml`

The migration may also add the bounded supporting index:

```sql
CREATE INDEX IF NOT EXISTS crm_leads_clinic_pipeline_active_idx
ON public.crm_leads (clinic_id, pipeline_id)
WHERE deleted_at IS NULL;
```

No table authority, tenant key, Patient relation or physical-delete capability is added.

The migration redefines only the two existing functions that require compatibility hardening, preserving their public signatures and grants:

- `create_current_clinic_crm_lead(...)`;
- `transition_current_clinic_crm_lead_stage(...)`.

## Validation contract

The new workflow follows the current released CRM harness pattern on PostgreSQL **16 and 17**.

The isolated harness must:

1. build the canonical Commercial fixture;
2. apply the released migration chain through MED-CRM-009;
3. apply the MED-CRM-010 migration twice;
4. run existing verifiers;
5. run MED-CRM-002/004/006/008/009 behavioral regressions plus Contact Identity concurrency;
6. run the new structural verifier;
7. run new behavior cases;
8. run the new concurrency proof.

Required new cases include:

- owner/admin positive configuration;
- recep/professional/financeiro denied;
- disabled `crm.access` denied;
- cross-tenant IDs fail without existence leakage;
- `anon` denied and raw `authenticated` DML remains closed;
- first Pipeline/default creation;
- invalid initial Stage sets;
- create retry and UUID conflict;
- rename exact retry/stale conflict;
- default exact retry/stale expected-default conflict;
- non-default/default Pipeline archive;
- last-active Pipeline rejection;
- open/inconsistent Lead archive rejection;
- terminal historical Lead archive success;
- Pipeline restore usable-stage/default preconditions;
- Stage create/rename/archive/restore;
- referenced Stage archive rejection;
- last-open Stage rejection;
- won/lost restore uniqueness;
- reorder exact retry, stale expected order, duplicate/missing/foreign IDs and normalized positions;
- config actions emit one bounded `audit_log` event and zero `crm_lead_activities`.

Concurrency must prove both orderings for:

1. Lead create ↔ default transfer;
2. Lead create ↔ Pipeline archive;
3. stage transition ↔ target Stage archive;
4. Pipeline archive ↔ real stage transition;
5. reorder/Stage lifecycle ↔ transition without deadlock.

The proof must assert blocking/recheck outcomes, not merely absence of SQL errors.

## SECOND ADVERSARIAL REVIEW

The design was attacked against the effective MED-CRM-006 Lead-create function, MED-CRM-004 transition guard, MED-CRM-008 Lead Details locking and current schema/index constraints.

Key correction made during review:

- adding a target-Stage lock **before** the existing Pipeline lock would create a possible `Stage → Pipeline` / `Pipeline → Stage` deadlock with admin lifecycle commands;
- the final design therefore preserves same-stage retry first, then uses `Pipeline FOR SHARE → target Stage FOR SHARE` for real transitions.

Additional close conditions:

- Pipeline terminal classification fails closed on inconsistent Lead/Stage state;
- canonical Pipeline/Stage readers already expose `updated_at`, so no parallel admin reader is needed;
- admin commands never lock Leads, avoiding a reverse row-lock cycle;
- config-only audit remains outside the Lead activity timeline;
- `Contact != Lead != Patient` is unchanged.

JEV advisory initially routed the plan to `deep_review`. After the deeper deterministic review and the refinements above, JEV completion review returned `complete` with 0.85 probability. JEV is advisory only.

## DESIGN outcome

The contract, authority, signatures, locking, retry semantics, migration composition and validation matrix are sufficiently explicit for MED-CRM-010 to move:

```text
APPROVED → DESIGNED
```

**EXECUTION remains NOT AUTHORIZED.**

The next safe gate is an implementation branch created from the then-current `origin/main`, after revalidating main/PR/checks and confirming that this docs-only design has been integrated. No migration/RPC/frontend/runtime mutation is authorized by this document.
