# MED-CRM-008 — Handoff

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
- lock current-clinic non-deleted Lead;
- treat desired-state equality as exact retry/no-op before stale-token rejection;
- otherwise reject when the locked row `updated_at` differs from `expected_updated_at`, forcing a canonical refetch;
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
