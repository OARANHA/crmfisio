# MED-CRM-005 — Evidence

**Date:** 2026-09-27  
**Canonical base:** `cae02c03345302737e8738a77da6841224659518`  
**Branch:** `feat/med-crm-005-prospect-intake-v1`  
**Status:** PROVED ON BRANCH / NOT MERGED / NOT RELEASED

## REAL NOW reconstructed before execution

MED-CRM-001/002/003/004 were RELEASED on canonical main.

The Commercial Board already used canonical Lead/Pipeline/Stage projections and stage-transition authority, but `src/lib/commercialCrm.ts` and `CommercialCrmBoard.tsx` had no Contact/Lead creation path.

`ReceptionPatients.tsx` remained a separate Patient-domain workflow and was intentionally excluded.

PR #525 remained stale historical material and was not used as base or authority.

## Released authority proved and reused

MED-CRM-002 already provides browser-facing:

- `create_current_clinic_crm_contact(...)`;
- `create_current_clinic_crm_lead(...)`.

Both derive current tenant server-side, require active profile + `crm.access`, enforce `owner | admin | recep`, and are exact-retry idempotent on caller-supplied aggregate UUIDs.

The Lead command validates the same-tenant non-deleted/non-anonymized Contact, validates an active pipeline and, with `p_stage_id = null`, selects the first active `open` stage.

No new mutation authority was required.

## EXECUTION

Implementation proof HEAD before documentation refresh:

`c2650234615cd4fd77dfcebd4a8e830a37b3415b`

Code/test files:

- `src/lib/commercialCrm.ts`
- `src/lib/commercialCrm.test.ts`
- `src/lib/commercialCrmFrontendBoundary.test.js`
- `src/components/CommercialCrmBoard.tsx`
- `src/components/CommercialCrmBoard.test.tsx`

The adapter calls the two released creation RPCs and performs no raw CRM table DML.

The Board generates `contactId` and `leadId` once when a draft opens. A failed/uncertain attempt keeps the modal and IDs, so retry reuses the exact same command identities.

No `clinic_id`, `patient_id`, stage choice, owner, value or source authority is introduced by the UI.

## VALIDATION

The first local `npm ci` attempt failed before tests because the isolated broker could not create the default npm cache:

```text
ENOENT: mkdir '/var/lib/wandora-exec/.npm'
```

This was an environment error. HOME and npm cache were redirected into the allowlisted workspace, after which `npm ci` installed 286 packages successfully.

First focused run:

```text
20 passed
2 failed
```

Both failures were boundary-test assertions:

- one incorrectly treated existing read-only `contact_patient_id` projection text as a creation parameter;
- one located the prospect refresh instead of the later transition refresh.

The harness was corrected.

Typecheck then found a real nullable-snapshot defect in `openProspect`; the implementation was fixed to choose from already-derived active pipelines.

Final controlled validation:

```text
focused CRM tests:
3 files passed
22 tests passed

full npm test:
128 files passed
690 tests passed

typecheck = PASS
lint = PASS
production build = PASS
process exit = 0
```

Production build transformed 1919 modules and completed successfully. Existing bundle-size warnings remained non-fatal.

Dependency audit:

```text
npm audit --audit-level=high = exit 0
2 moderate advisories = Vitest/@vitest-mocker
high/critical gate = PASS
```

No dependency upgrade was introduced because the available fix requires a breaking Vitest major upgrade and is outside this slice.

## Boundary proof

Tests prove at minimum:

- only released Contact + Lead creation RPCs are used;
- no composite Prospect RPC is introduced;
- no raw Commercial CRM DML is introduced;
- role presentation keeps professional read-only and recep writer affordance;
- retry reuses identical Contact + Lead UUIDs;
- no Patient creation path is added;
- active pipeline projection remains the source for selection;
- post-persist projection refresh failure remains stale UI state.

## Remaining gates

Before merge:

- open PR from the current branch;
- revalidate exact final HEAD against current main;
- require all applicable current-head GitHub checks to complete successfully;
- verify reviews/threads and mergeability;
- merge only with expected-head protection.

Before RELEASED:

- observe production frontend auto-deploy;
- verify live CRM lazy chunk includes the new prospect-intake markers and released creation RPC names;
- verify public route health.

There is no DB rollout in this slice.
