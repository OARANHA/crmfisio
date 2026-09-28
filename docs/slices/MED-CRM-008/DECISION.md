# MED-CRM-008 — Decision

**Decision status:** IMPLEMENTED / VALIDATED IN PR #554 / NOT RELEASED  
**Baseline:** `OARANHA/crmfisio@7b75b77c667b1c17b6eb408ee7047ad866e78a73`  
**Date:** 2026-09-27

## Decision statement

The next bounded Commercial CRM slice is **Lead Commercial Details V1**.

It adds a narrow canonical mutation for the Lead attributes that already exist in the Commercial Core and are already returned by the canonical read projection: `title`, `value_cents` and `source`.

It does not add a new qualification status, does not reuse Patient state, and does not merge this mutation with stage transition.

## Candidate comparison

| Candidate | Current problem | Existing authority / reuse | New authority required | Boundary / duplicate-authority risk | Decision now |
| --- | --- | --- | --- | --- | --- |
| Lead commercial details | existing fields cannot be maintained after creation | Lead schema/projection, mutator guard, activity/audit, constraints | one narrow update command + UI | bounded if stage/Contact/Patient/owner excluded | SELECT |
| Pipeline/Stage admin | defaults exist but clinic cannot configure lifecycle | schema/read projections/constraints | create/edit/archive/reorder/default command set | high: live Leads, archive/default semantics | DEFER |
| Structured lost reason/reporting | loss detail exists but UI uses free text only | lost fields + transition RPC | canonical taxonomy/config/reporting contract | medium: hardcoded client taxonomy would become authority | DEFER |
| Follow-up/next action | no Lead task/next-action capability proved | generic automation/outbox foundations need separate reuse audit | temporal task/enrollment/ownership authority | high: duplicate async engine risk | DEFER |
| Inbox/Conversation | no canonical Lead conversation boundary proved | messaging/provider foundations only | conversation/message/handoff authority | high cross-domain/channel scope | DEFER |
| Attribution | `source` exists but no campaign attribution chain | Lead source fields | acquisition/click/campaign/conversion model | medium/high; provider and downstream semantics | DEFER |
| Lead → Patient | no conversion authority exists | Patient registry + Contact patient link are separate foundations | explicit idempotent cross-domain conversion | high clinical identity boundary | DEFER |
| Contact edit | Contact exists but MED-CRM-006 governs identity resolution | identity resolver/normalizers | safe update semantics under identity ambiguity | high risk of bypassing identity authority | DEFER |

This is a next-slice choice under the current proved state, not a permanent ranking.

## Capability authority / reuse

Reuse:

- `public.crm_leads` as Lead persistence;
- `list_current_clinic_crm_leads()` as read projection;
- `crm_current_mutator_clinic_id()` as tenant/role/entitlement guard;
- existing Lead constraints and `guard_crm_lead_semantics()`;
- `crm_lead_activities` for bounded operational history;
- `audit_log` for technical audit;
- current projection-refresh pattern in `src/lib/commercialCrm.ts`.

Do not create:

- a second Lead table;
- a generic CRM update endpoint;
- raw browser DML;
- a new tenant resolver;
- a new role/capability/entitlement;
- a second stage writer;
- a qualification-status column.

## Why owner_id is excluded

The first candidate included possible owner assignment because `owner_id` already exists.

Adversarial review found that the current schema trigger validates only that an owner profile is active and same-tenant. It does not define which operational roles are eligible to own a Lead. Adding owner assignment now would silently make that ambiguity a product rule.

Therefore V1 is reduced to `title + value_cents + source`. Owner assignment requires a separate explicit role/ownership decision if product evidence justifies it.

## Why source is not attribution

`source` is an existing nullable Lead attribute and the RELEASED create command already accepts it. V1 may maintain it as a manual commercial label.

This does not create campaign identity, click attribution, Meta/Google identifiers, offline conversion dispatch or revenue attribution. Those remain separate capabilities.

## Command contract

The implementation should prefer one narrow operation equivalent to:

`update_current_clinic_crm_lead_details(p_lead_id, p_expected_updated_at, p_title, p_value_cents, p_source)`

Exact signature/name must be revalidated during implementation, but the semantic contract is fixed:

