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

Then resolve current `origin/main`, active PR/head/checks/diff and reconstruct ESTADO ATUAL COMPROVADO.

## Current slice

- ID: MED-CRM-002
- status: PROVED
- base at design: `main@652ea7b3aea4cd03a09944b780ef697168016bc3`
- branch: `feat/med-crm-002-commercial-command-boundary`
- objective: canonical Contact/Lead/stage mutation boundary
- implementation-proven head: `18ba481866a3af8412cfc200621290d3358a2b5e`;
- PR: #524;
- PostgreSQL 16.15: GREEN;
- PostgreSQL 17.11: GREEN;
- repository workflows on implementation-proven head: 8/8 SUCCESS;
- no production rollout implied; `PROVED != MERGED != RELEASED`

## Gates completed

- GAPS: Commercial Core has read foundation but no canonical mutation commands.
- REUSE GATE: reuse tenant/active profile, `crm.access`, CRM tables/triggers, `audit_log`; do not rebuild Agenda/Finance/channel/automation.
- DECISION: three commands only.
- SECOND ADVERSARIAL REVIEW: initial deep_review; refined guard returned allow with low confidence, recorded in README.
- EXECUTION: exactly three authenticated Commercial Core commands + internal mutator guard; no new table/engine/UI/provider/Patient mutation.
- VALIDATION: migration replay, old foundation verifier, new verifier and 12 behavior blocks GREEN on PostgreSQL 16.15 and 17.11; final JEV completion = complete 0.92 / confidence 0.87.
- DOCUMENTATION: README/DECISION/EVIDENCE/HANDOFF + ledger/current-state reconciliation.

## Exact next step

1. resolve current `origin/main` and current PR #524 head;
2. confirm the latest documentation-only head is still 0 behind, mergeable and has all required workflows SUCCESS;
3. confirm no new review/thread or executable diff appeared after `18ba481866a3af8412cfc200621290d3358a2b5e`;
4. if clean, make/execute the merge decision for #524;
5. after merge, confirm integration in `main` but do **not** infer production rollout;
6. then choose the next slice from the capability map only after a fresh GAPS + REUSE GATE review.

Likely high-value candidates after #524 are the Commercial Board/pre-clinical intake cutover and Lead next-action/follow-up, but neither is pre-approved by this handoff.

Do not add board/UI, Inbox, follow-up, attribution, conversion or AI to PR #524.
