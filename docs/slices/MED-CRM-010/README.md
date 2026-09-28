# MED-CRM-010 — Pipeline / Stage Administration Contract V1

**Status:** ANALYZED  
**Execution:** NOT AUTHORIZED  
**Owner domain:** Commercial CRM  
**Canonical repository:** `OARANHA/crmfisio`  
**Discovery baseline:** `main@ef4011f138585de71910ecbe6c1fa815208d0dee`  
**Created:** 2026-09-28

## Objective

Define the smallest safe clinic-admin contract for administering Commercial CRM pipelines and stages without creating a parallel Commercial authority, widening tenant/RBAC access or changing `Contact != Lead != Patient`.

This slice is deliberately **analysis/design only** at this checkpoint. It does not authorize migration, RPC, frontend or production mutation.

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

## Product/integrity decisions required before code

1. **Archive Pipeline with Leads**
   - Current behavior would freeze real changes: Board shows legacy/read-only; Lead details and state-changing stage transition fail on archived current pipeline; no cross-pipeline Lead move exists.
   - Decide whether archive is rejected while any Lead references the pipeline, allowed only for a terminal/closed set, or accompanied by a separate explicit migration capability.

2. **Archive Stage with Leads**
   - Current behavior is asymmetric: Board/details treat archived-stage Leads as legacy/read-only, while the server stage-transition command can move from an archived current stage to an active target.
   - Decide whether Stage archive is blocked with referenced Leads or requires a separate explicit reassignment workflow.

3. **Default Pipeline**
   - The DB prevents two active defaults but does not require one.
   - Decide whether an active CRM must always have exactly one default and how default transfer is performed atomically when archiving/changing default.

4. **Pipeline creation**
   - A new active pipeline without an active open stage is unusable for Lead creation.
   - Decide whether create is atomic with an initial stage set, whether a draft/inactive lifecycle is needed, or another explicit contract.

5. **Stage kind lifecycle**
   - Changing `open/won/lost` can reinterpret existing Lead outcome semantics.
   - Decide whether kind is immutable after creation or what guards apply.

6. **Reorder**
   - Active stage positions are unique.
   - Reorder needs one atomic, concurrency-safe server operation; frontend sequencing must not become authority.

7. **Delete vs archive**
   - V1 should not silently equate physical DELETE with administration. Archive/restore/delete semantics need explicit decision.

## SECOND ADVERSARIAL REVIEW

Deterministic review found these blockers to EXECUTION:

- direct reuse of `crm_current_mutator_clinic_id()` would over-authorize `recep`;
- archiving a live Pipeline can strand Leads permanently under current same-pipeline transition rules;
- archiving a Stage can create UI/server asymmetry;
- a naive reorder can race or violate active-position uniqueness;
- changing/archiving the default can leave Prospect/Lead creation without a usable default;
- creating an active Pipeline without stages can expose a selectable but unusable pipeline;
- Stage kind edits can rewrite business semantics for existing Leads;
- configuration audit belongs in `audit_log`, not automatically in the Lead operational timeline.

JEV advisory routing returned `deep_review`; deterministic repository evidence above remains authoritative.

## NEXT SAFE GATE

Before implementation:
1. close the seven product/integrity decisions above;
2. define the exact owner/admin-only current-clinic configuration authority;
3. define minimal RPC signatures and concurrency/idempotency contract;
4. define behavioral/verifier tests first;
5. repeat SECOND ADVERSARIAL REVIEW;
6. only then move this slice beyond ANALYZED.