1. resolve clinic via `crm_current_mutator_clinic_id()`;
2. require a non-deleted Lead in that clinic and lock it;
3. normalize title/source; validate title and value;
4. compare old/new values under the Lead lock;
5. if the desired details already equal the current persisted details, treat the call as an exact retry/no-op even when the caller carries the pre-COMMIT token; this side-effect-free retry remains valid even if the Lead became archived/read-only after the original COMMIT, matching the MED-CRM-004 idempotency-before-archive pattern;
6. for a real change, require the linked Contact to still be active/non-anonymized and the current pipeline/stage to remain non-archived; these related rows must be checked under a lock strong enough to prevent a concurrent archive/anonymize race during the mutation;
7. require `p_expected_updated_at` to equal the locked Lead `updated_at`; stale projections fail explicitly and must refetch rather than overwrite a concurrent Lead change;
8. changed update modifies only title/value/source;
9. create one `lead_details_updated` operational activity with bounded metadata such as `changed_fields[]`, never raw field values;
10. create one `CRM_LEAD_DETAILS_UPDATED` audit record containing IDs/change categories only;
11. never change Contact, Patient, pipeline, stage, owner or terminal fields.

## Rollback/reversibility

The migration is additive and can be rolled back operationally by removing UI usage and revoking/dropping the new RPC in a dedicated follow-up if required. Existing schema/data are not reinterpreted.

A user edit itself is a business mutation; the activity/audit trail must make the change observable. V1 does not provide destructive history erasure.

## Second adversarial review

Deterministic findings:

- implementation-plan review also found that Contact anonymization and archived pipeline/stage visibility would become UI-only guards if the new RPC ignored them; V1 therefore rejects edits for deleted/anonymized Contacts and archived pipeline/stage Leads server-side;
- implementation-plan review found that a row lock alone would still allow a stale full-form edit to overwrite a concurrent change; V1 therefore reuses the already-projected `lead_updated_at` as a conservative optimistic-concurrency token, with desired-state equality checked first to preserve exact retry idempotency;

- including `owner_id` would force an unresolved ownership-role policy, so it was removed;
- Pipeline/Stage admin is materially larger and touches live-lead semantics;
- loss reporting lacks a canonical reason taxonomy and should not hardcode client authority;
- follow-up/Inbox/attribution require other domain contracts before they are safe next steps;
- Lead→Patient crosses the clinical identity boundary and needs its own explicit design;
- Lead details can reuse current schema/guard/read/audit/activity without creating a parallel stage or identity writer.

Advisory JEV review evolved with the design. The initial reduced scope returned `proceed_fast=0.66`, but after concurrency/privacy/archive guards were made explicit a fresh JEV review routed `deep_review=0.74`, `proceed_fast=0.23`, `block=0.03`, confidence `0.65`. The deterministic deep review then refined lock/idempotency ordering: exact desired-state retry is side-effect free before archive/privacy write guards; real changes must protect related Contact/pipeline/stage state against concurrent read-only transitions.

The JEV result is advisory only. Execution is authorized only after these deterministic refinements and the repository evidence are reconciled.

## Reconsideration triggers

Return to fresh gates if:

- current main changes materially before implementation;
- an active CRM PR introduces a competing Lead-details writer;
- safe update requires owner/stage/pipeline/Contact/Patient mutation;
- activity/audit cannot avoid sensitive field values;
- a new domain requirement turns `source` into structured attribution rather than a manual label.


## Implementation outcome — 2026-09-28

The implemented PR #554 kept the original decision boundary intact:

- canonical writer: `update_current_clinic_crm_lead_details(...)`;
- write set remains only `title + value_cents + source`;
- no owner, Contact, Patient, stage, pipeline or terminal-field mutation was added;
- optimistic concurrency reuses `lead_updated_at`;
- exact retry/no-op semantics remain before real-change lifecycle guards;
- activity/audit metadata remains value-free;
- frontend stale handling refetches and requires human review instead of retrying the mutation.

Exact validated implementation head before documentation refresh:
`eb58c09d7f9aeed99eef52f5d71304049b43e6cb`.

No reconsideration trigger fired during implementation. Production release remains a separate deployment/runtime proof.
