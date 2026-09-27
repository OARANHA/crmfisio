# MED-CRM-003 — Handoff

## Current canonical checkpoint

Always resolve current `origin/main`, open PRs and runtime again before acting. The checkpoint below is institutional memory, not a checkout instruction.

```text
canonical repository = OARANHA/crmfisio
checkpoint main = 72a60262d09a14ce8382f3da9db12afcd15a8464

MED-CRM-001 = PROVED + MERGED + RELEASED
MED-CRM-002 = PROVED + MERGED + RELEASED

MED-CRM-003 = ANALYZED
DEEP REVIEW = CLOSED WITH PREREQUISITE GAP
SECOND ADVERSARIAL REVIEW = BLOCK
EXECUTION = FORBIDDEN
```

The production backend release was proved on `28server` / `supabase-db` and is already documented in the MED-CRM-001/002 slice evidence. Do not repeat that rollout merely to continue this slice.

## Deep-review closure — choice C

Current main/source/migrations/tests were re-read after #532. The frontend concerns around multi-pipeline selection, archived-stage targeting, lost reason, anonymized Contact presentation, read-only roles, Patient-domain separation and refetch-after-command all have bounded frontend designs.

However, a prior server contract gap blocks the Board:

```text
crm_pipelines.archived_at IS NOT NULL
+
crm_stages.archived_at IS NULL
        ↓
transition_current_clinic_crm_lead_stage(...)
does not check crm_pipelines.archived_at
        ↓
authorized writer can still transition a Lead inside an archived pipeline
```

Therefore a frontend-only “archived pipeline = read-only” rule would become a bypassable domain authority. That is not allowed.

Decision:

```text
A) frontend-only MED-CRM-003 now   NO
B) split Board implementation      NO
C) prior contract missing          YES
```

See [EVIDENCE.md](EVIDENCE.md) and [DECISION.md](DECISION.md).

## Stale historical PR

PR #525 (`docs/med-crm-002-merged-med-crm-003-design`) is historical input only.

At this checkpoint:

```text
PR #525 = OPEN
head = c00364b1395cdaf911c70cc56db03c7831b4c2ac
compare vs current main = diverged
ahead = 2
behind = 7
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
  → choice C: prior command contract is missing
  → frontend-only Board is not authorized

SECOND ADVERSARIAL REVIEW
  → CLOSED AS BLOCK
  → deterministic blocker: archived pipeline is not rejected by the canonical transition RPC

EXECUTION
  → NOT STARTED
  → FORBIDDEN until prerequisite server contract is proved
```

Latest advisory review after isolating the archived-pipeline server contract gap:

```text
route = block
block = 0.70
deep_review = 0.29
split_task = 0.01
proceed_fast = 0.00
confidence = 0.59
```

JEV is advisory. Deterministic repository/runtime evidence remains authoritative.

## Exact next-chat task

The next chat must **not start MED-CRM-003 implementation**.

First:

1. revalidate current `origin/main`, PR #525 and any newer CRM PR/branch;
2. re-read [EVIDENCE.md](EVIDENCE.md), [DECISION.md](DECISION.md) and the released MED-CRM-002 command contract;
3. create/identify a separate prerequisite slice only after its own GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW;
4. that prerequisite must make the canonical transition command fail closed when the Lead/current pipeline is archived, with verifier + PostgreSQL behavioral case;
5. validate and, if production is changed, prove rollout/readback before calling the prerequisite RELEASED;
6. only then reconstruct MED-CRM-003 from current main and re-run its four pre-execution gates.

Do not hide the gap with a frontend-only guard.

Do not add Contact/Lead creation UI, intake rewrite, Contact edit/merge/dedupe, Lead→Patient conversion, Inbox, follow-up, attribution, provider changes, automation or Commercial AI to MED-CRM-003.

## Handoff refresh — 2026-09-27

Immediately before this handoff refresh was committed, the repository was revalidated again:

```text
origin/main = 72a60262d09a14ce8382f3da9db12afcd15a8464
PR #533 = OPEN + mergeable
PR #533 base = main @ 72a60262d09a14ce8382f3da9db12afcd15a8464
PR #533 head before this refresh = dbf0003533263bb28644eea45c178a40ab38f6ca
PR #533 workflows on that head = 20 completed / 20 success
PR #525 = OPEN historical input only
```

This refresh commit itself advances the #533 head, so the successful workflow set above is evidence for `dbf0003533263bb28644eea45c178a40ab38f6ca`, not automatic certification of the new head. The next chat must re-read the actual #533 head and its checks before merging it.

No product code, migration, RPC, schema, role, entitlement or runtime was changed by this refresh. No slice status is promoted. MED-CRM-003 remains `ANALYZED`, its second adversarial review remains `BLOCK`, and feature execution remains forbidden until the archived-pipeline server-contract prerequisite is separately gated, proved and released as applicable.
