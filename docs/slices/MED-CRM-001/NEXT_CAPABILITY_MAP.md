# MED-CRM-001 — Post-Foundation Capability Map

**Audited against:** repository `main@9ed72fa51b536a9efa8b35b910fbb49547daf7fa` plus production runtime evidence from `28server/supabase-db` on 2026-09-27
**Date:** 2026-09-27
**Purpose:** classify the real commercial/relationship capability surface after MED-CRM-001 + MED-CRM-002 repository integration, before any next feature executes.

> This is an evidence-backed snapshot, not a permanent state claim. Re-measure against current `origin/main`, active PRs and runtime when the question depends on deployment.

## Proof boundary

The Commercial Core foundation and Command Boundary are now **PROVED + MERGED + RELEASED** for their bounded backend scopes.

- PR #522 merged MED-CRM-001 as `652ea7b3aea4cd03a09944b780ef697168016bc3`.
- PR #524 merged MED-CRM-002 as `7a8badf5ad81e92746e82bedd142ba75899a4080`.
- PR #529 merged the additive baseline reconciliation required by the real production runtime.
- Production host `28server`, PostgreSQL container `supabase-db` (`supabase/postgres:17.6.1.136`).
- Core migration SHA-256 `23c433e36e0513aeddc9eae8ba6c1c34ba7c17854d07c4f3a796c66e2f8c0331` applied and committed.
- Command migration SHA-256 `f8f38a0db0fd020713a89eeecb6abd6df4e414b89ffb2ae6457ee8c777ac9a13` applied and committed.
- Core verifier SHA-256 `da5f4bcfbd25c15fc2c654a59761e1fb9863e88608a65d57e6d44d8253913c8c` returned `COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED`.
- Command verifier SHA-256 `7d4a4ff23f9d70c3e808e0a8fcb696c2b8565ef0a64955532566de0a69753b34` returned `COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED`.
- The Core verifier was rerun after Command Boundary rollout and remained green.

Release proof covers the backend foundation and command boundary only. It does not imply CRM Board/UI cutover or any later commercial capability.

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
COMMERCIAL COMMAND BOUNDARY  │  ← PROVED / MERGED / RELEASED
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

The release blocker that previously prevented any next Commercial CRM slice is now closed.

The strongest known product authority conflict remains:

```text
current /crm
→ Patient.funil_stage
→ setFunilStage
```

while the released commercial authority is:

```text
Contact
→ Lead
→ crm_stages
→ current-clinic CRM projections/commands
```

A narrow **CRM Board Cutover V1** remains a plausible next candidate because it could retire a competing commercial authority without introducing a new domain engine. That observation is **not an execution authorization**.

Before creating or executing MED-CRM-003, reconstruct current `origin/main`, open PRs and relevant runtime, then run the full pre-execution discipline again:

```text
GAPS
→ CAPABILITY AUTHORITY / REUSE GATE
→ DECISION
→ SECOND ADVERSARIAL REVIEW
```

The new review must prove that the Board cutover still outranks other candidates and can consume the released Contact/Lead authority without mutating Patient Journey semantics. Until those gates close, MED-CRM-003 remains only a candidate.

## Re-measure

Before acting on this map:

1. resolve current `origin/main`;
2. re-read active PR/branch state;
3. inspect any newer CRM/contact/channel migrations;
4. do not infer deployment from merge;
5. use runtime only if the decision depends on what is actually deployed.
