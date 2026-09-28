# MED-CRM-009 — Commercial Lead Activity Read Boundary V1

**Status:** PROVED / IMPLEMENTATION PR OPEN / NOT MERGED / NOT RELEASED  
**Owner domain:** Commercial CRM  
**Canonical repository:** `OARANHA/crmfisio`  
**Design baseline:** `main@1ff2825cfe5dd630ea16e4cfeda586ad390c3be7`  
**Implementation baseline:** `main@6bc436f2789341b95c3800d8a82cfe7dbed6c78e`  
**Created:** 2026-09-28

## Objective

Harden the already-RELEASED Commercial CRM Lead activity reader so the authenticated browser receives only the bounded operational projection required by the Commercial Board timeline, while the full canonical activity persistence remains server-side.

This slice is a **read-boundary minimization** slice. It does not create a new timeline, writer, audit system, tenant source, role, entitlement or Patient authority.

## Proven gap

The RELEASED activity reader:

`list_current_clinic_crm_lead_activities(uuid)`

correctly derives tenant through `crm_current_reader_clinic_id()`, enforces active profile + `crm.access`, rejects cross-tenant Lead access and keeps raw table DML closed.

However, its current return contract still mirrors the generic persistence envelope:

- `actor_id`;
- `actor_kind`;
- raw `metadata jsonb`.

Known activity writers place more information in that metadata than the current Board needs:

- `stage_changed` persists loss-reason fields in addition to stage identifiers;
- `contact_identity_resolved` persists requested/resolved Contact IDs, `candidate_ids`, match reasons and an optional free-text distinct reason;
- the identity-candidate preview itself is writer-scoped, but the generic activity reader is available to all allowed CRM reader roles, including `professional` and `financeiro`.

MED-CRM-007 intentionally drops those fields in `src/lib/commercialCrm.ts`, but that sanitization happens **after the raw RPC payload has already reached the browser**.

That makes frontend projection logic the effective minimization boundary, contrary to MedicsPro doctrine that the surface should receive only what it needs and that frontend/projection is not authority.

## Scope

V1 hardens the **existing reader**. It must not create a parallel activity reader if the current function can be safely narrowed while preserving its public signature/row shape.

Expected semantic contract, subject to exact implementation-plan revalidation after this design PR is integrated:

- keep `list_current_clinic_crm_lead_activities(uuid)` as the browser read authority;
- preserve `crm_current_reader_clinic_id()`, current-clinic tenant derivation and `crm.access`;
- preserve current reader roles;
- preserve function name, arguments and return columns for compatibility;
- return no browser-usable actor UUID; `actor_id` should be projected as `NULL`;
- preserve only coarse `actor_kind` unless implementation evidence proves even that is unnecessary or unsafe;
- project metadata through a server-side allowlist by activity type;
- for `stage_changed`, preserve only the stage identifiers required by the current bounded timeline projection;
- for `contact_identity_resolved`, preserve only a validated `resolution_mode`;
- for `lead_created`, `lead_details_updated` and unknown/future activity types, return an empty metadata object unless a separately reviewed bounded field is proved necessary;
- fail closed for unknown metadata keys;
- keep the canonical `crm_lead_activities` row and full internal metadata unchanged for server-side domain logic/auditability;
- keep the MED-CRM-007 frontend adapter sanitization as defense in depth rather than deleting it because the server is hardened.

## Non-goals

MED-CRM-009 does **not** add or change:

- activity persistence schema;
- activity writers;
- manual notes/comments;
- audit-log semantics;
- Lead stage semantics;
- lost-reason taxonomy/reporting;
- Pipeline/Stage administration;
- owner assignment;
- Contact edit/merge/dedupe;
- Contact identity-resolution decisions;
- follow-up/tasks/next action;
- Inbox/Conversation;
- attribution/campaign model;
- Lead → Patient conversion;
- Patient creation/mutation/navigation;
- provider/Evolution authority;
- automation or Commercial AI;
- role, entitlement, tenant source or raw browser DML.

## Preserved invariants

