# MED-CRM-003 — Handoff

## Current canonical checkpoint

Always resolve current `origin/main`, open PRs and runtime again before acting. The checkpoint below is institutional memory, not a checkout instruction.

```text
canonical repository = OARANHA/crmfisio
checkpoint main = 64bc983686886d3bcca0ed2ca93feb05538e096b

MED-CRM-001 = PROVED + MERGED + RELEASED
MED-CRM-002 = PROVED + MERGED + RELEASED

MED-CRM-003 = ANALYZED
SECOND ADVERSARIAL REVIEW = OPEN / DEEP REVIEW
EXECUTION = FORBIDDEN UNTIL REVIEW CLOSES
```

The production backend release was proved on `28server` / `supabase-db` and is already documented in the MED-CRM-001/002 slice evidence. Do not repeat that rollout merely to continue this slice.

## Stale historical PR

PR #525 (`docs/med-crm-002-merged-med-crm-003-design`) is historical input only.

At this checkpoint:

```text
PR #525 = OPEN
head = c00364b1395cdaf911c70cc56db03c7831b4c2ac
compare vs current main = diverged
ahead = 2
behind = 6
mergeable = false
```

Its old checks were successful, but they belong to the stale head and do not authorize current MED-CRM-003 execution. Do not merge, rebase blindly or treat #525 as current design authority.

## Proven current source conflict

Current `src/pages/Crm.tsx` still uses:

```text
usePatients()
→ Patient[]
→ patients.funil_stage
→ setFunilStage()
```

for the visible CRM board and Patient-derived `leads no funil` metric.

The released commercial authority is:

```text
Contact
→ Lead
→ crm_pipelines
→ crm_stages
→ list_current_clinic_crm_*
→ transition_current_clinic_crm_lead_stage(...)
```

`CrmOperational.tsx` separately composes `TreatmentContinuityWatch`. NPS and churn content inside `Crm.tsx` are Patient-domain content and must not be reinterpreted as Commercial Lead state.

## Existing authority to reuse

Backend authority already exists and is RELEASED:

- `list_current_clinic_crm_pipelines()`;
- `list_current_clinic_crm_stages(uuid)`;
- `list_current_clinic_crm_leads()`;
- `transition_current_clinic_crm_lead_stage(...)`;
- `crm.access`;
- active profile + canonical tenant;
- writer roles `owner | admin | recep`;
- read-only roles `professional | financeiro`;
- activity/audit emitted by the canonical stage-transition command.

Do not create a new CRM writer, raw table DML path, tenant source, entitlement, role or audit authority.

## Current candidate decision

The current candidate remains a **frontend-only CRM Board Cutover V1**.

Possible bounded scope:

1. add a narrow frontend adapter/types for the existing released CRM RPCs;
2. replace only the Patient-backed commercial board block with Lead/Pipeline/Stage projections;
3. remove all `setFunilStage` use from the commercial board;
4. replace the Patient-derived commercial lead metric with canonical Lead data;
5. keep Treatment Continuity, NPS and churn as Patient-domain sections;
6. refetch canonical projections after successful mutation rather than inventing client-side authority.

This is still a candidate, not execution authorization.

## Deep-review issues that must close before EXECUTION

### 1. Multiple pipelines

The schema allows multiple active pipelines while permitting at most one active default pipeline.

A safe board must not silently hide non-default active pipelines. The current design direction is:

- show active pipelines through a selector;
- select the active default first when one exists;
- no pipeline administration in this slice.

### 2. Archived pipeline/stage state

Read projections expose archived objects while transition commands reject archived target stages.

The UI must:

- never offer archived stages as mutation targets;
- never silently drop Leads whose current pipeline/stage is archived or otherwise legacy;
- surface those Leads in an explicit read-only legacy/archived state or equivalent bounded presentation.

### 3. Lost-stage reason

The canonical transition command requires a loss reason for `stage_kind='lost'`.

The UI must collect a non-empty reason before invoking the RPC. Reuse the repository's existing `Modal + Field + Input` interaction pattern; do not weaken the DB invariant and do not use raw table writes.

### 4. Contact anonymization / privacy

The canonical Lead projection exposes `contact_anonymized_at`.

If a Contact is anonymized, the board must not render Contact PII such as name, phone or email. Use a neutral anonymized presentation.

`contact_patient_id` must not create automatic Patient navigation/link semantics in this slice.

### 5. Authorization presentation

`isOperationalRole(owner|admin|recep)` may control mutation affordances only.

Server RPCs remain authority for tenant, role, entitlement, stage invariants, activity and audit. `professional` and `financeiro` stay read-only.

### 6. Test boundary

Follow existing repository test patterns:

- Vitest;
- `react-test-renderer`;
- mocked current-user/RPC adapters;
- tests for operational vs read-only roles;
- anonymized Contact without PII;
- lost transition requires reason;
- archived target cannot be offered;
- legacy/archived Lead remains visible;
- no `setFunilStage`/Patient-stage mutation path in the commercial board.

## Mandatory discipline state

```text
GAPS
  → current Patient-backed board conflicts with released Commercial Core

CAPABILITY AUTHORITY / REUSE GATE
  → reuse released CRM projections + transition command
  → no new backend/domain authority

DECISION
  → frontend-only Board Cutover remains the candidate

SECOND ADVERSARIAL REVIEW
  → NOT CLOSED
  → latest review route = deep_review
  → execution must not start yet

EXECUTION
  → NOT STARTED
```

Latest advisory review after privacy/archive/lost-reason refinements:

```text
route = deep_review
deep_review = 0.62
proceed_fast = 0.28
split_task = 0.10
block = 0.00
confidence = 0.49
```

JEV is advisory. Deterministic repository/runtime evidence remains authoritative.

## Exact next-chat task

The next chat must **not start implementation immediately**.

First:

1. revalidate current `origin/main`, PR #525 and any newer CRM PR/branch;
2. re-read this HANDOFF and the released MED-CRM-001/002 evidence;
3. re-read current `Crm.tsx`, `CrmOperational.tsx`, `App.tsx`, `permissions.ts`, `supabaseClient.ts` and the four released CRM RPC contracts;
4. finish the deep review around multi-pipeline/archived state/privacy/lost reason/testability;
5. decide whether the scope can remain a single frontend-only micro-slice or must split;
6. run a fresh SECOND ADVERSARIAL REVIEW;
7. only if that review closes the gate may MED-CRM-003 enter EXECUTION.

Do not add Contact/Lead creation UI, intake rewrite, Contact edit/merge/dedupe, Lead→Patient conversion, Inbox, follow-up, attribution, provider changes, automation or Commercial AI to MED-CRM-003.
