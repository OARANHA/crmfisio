# MED-CRM-003 — Evidence

**Date:** 2026-09-27  
**Canonical main reconstructed before execution:** `01a2b947e13144a885549c248acceb25021c36a2`  
**Implementation PR:** #536 — `feat: cut over commercial CRM board`  
**Status:** PROVED ON BRANCH / NOT MERGED / NOT RELEASED

## REAL NOW before execution

PR #535 was revalidated on its actual final HEAD and merged only after all applicable checks were `completed + success`.

```text
PR #535 final pre-merge head =
20cf35c34e467d7843a84ea766a3014596592215

PR #535 checks =
20 workflow runs
20 success
0 failed

squash merge / resulting main =
01a2b947e13144a885549c248acceb25021c36a2
```

PR #525 remained OPEN and non-mergeable historical material and was not used as implementation authority or base.

No newer active CRM PR superseded MED-CRM-003 at reconstruction time.

## Proven source conflict

On `main@01a2b947...`, `src/pages/Crm.tsx` still implemented the visible commercial Board through:

```text
usePatients()
→ Patient[]
→ funilStage
→ setFunilStage()
```

and also derived a `leads no funil` metric from Patient state.

The released Commercial CRM authority remained:

```text
Contact
→ Lead
→ crm_pipelines
→ crm_stages
→ list_current_clinic_crm_pipelines()
→ list_current_clinic_crm_stages(uuid)
→ list_current_clinic_crm_leads()
→ transition_current_clinic_crm_lead_stage(...)
```

`CrmOperational.tsx` continued to compose `TreatmentContinuityWatch`; NPS and churn in `Crm.tsx` remained Patient-domain.

## Released authority revalidated

### Read authority

`crm_current_reader_clinic_id()` derives the active current clinic server-side and requires `crm.access`.

The released projections expose:

- active and archived pipelines, including `is_default` and `archived_at`;
- active and archived stages, including `pipeline_id`, `stage_kind`, `position` and `archived_at`;
- non-deleted Leads joined to Contact/Pipeline/Stage, including Contact PII fields, `contact_patient_id`, `contact_anonymized_at`, pipeline/stage identity and stage semantics.

### Mutation authority

`transition_current_clinic_crm_lead_stage(...)` remains the single reused stage-transition writer:

- tenant/current clinic is server-derived;
- writers remain `owner | admin | recep`;
- `crm.access` remains mandatory;
- Lead is locked;
- cross-pipeline target is rejected;
- archived target stage is rejected;
- lost reason remains mandatory;
- terminal fields are derived server-side;
- activity + audit are emitted server-side;
- raw authenticated Commercial CRM DML remains closed.

### MED-CRM-004 prerequisite proof

The RELEASED MED-CRM-004 guard now rejects a real state-changing transition when the Lead's current pipeline is archived, while preserving exact same-stage side-effect-free retry idempotency.

Therefore archived-pipeline read-only presentation is no longer a browser-only domain invariant.

## Deterministic deep review

The following points were re-proved before execution:

- multiple active non-default pipelines are valid; at most one active default exists;
- live Leads have tenant-preserving FKs to Contact/Pipeline/Stage with restrictive Lead references, so legacy context is not expected to disappear through ordinary referenced-row deletion;
- Lead rows do not carry pipeline/stage archive timestamps themselves, but the complete Pipeline/Stage projections allow correlation by ID;
- an anonymized Contact projection may still carry raw Contact fields, so the UI must actively suppress them;
- `contact_patient_id` is not authorization or Patient navigation authority;
- the lost invariant accepts a nonblank reason code or detail, so this slice can send a trimmed free-form `p_lost_reason_detail` without inventing taxonomy;
- `isOperationalRole()` is appropriate only as presentation affordance; the RPC remains authorization authority;
- the repository already has an established command-versus-projection pattern where post-COMMIT refresh failure is stale UI state rather than command failure.

## Gates

### GAPS

Closed for the bounded Board slice. The remaining product gap was frontend cutover, not missing backend authority.

### CAPABILITY AUTHORITY / REUSE

Closed by reusing only released RPCs/tenant/role/entitlement/audit capabilities. No parallel authority was created.

### DECISION

Closed as one frontend-only micro-slice.

### SECOND ADVERSARIAL REVIEW

Initial advisory result:

```text
deep_review = 0.72
proceed_fast = 0.26
block = 0.01
split_task = 0.01
confidence = 0.63
```

After deterministic deep review:

```text
proceed_fast = 0.83
deep_review = 0.15
block = 0.02
split_task = 0.00
confidence = 0.76
```

