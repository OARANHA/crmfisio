# MED-CRM-001 — Post-Foundation Capability Map

**Audited against:** `main@652ea7b3aea4cd03a09944b780ef697168016bc3`  
**Date:** 2026-09-26  
**Purpose:** classify the real commercial/relationship capability surface after the MED-CRM-001 foundation merge, before selecting the next implementation slice.

> This is an evidence-backed snapshot, not a permanent state claim. Re-measure against current `origin/main`, active PRs and runtime when the question depends on deployment.

## Proof boundary

The Commercial Core foundation is **PROVED + MERGED**, not RELEASED.

- PR #522 merged as `652ea7b3aea4cd03a09944b780ef697168016bc3`.
- PR #523 merged as `542fd289bb8060c7c0c69b20359f0b758092d946`.
- #522 final head had 8/8 required workflows SUCCESS.
- Commercial Core SQL harness was previously proven on PostgreSQL 16.15 and 17.11.
- No production rollout of the #522 migration was observed in this reconciliation.

Runtime was therefore not used to infer that the new Commercial Core is deployed.

## Classification vocabulary

- **EXISTS** — canonical capability exists for its current bounded purpose.
- **PARTIAL** — useful foundation/behavior exists, but the target capability is incomplete.
- **GAP** — required capability has no adequate canonical implementation.
- **CONFLICT** — an existing behavior competes with or contradicts the target authority.
- **FUTURE** — intentionally deferred until prerequisite capabilities become stable.

## Capability map

