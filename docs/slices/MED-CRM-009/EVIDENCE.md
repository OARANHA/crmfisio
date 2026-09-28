# MED-CRM-009 — Evidence

**Evidence status:** REPOSITORY PROVED / PRE-MERGE / NOT RELEASED  
**Audited repository:** `OARANHA/crmfisio`  
**Design audited main:** `1ff2825cfe5dd630ea16e4cfeda586ad390c3be7`  
**Implementation baseline:** `6bc436f2789341b95c3800d8a82cfe7dbed6c78e`  
**Repository proof HEAD:** `5e22d610024e0b5ba46acda481e3f11f111eed28`  
**Date:** 2026-09-28

## REAL NOW

Fresh GitHub revalidation before this slice:

- `origin/main = 1ff2825cfe5dd630ea16e4cfeda586ad390c3be7`;
- PR #554 = merged;
- PR #555 = merged;
- PR #556 = merged;
- PR #557 = merged into the current `main`;
- exact PR #557 head `6dd347ace12b0043ee0dcae7c9c11ce11fada957` completed 8/8 workflow runs with success;
- PR #525 remains OPEN, unmerged and non-mergeable on an old base; it is historical only;
- no newer open Commercial CRM PR was found;
- stale CRM branches inspected were either far behind/diverged or already represented by squash-merged work in `main`.

The ledger and current-state documents mark MED-CRM-001 through MED-CRM-008 RELEASED.

Runtime was not queried again for this design choice. The dependencies used by this decision are already recorded as RELEASED, and the question here is the current canonical source/read contract. Runtime will be required again for the eventual release gate of this slice.

## Proven source contract

### Activity persistence

`public.crm_lead_activities` stores:

- `activity_type`;
- `actor_id`;
- `actor_kind`;
- generic `metadata jsonb`;
- `created_at`.

Authenticated browser table DML/read remains closed; activity access is through SECURITY DEFINER projections.

### Current reader

`list_current_clinic_crm_lead_activities(uuid)`:

- uses `crm_current_reader_clinic_id()`;
- validates the requested non-deleted Lead is in the current clinic;
- is executable by `authenticated`;
- returns `actor_id`, `actor_kind` and raw `metadata`.

`crm_current_reader_clinic_id()` allows the current active-profile roles:

- owner;
- admin;
- professional;
- recep;
- financeiro;

and requires `crm.access`.

### Identity-resolution authority mismatch

`list_current_clinic_crm_contact_identity_candidates(text,text)` uses `crm_current_mutator_clinic_id()`, so candidate preview is writer-scoped to owner/admin/recep.

The final identity resolver persists activity metadata containing:

- `resolution_mode`;
- requested Contact ID;
- resolved Contact ID;
- `candidate_ids`;
- match reasons;
- optional free-text distinct reason.

Therefore the generic activity reader can transport writer-scope identity-resolution internals to broader CRM reader roles.

### Stage activity metadata

The stage-transition command persists:

- from stage ID;
- to stage ID;
- stage kind;
- loss-reason code/detail for lost transitions.

The current Board needs only from/to stage IDs from activity metadata. Lead loss fields are separately part of the canonical Lead projection, so this evidence does not claim that loss detail is inaccessible elsewhere.

### MED-CRM-007 frontend behavior

The current adapter receives an `ActivityRow` containing raw `actor_id`, `actor_kind` and `metadata`, then maps only:

- activity ID/type/time;
- from/to stage IDs for stage changes;
- `resolution_mode` for identity resolution.

Current frontend tests deliberately inject values such as actor UUIDs, candidate IDs, a Patient-like ID and free-text secret markers, then prove they are absent from the mapped frontend shape.

That proves the frontend is currently a sanitization layer, but it also proves the raw payload has already reached browser code.

## Doctrine evidence

`docs/doctrine/sistema-vivo.md` requires minimization: a surface should receive what it needs, not everything merely because it is available.

`docs/doctrine/autoridade-e-fronteiras.md` requires explicit domain authority, server-side tenant boundaries and deliberate control over which data crosses boundaries.

The selected slice moves minimization into the existing server read boundary while preserving the frontend allowlist as defense in depth.

