# P0 — #388 / #389 Verifier Reconciliation — 2026-09-15

## Status

**CLOSED IN REPOSITORY / NO PRODUCTION MUTATION.**

Base reviewed: `main@16cb7c048f177f2f61c2ea744eb3e31504c42103`

Branch: `docs/p0-388-389-verifier-reconciliation`

## Problem

Canonical beta documents still described the historical #388 verifier as incompatible with the later #389 resolution RPC. That description no longer matched the repository.

The current #388 verifier is composition-aware. It accepts the historical pre-#389 state and, when the canonical resolver exists, validates the approved resolution surface instead of demanding its absence.

## Decision → second review → execution

**Decision:** fix the stale verifier debt before opening another product feature.

**Second review:** inspecting the real verifier and the #389 harness showed that the code-side reconciliation was already implemented. Changing SQL again would duplicate work and could weaken a gate that is already correct.

**Execution:** re-run the existing effective-stack proof on isolated PostgreSQL 16 and reconcile documentation only.

## Validation executed

Command path: `scripts/test-financial-exception-resolution.sh`.

Observed on 2026-09-15:

1. #388 verifier passed before #389 exists;
2. #389 migration applied twice;
3. #388 verifier passed again after #389 exists;
4. #389 verifier passed;
5. `CHARGE` and `WAIVE` behavioral cases passed;
6. resolution concurrency/idempotency passed;
7. negative controls for reception authorization, `financeiro` `WAIVE`, missing materialization, mutable disposition, payment duplication and cross-tenant behavior failed as expected.

The harness completed with exit code `0`.

## Security / data impact

No production database, RLS, RPC, Edge Function, migration or application runtime was changed. The test ran in a disposable PostgreSQL 16 container in the auxiliary workspace.

The proof preserves the intended contract:

```text
#388 detection queue remains directly immutable
#389 resolver is the only approved audited resolution surface
owner/admin    -> CHARGE | WAIVE
financeiro     -> CHARGE
recep/professional -> no resolution action
cross-tenant   -> deny
```

## What remains open

This closes only the obsolete verifier-debt item. It does **not** prove other production/operational P0 evidence.

The #394 post-finalization read-only inspection was subsequently observed and closed on 2026-09-15 in `docs/P0_394_POST_FINALIZATION_READONLY_20260915.md`.

Still open unless later evidence exists:

- real production/human `CHARGE` and `WAIVE` smoke;
- role/mobile/direct-URL privacy-shell smoke;
- minimum beta observability.

Those must be closed from observed runtime evidence, never inferred from this harness.
