# MED-CRM-010 — Evidence

## REAL NOW

Canonical main at discovery close:

`ef4011f138585de71910ecbe6c1fa815208d0dee`

PR #561 proof before merge:
- state OPEN, merged false;
- exact HEAD `0e3dd1768bed6f821984bf5bb027fa76f9e06aab`;
- base `dbb2ae15393a815aadfa7a7a5b3beccfd2344ff3`;
- 1 ahead / 0 behind;
- mergeable;
- changed file: only `docs/slices/MED-CRM-009/HANDOFF.md`;
- reviews 0; review threads 0;
- 8 associated workflow runs, all `completed/success`.

Protected squash merge result:
- `merged=true`;
- resulting main `ef4011f138585de71910ecbe6c1fa815208d0dee`.

## Schema evidence

From `20260926_commercial_crm_core_foundation.sql`:

- `crm_pipelines.clinic_id` FK to clinics;
- `name`, `is_default`, `archived_at`, timestamps;
- partial unique active default per clinic;
- `crm_stages.clinic_id`, `pipeline_id`, `name`, `position`, `stage_kind`, `archived_at`, timestamps;
- stage kind constrained to open/won/lost;
- partial unique active position per pipeline;
- at most one active won and one active lost stage;
- Lead FKs to Pipeline/Stage use tenant-safe composite keys and ON DELETE RESTRICT;
- updated_at triggers exist for Pipeline/Stage.

## Read evidence

- `crm_current_reader_clinic_id()`: active profile, reader role allowlist and `crm.access`.
- `list_current_clinic_crm_pipelines()` and `list_current_clinic_crm_stages(uuid)`: SECURITY DEFINER, explicit `search_path = public, pg_temp`.
- authenticated gets EXECUTE on projections.
- Commercial raw tables are revoked from PUBLIC/anon/authenticated; service_role retains table DML.

## Existing writer evidence

Commercial CRM migrations on current main define:
- `crm_current_mutator_clinic_id()`;
- Contact create;
- Lead create;
- Lead stage transition;
- Contact identity-resolution helpers/orchestration;
- Lead details update;
- Lead activity reader hardening.

No Pipeline/Stage administration RPC set exists in these canonical migrations.

`crm_current_mutator_clinic_id()` permits owner/admin/recep + `crm.access`, proving it is not semantically identical to clinic configuration authority.

## Frontend evidence

`src/lib/commercialCrm.ts`:
- reads Pipeline/Stage/Lead through canonical RPCs;
- has no Pipeline/Stage admin mutation adapter.

`CommercialCrmBoard`:
- selects active pipelines;
- prefers the active default only as initial selection;
- filters archived stages from mutation columns;
- renders Leads whose current Pipeline/Stage is archived in a read-only legacy section.

`ConfigPremium`:
- no CRM/Pipeline administration section exists.

Permission matrix:
- `config` = full for owner/admin;
- `config` = none for professional/recep/financeiro.

UI presence remains non-authoritative; this evidence only supports the product placement/role model.

## Live-Lead compatibility evidence

- Lead create rejects archived Pipeline and archived/terminal initial Stage.
- State-changing stage transition requires current Pipeline active.
- Lead details update requires current Pipeline and current Stage active.
- stage transition target must be active and same Pipeline.
- no cross-Pipeline Lead transition exists.
- current stage itself is not required to be active by the transition RPC, creating the archived-stage asymmetry described in README.

## Tests/verifiers already proving reusable boundaries

Existing CRM tests cover:
- cross-tenant isolation;
- owner/admin/recep operational writers;
- professional/financeiro read-only;
- disabled `crm.access` fail-closed;
- raw authenticated DML closure;
- Contact != Lead != Patient;
- stage-transition idempotency;
- archived Pipeline transition guard;
- lost transition side effects/audit;
- Board legacy visibility.

They do not prove:
- admin Pipeline/Stage writers;
- default transfer;
- safe archive with live Leads;
- Stage reorder concurrency;
- Pipeline creation lifecycle;
- Stage kind lifecycle.

## Administrative pattern evidence

Message Template Admin Boundary is the closer reusable pattern:
- owner/admin only;
- server-derived clinic;
- entitlement check;
- SECURITY DEFINER;
- raw table DML closed;
- audit_log mutation event;
- recep/professional denied.

Clinic Configuration Core independently confirms owner/admin as the clinic-configuration role model.

