# MED-DOC-001 — Cross-Cutting Lessons

**Deskcomm snapshot:** `8e26e2fa763dc04a565742d52c36c8172bcab3a3`

This document mines recurring lessons from research, handoffs and implementation plans.

Promotion rule: a lesson becomes stable discipline only when it recurs across independent workstreams or has high enough safety/data/operational severity.

## 1. One concept, one ruler

Recurring failure families include AI spend, lead risk windows, provider/channel capability, handoff/silence state and CRM mutation paths.

**Lesson:** if two surfaces answer the same domain question, reuse one authoritative computation/operation or explicitly prove why they cannot.

**MedicsPro classification:** DOCTRINE / DOMAIN DESIGN.

## 2. Silent fallback is usually worse than explicit refusal

Recurring cases include dead events without notice, missing configuration treated as success, database error interpreted as not-found, automation marked successful while delivery failed, unknown provider fallthrough and stale work acting on newer state.

Prefer explicit outcomes such as `not_configured`, `not_authorized`, `not_applicable`, `uncertain`, `stale`, `dead`, or `skipped(reason)`.

**MedicsPro classification:** DOCTRINE + OPERABILITY.

## 3. Same mutation, same side effects

Lead movement by UI/API/MCP/AI repeatedly exposed drift when paths wrote directly instead of sharing the canonical operation. The historical missing `lead.stage_changed` event is the strongest example.

Target shape:

    UI / API / MCP / AI / Automation
                    ↓
          canonical domain operation
                    ↓
        state + audit + event + invariants

**MedicsPro classification:** DOCTRINE / CORE INVARIANT.

## 4. A configuration without a consumer is dead data

Reference work repeatedly found settings written by UI but ignored by runtime, duplicate settings with only one consumer, or future-looking fields stored without effect.

Prove: surface writes → canonical store persists → runtime reads → behavior changes → readback shows effective state.

**MedicsPro classification:** LIVING SYSTEM GATE + CI where enumerable.

## 5. Positive sets fail safer than negative sets

A documented follow-up defect came from a negative status list: a new status passed by omission. The safer model was an explicit positive set allowed to proceed.

**MedicsPro classification:** SECURITY/AUTHORIZATION PRINCIPLE.

Strong candidates: clinical action eligibility, tool catalog, outbound capabilities, destructive actions and workflow transitions.

## 6. Async work needs episode/version identity

ServiceBoundary, follow-up enrollment versions, optimistic movement locks, handoff state and appointment recovery all solve the same problem: work may execute after the state that authorized it has changed.

**Lesson:** async mutable work must carry enough identity/version to revalidate that it still belongs to the same current episode/resource state.

**MedicsPro classification:** DOCTRINE CANDIDATE + ADR PER DOMAIN.

Do not create a universal `Demand` aggregate without a proven need.

## 7. Model-visible output is part of the security boundary

The three-role agent measurement found leaks from tool description, tool name and raw tool result data.

Tool authorization is insufficient; control which tools, descriptions and result fields reach each model/role.

**MedicsPro classification:** AI DOCTRINE / PRIVACY & SAFETY.

## 8. A test must prove the property, not today’s example

Recurring examples: capability→route ownership, RLS completeness discovery, channel lint debt-ratchet, JobKind→map coverage and MCP catalog↔handler parity.

Prefer: derive set → assert property → guard against empty/vacuous discovery.

**MedicsPro classification:** SLICE METHOD / CI DISCIPLINE.

## 9. Prove that the proof fails

High-value Deskcomm work repeatedly uses sabotage: introduce the target defect, predict which tests should fail, confirm the mutation was actually applied, run, compare predicted vs measured red set, restore, rerun green.

Sabotage that fails only by TypeError may prove execution, not the intended invariant.

**MedicsPro classification:** ENGINEERING MANUAL / HIGH-RISK DoD, not universal doctrine.

## 10. Documentation changes can invalidate proof

Several handoffs record an important process bug: tests ran green, then documentation/evidence references changed, making the final tree fail a documentation gate.

**Lesson:** final validation runs against the final tree after documentation/evidence updates.

**MedicsPro classification:** SLICE METHOD / CI.

## 11. Handoff is evidence-rich context, not authority

Multiple handoffs later correct earlier claims. A handoff should carry last reconciled SHA, proven/inferred/open and next exact step. A new session repeats REAL NOW.

**MedicsPro classification:** ALREADY ABSORBED.

## 12. Main, release and deployed runtime are three different truths

The worker-remediation incident showed behavior present on main but absent from the published tag/installed kit.

For runtime claims record: main SHA, release/tag, image digest/build, deployed version and runtime readback.

**MedicsPro classification:** RUNBOOK / RELEASE DISCIPLINE.

## 13. Provider-real proof is separate

Recent social, ads, Meta-template and WhatsApp work repeatedly distinguishes code/test, local transport, sandbox, real provider and production.

**MedicsPro classification:** SLICE METHOD / INTEGRATION DoD.

## 14. Failure visibility needs an owner and a door

Dead events, stuck messages, handoffs, provider failures, missing configuration and stale work become harmful when the only trace is a log nobody sees.

Ask: who needs to know? where do they see it? what can they do next? what closes/resolves it?

**MedicsPro classification:** LIVING SYSTEM DOCTRINE.

## 15. Deliberate non-links are architecture

A forbidden connection can be as important as a required edge.

High-value MedicsPro non-links:

- commercial RAG -X-> patient chart
- platform admin -X-> implicit clinic clinical access
- Converser -X-> operator-only raw tools
- channel provider -X-> authorization authority
- Lead event -X-> implicit Patient creation

**MedicsPro classification:** DOCTRINE + ARCHITECTURE MAP.

## 16. What remains reference-specific

Do not promote as MedicsPro law: WAHA-specific thresholds, Deskcomm organization tenancy, agency-console semantics, self-host packaging mechanics, extension marketplace rules, Nuvemshop concepts, exact role names or exact worker topology.

## Promotion summary

| Lesson | Destination |
| --- | --- |
| one concept, one ruler | doctrine/domain design |
| explicit refusal/uncertainty | doctrine |
| same mutation, same side effects | doctrine |
| config must have consumer/surface | living-system gate |
| positive allowlists/fail closed | security doctrine |
| async revision/episode revalidation | doctrine candidate + ADR |
| model output projection | AI doctrine |
| derived property tests/vacuity | CI/method |
| sabotage | manual/high-risk DoD |
| final-tree revalidation | slice method/CI |
| handoff is not authority | already in method |
| main != release != runtime | runbook/manual |
| provider proof levels | integration DoD |
| failure owner/door/closure | living-system doctrine |
| deliberate non-links | architecture/doctrine |

## JEV review

The promotion set was submitted for adversarial review.

- route recommendation: `deep_review` (0.72 probability);
- guard decision: `allow`, but low confidence (0.30).

Therefore several items remain candidates rather than immediately rewriting stable doctrine. Promotion into `docs/doctrine/` should happen after MedicsPro applies the lesson in real slices, or when an existing MedicsPro invariant clearly already matches.