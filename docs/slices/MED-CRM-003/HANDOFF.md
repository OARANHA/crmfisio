# MED-CRM-003 — Handoff

## Current canonical checkpoint

Always resolve current `origin/main`, open PRs and runtime again before acting. The checkpoint below is institutional memory, not a checkout instruction.

```text
canonical repository = OARANHA/crmfisio
checkpoint main after MED-CRM-004 merge = bc667edced77e6f96f3ba1584c48c83dbfcb05e2

MED-CRM-001 = PROVED + MERGED + RELEASED
MED-CRM-002 = PROVED + MERGED + RELEASED

MED-CRM-003 = ANALYZED
PREREQUISITE GAP = CLOSED BY MED-CRM-004 RELEASED
PREVIOUS SECOND ADVERSARIAL REVIEW = HISTORICAL BLOCK
EXECUTION = NOT AUTHORIZED UNTIL FRESH FOUR-GATE REVIEW
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

## Released prerequisite — MED-CRM-004

The archived-pipeline server-contract gap isolated by the MED-CRM-003 deep review is now closed.

```text
MED-CRM-004 = Archived Pipeline Transition Guard
implementation PR #534 = MERGED
merge/main = bc667edced77e6f96f3ba1584c48c83dbfcb05e2
production rollout = COMPLETE
pinned read-only verifier = PASSED
status = RELEASED
```

The released canonical transition command now fails closed for a real stage change when the Lead's current pipeline is archived, while preserving exact same-stage side-effect-free retry idempotency. The release introduced no alternate CRM writer and did not touch the Board/frontend.

This removes the specific prerequisite blocker. It does not revive the old Board decision automatically. MED-CRM-003 must be reconstructed from current main and pass fresh GAPS → CAPABILITY AUTHORITY / REUSE → DECISION → SECOND ADVERSARIAL REVIEW before execution.

See `../MED-CRM-004/README.md`, `DECISION.md`, `EVIDENCE.md` and `HANDOFF.md` in that slice.

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
  → MUST BE REBUILT against current main after MED-CRM-004 release

CAPABILITY AUTHORITY / REUSE GATE
  → expected authority remains released CRM projections + canonical transition command
  → must be revalidated against current source before execution

DECISION
  → previous choice C served its purpose; prerequisite is now RELEASED
  → Board decision must be made again from current evidence

SECOND ADVERSARIAL REVIEW
  → previous BLOCK is historical evidence, not current authorization
  → run a fresh review after GAPS / REUSE / DECISION close

EXECUTION
  → NOT AUTHORIZED YET
```

JEV remains advisory. Deterministic repository/runtime evidence is authoritative.

## Exact next-chat task

Do not inherit the pre-prerequisite decision mechanically.

First:

1. revalidate current `origin/main`, PR #525 and any newer CRM PR/branch;
2. reread MED-CRM-003 `EVIDENCE.md` / `DECISION.md`, MED-CRM-002 released command contract and MED-CRM-004 release evidence;
3. rebuild GAPS from current frontend + schema + RPC + tests;
4. close CAPABILITY AUTHORITY / REUSE without creating a new CRM writer, tenant source, entitlement, role or audit path;
5. make a fresh DECISION for the bounded Board cutover;
6. run a fresh SECOND ADVERSARIAL REVIEW;
7. only if all four gates close, execute the smallest Board slice and validate it.

Expected Board boundaries remain: active-pipeline selector, archived/legacy Lead visibility read-only, archived stages never mutation targets, lost reason before lost transition, anonymized Contact without PII, no automatic Patient navigation from `contact_patient_id`, owner/admin/recep mutation affordances only, professional/financeiro read-only, canonical RPC authority, refetch after successful mutation, and Patient-domain NPS/churn/Treatment Continuity kept separate.

Do not add Contact/Lead creation UI, intake rewrite, Contact edit/merge/dedupe, Lead→Patient conversion, Inbox, follow-up, attribution, provider changes, automation or Commercial AI to MED-CRM-003.

## Handoff refresh — 2026-09-27

Immediately before generating the next-chat handoff, the repository was revalidated again:

```text
origin/main = bc667edced77e6f96f3ba1584c48c83dbfcb05e2
PR #535 = OPEN + mergeable
PR #535 base = main @ bc667edced77e6f96f3ba1584c48c83dbfcb05e2
PR #535 head before this refresh = dabcc972c98778dc9216605f26718c89a107e76b
PR #535 workflows on that head = 20 completed / 20 success / 0 failed
PR #525 = OPEN historical input only / mergeable=false
MED-CRM-004 runtime = RELEASED with pinned read-only production verifier PASS
```

This handoff refresh itself advances the #535 head, so the 20/20 green workflow set above certifies `dabcc972c98778dc9216605f26718c89a107e76b`, not this new documentation commit automatically. The next chat must re-read the actual #535 head and its checks before merge.

No product code, migration, RPC, schema, role, entitlement or runtime is changed by this refresh.

Exact continuation order:

1. revalidate current `origin/main`, PR #535 current HEAD/mergeability/checks and PR #525 status;
2. merge #535 only if its current HEAD is still based on current main, mergeable and every applicable check is completed + success;
3. re-resolve `origin/main` after merge and read the canonical MED-CRM-003 + MED-CRM-004 docs from main;
4. reconstruct MED-CRM-003 from current code/schema/tests;
5. execute GAPS → CAPABILITY AUTHORITY / REUSE → DECISION → SECOND ADVERSARIAL REVIEW;
6. do not start Board implementation unless all four gates close on current evidence.

MED-CRM-004 release removes the specific archived-pipeline prerequisite. It does not itself authorize MED-CRM-003 execution.
