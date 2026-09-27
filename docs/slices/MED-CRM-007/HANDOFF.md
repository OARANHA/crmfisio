# MED-CRM-007 — Handoff

## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

Design baseline:

`main@7e04f9d4c3bc84e95d90b7ad1ef2a15d02632120`

Execution baseline:

`main@b8f7943960254ba33ec036a4462c6b2683367289`

Execution branch:

`feat/med-crm-007-lead-activity-timeline`

Slice:

`MED-CRM-007 — Commercial Lead Activity Timeline V1`

Status:

`IMPLEMENTING`

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

## Next exact step

Open/revalidate the implementation PR, run applicable workflows on its exact HEAD and fix any failure without widening scope. Only after repository proof may MED-CRM-007 advance to PROVED. Runtime rollout/readback is a separate later gate before RELEASED.

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

Do not declare PROVED or RELEASED before the corresponding evidence exists.
