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