## Runtime evidence boundary

`medicspro-db-readback` exists and is read-only, but exposes only `postgres.pinned_readback` with pre-approved verifier hashes.

No arbitrary SQL was executed to search production catalogs and no operator/managed-admin path was used for discovery.

Therefore this analysis proves **canonical repository authority absence** for Pipeline/Stage admin writers; it does not claim an unpinned arbitrary catalog scan of production.

## SECOND ADVERSARIAL REVIEW

Blockers:
- operational helper would over-authorize reception;
- live-Pipeline archive can strand Leads;
- archived-stage behavior is inconsistent between UI/details and transition server path;
- default can become absent;
- empty active Pipeline can be unusable;
- reorder needs concurrency-safe atomicity;
- Stage kind edits can reinterpret Lead state.

JEV advisory: `deep_review` (advisory only).


## PRODUCT CONTRACT REVIEW — 2026-09-28

### Fresh REAL NOW

PR #562 was revalidated on exact HEAD `59130cec82012f12d681de8cfbbfe220666dcf85`:

- OPEN before merge, not draft;
- base `main@ef4011f138585de71910ecbe6c1fa815208d0dee`;
- 9 ahead / 0 behind;
- mergeable;
- exactly six changed files, all under `docs/`;
- reviews: 0;
- review threads: 0;
- 20 associated workflow runs on that exact HEAD;
- 20 completed / 20 success / 0 failed.

Protected squash merge used the expected HEAD and returned `merged=true`.

Resulting canonical main:

`17298d78e910951e8c719906b3305579d24ce0b0`

MED-CRM-010 remained ANALYZED immediately after that merge; no product code, schema or runtime mutation was included.

### Code/schema revalidation for the seven decisions

Current canonical schema/commands prove:

- `crm_pipelines_one_active_default_per_clinic` enforces at most one active default, not at least one;
- `crm_stages_active_position_unique` makes multi-row reorder collision-sensitive;
- Lead FKs to Pipeline/Stage are tenant-safe and restrict Lead-driven physical deletion;
- `create_current_clinic_crm_lead(...)` requires an active Pipeline and active `open` initial Stage;
- `stage_kind` drives Lead terminal-field semantics through `guard_crm_lead_semantics()`, but that trigger runs on Lead writes, not on Stage-kind changes;
- MED-CRM-004 protects real stage transitions against an archived current Pipeline with a Pipeline `FOR SHARE` lock;
- `update_current_clinic_crm_lead_details(...)` protects real changes with current Contact, Pipeline and Stage `FOR SHARE` locks;
- current `create_current_clinic_crm_lead(...)` validates Pipeline/Stage activity but does not lock those configuration rows;
- current stage-transition target lookup validates active same-Pipeline target but does not lock the target Stage;
- Contact Identity Resolution composes `create_current_clinic_crm_lead(...)`, so hardening the canonical Lead command also protects Prospect Intake.

### Administrative authority evidence

`src/lib/permissions.ts` keeps `config=full` for owner/admin and `config=none` for recep/professional/financeiro.

Message Template Admin proves the closer server pattern:

- current clinic derived server-side;
- owner/admin only;
- entitlement check;
- SECURITY DEFINER + explicit search path;
- authenticated receives RPC EXECUTE, not raw-table admin DML;
- mutation writes the existing `audit_log`.

Therefore a narrow CRM configuration helper may reuse those primitives, but direct reuse of `crm_current_mutator_clinic_id()` would over-authorize reception.

### Adversarial concurrency finding

The first Product Contract draft assumed that locking inside new admin commands was sufficient. It is not.

A concurrent Lead create could observe an active Pipeline/open Stage before archive and commit after the admin lifecycle check unless the existing writer takes compatible locks. Likewise, a transition could observe an active target Stage before a concurrent Stage archive unless target selection is a locking read.

The approved contract therefore requires compatibility hardening of existing authorities as a DESIGN prerequisite. This closes the conceptual race without creating a second writer.

### Product Contract outcome

All seven product/integrity choices are now explicit and can advance the slice to APPROVED once this documentation is merged.

Execution remains blocked on exact design of:

- command signatures;
- lock order;
- idempotency/preconditions;
- reorder algorithm;
- audit metadata;
- additive migration composition;
- behavioral/verifier/regression matrix.

### SECOND ADVERSARIAL REVIEW

