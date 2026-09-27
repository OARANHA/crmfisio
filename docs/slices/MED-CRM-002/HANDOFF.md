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

Then resolve current `origin/main`, PR #524/head/base/diff/checks/reviews/merge state. Mutable facts below are a checkpoint, never an instruction to trust an old SHA.

## Proven executable checkpoint

- base at proof: `main@652ea7b3aea4cd03a09944b780ef697168016bc3`;
- implementation-proven head: `1d7655d3e282962f8ebc5760f3f2b17f84c73bf5`;
- PR: #524 — `feat/med-crm-002-commercial-command-boundary`;
- compare at proof: 36 ahead / 0 behind;
- mergeable: true;
- reviews: 0;
- review threads: 0;
- main ruleset: squash only; required `validate` + `dependency-audit`; zero approving reviews required.

## Slice state

```text
MED-CRM-002
PROVED
NOT MERGED
NOT RELEASED
```

The proof decision and merge decision are separate.

## Scope proved

Exactly the designed Commercial Core mutation boundary:

- internal current-clinic CRM mutator guard;
- authenticated Contact creation;
- authenticated Lead creation;
- authenticated same-pipeline Lead stage transition;
- commercial activity + audit side effects;
- anonymized Contact cannot be replayed as active or receive a new Lead;
- no new table/column/domain engine;
- no Patient link/conversion;
- no Patient/Encounter/Patient Journey mutation;
- no CRM board/UI cutover;
- no Inbox/follow-up/attribution/AI/provider/automation engine.

Authority reused:

- `current_active_profile()`;
- `crm.access`;
- canonical `owner/admin/recep` writer roles;
- MED-CRM-001 Contact/Lead/Pipeline/Stage/Activity model and constraints;
- `audit_log`.

## Latest validation

Dedicated workflow `Commercial CRM Command Boundary`, run `36286051483`, on executable head `1d7655d...`:

- PostgreSQL 16.15 — SUCCESS;
- PostgreSQL 17.11 — SUCCESS;
- migration replay — PASS;
- MED-CRM-001 verifier — PASS;
- MED-CRM-002 verifier — PASS;
- 13 behavior cases — PASS;
- anonymized Contact case executed — PASS.

Ruleset gates on the same executable head:

- `validate` — SUCCESS;
- `dependency-audit` — SUCCESS.

The prior red CI was diagnosed from raw job logs. Both versions failed at behavior-case line 172 on `DO $`. Commit `0161da...` introduced that malformed test delimiter. The correction changed only `DO $` / `END $;` to `DO $$` / `END $$;`; no domain/security code changed.

Final JEV completion review: `complete=0.89`, confidence `0.84`. Advisory only.

## Methodological state

```text
GAPS
→ CAPABILITY AUTHORITY / REUSE GATE
→ DECISION
→ SECOND ADVERSARIAL REVIEW
→ EXECUTION
→ VALIDATION
→ DOCUMENTATION
```

VALIDATION is closed for the executable proof above. This handoff is the documentation reconciliation.

## Exact next step

1. revalidate the live PR head after this documentation commit;
2. require `Commercial CRM PostgreSQL 16/17`, `validate` and `dependency-audit` green on the applicable final head/equivalent executable proof;
3. confirm 0 behind or explicitly reconcile, mergeable, no reviews/threads and final diff in scope;
4. make a separate merge decision;
5. if merge is approved, use squash only and confirm the resulting `main` integration;
6. do not declare RELEASED without production rollout/runtime proof;
7. only after integration, rebuild `NEXT_CAPABILITY_MAP.md` against the new main before selecting another micro-slice through fresh GAPS → REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW.

Do not start Board/UI, pre-clinical intake, follow-up, Inbox, attribution, Lead→Patient conversion, CRM automation or commercial AI before #524 is correctly integrated.
