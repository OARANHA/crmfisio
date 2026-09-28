# MED-CRM-009 — Handoff

## Implementation PROVED checkpoint — 2026-09-28

Fresh state before this documentation refresh:

- canonical repository: `OARANHA/crmfisio`;
- `origin/main = 6bc436f2789341b95c3800d8a82cfe7dbed6c78e`;
- design PR #558 = MERGED;
- design exact HEAD `182d33fe5d566aaa2cf808b3df33e6992c38fc3e` = 20/20 workflow runs success before protected squash merge;
- implementation PR #559 = OPEN / unmerged / mergeable;
- implementation branch: `feat/med-crm-009-lead-activity-read-boundary`;
- exact implementation proof HEAD before this documentation refresh: `5e22d610024e0b5ba46acda481e3f11f111eed28`;
- compare at proof time: 8 commits ahead / 0 behind before this documentation commit is added;
- product scope: same activity-reader RPC hardening; no frontend, writer, Patient, tenant, role, entitlement or parallel-reader authority;
- exact proof HEAD: **11/11 applicable workflow runs completed + success**;
- dedicated MED-CRM-009 PostgreSQL 16 + 17 jobs: success;
- Contact Identity Resolution PG16/17 regression: success;
- Lead Details PG16/17 regression: success;
- validate: `npm test`, typecheck, lint, build = success;
- dependency-audit = success;
- production rollout/readback = NOT STARTED.

The repository-level state is:

```text
GAPS                              CLOSED / REVALIDATED
CAPABILITY AUTHORITY / REUSE      CLOSED / REVALIDATED
DECISION                          CLOSED / REVALIDATED
SECOND ADVERSARIAL REVIEW         CLOSED / FRESH
EXECUTION                         IMPLEMENTED
VALIDATION                        PROVED ON 5e22d610...
DOCUMENTATION                     THIS REFRESH
MERGE                             PENDING
RELEASE                           NOT STARTED
```

**Important:** this documentation refresh moves PR #559 to a new exact HEAD. Do not reuse the 11/11 result from `5e22d610...` as merge authorization for the new HEAD. Re-resolve the PR and require every applicable workflow/check on the new HEAD to complete successfully.

Next safe gate:

1. resolve current `origin/main`;
2. resolve PR #559 exact HEAD/base/mergeability/ahead-behind/diff;
3. confirm no blocking reviews/threads;
4. require all applicable workflows/checks of that exact HEAD to be completed + success;
5. only then protected-squash-merge #559 using expected-head protection;
6. confirm `merged=true` and re-resolve the resulting `origin/main`;
7. do **not** call MED-CRM-009 RELEASED after merge;
8. reconstruct production authority/capabilities;
9. perform production pre-readback of the current RPC contract;
10. hash-pin the exact canonical migration/verifier from merged main;
11. if migration is absent, perform a fresh rollout adversarial review and only then governed transactional apply;
12. run pinned read-only verifier + relevant CRM regressions;
13. read back the served frontend/timeline and route health without mutating real production data merely for proof;
14. only with that evidence may MED-CRM-009 become RELEASED.

No MED-CRM-010 or successor capability is authorized by this checkpoint.

---

## Next-chat generation checkpoint — 2026-09-28

Fresh revalidation immediately before generating the next-chat prompt:

- canonical repository: `OARANHA/crmfisio`;
- canonical `main`: `1ff2825cfe5dd630ea16e4cfeda586ad390c3be7`;
- design PR: #558 — OPEN / unmerged / mergeable;
- branch: `docs/med-crm-009-lead-activity-read-boundary`;
- exact PR HEAD before this HANDOFF refresh: `2543bda15f693d473ddc743fef3671df1689f839`;
- compare before refresh: 7 ahead / 0 behind;
- changed files: 6, all under `docs/`;
- workflow snapshot on that prior HEAD: 20 total, 13 completed-success, 5 in progress, 2 queued;
- reviews: 0;
- review threads: 0;
- no product/schema/runtime change is present in the design PR.

**Important:** this HANDOFF refresh itself creates a new PR HEAD. Therefore the workflow snapshot above is historical immediately after this commit. The next chat must resolve the new exact HEAD and re-read its checks before any merge decision. Do not inherit success from the previous HEAD.

Next safe continuation:

