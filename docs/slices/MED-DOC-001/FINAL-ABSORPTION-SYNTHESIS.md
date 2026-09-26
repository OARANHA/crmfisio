# MED-DOC-001 — Final Absorption Synthesis

**Deskcomm audit snapshot:** `8e26e2fa763dc04a565742d52c36c8172bcab3a3`

## Purpose

Transform the audit into actionable MedicsPro absorption decisions.

The goal is not to reproduce Deskcomm. The goal is to reuse proven invariants, failure lessons and operational disciplines while keeping MedicsPro sovereign in clinical domain, tenancy, authorization, runtime and provider choices.

## Global rule

    absorb the problem/invariant
        ↓
    identify MedicsPro authority
        ↓
    check existing foundation
        ↓
    ADAPT / REUSE / REBUILD / DEFER / REJECT
        ↓
    prove in MedicsPro

External proof never becomes MedicsPro proof automatically.

## Proof vocabulary

- `DOC_ONLY`
- `CODE_PRESENT`
- `UNIT_PROVEN`
- `DB_INVARIANT_PROVEN`
- `INTEGRATION_PROVEN`
- `E2E_LOCAL_PROVEN`
- `SABOTAGE_PROVEN`
- `PROVIDER_SANDBOX_PROVEN`
- `PROVIDER_REAL_PROVEN`
- `RUNTIME_REHEARSED`
- `PRODUCTION_OBSERVED`

## A. MED-CRM-001 — Commercial Core

### Absorb/adapt

- Contact and Lead are distinct aggregates.
- A Contact may have multiple Leads; do not infer one permanent opportunity per person.
- Pipeline/stage vocabulary belongs to the clinic/business context, not hardcoded specialty labels.
- Loss reasons should be structured and reportable.
- Commercial activity timeline is separate from clinical history.
- Ambiguous Contact→active Lead resolution must fail safely; do not guess the wrong opportunity.
- Human/API/MCP/AI stage movement must use one canonical domain operation and emit the same side effects.
- Conversion to Patient is an explicit MedicsPro operation, not a Deskcomm concept to copy.

### Reject

- Deskcomm organization tenancy.
- Deskcomm roles as MedicsPro roles.
- implicit Patient creation from message/form/social identity.
- e-commerce default pipeline semantics.

### Evidence from reference

- Contact/Lead/Pipeline structures: current code/migrations present.
- stage-event parity: current unit/code proof.
- loss reason enforcement: current DB/server proof.

### MedicsPro target invariant

    Contact != Lead != Patient

and

    moveLeadStage()
      → state
      → commercial activity
      → canonical domain event
      → same result regardless of ingress

## B. MED-EVENT-001 — Event / Async Effect Core

### Absorb/adapt

- bounded retry;
- stale-processing reaper;
- explicit dead state;
- idempotency/dedup;
- claim with concurrency control;
- terminal failure visible to an operator;
- no-handler and not-applicable states distinct from failure;
- async work revalidates episode/resource revision before mutable effect.

### Reference proof

`event_log` drain and agent drain have strong current code + DB-invariant proof.

### MedicsPro gate

Do not create an Event Core if existing MedicsPro automation/outbox foundations can be extended to satisfy the invariant. `CAPABILITY AUTHORITY / REUSE GATE` decides first.

## C. MED-CHANNEL-001 — Channel Platform

### Absorb/adapt

- provider adapter seam;
- capability matrix instead of provider literals;
- unknown/unsupported provider fails closed;
- social identity distinct from phone/WhatsApp identity;
- webhook authentication before effect;
- uncertain delivery requires reconciliation, not blind resend;
- pre-go-live/test mode before broad AI automation;
- sink re-checks eligibility immediately before external effect.

### Keep MedicsPro authority

Evolution remains the current WhatsApp provider unless a separate decision changes it.

### Reject

- WAHA-specific numeric rules;
- WAHA-specific session mechanics as architecture;
- Zernio as mandatory social provider.

### Proof level

Channel seam: current code/unit/invariant patterns.
Social: local schema/unit/invariant/integration proof; provider-real proof remains separate.

## D. MED-INBOX-001 — Unified Inbox / Human Operations

### Absorb/adapt

- Conversation is not Lead and not Patient.
- Atomic claim/transfer/release.
- Human takeover must be explicit and visible.
- Returning to automation is a separate operation with clear state.
- Case/task for back-office work can coexist with conversation handoff.
- A dead/stuck operational demand needs owner, visible surface, next step and closure.

### Healthcare adaptation

Clinical decisions must not be delegated to generic operational cases.

Use cases can include:

- insurance/authorization;
- reception issue;
- finance exception;
- document/admin follow-up;
- operational escalation.

## E. MED-ACQ-001 — Acquisition & Attribution

### Absorb/adapt

- click-ref token pattern;
- org/clinic-scoped single consumption;
- preserve `gclid`, `gbraid`, `wbraid` and allowed UTMs;
- attribution is attached to Contact/Lead without inventing Patient;
- conversion dispatch ledger;
- isolated reprocessing;
- local proof and provider-real proof recorded separately.

### MedicsPro target chain

    campaign
      → Contact
      → Lead
      → Appointment
      → Show / No-show
      → Patient conversion
      → Payment / real revenue