| Capability | State | Proven current authority / evidence | Residual gap / boundary |
| --- | --- | --- | --- |
| Tenant identity, membership, active profile | EXISTS | `clinic_id`, `current_active_profile()`, tenant lifecycle/RLS foundations | never accept browser-selected tenant as authority |
| CRM entitlement + role read boundary | EXISTS | `crm.access`; Commercial Core read guard; canonical roles | mutation operations still need their own server-side role checks |
| Contact identity substrate | EXISTS | `contacts`, tenant-scoped, optional Patient link, phone/email not identity keys | no authorized browser/domain mutation operation yet |
| Lead/Pipeline/Stage/Activity data model | EXISTS | `crm_leads`, `crm_pipelines`, `crm_stages`, `crm_lead_activities`; stage-driven outcome | mutation boundary and operable UI absent |
| Commercial read projections | EXISTS | authenticated SECURITY DEFINER current-clinic projections | read-only by design |
| Commercial mutation/domain commands | GAP | raw browser DML intentionally revoked; no Contact/Lead/stage mutation RPCs in #522 | prerequisite for UI/API/AI/automation parity |
| Commercial activity/audit side effects | PARTIAL | activity table + `audit_log` authority exist | no single domain writer guarantees both for commercial mutations |
| Pipeline/stage administration | PARTIAL | configurable schema + default generic pipeline/stages | no owner/admin operation/UI for create/reorder/archive/configure |
| Loss reasons | PARTIAL | lost stage requires reason in DB invariant | no product writer/catalog/reporting UX yet |
| Existing `/crm` commercial board | CONFLICT | `src/pages/Crm.tsx` still groups/moves `patients.funil_stage` | must not remain the commercial source of truth after cutover |
| Patient Journey | EXISTS | `patients.funil_stage`, `patient_journey_events`, clinical transition boundary | preserve as Patient/clinical journey; do not repurpose as Lead pipeline |
| Pre-clinical reception intake | GAP | current quick patient registration creates Patient early | Contact/Lead path needed before clinical identity is justified |
| Lead → Patient conversion | FUTURE | design requires explicit, atomic, idempotent conversion and Patient Registry reuse | depends on stable commercial commands and fresh Patient Registry reuse review |
| Agenda / appointment operations | EXISTS | conflict/capacity/finder/reschedule/status boundaries; Appointment remains Patient-bound | no direct Lead appointment authority in V1 |
| Commercial → Agenda handoff | FUTURE | Agenda can search/select slots, but appointment requires Patient | follows explicit conversion/link policy; do not weaken Appointment authority |
| WhatsApp outbound/outbox/status/webhook | EXISTS | `wa_logs`, worker secret, Evolution worker/webhook, reconciliation of uncertain delivery | provider remains adapter; not commercial domain authority |
| Communication configuration/templates | EXISTS | tenant settings, templates admin boundary, `whatsapp.access` | tenant-facing provider health remains partially open per canonical docs |
| Inbound reply handling + human review | EXISTS | normalized webhook path, response policies, `needs_human`, review queue | currently template/patient-oriented, not a general Conversation aggregate |
| Unified Inbox / Conversation model | PARTIAL | Message Center + inbound/outbound log + review queue exist | no Contact/Lead-centric thread ownership, claim/transfer/release or multichannel conversation authority |
| Patient reactivation | EXISTS | eligibility, opt-in/opt-out, cooldown, manual queue + controlled auto tick | Patient retention only; must not be confused with Lead follow-up |
| Waitlist recovery | EXISTS | waitlist offers + automation/reply handling | separate operational domain; reuse mechanics, not entity semantics |
| Commercial Lead follow-up / next action | GAP | no canonical Lead task/next-action command found; Commercial Core has no such operation | should build on commercial commands, not Patient reactivation tables |
| Automation runtime/orchestration | EXISTS | `medicspro-automation`, domain RPC ticks, `automation_runs`, Evolution worker | domain-specific; do not create a second generic engine without reuse proof |
| Generic CRM automation/journeys | FUTURE | existing automation can orchestrate domain commands | requires commercial commands + conversation/event semantics first |
| Commercial AI / agent tools | GAP | doctrine defines narrow domain tools; no commercial AI/RAG/tool platform in current tree | should enter only after domain commands, handoff and deterministic guards |
| Clinical AI / Nexus | EXISTS | separate clinical engine/governance | explicitly not authority for commercial AI |
| Source capture on Lead | PARTIAL | `crm_leads.source` + `source_metadata` | no canonical campaign/touch/click-ref/UTM identity or validation contract |
| Marketing attribution | GAP | no dedicated acquisition/attribution domain in current tree; TODO keeps origin/campaign open | needs immutable/traceable source chain before provider conversion APIs |
| Commercial funnel analytics | GAP | no Lead-stage conversion reporting over Commercial Core yet | depends on operational Lead mutations/events |
| Operational/financial reporting | EXISTS | reporting metrics, recovery ROI, NPS, finance and retention views | must remain role/context-safe |
| Retention/churn prioritization | EXISTS | transparent churn rule, Treatment Continuity Watch, reactivation | current score is operational heuristic, not AI prediction |
| Revenue recovery metrics | EXISTS | recovery events/ROI surfaces distinguish realized vs pipeline and avoid unsupported causality | commercial campaign revenue attribution remains separate |
| Contact/Lead consent + privacy lifecycle | PARTIAL | Patient WhatsApp opt-out and Contact anonymization fields exist; MED-CRM-001 mandates LGPD lifecycle | Contact/Lead export/anonymization/reconciliation operation still required before release |
| Tenant communication/provider health | PARTIAL | worker/server observability + platform automation telemetry exist | canonical docs still call tenant-facing connection/provider health a residual gap |
| Event/async effect core | PARTIAL | outbox, claim/retry/reconciliation, automation ticks and recovery patterns already exist | first prove extension suffices before creating any generic Event Core |
| Human operational ownership | PARTIAL | review queue exists for WhatsApp ambiguity | broader Inbox/case ownership and explicit claim/transfer/release are not yet canonical |

## Conflicts that must be retired deliberately

### 1. Patient funnel as commercial CRM

Current `/crm` is still Patient-backed:

```text
Patient.funil_stage
  → CRM columns
  → direct patient-stage writer
```

Target authority is now:

```text
Contact
  → Lead
  → crm_stages
  → crm_lead_activities
```

The old Patient journey cannot be silently deleted because it is consumed outside CRM and includes clinical/assistential semantics. Cutover is a later bounded slice.

### 2. Retention != acquisition follow-up