Deterministic result: **Product Contract can be APPROVED; EXECUTION remains BLOCKED pending DESIGN.**

JEV advisory was conservative (`deep_review` in the first pass; later `block` probability with low confidence after the prompt explicitly stated that execution remained forbidden). It is advisory only and did not override deterministic evidence.


## IMPLEMENTATION PLAN REVIEW — 2026-09-29

### REAL NOW

PR #563 was revalidated on exact HEAD `ece6118571eb51839d2df783538388172fe17e08` before merge:

- open, non-draft, mergeable;
- base `main@17298d78e910951e8c719906b3305579d24ce0b0`;
- 6 ahead / 0 behind;
- exactly six changed files, all documentation;
- reviews: 0;
- review threads: 0;
- associated workflows: 20 completed / 20 success / 0 failed.

Protected squash merge with expected HEAD succeeded and produced:

`main@7be73d0c51c8633d829776913645681adcf35785`

The integrated main therefore owns the APPROVED Product Contract before this design review.

### Effective code revalidation

The design review re-read the effective definitions rather than relying on earlier migration versions.

- MED-CRM-006 is the effective definition of `create_current_clinic_crm_lead(...)`; it keeps the `lead_retry` advisory lock but currently has no compatible clinic/Pipeline/Stage row locks around default/initial-stage selection.
- MED-CRM-004 is the effective stage-transition guard; it locks the Lead `FOR UPDATE`, preserves exact same-stage retry before the current-Pipeline guard, locks the current Pipeline `FOR SHARE` for real changes, and currently reads the target Stage without a row lock.
- MED-CRM-008 Lead Details already uses `Lead FOR UPDATE → Contact FOR SHARE → Pipeline FOR SHARE → Stage FOR SHARE` for real changes.
- `list_current_clinic_crm_pipelines()` and `list_current_clinic_crm_stages(uuid)` already expose `updated_at`; optimistic configuration preconditions therefore reuse canonical readers.
- `crm_pipelines_one_active_default_per_clinic`, `crm_stages_active_position_unique` and active won/lost partial unique indexes remain the physical constraints to compose.
- `crm_leads_clinic_stage_idx` already supports Stage-reference checks. A bounded partial `(clinic_id,pipeline_id) WHERE deleted_at IS NULL` index is justified for Pipeline archive checks and remains an implementation detail to prove.

### Validation-pattern reuse

The released Commercial CRM harness proves the current repository convention:

- isolated PostgreSQL 16 and 17 GitHub jobs;
- isolated fixture database;
- migration replay/idempotency;
- structural verifier;
- released behavioral regressions;
- explicit shell concurrency proof;
- fail-fast database name guards.

The MED-CRM-010 plan reuses that structure rather than creating a second verification framework.

### SECOND ADVERSARIAL REVIEW

The first concrete lock proposal was rejected because simply adding `FOR SHARE` to the target Stage at its existing read position would produce:

`transition: Stage → Pipeline`

against:

`admin: Pipeline → Stage`

which can deadlock.

The final design preserves exact same-stage retry first and, for real transitions, requires:

`Lead FOR UPDATE → Pipeline FOR SHARE → target Stage re-read FOR SHARE`

Admin Stage commands use:

`clinic FOR UPDATE → parent Pipeline FOR SHARE → Stage FOR UPDATE`

Admin Pipeline commands use:

`clinic FOR UPDATE → Pipeline FOR UPDATE`

Lead creation uses:

`lead_retry advisory → clinic FOR SHARE → Pipeline FOR SHARE → Stage FOR SHARE`

Configuration commands never lock Lead rows, preventing a reverse Pipeline/Stage-to-Lead cycle.

Pipeline archive also fails closed on ambiguous terminal state: a nondeleted Lead is considered safely terminal only when its referenced Stage is `won|lost` and `closed_at IS NOT NULL`.

No additional tenant source, role, entitlement, Patient authority, raw browser DML or audit path is introduced.

JEV advisory routed the initial design to `deep_review` (0.91). After the deterministic deeper review and refinements above, JEV completion review returned `complete` with probability 0.85. JEV remains advisory.

### Outcome

The exact authority, RPC signatures, lock order, idempotency/preconditions, audit contract, migration composition and PostgreSQL 16/17 validation matrix are documented in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

Deterministic result:

**MED-CRM-010 can move APPROVED → DESIGNED. EXECUTION remains NOT AUTHORIZED.**
