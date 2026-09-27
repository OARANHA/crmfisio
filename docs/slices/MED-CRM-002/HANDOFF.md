# MED-CRM-002 — Handoff

## Start here

1. `docs/CANONICAL_INDEX.md`
2. `AGENTS.md`
3. `docs/CURRENT_STATE.md`
4. `docs/SLICE_EXECUTION_METHOD.md`
5. `docs/SLICE_LEDGER.md`
6. `docs/slices/MED-CRM-001/NEXT_CAPABILITY_MAP.md`
7. `docs/slices/MED-CRM-002/README.md`
8. `docs/slices/MED-CRM-002/EVIDENCE.md`
9. `docs/slices/MED-CRM-003/HANDOFF.md`

Resolve current `origin/main` again before acting.

## State

```text
MED-CRM-002
PROVED
MERGED (#524 → main@7a8badf5ad81e92746e82bedd142ba75899a4080)
NOT RELEASED
```

Final repository proof:

- executable proof head: `1d7655d3e282962f8ebc5760f3f2b17f84c73bf5`;
- final PR head: `cf94434ca5294e4e9cc4de70661268d9e4765045`;
- PostgreSQL 16.15/17.11 — SUCCESS;
- MED-CRM-001 + MED-CRM-002 verifiers — PASS;
- 13 behavior cases — PASS;
- final PR workflows — 21/21 SUCCESS;
- required `validate` / `dependency-audit` — SUCCESS;
- reviews/threads — 0/0;
- squash merge readback — confirmed.

No production rollout was proved. Keep status below RELEASED.

MED-CRM-002 is not the active implementation slice. Continue at [MED-CRM-003 HANDOFF](../MED-CRM-003/HANDOFF.md). Do not append Board/UI, intake, follow-up, Inbox, attribution, conversion, automation or AI to MED-CRM-002.