No deterministic blocker remained.

## EXECUTION evidence

A fresh branch was created from exact canonical main:

```text
branch = feat/med-crm-003-commercial-board-cutover-v1
base = 01a2b947e13144a885549c248acceb25021c36a2
```

Implementation files before documentation reconciliation:

```text
src/lib/commercialCrm.ts
src/lib/commercialCrm.test.ts
src/lib/commercialCrmFrontendBoundary.test.js
src/components/CommercialCrmBoard.tsx
src/components/CommercialCrmBoard.test.tsx
src/pages/Crm.tsx
```

No migration, schema, RPC, table, RLS policy, grant, role, entitlement, tenant source, provider, automation or AI file was changed.

### Adapter boundary

`commercialCrm.ts` calls only:

```text
list_current_clinic_crm_pipelines
list_current_clinic_crm_stages
list_current_clinic_crm_leads
transition_current_clinic_crm_lead_stage
```

It performs no raw table DML.

### Board behavior

The implementation:

- lists every active pipeline in an explicit selector;
- selects the active default initially when present;
- uses only active stages as mutation columns/targets;
- keeps archived pipeline/stage Leads in an explicit read-only legacy section;
- collects a mandatory trimmed loss reason before invoking a lost transition;
- hides Contact name/phone/email and free-form Lead title when the Contact is anonymized;
- creates no Patient navigation from `contact_patient_id`;
- exposes mutation affordances only to `owner | admin | recep`;
- leaves `professional | financeiro` read-only;
- delegates the actual mutation to the canonical RPC;
- refetches canonical projections after command success;
- reports post-COMMIT refetch failure as a stale-projection warning;
- does not treat optimistic client state as authority;
- removes Patient `funilStage` / `setFunilStage()` from the commercial Board;
- keeps NPS/churn/Treatment Continuity in Patient-domain.

A generic transition transport/RPC error deliberately avoids asserting that persistence definitely did or did not happen; the UI instructs the user to refresh before retry.

## VALIDATION evidence

### Controlled workspace

The branch was cloned into the allowlisted MedicsPro operational workspace and `npm ci` completed successfully.

The first focused test run produced:

```text
15 passed
2 failed
```

Both failures were test-harness defects:

1. a React serialization assertion expected adjacent text nodes as one JSON string;
2. the Modal test ran in Node without a `window` stub.

Those harness issues were corrected.

### First GitHub CI attempt

The full `npm test` passed, including the new Board/adapter/boundary tests.

Typecheck then caught test-fixture types inferred too narrowly from `null` literals. The fixture was explicitly typed as `CommercialCrmSnapshot` and the head advanced.

### Proven implementation head before this docs refresh

```text
50ff38ff1427f71b30c62120b26259838a6b94b0
```

On that HEAD, the current GitHub evidence was:

```text
npm test            SUCCESS
typecheck           SUCCESS
lint                SUCCESS
production build    SUCCESS
dependency-audit    SUCCESS

GitHub check-runs:
9 completed
9 success
0 failed
```

The production build transformed 1919 modules and completed successfully. The existing bundle-size warning remained a warning, not a build failure.

The new tests cover at minimum:

- every active pipeline + default initial selection;
- writer versus read-only role presentation;
- anonymized Contact without rendered PII or free-form Lead title;
- archived pipeline/stage Lead remains visible read-only;
- lost stage cannot invoke the command before a non-empty reason;
- only canonical released CRM RPCs are used;
- no raw Commercial CRM table DML;
- no `setFunilStage`/Patient-stage commercial writer;
- no Patient navigation in the commercial Board;
- post-COMMIT projection failure remains stale projection instead of command failure.

## Post-implementation review

Advisory completion review:

```text
verify_more = 0.67
incomplete = 0.22
complete = 0.11
confidence = 0.51
```

The remaining verification items supplied to that review were deliberately:

- institutional documentation reconciliation;
- merge proof;
- production frontend deployment/readback.

No new deterministic implementation blocker was identified.

## DOCUMENTATION boundary

This evidence update occurs after the implementation HEAD above. Therefore it will create a newer PR HEAD and **must cause a fresh final-head GitHub validation before merge**. The 9/9 success set above must not be inherited by the documentation commit automatically.

`docs/CURRENT_STATE.md` is intentionally not rewritten to claim integrated Board state before PR #536 merges. Main still owns current integrated state.

## Status

```text
MED-CRM-003 = PROVED ON BRANCH
PR #536 = OPEN
MERGED = NO
RELEASED = NO
```

RELEASED requires production frontend rollout/readback after merge. There is no database rollout in this slice.
