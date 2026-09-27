# MED-CRM-001 — Post-Command-Boundary Capability Map

**Audited against:** `main@7a8badf5ad81e92746e82bedd142ba75899a4080`
**Date:** 2026-09-26
**Purpose:** re-measure the commercial capability surface after MED-CRM-001 + MED-CRM-002 integration and select the next micro-slice from current source/schema evidence.

> Snapshot, not permanent truth. Re-measure current `origin/main`, active PRs and runtime whenever deploy state matters.

## Proof boundary

- MED-CRM-001 Commercial Core: PROVED + MERGED via #522.
- MED-CRM-002 Commercial Command Boundary: PROVED + MERGED via #524.
- #524 squash integration: `main@7a8badf5ad81e92746e82bedd142ba75899a4080`.
- #524 final head: 21/21 workflows SUCCESS.
- PostgreSQL 16.15 + 17.11 dedicated command proof: SUCCESS.
- `validate` + `dependency-audit`: SUCCESS.
- No rollout proof: neither Commercial Core nor Command Boundary is RELEASED here.

## Capability map

| Capability | State | Current authority / evidence | Residual gap / boundary |
| --- | --- | --- | --- |
| Tenant / active profile | EXISTS | `clinic_id`, `current_active_profile()`, RLS foundations | browser never chooses tenant authority |
| CRM entitlement + roles | EXISTS | `crm.access`; read guard; mutation guard; canonical roles | UI stays caller; server stays authority |
| Contact substrate | EXISTS | `contacts`; tenant-scoped; optional Patient link | create exists; edit/merge/dedupe/anonymize operations remain future |
| Lead/Pipeline/Stage/Activity model | EXISTS | Commercial Core #522 | canonical board still absent |
| Commercial read projections | EXISTS | current-clinic pipelines/stages/leads/activities RPCs | use instead of raw reads |
| Commercial commands | EXISTS | #524 create Contact, create Lead, stage transition | current scope excludes edit/admin/conversion |
| Activity/audit parity | EXISTS | #524 commands emit commercial activity/audit | future commands must preserve parity |
| Pipeline/stage admin | PARTIAL | configurable schema + generic defaults | no owner/admin operation/UI |
| Loss reasons | PARTIAL | lost stage requires reason | no catalog/reporting UX |
| Existing `/crm` board | CONFLICT | `Crm.tsx` still groups/moves Patient via `patients.funil_stage` | retire Patient-as-commercial-source without deleting Patient Journey |
| Patient Journey | EXISTS | Patient stage/events/writers | preserve as clinical/assistential lifecycle |
| Pre-clinical intake | GAP | reception/Patient Registry creates Patient directly | Contact→Lead intake needs separate composition/retry design |
| Lead→Patient conversion | FUTURE | explicit atomic/idempotent conversion required | not board work |
| Agenda | EXISTS | Appointment remains Patient-bound | no direct Lead appointment in V1 |
| Channel / WhatsApp transport | EXISTS | existing outbox/webhook/worker | provider is adapter |
| Unified Inbox | PARTIAL | logs + review mechanics exist | no Contact/Lead thread authority |
| Patient reactivation / waitlist | EXISTS | mature Patient/Agenda flows | not Lead follow-up storage |
| Lead follow-up / next action | GAP | no Lead task contract | separate domain slice |
| Automation runtime | EXISTS | current runner/domain ticks | do not build second engine |
| Commercial AI | GAP | no deterministic commercial agent authority | defer until domain operations stabilize |
| Source / attribution | PARTIAL / GAP | Lead source fields exist; no attribution chain | separate acquisition design |
| Commercial analytics | GAP | no canonical Lead-stage analytics | Patient funnel metrics are not substitute |
| Contact/Lead privacy lifecycle | PARTIAL | anonymized state exists; #524 rejects reuse | export/anonymize/reconcile operations remain |

## Conflict readback

Current `/crm`:

```text
CrmOperational
→ Crm
→ Patient[]
→ patients.funil_stage
→ setFunilStage / Patient writer
```

Current canonical commercial authority:

```text
Contact
→ Lead
→ Pipeline / Stage
→ Commercial activity + audit
→ #524 command boundary
```

NPS, churn and Treatment Continuity remain Patient-domain capabilities. They are not justification to keep Patient as the Lead aggregate.

## Capability Authority / Reuse Gate

### REUSE

- active profile / tenant;
- `crm.access`;
- Commercial Core projections;
- #524 command boundary;
- existing `/crm` route privacy/entitlement shell;
- `isOperationalRole(role)` for **UX affordance only**;
- Patient continuity/NPS/churn only for Patient-domain sections.

### DO NOT REBUILD

- tenant/RLS/RBAC;
- CRM read/write server authority;
- Patient/Encounter/Patient Journey;
- Agenda/Finance;
- delivery/automation foundations;
- audit log;
- Nexus.

### DEFER

- Contact/Lead creation UI;
- pre-clinical intake;
- Lead→Patient conversion;
- pipeline admin;
- follow-up;
- Inbox;
- attribution;
- AI;
- generic Event Core.

## Candidate comparison

### Commercial Board cutover

- consumes authority already merged/proved;
- can remain frontend-only;
- retires the highest visible competing source of truth;
- no schema/clinical identity mutation;
- makes #524 operational.

### Pre-clinical intake

- valuable but changes when Patient identity exists;
- sequential Contact→Lead composition adds partial-state/retry semantics;
- higher blast; separate slice.

### Follow-up / Inbox / attribution / conversion / AI

Require additional domain semantics or higher blast and should not precede canonical board use.

## Decision

Select:

```text
MED-CRM-003 — Commercial Board V1
```

Scope:

- replace only the Patient-backed commercial funnel block in `/crm`;
- read canonical pipelines/stages/leads;
- move Lead only through `transition_current_clinic_crm_lead_stage`;
- professional/financeiro remain read-only;
- `isOperationalRole` controls presentation only, never authorization;
- preserve Patient Treatment Continuity/NPS/churn;
- remove/replace Patient-derived “leads no funil”.

Not in MED-CRM-003:

- create Contact/Lead UI;
- Patient intake changes;
- Lead→Patient conversion;
- pipeline admin;
- follow-up/Inbox/attribution/provider/automation/AI;
- backend/schema/RPC changes.

## Second adversarial review

Combined board + creation scope:

```text
split_task: 0.83
confidence: 0.77
```

Narrow board first pass:

```text
deep_review: 0.57
confidence: 0.43
```

Deep review proved:

- Supabase client is intentionally untyped, so existing RPC calls do not require a new schema/type authority;
- `isOperationalRole = owner|admin|recep` already matches writer roles for UI affordance;
- legacy funnel block is separable from Patient NPS/churn;
- `/crm` already has `crm.access`;
- Patient-derived “leads no funil” must be retired/replaced.

Refined review:

```text
proceed_fast: 0.60
deep_review: 0.36
block: 0.03
split_task: 0.01
confidence: 0.46
```

JEV is advisory; source/schema proof is authoritative.

## State after selection

```text
MED-CRM-003 = DESIGNED
EXECUTION = NOT STARTED
```

Before EXECUTION, reconstruct current state again. If main/source/authority changed, repeat GAPS → REUSE → DECISION → SECOND ADVERSARIAL REVIEW.
