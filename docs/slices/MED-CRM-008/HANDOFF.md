# MED-CRM-008 — Handoff

## Implementation handoff refresh — 2026-09-28

Fresh GitHub revalidation before documentation closeout:

- canonical `main` is `4654bd95c4d1305754d44886c0d1fbad7fd59126`, containing the merged MED-CRM-008 design from PR #553;
- implementation PR #554 is OPEN, non-draft and mergeable;
- validated implementation head before this documentation refresh: `eb58c09d7f9aeed99eef52f5d71304049b43e6cb`;
- that exact head was `0 behind` main;
- all **10/10 applicable PR workflows completed with success**;
- `Commercial CRM Lead Details` passed PostgreSQL 16/17 with released CRM regressions and MED-CRM-008 behavior;
- `Clinical workflow CI` passed and executes `npm test`, typecheck, lint and build;
- PR #554 has no reviews and no review threads;
- final deterministic review found no authority expansion beyond `title + value_cents + source`;
- production deployment/runtime readback is **not** claimed.

Implementation now present in PR #554:

- authenticated-only SECURITY DEFINER `update_current_clinic_crm_lead_details(...)`;
- tenant/role/entitlement reuse through `crm_current_mutator_clinic_id()`;
- Lead `FOR UPDATE`, exact desired-state retry/no-op, related Contact/pipeline/stage `FOR SHARE`, then stale token check;
- bounded activity/audit without raw edited values;
- typed `lead_updated_at` concurrency token;
- Board editor for operational roles only;
- no edit affordance for anonymized Contacts or legacy archived Leads;
- stale edit rejection refetches canonical projection and never silently retries the mutation.

This documentation refresh creates a newer PR head than the already-green implementation head above. Therefore the next action is deterministic:

1. resolve the new exact PR #554 HEAD;
2. require every applicable workflow on that exact HEAD to be `completed + success`;
3. require PR to remain mergeable, `0 behind`, with no blocking review/thread;
4. only then squash-merge PR #554;
5. resolve the resulting new `main` SHA;
6. update canonical state/ledger only from the merged main;
7. treat production deployment/runtime readback as a separate release proof — do not label MED-CRM-008 RELEASED from CI alone.


## Handoff refresh — 2026-09-27 20:40 BRT

Fresh GitHub revalidation before opening the next chat:

- `origin/main` remains `7b75b77c667b1c17b6eb408ee7047ad866e78a73` (`docs: close MED-CRM-007 after production readback (#552)`);
- design PR #553 remains OPEN, non-draft and mergeable;
- exact validated PR head before this HANDOFF refresh: `72d0c511c0e4c821259f4856850d406c0cadfbf3`;
- that exact head completed **20/20 workflows with success and 0 failures**;
- PR #553 has no reviews and no review threads;
- PR #525 remains historical/open and must not be treated as current authority;
- no implementation code, migration or runtime mutation has started for MED-CRM-008.

This HANDOFF refresh itself creates a newer docs-only PR head. Therefore **do not merge from the 20/20 result above without first revalidating the new exact HEAD and its checks**.

Next safe sequence:

1. resolve current `origin/main` and PR #553 exact HEAD;
2. require the current exact HEAD to be mergeable with all applicable workflows `completed + success` and no blocking review/thread;
3. only then merge the docs-only design PR;
4. resolve the resulting new `main` SHA;
5. reconstruct active CRM PR/branch state again;
6. create a fresh implementation branch for MED-CRM-008;
7. implement only the designed Lead details authority (`title + value_cents + source`) with optimistic concurrency, exact-retry idempotency and server-side privacy/archive guards;
8. validate PostgreSQL 16/17 behavior + existing Commercial CRM regressions before frontend execution;
9. never expand into owner assignment, stage/pipeline admin, Contact/Patient mutation, follow-up, Inbox, attribution or Lead→Patient without new gates.


## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

Design baseline:

`main@7b75b77c667b1c17b6eb408ee7047ad866e78a73`

Design branch:

`docs/med-crm-008-lead-commercial-details`

Slice:

`MED-CRM-008 — Lead Commercial Details V1`

Status:

`DESIGNED / EXECUTION NOT STARTED`

## Decision

Add one bounded Commercial CRM capability to maintain the existing Lead fields:

- `title`;
- `value_cents`;
- `source`.

Do not introduce a qualification status/score.

## Authority to reuse

- `crm_leads`;
- `list_current_clinic_crm_leads()`;
- `crm_current_mutator_clinic_id()`;
- current clinic / active profile;
- `crm.access`;
- owner/admin/recep writer boundary;
- `guard_crm_lead_semantics()`;
- `crm_lead_activities`;
- `audit_log`;
- canonical refetch/stale-projection frontend pattern.

## Hard boundaries

`Contact != Lead != Patient`

Do not include:

- `owner_id` assignment;
- stage or pipeline mutation;
- Contact edit/identity changes;
- lost-reason taxonomy;
- Pipeline/Stage admin;
- follow-up;
- Inbox/Conversation;
- attribution engine;
- Lead→Patient;
- Patient data/mutation;
- provider/automation/AI;
- raw browser DML;
- new role/entitlement/tenant source.

## Required server contract

A narrow authenticated-only SECURITY DEFINER command should:

- derive tenant with `crm_current_mutator_clinic_id()`;
- receive the current projection's `lead_updated_at` as `expected_updated_at`;
- lock the current-clinic non-deleted Lead first;
- treat desired-state equality as exact retry/no-op before any real-change archive/privacy/stale guard;
- for a real change, lock/revalidate linked Contact as active/non-anonymized and current pipeline/stage as non-archived so a concurrent anonymize/archive cannot race the update;
- reject when the locked Lead `updated_at` differs from `expected_updated_at`, forcing a canonical refetch;
- validate/normalize title, value cents and source;
- update only those three fields;
- return cleanly on exact no-change retry without duplicate evidence;
- emit `lead_details_updated` activity only for a real change;
- emit `CRM_LEAD_DETAILS_UPDATED` audit only for a real change;
- record IDs/change categories only, never raw title/source/value in audit/activity metadata;
- preserve stage/pipeline/contact/owner/terminal fields.

## Validation requirement

Before PROVED, require:

- PostgreSQL behavior for owner/admin/recep allow;
- professional/financeiro deny;
- `crm.access` deny;
- cross-tenant/missing/deleted Lead deny;
- anonymized/deleted Contact denies a real change;
- archived pipeline or archived stage denies a real change;
- exact desired-state retry remains no-op and emits no new evidence even if the related state became read-only after the original COMMIT;
- non-empty title;
- nullable/non-negative integer cents;
- source trim/null behavior;
- exact no-change retry = no extra activity/audit, including retry with the pre-COMMIT timestamp when the desired persisted details already match;
- stale `expected_updated_at` + different desired state = explicit conflict, no overwrite;
- real change = exactly one update activity + audit;
- stage/pipeline/contact/owner/terminal fields unchanged;
- raw browser DML remains denied;
- no Patient mutation;
- Core/Command/Archived Guard/Identity regressions remain green;
- frontend writer/read-only tests;
- typecheck/lint/build and applicable CI.

## Next gate

After this design branch is validated and integrated, re-resolve `origin/main`, revalidate open CRM PRs and the four closed gates, then create a fresh implementation branch.

Do not implement product code on this documentation branch.