Do not optimize merely for lead count if downstream clinical/business conversion can be measured.

## F. MED-AI-001 — AI Platform / MCP / RAG

### Absorb/adapt

- Converser != Operator != Clinical Intelligence != Human Professional.
- Tool visibility and tool-result projection are separate security controls.
- MCP exposes narrow domain tools, not raw SQL.
- UI/API/MCP/AI converge on the same domain service.
- tool catalog ↔ handler correspondence should be mechanically derived/tested.
- Knowledge != Organizational Memory != Clinical Data.
- RAG failure returns explicit unavailable/no-answer state rather than invented answer.
- search telemetry must not break the answer, but telemetry failure cannot be silent.
- provider/model cost has one canonical ruler.
- shadow/observer mode before granting new decision authority.

### MedicsPro clinical rule

Generic commercial/admin RAG never ingests patient chart data automatically.

Clinical knowledge and clinical decision support remain under Nexus/clinical governance.

## G. MED-AUTO-001 — Follow-up / Journeys

### Absorb/adapt

- immutable/versioned flow graph;
- enrollment pinned to a version;
- one controlled step per tick;
- idempotent node/action ledger;
- bounded retry/backoff/dead visibility;
- action enqueue and action completion are distinct;
- human handoff and opt-out interrupt appropriately;
- stale episode/revision blocks obsolete automation;
- feedback/outcome closes the loop.

### Sequence

Do not implement before Commercial Core + Event/Async foundation + Conversation/channel boundaries are stable.

## H. MED-OPS-001 — Operational Discipline

### Absorb

- `healthy` internal process != public/user-visible healthy;
- precheck → mutation → independent readback → user-relevant smoke → rollback;
- main != release != deployed runtime;
- runbook marks verified vs unverified steps;
- migration proof includes fresh install and upgrade path;
- consequential failure must have visible operational owner/door.

### MedicsPro/VPS

MCP_WANDORA_VPS should be used to prove runtime only when the question depends on runtime.

Repository architecture decisions stay repository-driven.

## I. MED-DOC / Engineering Discipline

### Absorb

- typed knowledge: doctrine / ADR / spec / evidence / runbook / snapshot / handoff;
- research labels `CONFIRMED / INFERRED / PROPOSED`;
- measurable facts should document how to re-measure;
- handoff is context, not authority;
- final validation runs after docs/evidence edits;
- property tests derive enumerations and include vacuity guards;
- selective sabotage for high-risk invariants;
- architecture maps declare deliberate non-links;
- maps should encode `AS-IS / TRANSITION / TO-BE` plus proof metadata.

### Healthcare evidence restriction

No real patient/clinical data should be committed as evidence.

Use synthetic/sanitized fixtures. Production-sensitive evidence belongs in an approved secure operational system, with only sanitized references committed.

## Cross-slice dependency order

    MED-DOC-001  (knowledge mining; advisory)
          │
          ├──────────────┐
          ▼              │
    MED-CRM-001          │
          │              │
          ▼              │
    MED-EVENT-001        │
          │              │
          ▼              │
    MED-CHANNEL-001      │
          │              │
          ▼              │
    MED-INBOX-001        │
          ├──────────┐   │
          ▼          ▼   │
    MED-ACQ-001   MED-AI-001
          │          │
          └────┬─────┘
               ▼
          MED-AUTO-001

Operational discipline applies across all slices, not as a late phase.

## What the audit changed from the initial plan

1. Deskcomm docs are no longer treated as a feature catalog; they are a history of decisions, proof and failures.
2. Architecture maps are useful but need state/proof metadata before MedicsPro should adopt the pattern.
3. Business-rule catalogs are semantic indexes, not implementation proof.
4. Specs can remain useful after becoming stale; their epistemic role must be labeled.
5. Proof level is now independent from adoption decision.
6. External/provider proof is explicitly separated from local E2E.
7. Async stale-work revision boundaries deserve first-class architectural consideration.
8. Human/AI separation must include result projection, not just tool visibility.
9. Evidence handling in healthcare must be stricter than the reference project.
10. MedicsPro can absorb the Deskcomm discipline without importing its product/runtime architecture.

## Proposed future MedicsPro manual

Do not publish this as authoritative yet. Build it from real MedicsPro slices after the discipline has been exercised.

Candidate chapters:

1. Sources of truth and how to start work
2. Doctrine and non-negotiable boundaries
3. REAL NOW and proof levels
4. Capability Authority / Reuse Gate
5. ADRs and when to reconsider
6. How to design a living capability
7. Tenant and clinical authorization
8. AI, humans and domain tools
9. External channels and irreversible effects
10. Async work, idempotency and recovery
11. Testing, sabotage and evidence
12. Architecture maps and deliberate non-links
13. Runbooks, releases and runtime readback
14. Handoffs between humans/agents/chats
15. Documentation drift and reconciliation

## MED-DOC-001 completion criterion

The audit can move to `PROVED` as documentation/research work when:

- all four audit artifacts are reconciled against the chosen Deskcomm snapshot;
- the adoption matrix points to the audited snapshot and proof vocabulary;
- the slice handoff names the remaining optional deep dives instead of hiding them;
- no product/runtime state is claimed to have changed;
- a final adversarial review confirms the synthesis does not create duplicate MedicsPro authority.