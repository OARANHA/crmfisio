# MED-CRM-008 — Handoff

## Post-merge handoff refresh — 2026-09-28

Fresh canonical revalidation before generating the next-chat prompt:

- canonical repository: `OARANHA/crmfisio`;
- canonical `main` after implementation merge: `7fbd255d8bb60932cc3ee839f325f35ce7568e01`;
- PR #554 is CLOSED + MERGED;
- protected merge used exact final PR head `2e56256426994eebaa643bd6b1537053f51d22d7`;
- that exact final PR head completed **22/22 applicable workflows with success and 0 failures** before merge;
- PR #554 had no blocking reviews or review threads at merge;
- compare after merge proved `main` identical to merge commit `7fbd255d8bb60932cc3ee839f325f35ce7568e01`;
- the merge commit itself has no separate push workflow/status records, so do not invent a second CI proof;
- historical PR #525 remains OPEN, unmerged and non-mergeable against an old base; it is not current authority;
- no newer competing Commercial CRM Lead-details writer was found;
- production rollout/runtime readback for MED-CRM-008 is still **NOT PROVED**.

Current source state now merged into `main`:

- additive authenticated-only SECURITY DEFINER `update_current_clinic_crm_lead_details(...)`;
- tenant/role/entitlement authority reused through `crm_current_mutator_clinic_id()`;
- mutation restricted to `title + value_cents + source`;
- exact desired-state retry/no-op before real-change privacy/archive/stale guards;
- Contact/pipeline/stage real-change revalidation under row locks;
- optimistic concurrency through canonical `lead_updated_at`;
- bounded `lead_details_updated` activity and `CRM_LEAD_DETAILS_UPDATED` audit without raw edited values;
- raw browser `UPDATE crm_leads` remains closed;
- Board editor is writer-only, absent for anonymized Contacts and legacy archived Leads;
- stale UI conflict refetches canonical projection and never silently retries the mutation;
- `Contact != Lead != Patient` remains preserved.

## Next safe gate — production rollout/readback

Do **not** start a new product capability yet. First close MED-CRM-008 release proof.

Required sequence in the next chat:

1. resolve the current `origin/main` again; never assume the SHA above is still current;
2. re-read this HANDOFF plus MED-CRM-008 README/DECISION/EVIDENCE and current canonical migration/verifier;
3. reconstruct current production state before any mutation;
4. prove whether the MED-CRM-008 backend RPC/migration is absent or already present in production;
5. if absent, stage/hash-verify and apply only the canonical MED-CRM-008 migration through the governed production write path, with exact approval and transactional/fail-closed behavior;
6. run the canonical pinned/read-only MED-CRM-008 verifier against production and retain exact evidence;
7. re-check the previously RELEASED Commercial CRM boundaries needed to prove no regression where the production verifier contract requires it;
8. observe the frontend deployment/readback and prove the live CRM bundle contains the MED-CRM-008 Lead-details editor/RPC markers while preserving the released Contact/Lead/Patient boundaries;
9. run public route health/smoke appropriate to the existing release doctrine;
10. update `CURRENT_STATE.md`, `SLICE_LEDGER.md`, MED-CRM-008 `EVIDENCE.md` and this HANDOFF from observed runtime evidence;
11. only after backend production verifier + frontend runtime readback are both proved may MED-CRM-008 advance to `RELEASED`.

Do not perform an authenticated human data mutation merely to prove release unless the canonical rollout doctrine explicitly requires it. Do not declare `GREEN`, `PROVED` or `RELEASED` from repository CI alone.


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