Patient reactivation is already a mature Patient-domain capability. It is not a justification to model pre-clinical Lead follow-up on Patient or to auto-create Patient.

### 3. Message log != Unified Inbox

`wa_logs` + review queue prove transport/reply/review mechanics. They do not make a general Contact/Lead Conversation aggregate unnecessary, nor do they authorize copying provider identity into domain identity.

## Capability Authority / Reuse Gate summary

### REUSE

- `clinic_id`, active profile and clinic lifecycle;
- `crm.access` and canonical role model;
- Commercial Core tables/read projections;
- `audit_log`;
- current WhatsApp outbox/webhook/worker and Evolution adapter;
- current automation orchestrator where an async tick is needed;
- Agenda conflict/capacity/appointment operations;
- Patient Registry for future explicit conversion;
- Patient retention/reactivation for Patient lifecycle only;
- Finance/reporting foundations for downstream revenue outcomes.

### EXTEND

- Commercial Core with one canonical mutation boundary;
- Message Center toward a future Contact/Lead conversation model only after domain identity is stable;
- recovery/analytics with commercial events after those events exist.

### DO NOT REBUILD

- tenant/RLS/RBAC;
- `crm.access`;
- Patient/Encounter/Patient Journey;
- Agenda;
- Finance;
- Evolution delivery pipeline;
- automation runner;
- audit log;
- clinical Nexus.

### DEFER

- Lead→Patient conversion;
- Unified Inbox;
- generic follow-up graph;
- commercial AI/MCP/RAG;
- Meta/Google attribution adapters;
- generic Event Core unless existing async foundations fail a concrete requirement.

## Dependency graph

```text
CANONICAL TENANT / RBAC / crm.access
             │
             ├───────────────┐
             ▼               │
COMMERCIAL CORE #522         │
Contact/Lead/Pipeline/Stage  │
             │               │
             ▼               │
COMMERCIAL COMMAND BOUNDARY  │  ← highest-unlock missing primitive
(create/update/move +         │
 activity/audit parity)      │
      │          │           │
      │          ├──────────────→ PIPELINE/STAGE ADMIN
      │          │
      │          └──────────────→ COMMERCIAL ANALYTICS EVENTS
      │
      ├────────→ CRM BOARD CUTOVER
      │             │
      │             └────→ RECEPTION PRE-CLINICAL INTAKE
      │
      ├────────→ LEAD NEXT ACTION / FOLLOW-UP
      │
      ├────────→ INBOX Contact/Lead linkage
      │             │
      │             └────→ HUMAN OWNERSHIP / HANDOFF
      │
      ├────────→ ATTRIBUTION CAPTURE
      │             │
      │             └────→ campaign → lead → downstream outcome analytics
      │
      └────────→ EXPLICIT LEAD→PATIENT CONVERSION
                    │
                    ├────→ PATIENT REGISTRY reuse
                    └────→ AGENDA handoff (Appointment remains Patient-bound)

EXISTING CHANNEL / OUTBOX / WEBHOOK ───────────────┐
EXISTING AUTOMATION ORCHESTRATOR ─────────────────┤
EXISTING RETENTION / WAITLIST ────────────────────┤
EXISTING AGENDA / FINANCE ────────────────────────┘
                                                  │
                         reuse these after domain commands exist
                                                  ▼
                               AUTOMATION / AI / ROI CLOSED LOOP
```

## Selection rule for the next micro-slice

A candidate should maximize:

1. number of downstream capabilities unblocked;
2. reuse of existing authority;
3. low schema/clinical blast radius;
4. deterministic tenant/security proof;
5. ability to keep provider/AI/UI as callers rather than authorities.

By this dependency graph, the first missing primitive to evaluate is the **Commercial Command Boundary**. It must still pass its own GAPS → REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW before execution.

## Re-measure

Before acting on this map:

1. resolve current `origin/main`;
2. re-read active PR/branch state;
3. inspect any newer CRM/contact/channel migrations;
4. do not infer deployment from merge;
5. use runtime only if the decision depends on what is actually deployed.
