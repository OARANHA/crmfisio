# MED-CRM-005 — Handoff

## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

**Institutional main after release reconciliation:** `42c8f181c0605a2a966a4bb19603527e05fc8a77` (`docs: reconcile MED-CRM-005 production release (#539)`).

Revalidate these values before acting; they are a checkpoint, not inherited authority.

```text
base audited = main@cae02c03345302737e8738a77da6841224659518
implementation PR = #538
final PR head = 6df9f1ba39b474454fe33ee93d0143677cd12f6d
merge/main = 004fcb2c6c60ff7611bf6c1156e90edaac27ae9a
production entry = /assets/index-B0iT1ZY2.js
production CRM chunk = /assets/CrmOperational-D1hSbB77.js
institutional reconciliation PR = #539
institutional main after #539 = 42c8f181c0605a2a966a4bb19603527e05fc8a77
active next CRM slice = NONE (must be selected through fresh gates)

MED-CRM-001 = RELEASED
MED-CRM-002 = RELEASED
MED-CRM-003 = RELEASED
MED-CRM-004 = RELEASED
MED-CRM-005 = PROVED + MERGED + RELEASED
```

## Four gates

### GAPS — CLOSED FOR BOUNDED SLICE

The released Commercial Board had no product path to create a pre-clinical prospect.

### CAPABILITY AUTHORITY / REUSE — CLOSED

Reuse only MED-CRM-002:

- `create_current_clinic_crm_contact(...)`
- `create_current_clinic_crm_lead(...)`

No new RPC/table/migration/writer/tenant authority.

### DECISION — CLOSED

Frontend-only `Novo prospect` in `/crm` with stable Contact/Lead UUIDs across retry.

### SECOND ADVERSARIAL REVIEW — CLOSED

The first composite-RPC proposal was rejected by the reuse analysis. Final frontend-only reuse design received advisory `proceed_fast = 0.61`; deterministic released contracts remain authority.

## Implemented boundary

- Contact name required;
- phone/email optional;
- Lead title required;
- active pipeline required;
- no user-selected initial stage/owner/value/source;
- no Patient creation/navigation;
- owner/admin/recep UI writer affordance;
- professional/financeiro read-only;
- server commands remain final authorization authority;
- canonical projection refetch after success;
- stale-projection warning if only the refetch fails.

## Validation

Final controlled workspace proof on the implementation checkpoint:

```text
focused tests = 22/22 PASS
full suite = 128 files / 690 tests PASS
typecheck = PASS
lint = PASS
build = PASS
npm audit --audit-level=high = PASS
```

Two moderate pre-existing Vitest/@vitest-mocker advisories remain; their available fix is a breaking major upgrade.

## Merge and release proof

PR #538 was revalidated on exact final HEAD `6df9f1ba39b474454fe33ee93d0143677cd12f6d`:

```text
base = current main@cae02c03345302737e8738a77da6841224659518
behind = 0
mergeable = true
reviews = 0
review threads = 0
8/8 workflows = completed + success
validate = success
dependency-audit = success
```

Protected squash merge produced `main@004fcb2c6c60ff7611bf6c1156e90edaac27ae9a`.

Production readback then proved:

```text
entry = /assets/index-B0iT1ZY2.js
CRM chunk = /assets/CrmOperational-D1hSbB77.js
create_current_clinic_crm_contact = PRESENT
create_current_clinic_crm_lead = PRESENT
Novo prospect = PRESENT
create_current_clinic_crm_prospect = ABSENT
addPatient = ABSENT
create_patient = ABSENT
/ /crm /agenda /pacientes = HTTP 200
```

No database rollout or manual production mutation exists for this slice.

## Next product gate

MED-CRM-005 is closed and its post-release reconciliation is integrated in `main@42c8f181c0605a2a966a4bb19603527e05fc8a77`. Do not reopen it merely because a new chat starts.

There is **no active successor CRM slice yet**. The next chat must begin by reconstructing current gaps and selecting the next capability through the four mandatory gates; it must not infer MED-CRM-006 or any other scope from this handoff.

Fresh PR revalidation before this handoff refresh also confirmed PR #525 remains historical/open, unmerged and non-mergeable. It is not an implementation base or authority.

Before selecting the next Commercial CRM capability:

1. resolve current `origin/main` and active PRs again;
2. read `CURRENT_STATE.md`, `SLICE_LEDGER.md` and MED-CRM-005 evidence;
3. reconstruct current code/schema/test/runtime gaps;
4. run GAPS → CAPABILITY AUTHORITY / REUSE → DECISION → SECOND ADVERSARIAL REVIEW;
5. preserve Contact != Lead != Patient and the released CRM writers.

If a new chat is needed, revalidate main/PR/checks and update this HANDOFF before generating the prompt.
