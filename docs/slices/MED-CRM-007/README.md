# MED-CRM-007 — Commercial Lead Activity Timeline V1

**Status:** DESIGNED  
**Owner domain:** Commercial CRM  
**Canonical repository:** `OARANHA/crmfisio`  
**Design baseline:** `main@7e04f9d4c3bc84e95d90b7ad1ef2a15d02632120`  
**Created:** 2026-09-27

## Objective

Expose the already-canonical Commercial CRM Lead activity timeline inside the current `/crm` Board without adding mutation authority, a parallel history store, Patient authority, raw metadata exposure or a second audit mechanism.

The V1 is intentionally a projection/integration slice. The server-side activity model and read authority already exist in the RELEASED Commercial Core:

- `public.crm_lead_activities`;
- `public.list_current_clinic_crm_lead_activities(uuid)`;
- `public.crm_current_reader_clinic_id()`;
- existing `crm.access`, active-profile and tenant boundaries.

The current frontend does not consume that read RPC.

## Non-goals

MED-CRM-007 does **not** add:

- Contact edit, merge or dedupe;
- Lead edit/qualification;
- owner/value/source administration;
- Pipeline/Stage administration;
- manual note/comment writer;
- new activity writer;
- follow-up/tasks/next-action engine;
- Unified Inbox or Conversation authority;
- messaging/provider authority;
- attribution/campaign model;
- Lead → Patient conversion;
- Patient timeline or clinical history;
- Commercial AI/automation;
- new table, migration, RPC, RLS policy, role, entitlement, tenant source or audit authority.

## Preserved invariants

`Contact != Lead != Patient`

- Contact remains commercial/communication identity.
- Lead remains commercial opportunity/process.
- Patient remains clinical identity.
- owner/admin/recep remain CRM writers.
- professional/financeiro remain read-only for Commercial CRM.
- tenant remains server-side.
- `crm.access` remains mandatory.
- browser/frontend remains projection only.
- raw browser DML remains closed.
- operational timeline does not become clinical history.
- `audit_log` remains audit authority; the activity timeline is an operational projection, not a replacement audit system.

## GAPS

Fresh reconstruction against the design baseline proved:

1. canonical activity persistence already exists;
2. canonical current-clinic activity read authority already exists;
3. Lead creation records `lead_created`;
4. stage transition records `stage_changed`;
5. MED-CRM-006 records `contact_identity_resolved`;
6. Core tests prove current-tenant activity read and cross-tenant rejection;
7. current frontend adapter does not expose `listCurrentClinicCrmLeadActivities(...)`;
8. current `CommercialCrmBoard` has no visible Lead activity timeline;
9. production frontend bundle observation on 2026-09-27 found `list_current_clinic_crm_lead_activities` absent from the live CRM chunk.

The gap is therefore product integration of a RELEASED read capability, not absence of a new domain authority.

## CAPABILITY AUTHORITY / REUSE GATE

| Need | Canonical authority | MED-CRM-007 decision |
| --- | --- | --- |
| tenant | current active profile / server current clinic | REUSE |
| entitlement | `crm.access` | REUSE |
| Lead identity | canonical Commercial CRM projection | REUSE |
| activity storage | `crm_lead_activities` | REUSE |
| timeline read | `list_current_clinic_crm_lead_activities(uuid)` | REUSE |
| Lead creation event | RELEASED Lead command | REUSE |
| stage event | RELEASED stage-transition command | REUSE |
| Contact identity resolution event | RELEASED MED-CRM-006 resolver | REUSE |
| audit | `audit_log` | REUSE; do not rebuild |
| Patient/clinical history | clinical domains | DO NOT CROSS |
| new writer | none | DO NOT CREATE |

## Decision

Design a frontend-only V1 while the released RPC contract remains sufficient.

Expected implementation surface:

- add a typed frontend adapter for `list_current_clinic_crm_lead_activities(uuid)`;
- load activities on demand for a selected Lead rather than loading every timeline with the Board;
- render only a bounded allowlist of known commercial event types;
- resolve stage IDs to already-loaded CRM stage names when possible;
- render unknown future event types as a neutral commercial event without raw metadata;
- preserve anonymized Contact presentation;
- provide explicit loading, empty and error states.

If implementation discovers that the existing RPC is not sufficient, MED-CRM-007 must return to the authority/reuse gate. It must not silently expand into backend/schema work.

## Data projection rule

The UI must **not** render arbitrary `metadata` JSON.

V1 must not expose:

- raw phone/e-mail;
- `candidate_ids`;
- internal Contact/Lead/Stage UUIDs;
- actor UUIDs;
- Patient identifiers or links;
- clinical data;
- arbitrary future metadata keys.

Known event presentation may use only bounded fields required to explain the commercial event.

## Validation plan

Before merge, prove at minimum:

- adapter calls only the canonical activity RPC;
- timeline is scoped to a selected Lead;
- loading / empty / error states;
- `lead_created` rendering;
- `stage_changed` rendering;
- `contact_identity_resolved` rendering;
- unknown type fallback with no metadata dump;
- anonymized Contact does not regain PII;
- no Patient navigation/data is introduced;
- no activity writer/raw CRM DML is introduced;
- owner/admin/recep writer boundaries are unchanged;
- professional/financeiro remain read-only;
- frontend boundary regression remains green;
- typecheck/lint/build and applicable CI are green.

## Expected rollout

Frontend-only rollout through the existing MedicsPro frontend/Portainer path, followed by live bundle readback and public route smoke.

Expected runtime proof after implementation:

- live CRM chunk contains `list_current_clinic_crm_lead_activities`;
- no new CRM writer or raw-table DML marker appears;
- `/crm` remains healthy;
- other baseline routes remain healthy;
- authenticated timeline smoke is claimed only if it is actually performed.

## Gate status

```text
GAPS                              CLOSED
CAPABILITY AUTHORITY / REUSE      CLOSED
DECISION                          CLOSED
SECOND ADVERSARIAL REVIEW         CLOSED
EXECUTION                         NOT STARTED
VALIDATION                        NOT STARTED
DOCUMENTATION                     IN PROGRESS (design artifacts only)
```

No implementation is authorized by status alone. Before execution, revalidate current `origin/main`, open PRs, this slice contract and any newer CRM authority.