## Candidate gaps re-audited

### Pipeline / Stage administration

- schema: exists;
- read projections: exist;
- writers: no administration command set proved;
- UI: selector/Board only, no admin;
- authorization foundations reusable;
- missing: create/edit/archive/reorder/default semantics and live-Lead compatibility;
- size/risk: materially larger than read-boundary hardening.

### Lost reason / reporting

- Lead fields exist;
- stage command enforces a reason for lost;
- Board captures free-text detail;
- no canonical tenant reason taxonomy/catalog/reporting authority proved;
- client-side taxonomy would create authority by convenience.

### Follow-up / next action

- no Lead next-action/task aggregate proved;
- existing automation/outbox is not automatically a Lead follow-up authority;
- would require separate Event/Async reuse audit, ownership/time semantics and recovery/idempotency.

### Inbox / Conversation

- current message center/outbox is Patient/appointment/waitlist oriented;
- no canonical Lead Conversation aggregate/handoff authority proved;
- reusing Patient messaging persistence as Lead Inbox authority would collapse domain boundaries.

### Attribution

- `crm_leads.source` exists as a manual commercial label;
- no campaign/click/acquisition/conversion chain is proved;
- a real attribution capability needs a separate model and provider boundaries.

### Lead → Patient

- no conversion authority exists;
- Patient registry and Contact↔Patient link are separate foundations;
- doctrine requires explicit, audited and idempotent conversion;
- this crosses the clinical identity boundary and is not a safe incidental CRM extension.

## SECOND ADVERSARIAL REVIEW evidence

JEV advisory route:

```text
deep_review = 0.87
proceed_fast = 0.09
block = 0.03
split_task = 0.01
confidence = 0.82
```

Deterministic review then narrowed the proposal to the same existing RPC and same return shape, with full storage unchanged.

## Repository implementation proof

- design PR #558 exact HEAD `182d33fe5d566aaa2cf808b3df33e6992c38fc3e` completed 20/20 workflow runs successfully and was protected-squash-merged as `main@6bc436f2789341b95c3800d8a82cfe7dbed6c78e`;
- repository consumer audit proved the product path is `src/lib/commercialCrm.ts` → `CommercialCrmBoard`, and that the Board does not require actor UUID or raw metadata;
- Contact Identity Resolution retry reads canonical `crm_lead_activities` directly; stage-transition and Lead-details writers do not consume the read RPC;
- implementation PR #559 uses an additive follow-up migration and preserves RPC signature/row type/ACL/tenant guard/storage;
- the structural verifier proves signature/ACL/STABLE/SECURITY DEFINER/search-path/tenant guard, projection allowlist, no Patient/write authority and raw DML closure;
- behavioral cases prove bounded projection for owner/admin/recep/professional/financeiro, cross-tenant deny, anonymous deny, inactive/no-profile deny, missing `crm.access` deny, unknown metadata fail-closed and canonical stored metadata intact;
- the dedicated MED-CRM-009 workflow passed PostgreSQL 16 and PostgreSQL 17;
- Contact Identity Resolution PG16/17 regression passed, including concurrency proof;
- Lead Details PG16/17 regression passed;
- exact implementation HEAD `5e22d610024e0b5ba46acda481e3f11f111eed28` completed **11/11 applicable workflows with success**;
- `Clinical workflow CI / validate` passed `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`; `dependency-audit` passed.

During proof construction, CI exposed three harness-fixture issues which were corrected without weakening product invariants: the shared concurrency script test-database allowlist omitted the new isolated DB; an initial fixture attempted a second `contact_identity_resolved` event on one Lead and was correctly rejected by the existing exactly-once constraint; inactive/no-profile deny uses canonical `no_data_found` in addition to permission-deny paths. The final exact HEAD is green after those corrections.

**Repository conclusion:** MED-CRM-009 is PROVED at repository level. It is not yet MERGED and not RELEASED.

## Runtime evidence required for RELEASED

- production current function pre-readback;
- exact hash-pinned migration/verifier;
- governed rollout;
- pinned production verifier + relevant CRM regressions;
- frontend/timeline readback and public route health;
- authenticated human interaction only if actually executed.
