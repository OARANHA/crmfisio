# MED-CRM-003 — Handoff

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
12. `docs/slices/MED-CRM-002/HANDOFF.md`
13. `docs/slices/MED-CRM-003/README.md`
14. `docs/slices/MED-CRM-003/DECISION.md`
15. `docs/slices/MED-CRM-003/EVIDENCE.md`

Then resolve current `origin/main` and active PRs.

## State

```text
MED-CRM-003
DESIGNED
NOT IMPLEMENTING
NOT PROVED
NOT RELEASED
```

Design base: `main@7a8badf5ad81e92746e82bedd142ba75899a4080`.

Scope: replace only the Patient-backed commercial funnel block in `/crm` with canonical Lead/Stage projections + existing transition command.

Preserve Patient Treatment Continuity/NPS/churn. No Contact/Lead creation, intake rewrite, conversion, backend/schema/RPC, follow-up, Inbox, attribution, provider, automation or AI.

## Gates

GAPS, REUSE GATE, DECISION and SECOND ADVERSARIAL REVIEW are complete for the design-base state only.

Before EXECUTION:

1. revalidate main;
2. check concurrent PRs touching `/crm`/Commercial Core;
3. re-read `Crm.tsx`, `App.tsx`, `permissions.ts`, `supabaseClient.ts` and CRM RPC signatures;
4. confirm frontend-only scope still holds;
5. rerun the four gates if any material fact changed;
6. otherwise create the implementation branch/PR and validate no Patient-stage writes/raw CRM DML before promotion.

No feature implementation occurred in this design checkpoint.
