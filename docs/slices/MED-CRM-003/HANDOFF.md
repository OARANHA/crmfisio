# MED-CRM-003 — Handoff

## Current checkpoint

Always resolve current `origin/main`, PR #536 HEAD/base/checks and runtime again before acting. This document is institutional memory, not permission to inherit stale checks.

```text
canonical repository = OARANHA/crmfisio

main after MED-CRM-003 merge =
9962a14cb31ff09666234129590b59524a2d85c3

MED-CRM-001 = RELEASED
MED-CRM-002 = RELEASED
MED-CRM-004 = RELEASED

MED-CRM-003 = PROVED + MERGED
PR #536 = MERGED
merge/main = 9962a14cb31ff09666234129590b59524a2d85c3
RELEASED = NO
```

PR #525 remains stale historical material. Do not merge it, rebase it blindly or use it as implementation authority.

## Fresh four-gate result

After PR #535 was safely merged, MED-CRM-003 was reconstructed from the resulting main.

### GAPS — CLOSED FOR BOUNDED SLICE

Canonical main still had the visible Board backed by:

```text
Patient[]
→ patients.funil_stage
→ setFunilStage()
```

while the released commercial authority is Contact → Lead → Pipeline → Stage.

The remaining gap was the frontend cutover. No missing server capability remained after MED-CRM-004.

### CAPABILITY AUTHORITY / REUSE — CLOSED

The implementation reuses only:

- `list_current_clinic_crm_pipelines()`;
- `list_current_clinic_crm_stages(uuid)`;
- `list_current_clinic_crm_leads()`;
- `transition_current_clinic_crm_lead_stage(...)`;
- server-derived current tenant;
- `crm.access`;
- canonical roles;
- canonical activity/audit side effects.

No new CRM writer, raw table DML, tenant authority, entitlement, role or audit path is introduced.

### DECISION — CLOSED

One frontend-only Commercial Board Cutover V1 remained the smallest correct slice.

### SECOND ADVERSARIAL REVIEW — CLOSED

Initial advisory JEV requested deeper review:

```text
deep_review = 0.72
proceed_fast = 0.26
block = 0.01
```

Deterministic deep review then closed the identified concerns, and the fresh advisory route became:

```text
proceed_fast = 0.83
deep_review = 0.15
block = 0.02
```

JEV is advisory. Code/schema/tests provided the execution authority.

## Implementation boundary

PR #536, branch:

```text
feat/med-crm-003-commercial-board-cutover-v1
```

implements:

- canonical Commercial CRM adapter over released RPCs only;
- all active pipelines explicit, default only initial selection;
- archived pipeline/stage Leads visible in read-only legacy section;
- archived stages never offered as mutation targets;
- required lost reason before transition;
- anonymized Contact with PII and free-form Lead title suppressed;
- no automatic Patient navigation from `contact_patient_id`;
- owner/admin/recep mutation affordance;
- professional/financeiro read-only;
- server RPC authority preserved;
- refetch after successful command;
- post-COMMIT refetch failure treated as stale projection warning;
- Patient NPS/churn/Treatment Continuity kept in Patient-domain;
- no `setFunilStage()` authority in commercial Board.

No backend/schema/migration/RPC/table/RLS/role/entitlement/provider/automation/AI change is part of this slice.

## Proven implementation HEAD before documentation refresh

Before updating MED-CRM-003 documentation, PR #536 was at:

```text
head = 50ff38ff1427f71b30c62120b26259838a6b94b0
base = main@01a2b947e13144a885549c248acceb25021c36a2
behind main = 0
mergeable = true
```

and GitHub proved:

```text
9 check-runs completed
9 success
0 failed

npm test = SUCCESS
typecheck = SUCCESS
lint = SUCCESS
build = SUCCESS
dependency-audit = SUCCESS
```

The first CI attempt had caught a test-fixture typing issue after tests passed. It was fixed; the proof above belongs to the corrected implementation HEAD.

## Merge proof

The documentation refresh moved PR #536 to final HEAD:

```text
2f0d8bc3cf9a7b61677abc053a64218d120dacf6
```

That exact HEAD was revalidated before merge:

```text
base = current main@01a2b947e13144a885549c248acceb25021c36a2
behind = 0
mergeable = true
reviews = 0
review threads = 0
9/9 check-runs = completed + success
```

The PR was then squash-merged with expected-head protection:

```text
main = 9962a14cb31ff09666234129590b59524a2d85c3
```

Do not repeat or re-merge #536.

## Current release gate

MED-CRM-003 has no database rollout.

Immediate post-merge public readback showed the application healthy but still serving the pre-MED-CRM-003 bundle:

```text
asset = /assets/index-D1eGcOhA.js

list_current_clinic_crm_pipelines        ABSENT
transition_current_clinic_crm_lead_stage ABSENT
Leads arquivados / legado                ABSENT
Contato anonimizado                      ABSENT

/           HTTP 200
/crm        HTTP 200
/agenda     HTTP 200
/pacientes  HTTP 200
```

So MED-CRM-003 is **PROVED + MERGED / NOT RELEASED** at this checkpoint.

Do not call it RELEASED merely because GitHub merged.

The canonical deploy guide and recent production evidence show the frontend is Docker/Portainer-operated and previous frontend-only merges may auto-deploy. Prefer observing that auto-update first. Prove the deployed production frontend corresponds to the merged main and that the CRM route is healthy.

Production proof should be sufficient to establish that the deployed bundle contains the Commercial CRM cutover and that there is no unexpected runtime failure on the production route. Do not weaken authentication/privacy boundaries just to obtain evidence.

If the Portainer auto-update does not promote this main and a manual frontend promotion becomes necessary, reconstruct the exact current stack/source path first. Any managed-admin mutation requires its explicit approval; do not guess a compose path or execute a broad Docker action.

After rollout/readback, update:

- `docs/CURRENT_STATE.md`;
- `docs/SLICE_LEDGER.md`;
- MED-CRM-003 `EVIDENCE.md`;
- MED-CRM-003 `HANDOFF.md`;

and only then consider `RELEASED`.

## Non-goals remain

Do not add in this slice:

- Contact/Lead creation UI;
- intake rewrite;
- Contact edit/merge/dedupe;
- Lead→Patient conversion;
- Inbox;
- follow-up engine;
- attribution;
- provider/Evolution changes;
- automation;
- Commercial AI/MCP/RAG;
- pipeline administration.

## Required checkpoint format

When reporting the next material checkpoint:

```text
REAL NOW
PROVEN EVIDENCE
GAPS
CAPABILITY AUTHORITY / REUSE
DECISION
SECOND ADVERSARIAL REVIEW
EXECUTION
VALIDATION
DOCUMENTATION
NEXT GATE
```

Do not declare GREEN, PROVED, MERGED or RELEASED without evidence at the level claimed.