1. resolve current `origin/main`;
2. resolve PR #558 current HEAD/base/mergeability/diff;
3. prove the current HEAD remains docs-only and 0 behind;
4. wait for/inspect all applicable exact-HEAD workflows and require completed + success;
5. confirm no blocking review/thread;
6. only then merge the design PR;
7. after merge, re-resolve `origin/main`;
8. re-read MED-CRM-009 README/DECISION/EVIDENCE/HANDOFF from integrated main;
9. audit every canonical consumer of `list_current_clinic_crm_lead_activities(uuid)`;
10. if the design contract still holds, create a **fresh implementation branch** from the new main;
11. do not implement on the design branch.

No MED-CRM-010 or other successor scope is authorized by this handoff.

## Design PR checkpoint — 2026-09-28

- PR: #558 — `docs(crm): design MED-CRM-009 activity read boundary`;
- branch: `docs/med-crm-009-lead-activity-read-boundary`;
- base at PR creation: `main@1ff2825cfe5dd630ea16e4cfeda586ad390c3be7`;
- head before this HANDOFF refresh: `f88001c53019f70faf1a77f23d2f7b992e25a0b4`;
- compare before refresh: 6 ahead / 0 behind;
- changed files: 6;
- scope: documentation only;
- product/schema/runtime mutation: none.

This HANDOFF refresh itself moves the PR HEAD. Do **not** inherit checks from `f88001c53019f70faf1a77f23d2f7b992e25a0b4`. Resolve the new exact HEAD and its workflows before any merge decision.

## Design checkpoint — 2026-09-28

Canonical repository:

`OARANHA/crmfisio`

Design baseline:

`1ff2825cfe5dd630ea16e4cfeda586ad390c3be7`

Slice:

`MED-CRM-009 — Commercial Lead Activity Read Boundary V1`

Current methodological state:

```text
GAPS                              CLOSED
CAPABILITY AUTHORITY / REUSE      CLOSED
DECISION                          CLOSED
SECOND ADVERSARIAL REVIEW         CLOSED
EXECUTION                         DESIGN/DOCS ONLY
PRODUCT IMPLEMENTATION            NOT STARTED
```

## Why this slice exists

The RELEASED activity RPC is tenant/entitlement protected but returns a generic persistence envelope to the authenticated browser.

That envelope includes actor identity and identity-resolution metadata not required by the Commercial Board. The MED-CRM-007 adapter removes those values only after they reach browser code.

The smallest safe correction is to harden the existing RPC projection server-side while keeping:

- the same activity table;
- the same reader guard;
- the same function identity/signature/row shape if implementation review confirms compatibility;
- the same activity writers;
- the same audit path;
- the existing frontend allowlist as defense in depth.

No parallel reader should be created merely for convenience.

## Next safe gate after this design PR

1. validate the exact HEAD of the design/docs PR;
2. merge only if docs-only scope, base, mergeability and all applicable checks are proved;
3. re-resolve `origin/main`;
4. re-read this slice from the integrated main;
5. search all current repository consumers of `list_current_clinic_crm_lead_activities(uuid)`;
6. close the exact implementation plan for a follow-up migration that preserves compatibility;
7. repeat adversarial review if any consumer/contract differs from this design;
8. only then create a fresh implementation branch.

Do not implement product/schema on the design branch.

## Implementation constraints

Expected direction:

- harden `list_current_clinic_crm_lead_activities(uuid)`;
- do not change canonical stored activity metadata;
- `actor_id` must not cross the browser read projection;
- stage activity metadata exposes only from/to stage IDs;
- identity-resolution metadata exposes only validated `resolution_mode`;
- other/unknown activity metadata fails closed to an empty object;
- tenant/RBAC/`crm.access` stay unchanged;
- no Patient authority;
- no new writer/table/audit/role/entitlement/tenant source;
- frontend sanitization stays as defense in depth.

## Competing candidates

Pipeline/Stage admin, lost-reason taxonomy/reporting, follow-up, Inbox/Conversation, attribution and Lead→Patient remain open candidate areas, but none is authorized by this slice.

Reconstruct them again after MED-CRM-009 is closed; do not inherit a roadmap order.

## JEV

JEV advisory review requested deep review:

```text
deep_review = 0.87
confidence = 0.82
```

Deterministic review, not JEV, closed the gate by narrowing the change to the existing read authority and preserving storage/writers/signature.

## Rule

Never declare MED-CRM-009 PROVED, MERGED or RELEASED from this design checkpoint.

If a future chat is generated, first revalidate `origin/main`, active branch/PR HEAD, checks and merge state, then update this HANDOFF.
