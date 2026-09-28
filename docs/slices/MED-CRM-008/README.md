# MED-CRM-008 — Lead Commercial Details V1

**Status:** IMPLEMENTED / VALIDATED IN PR #554 / NOT RELEASED  
**Owner domain:** Commercial CRM  
**Canonical repository:** `OARANHA/crmfisio`  
**Design baseline:** `main@7b75b77c667b1c17b6eb408ee7047ad866e78a73`  
**Created:** 2026-09-27

## Objective

Allow an authorized Commercial CRM writer to maintain the existing Lead commercial attributes `title`, `value_cents` and `source` through one canonical server-side command and a bounded Board UI, without changing stage, pipeline, Contact, Patient, owner semantics or introducing a parallel qualification model.

This slice deliberately treats these fields as **Lead details**, not as a new qualification/status engine.

## Proven product gap

The RELEASED Commercial Core already stores and projects:

- `title`;
- `value_cents`;
- `source`;
- `owner_id`;
- terminal/loss fields.

The current Board can create a prospect and move stages, but it cannot edit Lead details after creation. Prospect Intake captures only Contact identity inputs, Lead title and pipeline. There is no canonical Lead-details update RPC and raw browser `UPDATE crm_leads` is closed and behavior-tested.

Therefore the gap is a missing bounded mutation capability over already-canonical Lead attributes.

## Scope

V1 may update only:

- `title` — non-empty commercial subject/interest;
- `value_cents` — nullable, integer cents, non-negative;
- `source` — nullable manual source label.

The implementation must:

- reuse `crm_current_mutator_clinic_id()`;
- derive tenant server-side;
- preserve `crm.access`;
- keep owner/admin/recep as writers;
- keep professional/financeiro read-only;
- expose the already-projected `lead_updated_at` in the typed frontend Lead shape and send it as the optimistic-concurrency token;
- lock the target Lead before update;
- after locking, accept an exact desired-state retry as a no-op; otherwise require the supplied expected `updated_at` to match the current row and fail stale edits closed;
- fail if the Lead is missing/deleted/cross-tenant;
- for any real change, fail if the linked Contact is deleted/anonymized or the current pipeline/stage is archived; related-row checks must be serialized strongly enough to prevent a concurrent anonymize/archive race;
- preserve exact desired-state retry as a side-effect-free no-op before those real-change guards, matching the released archived-pipeline idempotency pattern;
- keep stage/pipeline/contact/owner/terminal fields unchanged;
- be side-effect idempotent for an exact retry;
- emit one bounded operational activity only when data actually changes;
- emit one technical audit entry only when data actually changes;
- avoid logging raw title/source/value in audit text or activity metadata.

## Non-goals

MED-CRM-008 does **not** add or change:

- `owner_id` assignment;
- Contact edit, merge or dedupe;
- stage transition or lost-reason semantics;
- pipeline/stage administration;
- qualification score/status;
- follow-up/tasks/next action;
- Inbox/Conversation;
- attribution/campaign engine;
- Lead → Patient conversion;
- Patient creation/linking/navigation;
- messaging/provider authority;
- automation or Commercial AI;
- new tenant source, role, entitlement or audit system.

## Preserved invariants

`Contact != Lead != Patient`

- frontend/projection is not authority;
- raw browser DML remains closed;
- Commercial CRM timeline remains operational, not clinical;
- `audit_log` remains the technical audit authority;
- stage mutation remains exclusively behind `transition_current_clinic_crm_lead_stage(...)`;
- owner semantics are not silently redefined.

## Gate status

```text
GAPS                              CLOSED
CAPABILITY AUTHORITY / REUSE      CLOSED
DECISION                          CLOSED
SECOND ADVERSARIAL REVIEW         CLOSED
EXECUTION                         CLOSED IN PR #554
VALIDATION                        CLOSED ON EXACT PR HEAD
DOCUMENTATION                     IMPLEMENTATION CHECKPOINT
```

## Implementation checkpoint

PR #554 implements the designed shape without expanding authority:

- additive authenticated-only SECURITY DEFINER `update_current_clinic_crm_lead_details(...)`;
- `lead_updated_at` mapped as the optimistic concurrency token;
- exact desired-state retry before real-change privacy/archive/stale guards;
- Contact/pipeline/stage revalidation under row locks for real changes;
- mutation restricted to `title + value_cents + source`;
- bounded activity/audit metadata without raw edited values;
- Board editor hidden for read-only roles, anonymized Contacts and legacy archived Leads;
- stale UI conflict refetches the canonical projection and never silently retries the mutation.

Validated implementation head before this documentation refresh:
`eb58c09d7f9aeed99eef52f5d71304049b43e6cb`.

That exact head completed all 10 applicable PR workflows with success, including PostgreSQL 16/17 Commercial CRM Lead Details proof and Clinical workflow CI (`npm test`, typecheck, lint, build).

No production rollout or runtime readback is claimed by this checkpoint.

## Implementation shape

Implemented additive migration:

- add one authenticated-only SECURITY DEFINER RPC for Lead commercial details;
- reuse the current mutator guard;
- no direct table grants;
- add verifier + PostgreSQL behavior cases;
- add typed frontend adapter and Board edit/details UI only after server contract is proved in the branch;
- use existing `lead_updated_at` rather than adding a parallel version column;
- refresh canonical projection after COMMIT; refetch failure is stale projection, not command failure.

If implementation reveals that title/value/source cannot be changed safely without touching owner, stage, pipeline, Contact or Patient authority, return to the reuse/decision gates rather than expanding this slice.
