# MED-CRM-001 — Post-Foundation Capability Map

**Audited against:** `main@7a8badf5ad81e92746e82bedd142ba75899a4080`
**Date:** 2026-09-26
**Purpose:** classify the real commercial/relationship capability surface after MED-CRM-001 + MED-CRM-002 repository integration, before any next feature executes.

> This is an evidence-backed snapshot, not a permanent state claim. Re-measure against current `origin/main`, active PRs and runtime when the question depends on deployment.

## Proof boundary

The Commercial Core foundation and command boundary are **PROVED + MERGED**, not RELEASED.

- PR #522 merged as `652ea7b3aea4cd03a09944b780ef697168016bc3`.
- PR #523 merged as `542fd289bb8060c7c0c69b20359f0b758092d946`.
- PR #524 merged as `7a8badf5ad81e92746e82bedd142ba75899a4080`.
- #524 final PR head `cf94434...` completed 21/21 repository workflows SUCCESS.
- Dedicated Commercial CRM harness passed PostgreSQL 16.15 and 17.11, migration replay, MED-CRM-001 verifier, MED-CRM-002 verifier and 13 behavior cases.
- `validate` and `dependency-audit` were SUCCESS.
- No production rollout/schema installation of #522/#524 was proved in this reconciliation.

Runtime was not used to infer deployment because the available `medicspro-agent` target does not expose production DB/container readback.

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
| CRM entitlement + role boundary | EXISTS | `crm.access`; current active profile; canonical roles; #524 mutator guard | owner/admin/recep write; professional/financeiro remain read-only |
| Contact identity substrate | EXISTS | `contacts`, tenant-scoped, optional Patient link, phone/email not identity keys; #524 create command | edit/merge/dedupe/privacy operations remain separate |
| Lead/Pipeline/Stage/Activity data model | EXISTS | `crm_leads`, `crm_pipelines`, `crm_stages`, `crm_lead_activities`; stage-driven outcome; #524 create/transition commands | operable Commercial UI still absent |
| Commercial read projections | EXISTS | authenticated SECURITY DEFINER current-clinic projections | read-only by design |
| Commercial mutation/domain commands | EXISTS | #524 current-clinic Contact create, Lead create and same-pipeline stage transition | no generic CRUD; future mutations must reuse this authority |
| Commercial activity/audit side effects | EXISTS | #524 writes commercial activity + `audit_log` atomically for Lead create/stage change and audit for Contact create | future command classes must preserve equivalent parity |
| Pipeline/stage administration | PARTIAL | configurable schema + default generic pipeline/stages | no owner/admin operation/UI for create/reorder/archive/configure |
| Loss reasons | PARTIAL | lost stage requires reason in DB invariant | no product writer/catalog/reporting UX yet |
| Existing `/crm` commercial board | CONFLICT | `src/pages/Crm.tsx` still groups/moves `patients.funil_stage` | must not remain the commercial source of truth after cutover |
| Patient Journey | EXISTS | `patients.funil_stage`, `patient_journey_events`, clinical transition boundary | preserve as Patient/clinical journey; do not repurpose as Lead pipeline |
| Pre-clinical reception intake | GAP | current quick patient registration creates Patient early | Contact/Lead path needed before clinical identity is justified |
| Lead → Patient conversion | FUTURE | design requires explicit, atomic, idempotent conversion and Patient Registry reuse | commands are now merged; still requires fresh Patient Registry review + runtime release proof |
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
| Generic CRM automation/journeys | FUTURE | existing automation can orchestrate domain commands | command primitive exists; still requires conversation/event semantics and release proof first |
| Commercial AI / agent tools | GAP | doctrine defines narrow domain tools; no commercial AI/RAG/tool platform in current tree | should enter only after domain commands, handoff and deterministic guards |
| Clinical AI / Nexus | EXISTS | separate clinical engine/governance | explicitly not authority for commercial AI |
| Source capture on Lead | PARTIAL | `crm_leads.source` + `source_metadata` | no canonical campaign/touch/click-ref/UTM identity or validation contract |
| Marketing attribution | GAP | no dedicated acquisition/attribution domain in current tree; TODO keeps origin/campaign open | needs immutable/traceable source chain before provider conversion APIs |
| Commercial funnel analytics | GAP | no Lead-stage conversion reporting over Commercial Core yet | commands/events exist, but operable Commercial Core usage and reporting surface remain absent |
| Operational/financial reporting | EXISTS | reporting metrics, recovery ROI, NPS, finance and retention views | must remain role/context-safe |
| Retention/churn prioritization | EXISTS | transparent churn rule, Treatment Continuity Watch, reactivation | current score is operational heuristic, not AI prediction |
| Revenue recovery metrics | EXISTS | recovery events/ROI surfaces distinguish realized vs pipeline and avoid unsupported causality | commercial campaign revenue attribution remains separate |
| Contact/Lead consent + privacy lifecycle | PARTIAL | Contact anonymization fields exist and #524 refuses replay/new Lead for anonymized Contact | export/anonymization/reconciliation operations and consent semantics remain incomplete |
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

- Commercial Core consumers through the merged canonical mutation boundary;
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
COMMERCIAL COMMAND BOUNDARY  │  ← MERGED / PROVED, NOT RELEASED
(create Contact/Lead +        │
 stage transition + audit)   │
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

The former highest-unlock primitive — Commercial Command Boundary — is now closed in the repository.

The strongest remaining product conflict is:

```text
current /crm
→ Patient.funil_stage
→ setFunilStage
```

while the canonical commercial authority is now:

```text
Contact
→ Lead
→ crm_stages
→ current-clinic CRM projections/commands
```

A narrow **CRM Board Cutover V1** is therefore the leading next-product candidate because it can retire a competing commercial authority without adding schema, provider, AI or Patient conversion.

However, it is **not authorized for EXECUTION yet**.

Immediate blocker:

- MED-CRM-001/002 are merged but not RELEASED;
- production installation of #522/#524 has not been proved;
- the current session target cannot read the production database/containers;
- adversarial review of starting the Board before this proof returned `block=0.98`, confidence `0.97`.

Therefore the immediate next gate is **production rollout/readback of #522/#524**, not a new feature branch. After release proof, re-run GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW before creating MED-CRM-003.

## Re-measure

Before acting on this map:

1. resolve current `origin/main`;
2. re-read active PR/branch state;
3. inspect any newer CRM/contact/channel migrations;
4. do not infer deployment from merge;
5. use runtime only if the decision depends on what is actually deployed.
