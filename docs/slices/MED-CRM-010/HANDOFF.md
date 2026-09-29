# MED-CRM-010 — Handoff

## Current checkpoint

**Slice:** MED-CRM-010 — Pipeline / Stage Administration Contract V1  
**Institutional status after this docs PR merges:** APPROVED  
**Current main before this docs PR:** `17298d78e910951e8c719906b3305579d24ce0b0`  
**Execution:** NOT AUTHORIZED  
**Branch:** `docs/med-crm-010-product-contract-review`

PR #562 is merged. Its protected squash result is `main@17298d78e910951e8c719906b3305579d24ce0b0`.

This handoff records a Product Contract decision, not an implementation authorization.

## Gate status

```text
REAL NOW / PROVEN EVIDENCE       CLOSED FOR PRODUCT CONTRACT
GAPS                             CLOSED
CAPABILITY AUTHORITY / REUSE     CLOSED
DECISION                         CLOSED: PRODUCT CONTRACT APPROVED
SECOND ADVERSARIAL REVIEW        CLOSED FOR PRODUCT CONTRACT
EXECUTION                        NOT AUTHORIZED
VALIDATION                       DOCS + REPOSITORY EVIDENCE ONLY
DOCUMENTATION                    THIS DOCS-ONLY BRANCH
```

## Seven approved decisions

1. Pipeline archive blocks nonterminal Leads; terminal historical Leads may remain frozen/read-only; no last-active archive; default archive requires atomic explicit replacement.
2. Stage archive blocks any referenced nondeleted Lead and blocks the last active open Stage.
3. Exactly one active default while active Pipelines exist; transfer is atomic and stale-aware.
4. Pipeline creation is atomic active Pipeline + ordered initial Stages with at least one open Stage; no draft-via-archive.
5. `stage_kind` is immutable after creation in V1.
6. Reorder is one atomic server command with expected-order precondition and collision-safe two-phase rewrite.
7. V1 exposes archive/restore, not authenticated physical delete.

## Authority

Reuse:

- current active profile / current clinic;
- `crm.access`;
- current Pipeline/Stage schema and read projections;
- `audit_log`;
- raw Commercial table closure.

Future CRM configuration authority:

- owner/admin only;
- server-derived clinic;
- internal helper, not browser tenant selector;
- no platform_admin shortcut;
- no Patient authority;
- no second entitlement or audit path.

Do not reuse `crm_current_mutator_clinic_id()` directly for config because it includes `recep`.

## New adversarial finding that must be designed before code

New admin locks are insufficient unless RELEASED writers serialize with them.

The next design must prove:

- current-clinic config lock order;
- compatible lock in `create_current_clinic_crm_lead(...)` before selecting/using default Pipeline and initial Stage;
- compatible target-Stage lock in `transition_current_clinic_crm_lead_stage(...)`;
- preservation of existing Pipeline/Stage locks in `update_current_clinic_crm_lead_details(...)`;
- no deadlock and no regression of exact retry behavior.

Identity Resolution composes Lead creation, so do not duplicate that authority.

## Next safe gate — Implementation Plan Review

Reconstruct current `origin/main`, this branch/PR and checks first.

Before DESIGNED/EXECUTION, document and adversarially review:

1. exact helper/RPC names and signatures;
2. parameters + server-derived tenant;
3. deterministic lock order;
4. retry/idempotency/precondition matrix;
5. reorder implementation;
6. audit actions/metadata;
7. additive migration plan;
8. positive behavioral tests;
9. RBAC negative tests;
10. cross-tenant negative tests;
11. disabled-`crm.access` tests;
12. raw-DML closure tests;
13. regressions for existing CRM commands/intake/details;
14. PostgreSQL harness/verifier policy.

Only after that review closes may MED-CRM-010 move APPROVED → DESIGNED.

No migration, RPC, frontend or production mutation is authorized by this handoff.
