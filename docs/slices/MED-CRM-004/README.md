# MED-CRM-004 — Archived Pipeline Transition Guard

**Status:** RELEASED
**Base audited:** `main@2bcadc00a730eb9a1c1c063a688ccebf8982ce35`
**Depends on:** MED-CRM-001 + MED-CRM-002 RELEASED
**Unblocks:** fresh re-analysis of MED-CRM-003; execution still requires its own four gates

## Purpose

Close the server-side prerequisite found by the MED-CRM-003 deep review.

Today the canonical stage-transition RPC validates tenant, writer role, `crm.access`, Lead, same-pipeline target stage and target-stage archival state, but the RELEASED contract does not reject a state-changing transition when the Lead's current `crm_pipelines` row is archived while its stages remain active.

This slice hardens the existing command. It does not create a second CRM authority.

## Scope

- additive follow-up migration only;
- `CREATE OR REPLACE` the existing `transition_current_clinic_crm_lead_stage(...)`;
- fail closed for state-changing transitions when the current pipeline is archived;
- serialize the active-pipeline check against concurrent pipeline archive with a row lock;
- preserve exact same-stage side-effect-free retries;
- preserve tenant/RBAC/entitlement, same-pipeline, archived-stage, lost-reason, activity/audit and Patient boundaries;
- add a dedicated verifier;
- add PostgreSQL behavioral proof;
- run the existing MED-CRM-002 regression contract in the same harness;
- prove PostgreSQL 16 and 17.

## Non-goals

No MED-CRM-003 Board/frontend work. No Contact/Lead creation UI, intake rewrite, pipeline administration, Lead→Patient conversion, Inbox, follow-up, provider/Evolution, automation, AI/MCP/RAG, new role, entitlement, tenant source, table or parallel RPC.

## Acceptance

The slice cannot become PROVED until mechanical validation shows:

1. valid active-pipeline transition still works through the released regression suite;
2. archived current pipeline rejects an actual stage change server-side;
3. archived target stage remains rejected;
4. cross-pipeline remains rejected;
5. lost-reason and exact retry idempotency remain intact;
6. tenant / auth / role / `crm.access` remain intact;
7. valid transitions still emit activity + audit;
8. rejected archived-pipeline transition emits neither;
9. Patient / Patient Journey remain untouched;
10. migration replay and dedicated verifier pass;
11. PostgreSQL 16 and 17 harnesses pass.

### Validation checkpoint

On final PR #534 head `8b0c4c331c78f09e472f83567c59bde2a258790e`:

- dedicated PostgreSQL guard workflow: PostgreSQL 16 SUCCESS + PostgreSQL 17 SUCCESS;
- all 21 GitHub workflow runs for that exact head: SUCCESS;
- local workspace: 125 test files / 668 tests PASS;
- `npm run typecheck`: PASS;
- `npm run lint`: PASS;
- `npm run build`: PASS;
- `bash -n` and `git diff --check`: PASS.

PR #534 was squash-merged as `main@bc667edced77e6f96f3ba1584c48c83dbfcb05e2`.

Production rollout was then performed through the governed managed-admin path. Pre-rollout pinned readback failed on the missing archived-pipeline guard, proving the production RPC had not yet received this slice. The canonical migration artifact was hash-verified before application, applied transactionally with stop-on-error, and the separate pinned read-only verifier then returned:

```text
COMMERCIAL CRM ARCHIVED PIPELINE TRANSITION GUARD VERIFY PASSED
```

Therefore MED-CRM-004 is RELEASED for this bounded server-side contract. This does not authorize MED-CRM-003 execution; that slice must be reconstructed from current main and rerun GAPS → CAPABILITY AUTHORITY / REUSE → DECISION → SECOND ADVERSARIAL REVIEW.
