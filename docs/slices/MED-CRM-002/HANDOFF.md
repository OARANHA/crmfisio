# MED-CRM-002 — Handoff

## Start here

1. `docs/CANONICAL_INDEX.md`
2. `AGENTS.md`
3. `docs/CURRENT_STATE.md`
4. `docs/WORK_MASTER_PROMPT.md`
5. `docs/WORK_CONTEXT.md`
6. `docs/SLICE_EXECUTION_METHOD.md`
7. `docs/SLICE_LEDGER.md`
8. `docs/doctrine/README.md`
9. `docs/doctrine/sistema-vivo.md`
10. `docs/doctrine/autoridade-e-fronteiras.md`
11. `docs/slices/MED-CRM-001/NEXT_CAPABILITY_MAP.md`
12. `docs/slices/MED-CRM-002/README.md`
13. `docs/slices/MED-CRM-002/DECISION.md`
14. `docs/slices/MED-CRM-002/EVIDENCE.md`

Then resolve current `origin/main` and runtime evidence again. Do not use the SHA below as a future checkout instruction without revalidation.

## Canonical checkpoint

```text
main = 7a8badf5ad81e92746e82bedd142ba75899a4080
PR #524 = MERGED (squash)
final PR head = cf94434ca5294e4e9cc4de70661268d9e4765045
MED-CRM-002 = PROVED + MERGED
MED-CRM-002 = NOT RELEASED
```

Final PR validation:

- 21/21 repository workflows SUCCESS;
- Commercial CRM PostgreSQL 16.15 — SUCCESS;
- Commercial CRM PostgreSQL 17.11 — SUCCESS;
- `validate` — SUCCESS;
- `dependency-audit` — SUCCESS;
- reviews: 0;
- review threads: 0.

## Scope integrated

Exactly the canonical Commercial Core mutation boundary:

- current-clinic mutator guard;
- Contact creation;
- Lead creation;
- same-pipeline Lead stage transition;
- activity + audit parity;
- anonymized Contact cannot be replayed or receive a new Lead;
- no new table/column/domain engine;
- no Patient link/conversion;
- no Patient/Encounter/Patient Journey mutation;
- no Board/Inbox/follow-up/attribution/provider/AI/automation engine.

## Release boundary

Repository merge is not rollout proof.

The current `medicspro-agent` target can run controlled workspace processes but does not expose production database/container access, so this session cannot prove that #522/#524 migrations are installed in production. Do not mark RELEASED from GitHub evidence alone.

## Post-merge capability decision

The capability map was reaudited against `main@7a8badf5...`.

The strongest product conflict is still the legacy Patient-backed commercial board in `src/pages/Crm.tsx`, which reads `patients.funilStage` and writes through `setFunilStage`.

A proposed next slice, **CRM Board Cutover V1**, was adversarially reviewed with the current evidence. JEV returned:

```text
block: 0.98
deep_review: 0.02
confidence: 0.97
```

Reason preserved: the canonical Commercial Core/commands are merged but their production installation is not proved. Therefore Board execution is not authorized yet.

## Exact next step

1. obtain production database/readback authority;
2. prove whether #522 and #524 are already installed;
3. if absent, run the controlled migration rollout + verifiers/readback;
4. only then mark MED-CRM-001/002 RELEASED when evidence supports it;
5. reconstruct the capability map once more after runtime proof;
6. re-run GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW for the next feature.

Do not start Board/UI, pre-clinical intake, follow-up, Inbox, attribution, Lead→Patient conversion, CRM automation or commercial AI before the release gate closes.
