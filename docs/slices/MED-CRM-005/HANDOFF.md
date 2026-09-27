# MED-CRM-005 — Handoff

## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

Revalidate these values before acting; they are a checkpoint, not inherited authority.

```text
base audited = main@cae02c03345302737e8738a77da6841224659518
branch = feat/med-crm-005-prospect-intake-v1
implementation proof head before docs = c2650234615cd4fd77dfcebd4a8e830a37b3415b

MED-CRM-001 = RELEASED
MED-CRM-002 = RELEASED
MED-CRM-003 = RELEASED
MED-CRM-004 = RELEASED
MED-CRM-005 = PROVED ON BRANCH / NOT MERGED / NOT RELEASED
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

## Next gate

Do not call this slice MERGED or RELEASED yet.

1. resolve current `main` and current branch HEAD;
2. open/revalidate the PR;
3. wait for all applicable final-HEAD checks;
4. verify 0 behind / mergeability / reviews / threads;
5. protected squash merge with expected HEAD only when all gates are green;
6. re-resolve `main`;
7. prove frontend production rollout/readback;
8. only then reconcile institutional docs to RELEASED.

If a new chat is needed, revalidate these facts and update this HANDOFF before generating the next-chat prompt.