`Contact != Lead != Patient`

- tenant remains server-side;
- `crm.access` remains mandatory;
- owner/admin/recep remain CRM writers;
- professional/financeiro remain read-only;
- raw browser CRM table DML remains closed;
- the activity table remains the canonical operational history;
- `audit_log` remains the technical audit authority;
- Commercial timeline remains separate from Patient/clinical history;
- frontend remains defense in depth, not the authorization or minimization authority.

## Gate status

```text
GAPS                              CLOSED / REVALIDATED
CAPABILITY AUTHORITY / REUSE      CLOSED / REVALIDATED
DECISION                          CLOSED / REVALIDATED
SECOND ADVERSARIAL REVIEW         CLOSED / FRESH IMPLEMENTATION REVIEW
EXECUTION                         IMPLEMENTED IN PR #559
VALIDATION                        REPOSITORY PROVED ON HEAD 5e22d610...
DOCUMENTATION                     UPDATED / FINAL PR HEAD MUST BE REVALIDATED
RELEASE                           NOT STARTED
```

## Intended implementation shape after design integration

Only after this design PR is merged and `origin/main` is re-resolved:

1. create a fresh implementation branch from the then-current `main`;
2. add a follow-up migration that changes only the body/projection of the existing activity reader, preserving its signature and return row type;
3. add/update a structural verifier for ACL/signature/body boundary;
4. add PostgreSQL behavioral cases proving server-side minimization for every current CRM reader role;
5. retain the current frontend adapter allowlist and its focused tests;
6. run the RELEASED Commercial CRM regression suites and PostgreSQL 16/17 proof if still required by repository policy;
7. use exact-head GitHub workflow evidence before merge;
8. treat production rollout/readback as a separate RELEASED gate.

If implementation discovers a real consumer that requires raw activity metadata from the authenticated browser RPC, return to CAPABILITY AUTHORITY / REUSE instead of preserving the leak or creating a second browser authority by convenience.


## Repository implementation proof — 2026-09-28

Design PR #558 was revalidated on exact HEAD `182d33fe5d566aaa2cf808b3df33e6992c38fc3e` with 20/20 workflow runs successful, 0 behind, mergeable, docs-only and no reviews/threads, then protected-squash-merged as `main@6bc436f2789341b95c3800d8a82cfe7dbed6c78e`.

The implementation consumer audit confirmed:

- `src/lib/commercialCrm.ts` is the browser product adapter consuming `list_current_clinic_crm_lead_activities(uuid)`;
- `CommercialCrmBoard` needs only bounded activity type/time, stage from/to IDs and validated identity `resolution_mode`;
- no legitimate product consumer was found that requires actor UUID or raw activity metadata;
- Contact Identity Resolution retry/idempotency reads canonical `crm_lead_activities` persistence directly, not this reader RPC;
- stage-transition and Lead-details writers also write canonical persistence directly and do not depend on the reader projection.

Implementation PR #559, branch `feat/med-crm-009-lead-activity-read-boundary`, preserves the released RPC name, arguments, return row type, ACL, `crm_current_reader_clinic_id()` authority and full stored activity rows. It changes only browser-visible values:

- `actor_id = NULL`;
- `actor_kind` remains constrained coarse provenance;
- `stage_changed` metadata is allowlisted to `from_stage_id` / `to_stage_id`;
- `contact_identity_resolved` metadata is allowlisted to a valid `resolution_mode`;
- unknown/other metadata fails closed to `{}`.

Exact implementation HEAD `5e22d610024e0b5ba46acda481e3f11f111eed28` completed **11/11 applicable workflow runs with success**. The dedicated MED-CRM-009 workflow passed PostgreSQL 16 and 17. `Clinical workflow CI / validate` passed `npm test`, typecheck, lint and build; dependency audit passed. Contact Identity Resolution and Lead Details PostgreSQL 16/17 regressions also passed.

This is **repository-level PROVED only**. PR #559 is not yet merged at this documentation checkpoint and no production rollout/readback has occurred.
