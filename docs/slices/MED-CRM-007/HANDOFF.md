# MED-CRM-007 — Handoff

## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

Design baseline:

`main@7e04f9d4c3bc84e95d90b7ad1ef2a15d02632120`

Execution baseline:

`main@b8f7943960254ba33ec036a4462c6b2683367289`

Execution branch:

`feat/med-crm-007-lead-activity-timeline`

Implementation PR:

`#551 — feat: add MED-CRM-007 lead activity timeline`

Slice:

`MED-CRM-007 — Commercial Lead Activity Timeline V1`

Status:

`PROVED + MERGED / NOT RELEASED`

MED-CRM-006 remains RELEASED and closed. Do not extend it.

## Decision

The next bounded Commercial CRM capability is to expose the existing per-Lead operational activity timeline in the canonical Commercial CRM Board.

This is selected because the server authority already exists and the product surface does not consume it.

## Canonical authority to reuse

- `public.crm_lead_activities`;
- `public.list_current_clinic_crm_lead_activities(uuid)`;
- `public.crm_current_reader_clinic_id()`;
- current clinic / active profile;
- `crm.access`;
- existing Commercial CRM projections;
- existing server-emitted `lead_created`, `stage_changed`, `contact_identity_resolved`;
- existing `audit_log` as separate audit authority.

## Hard boundaries

`Contact != Lead != Patient`

Do not add or widen:

- tenant source;
- RLS/RBAC;
- role;
- entitlement;
- raw browser DML;
- activity writer;
- generic Lead writer;
- Contact edit/merge/dedupe;
- Pipeline admin;
- follow-up/tasks;
- Inbox/conversation;
- messaging/provider;
- attribution;
- Lead → Patient;
- Patient/clinical timeline;
- AI/automation.

owner/admin/recep remain CRM writers. professional/financeiro remain read-only.

## Required frontend safety contract

Do not render raw `metadata`.

Known activity types must use an explicit presenter/allowlist. Unknown types display a neutral event label with no metadata dump.

Do not expose raw phone/e-mail, internal UUIDs, candidate IDs, actor IDs, Patient identifiers/links or clinical data.

Anonymized Contact state must remain anonymized.

## Expected implementation shape

If fresh revalidation still confirms the contract:

1. add typed `CommercialCrmLeadActivity` model;
2. add `listCurrentClinicCrmLeadActivities(leadId)` frontend adapter calling only the canonical RPC;
3. add on-demand selected-Lead timeline UI to `CommercialCrmBoard`;
4. map known events to bounded human-readable copy;
5. resolve known stage IDs to already-loaded stage names only;
6. add loading/empty/error handling;
7. add focused adapter/UI/boundary tests;
8. do not modify SQL/schema/backend unless a newly proved blocker sends the slice back through fresh gates.

## Implementation checkpoint

Design PR #550 passed 20/20 workflows on exact HEAD and merged as `main@b8f7943960254ba33ec036a4462c6b2683367289`. Post-merge revalidation found no material authority change. Execution therefore started frontend-only.

Implemented in the current branch:

- bounded activity adapter over `list_current_clinic_crm_lead_activities(uuid)`;
- no raw metadata/actor/candidate/Patient envelope reaches the Board;
- on-demand per-Lead history UI;
- bounded presenters for known events and neutral unknown-event fallback;
- explicit loading/empty/error/retry states;
- anonymized Contact remains anonymized;
- focused adapter, UI and frontend-boundary tests.

## Repository proof

PR #551 exact HEAD `6714ed5672fa2b08934ce7538fbab016d3d2f8f7` completed 20/20 workflows successfully and was squash-merged as `main@7f1eda9631407ac8ddaa6fae4c87c293db024945`.

The implementation remains frontend-only and did not add schema/backend/RLS/RBAC/role/entitlement/tenant/audit/Patient authority.

## Runtime checkpoint

The first production readback after the merge still served the prior entry `/assets/index-BYMym6it.js`. The MED-CRM-007 bundle has therefore not yet been observed live. Do not call the slice RELEASED from repository proof alone.

## Next exact step

Re-resolve current `origin/main`, then read `https://app.medicspro.com.br/` and its referenced CRM chunk. When the entry/chunk changes, prove that the live CRM chunk contains `list_current_clinic_crm_lead_activities`, does not reintroduce forbidden direct Prospect writers/raw CRM DML/Patient crossover, and smoke `/`, `/crm`, `/agenda`, `/pacientes`. Claim an authenticated timeline smoke only if it is actually performed.

If the production entry remains the old build, keep the slice at PROVED + MERGED / NOT RELEASED and investigate the canonical Portainer deployment path rather than creating another code authority.

## Proof required later

Repository proof:

- focused tests;
- frontend boundary test;
- typecheck;
- lint;
- build/diff-check;
- applicable GitHub workflows on exact HEAD.

Runtime proof after merge/deploy:

- live CRM chunk contains the activity read RPC marker;
- no new writer/raw DML marker;
- public route health;
- authenticated timeline smoke only if actually executed.

Repository PROVED evidence now exists. Do not declare RELEASED until the frontend rollout/readback evidence exists.
