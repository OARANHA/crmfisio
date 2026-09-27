# MED-CRM-002 — Handoff

## Start here

1. `docs/CANONICAL_INDEX.md`
2. `AGENTS.md`
3. `docs/CURRENT_STATE.md`
4. `docs/SLICE_EXECUTION_METHOD.md`
5. `docs/SLICE_LEDGER.md`
6. `docs/doctrine/README.md`
7. `docs/doctrine/sistema-vivo.md`
8. `docs/doctrine/autoridade-e-fronteiras.md`
9. `docs/doctrine/ia-humano-operacao.md`
10. `docs/slices/MED-CRM-001/NEXT_CAPABILITY_MAP.md`
11. `docs/slices/MED-CRM-002/README.md`
12. `docs/slices/MED-CRM-002/DECISION.md`
13. `docs/slices/MED-CRM-002/EVIDENCE.md`

Then resolve current `origin/main`, active PR/head/checks/diff and reconstruct ESTADO ATUAL COMPROVADO. Do not use any SHA below as an instruction to checkout without revalidation.

## Current canonical checkpoint

Revalidated before this handoff:

- `origin/main = 652ea7b3aea4cd03a09944b780ef697168016bc3`;
- PR #524 is **OPEN**, not merged;
- branch: `feat/med-crm-002-commercial-command-boundary`;
- pre-handoff PR head: `48f585577b5b59f36517652bb806cdf0a62ec36d`;
- base: `main@652ea7b3aea4cd03a09944b780ef697168016bc3`;
- compare: **33 ahead / 0 behind**;
- GitHub reports `mergeable=true`;
- reviews: 0;
- review threads: 0;
- current ruleset on `main` requires squash PR + status checks `validate` and `dependency-audit`; no approving review is required.

## Current slice

- ID: MED-CRM-002
- status: **IMPLEMENTING**
- objective: canonical Contact/Lead/stage mutation boundary
- PR: #524
- no production rollout implied
- `PROVED != MERGED != RELEASED`

## Scope already implemented

Exactly the designed Commercial Core write boundary:

- internal current-clinic CRM mutator guard;
- authenticated Contact creation;
- authenticated Lead creation;
- authenticated same-pipeline Lead stage transition;
- commercial activity + audit side effects;
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

## Validation history — important distinction

Earlier executable head `18ba481866a3af8412cfc200621290d3358a2b5e` passed:

- PostgreSQL 16.15 disposable harness — GREEN;
- PostgreSQL 17.11 disposable harness — GREEN;
- migration replay;
- MED-CRM-001 verifier;
- MED-CRM-002 verifier;
- then-current behavior cases;
- 8/8 repository workflows SUCCESS.

That evidence is **not sufficient for the current executable head** because a later adversarial review found one real lifecycle gap:

- anonymized Contact must not be replayed as active;
- anonymized Contact must not receive a new Lead.

The command migration/verifier/cases were hardened for `anonymized_at`, and behavior coverage increased to 13 cases.

Therefore, do **not** promote the slice to PROVED based on the older PostgreSQL proof.

## Current blocking evidence

A dedicated workflow was added:

`Commercial CRM Command Boundary`

Run on head `48f585577b5b59f36517652bb806cdf0a62ec36d`:

- workflow run: `36285041270`;
- PostgreSQL 16 job: **FAILURE**;
- PostgreSQL 17 job: **FAILURE**;
- checkout: SUCCESS;
- isolated DB creation: SUCCESS;
- failing step in both jobs: **Run Commercial CRM foundation + command boundary proof**.

The available GitHub connector exposed job/step status but not raw job logs in this session. The next chat must inspect the Actions failure output (or reproduce the harness locally/isolated) before changing code.

At the same checkpoint, required ruleset checks `validate` and `dependency-audit` were not yet present as completed check-runs for the current head. Revalidate them; do not infer success from older heads.

## Gates

Completed before execution:

- GAPS;
- CAPABILITY AUTHORITY / REUSE GATE;
- DECISION;
- SECOND ADVERSARIAL REVIEW.

Execution exists, but validation is **not closed** on the latest executable state.

Current methodological state:

```text
GAPS
→ REUSE GATE
→ DECISION
→ SECOND ADVERSARIAL REVIEW
→ EXECUTION
→ VALIDATION  ← ACTIVE / FAILING CI
→ DOCUMENTATION
```

## Exact next step

1. resolve current `origin/main`, PR #524 head/base/diff/mergeability again;
2. read the current GitHub Actions failure for workflow `Commercial CRM Command Boundary`;
3. diagnose the common PostgreSQL 16/17 harness failure without weakening tenant/RLS/RBAC/clinical boundaries;
4. fix only the proven defect;
5. rerun/revalidate:
   - Commercial CRM PostgreSQL 16;
   - Commercial CRM PostgreSQL 17;
   - `validate`;
   - `dependency-audit`;
   - reviews/threads;
   - diff against current main;
6. only when the latest executable head is green, perform the final adversarial completion review;
7. then decide whether MED-CRM-002 is PROVED;
8. merge decision remains separate;
9. after any merge, confirm integration in `main` but do **not** infer production rollout;
10. only then return to `NEXT_CAPABILITY_MAP.md` and select the next slice through a fresh GAPS + REUSE GATE.

Do not start Board/UI, Inbox, follow-up, attribution, Lead→Patient conversion or AI while PR #524 validation is red.
