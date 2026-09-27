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

Then resolve current `origin/main`, active PR/head/checks/diff and reconstruct ESTADO ATUAL COMPROVADO.

## Current slice

- ID: MED-CRM-002
- status: IMPLEMENTING
- base at design: `main@652ea7b3aea4cd03a09944b780ef697168016bc3`
- branch: `feat/med-crm-002-commercial-command-boundary`
- objective: canonical Contact/Lead/stage mutation boundary
- no production rollout implied

## Gates completed

- GAPS: Commercial Core has read foundation but no canonical mutation commands.
- REUSE GATE: reuse tenant/active profile, `crm.access`, CRM tables/triggers, `audit_log`; do not rebuild Agenda/Finance/channel/automation.
- DECISION: three commands only.
- SECOND ADVERSARIAL REVIEW: initial deep_review; refined guard returned allow with low confidence, recorded in README.

## Exact next step

Implement the SQL migration, verifier, behavior cases and isolated harness exactly within the documented scope. Run database proofs before moving to PROVED.

Do not start board/UI, Inbox, follow-up, attribution, conversion or AI from this branch.
