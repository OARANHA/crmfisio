# MED-DOC-001 — Specs, Architecture & Proof Review

**Deskcomm snapshot:** `melgarafael/DeskcommCRM@8e26e2fa763dc04a565742d52c36c8172bcab3a3`

This phase audits the relationship:

```text
SPEC
→ ARCHITECTURE MAP
→ CODE / MIGRATION
→ INVARIANT TEST
→ EVIDENCE / RUNBOOK
→ CURRENT REALITY
```

The key rule is epistemic:

> A spec may remain useful as lineage while no longer being the current contract.

## 1. Spec generations

The current `docs/specs/` directory mixes different generations and proof levels.

### Generation A — foundational design contracts (01–12)

Mostly dated 2026-04-28 / 2026-05-05, with statuses such as `em revisão`, `draft`, or `draft (pre-implementation)`.

| Spec | Audit classification | MedicsPro use |
| --- | --- | --- |
| 01 Platform Base | HISTORICAL FOUNDATION | mine invariants; never copy auth/tenancy/runtime |
| 02 Customer 360 | HISTORICAL FOUNDATION WITH SURVIVING DOMAIN IDEAS | strong reference for Contact/Lead separation, identity resolution and timeline |
| 03 WhatsApp WAHA | HISTORICAL + PROVIDER-SPECIFIC | reject WAHA constants/runtime; mine channel/outbox/idempotency lessons |
| 04 Pipeline + Atendimento | HISTORICAL CONTRACT | mine claim/assignment/Inbox/Kanban patterns; re-prove current behavior |
| 05 IA + RAG + Handoff | HISTORICAL ORIGIN | current agent-engine/RAG/handoff code supersedes many details |
| 06 Nuvemshop + LGPD | HISTORICAL + E-COMMERCE-SPECIFIC | mine privacy/audit patterns only |
| 07 Event Log + Workers | DRAFT ORIGIN, NOW STRONGLY IMPLEMENTED IN LATER CODE | important lineage; current code/tests are authority |
| 08 Deploy + Observability | HISTORICAL CONTRACT | current runbooks/runtime evidence outrank it |
| 09 Frontend↔Backend | HISTORICAL CONTRACT | use for API-contract ideas, not current endpoint inventory |
| 10 AI Agents Runtime | PRE-IMPLEMENTATION ORIGIN | largely superseded by current harness/agent-engine |
| 11 MCP Server | PRE-IMPLEMENTATION ORIGIN | useful lineage; current MCP has grown far beyond the original catalog |
| 12 AI Agents UI | PRE-IMPLEMENTATION ORIGIN | current UI/code is authority |

### Generation B — measured / transitional contracts (13–20)

These increasingly carry measured baselines, explicit source SHAs, DIRC/reuse reasoning or implementation state.

| Spec | Audit classification | Important note |
| --- | --- | --- |
| 13 Governança de Atendimento | TRANSITIONAL DESIGN + IMPLEMENTED WAVES | explicitly says some DDL is draft while other foundations already exist |
| 14 External Agent Governance | VERIFIED SNAPSHOT CONTRACT | verified at an older SHA; must be rechecked before current claims |
| 15 Human Cases | **STALE STATUS, IMPLEMENTATION NOW EXISTS** | header still says pre-implementation, but `human-cases.ts`, `case-reply-turn.ts` and DB tests exist |
| 16 Three Agent Roles | MEASURED CONTRACT | built from measured leakage; strong transfer value |
| 17 Conversation→Lead | MEASURED / IMPLEMENTED LINEAGE | current `nascimento-do-lead.ts` and event path prove the concept survived |
| 17 Friction Index | MAPPING / NOT IMPLEMENTED AT ITS SNAPSHOT | useful as product-measure research, not proof |
| 18 Voice Calls | DRAFT | defer for MedicsPro |
| 19 Agency Console | DRAFT | not MedicsPro authority |
| 20 External Database | IMPLEMENTED IN CUTS | useful tool/data-boundary lessons, lower priority |

### Generation C — recent implementation contracts

Files such as:

- `pre-go-live-whatsapp.md`;
- `redes-sociais-nativas.md`;
- `extensoes-declarativas-v1.md`;
- `modulo-instalado-onda-2.md`.

These are written closer to delivered code and explicitly state proof and limitations.

**Lesson:** recency + explicit proof raises confidence, but still does not replace current readback.

### Generation D — reconciliation

`RECONCILIATION-LOG.md` is valuable because it acknowledges that specs can conflict.

MedicsPro should absorb the **conflict-resolution discipline**, not the assumption that an old reconciliation log is eternally authoritative.

## 2. Concrete spec drift found

### S-D1 — Spec 11 MCP catalog drift

Spec 11 describes the initial MCP catalog as a small fixed set.

Current runtime:

- `app/api/mcp/route.ts` serves Streamable HTTP;
- `lib/mcp/server.ts` resolves auth-derived organization context, role, scope, rate limit, audit and idempotency;
- `lib/mcp/tools/index.ts` contains a much larger current tool set;
- `tests/unit/catalogo-servido.test.ts` enforces real handler ↔ catalog correspondence.

**Classification:** the spec is lineage, not current inventory.

**MedicsPro lesson:** tool catalogs must be derived/tested from current declarations; never maintain a manual count as authority.

### S-D2 — Spec 15 status drift

Spec 15 still says `Pré-implementação`.

Current tree contains:

- `lib/agent-engine/agent/human-cases.ts`;
- `lib/agent-engine/agent/case-reply-turn.ts`;
- `tests/invariants/human-cases.test.ts`;
- `tests/invariants/case-reply-turn.test.ts`.

The case-reply invariant runs against real Postgres for case→conversation resolution while mocking the LLM/send seam.

**Classification:** implementation exists, but not every end-to-end effect is proven by that test.

**MedicsPro lesson:** status fields need reconciliation or an explicit `audited_against` marker.

### S-D3 — architecture prose/count drift

The architecture README itself says its map list has already gone stale before.

The map test records another historical failure:

- `agent-turn.workflow.json` once claimed fewer before-send gates and fewer model calls than reality;
- the original file filter even missed that workflow map;
- the test was expanded to cover all JSON files and to derive JobKinds from code.

**MedicsPro lesson:** documentation gates must derive from the source they protect, with vacuity guards.

## 3. Architecture map model

At the audited SHA there are **34 JSON architecture/workflow maps**.

### What is strong

The JSON maps make hidden relationships explicit:

- input/output edges;
- human feedback loops;
- audit/readback paths;
- deliberate non-links;
- domain boundaries;
- shared rule ownership;
- error/retry visibility.

Examples:

- CRM Vivo makes human decision → next agent context explicit.
- IA 360 Organizar makes REST and MCP converge on the same domain operation.
- Pre-go-live shows configuration → shared gate → sink re-read → Inbox/audit.
- Central de Avisos separates “open context” from “resolve”.
- Conversion map includes dispatch ledger + retry + audit.
- RAG/acervo map connects indexing failure to a visible operational notice.

### What the current gate really proves

`tests/unit/mapas-de-arquitetura.test.ts` proves **internal structural coherence**:

- JSON parses;
- edges point to real nodes;
- nodes live in declared lanes;
- mainPath uses real IDs;
- nodes are not islands (with explicit debt exception);
- selected critical features have ≥2 edges / feedback loops;
- every runtime JobKind that represents an agent turn is represented in the turn map or explicitly excepted.

The test **explicitly says it does not prove that the map matches current code**.

This distinction must be preserved.

### Planned vs implemented can coexist

`crm-vivo.architecture.json` is explicitly described as a **PLANTA, not fotografia**.

The README says later waves may not yet exist in code while remaining legitimate contracted design.

This is useful, but the current generic schema does not consistently encode implementation state per node/edge.

## 4. MedicsPro architecture-map adaptation

**Decision:** `ADAPT STRONGLY`.

If MedicsPro adopts machine-readable architecture maps, extend the model.

Recommended node/edge metadata:

```text
state:
  as_is | transition | to_be

proof:
  code_paths[]
  migrations[]
  tests[]
  evidence[]
  runtime_required: boolean

last_reconciled:
  repo_sha
  date

authority:
  domain

sensitivity:
  commercial | operational | financial | clinical | platform
```

### Why

Without this, a correct `TO-BE` map can be misread as delivered reality.

### Deliberate non-links

Absorb the Deskcomm pattern that **absence of an edge can be a decision**.

Examples relevant to MedicsPro:

- Commercial CRM must not link to broad EHR reads.
- Platform admin must not link directly to clinic clinical data.
- Converser must not receive operator-only tool outputs.
- Generic RAG must not ingest patient clinical records.
- Channel provider must not own domain authorization.

A deliberate non-link should be declared in data/cards and, where mechanical, tested.

## 5. Proof tracks for high-value capabilities

### P1 — Event Log / Workers

**Proof level:** STRONG EXECUTABLE PROOF.

Current evidence:

- generic drain implementation;
- stale `processing` reaper;
- retry/backoff;
- dead state;
- visible critical notice for dead effects;
- DB invariant test covers success, retry, dead, future scheduling, no-handler and orphan recovery;
- agent-specific drain uses `FOR UPDATE SKIP LOCKED`, tenant from event row, CAS/dedup and stale reaping.

**MedicsPro decision:** `ADAPT STRONGLY`.

Absorb the invariant, not necessarily the exact table/worker implementation:

> a promised asynchronous effect needs claim, idempotency, bounded retry, stale recovery, terminal visibility and independent readback.

Target: future Event Core / Automation slices.

### P2 — MCP / Domain Tools

**Proof level:** STRONG CURRENT CODE + UNIT GATES.

Current evidence:

- Streamable HTTP endpoint;
- bearer auth;
- tenant/org comes from authenticated context;
- role + scope checks;
- rate limiting;
- audit;
- idempotency;
- static human-facing catalog separated from runtime handler definitions;
- handler↔catalog correspondence mechanically tested;
- handler description remains the model-facing contract.

**Important drift:** original Spec 11 inventory is obsolete.

**MedicsPro decision:** `ADAPT STRONGLY`.

Target invariant:

```text
UI / API / MCP / IA
→ same domain operation
→ same authorization + audit + events
```

No arbitrary SQL tool.

### P3 — Lead mutation parity

**Proof level:** STRONG UNIT/CURRENT-CODE PROOF.

A historical defect existed: AI stage movement updated CRM state/activity without emitting the same `lead.stage_changed` event used by automation/follow-up.

Current code/tests explicitly protect the fix:

- AI stage sync emits `lead.stage_changed`;
- event uses the entity kind expected by the automation engine;
- appointment/handoff stage moves document the same parity requirement.

**MedicsPro decision:** `ABSORB AS CORE INVARIANT`.

For `MED-CRM-001` and Event Core:

> human, UI, API, AI, automation and MCP must converge on the same domain mutation and side-effect contract.

### P4 — Pre-go-live / safe activation

**Proof level:** STRONG LOCAL CODE/DB/E2E; NOT REAL-PROVIDER E2E.

The spec explicitly distinguishes:

- UI + auth + DB proof;
- eligibility/integration proof;
- sink re-read before send;
- watchdog re-read;
- human sending remains possible;
- no claim of paid/model/real-device WhatsApp end-to-end.

**MedicsPro decision:** `ABSORB PATTERN`.

Useful for:

- AI channel rollout;
- clinic beta activation;
- new provider adapters;
- high-risk automation rollout.

Pattern:

```text
configured
!= enabled
!= public
!= safe for everyone
```

### P5 — Native social channels

**Proof level:** STRONG LOCAL SCHEMA/UNIT/INVARIANT + LOCAL HTTP QA; REAL PROVIDER DELIVERY SEPARATE.

DB invariant proves:

- credentials inaccessible to browser DB roles;
- RLS enabled;
- social identity distinct from phone/WhatsApp identity;
- uniqueness scoped to organization.

Current code has social adapter/client/ingest/parser plus route/OAuth tests.

**MedicsPro decision:** `ADAPT LATER`.

Key invariant for MedicsPro:

> social identity is a channel identity, not a phone number and not a Patient identity.

### P6 — RAG / Knowledge Search

**Proof level:** STRONG UNIT PROOF, plus schema/telemetry foundation.

Current test proves:

- explicit org + KB version scoping;
- embedding failure becomes `knowledge_unavailable`, not fabricated knowledge;
- DB retrieval failure becomes teachable failure;
- threshold is enforced at the application contract;
- real top-score is recorded even when no hit passes;
- telemetry failure does not break the answer but is logged;
- NaN/invalid similarity does not poison telemetry;
- citations are projected into a bounded UI shape.

**MedicsPro decision:** `ADAPT STRONGLY`.

Clinical adaptation remains stricter:

- admin/commercial knowledge can use generic RAG;
- clinical knowledge belongs to governed Nexus/clinical context;
- patient record is not organizational RAG or memory.

### P7 — Human Cases / Async IA↔Human loop

**Proof level:** IMPLEMENTED CORE + DB INVARIANT; PARTIAL END-TO-END.

Current case-reply test proves:

- human reply resolves the **conversation of the case**;
- resolved and need-info actions inject deterministic re-entry instructions;
- stale/mismatched case state becomes no-op rather than acting on old context;
- nonexistent case does not crash the worker.

Limitation documented by the test itself:

- `runAgentTurn` is mocked; the full LLM+send seam is not proven by this invariant.

**MedicsPro decision:** `ADAPT CONCEPT`, not copy wholesale.

Potential MedicsPro uses:

- back-office insurance/authorization question;
- finance exception;
- reception issue;
- non-clinical operational case.

Clinical decisions still require the appropriate human professional and clinical boundary.

### P8 — Follow-up engine

**Proof level:** STRONG DB-REAL ENGINE PROOF; external delivery proof varies by path.

The current engine/invariants show:

- immutable/versioned flow graph;
- enrollment pinned to version;
- due-claim behavior;
- one-node-at-a-time progression;
- idempotent enrollment events;
- wait state;
- bounded attempts/backoff/dead behavior;
- visible dead inbox item;
- separation between enqueueing action and completing the action turn.

**MedicsPro decision:** `ADAPT AFTER EVENT + COMMERCIAL CORE`.

Do not start here before the domain/events foundations.

### P9 — Ads attribution and conversion

**Proof level:** STRONG UNIT/DB/E2E LOCAL; REAL AD-ACCOUNT DELIVERY SEPARATE.

Current proof includes:

- short click-ref token;
- org-scoped single consumption;
- `gclid`, `gbraid`, `wbraid`;
- attribution stamping;
- dispatch ledger;
- isolated reprocessing;
- browser/admin UI paths;
- runbook explicitly says local E2E does not call real ad accounts.

**MedicsPro decision:** `ADAPT`.

Target chain:

```text
Ad / campaign
→ Contact
→ Lead
→ Appointment
→ Show / No-show
→ Patient conversion
→ Payment / real revenue
```

This can become significantly more useful in clinics than a generic “lead generated” conversion.

## 6. Proof-level vocabulary for MedicsPro reuse

Add a proof dimension independent of adoption decision.

```text
DOC_ONLY
CODE_PRESENT
UNIT_PROVEN
DB_INVARIANT_PROVEN
E2E_LOCAL_PROVEN
RUNTIME_PROVEN
PROVIDER_REAL_PROVEN
PRODUCTION_OBSERVED
```

A capability can be `ADAPT` with only `DOC_ONLY`, but implementation must not claim the stronger level.

## 7. Important absorption rules from this phase

### R1 — Never copy a manual inventory if the repo can enumerate it

Examples:

- tool catalog;
- tenant tables;
- worker kinds;
- routes;
- provider registrations.

Prefer derived gates.

### R2 — Prove property parity across ingress paths

Do not separately prove:

- human stage change works;
- AI stage change works.

Also prove:

> both reach the same canonical event/side effect.

### R3 — Local E2E != provider-real proof

This distinction appears repeatedly in good recent Deskcomm docs.

MedicsPro should encode it explicitly in slices.

### R4 — A visible failure is part of the capability

Dead event without notice is not operationally complete.

RAG telemetry failure must log.

Provider uncertainty needs reconciliation.

### R5 — Status text is not self-validating

A header can say `pre-implementation` after code exists.

Therefore status must either:

- be reconciled mechanically; or
- carry snapshot semantics and be re-read against source.

## 8. MedicsPro documentation upgrades suggested

Not all should be implemented immediately.

### Near-term

1. add proof level to `DESKCOMM_ADOPTION_MATRIX.md`;
2. add `audited_against` / `last_reconciled` to research-style documents;
3. use `CONFIRMED / INFERRED / PROPOSED` in research;
4. require provider-real distinction in integration slices;
5. add ADR `Reconsider if...` field.

### Later, after real need

6. machine-readable architecture maps;
7. map→code reconciliation gates;
8. business-rule catalog with enforcement/proof links;
9. user-journey maps for clinic roles;
10. a formal reconciliation log if cross-contract drift appears often enough.

## 9. Next exact step

Continue with:

```text
TESTING + EVIDENCE
→ RUNBOOKS + OPERATIONS
→ RESEARCH / HANDOFFS / SUPERPOWERS
→ FINAL ABSORPTION SYNTHESIS
```

For the next pass:

1. classify Deskcomm test/evidence types by what they actually prove;
2. audit user-journey map discipline and evidence naming;
3. audit runbooks for health/readback/recovery rules;
4. mine research/handoffs for recurring failure patterns that never became doctrine;
5. produce the final MedicsPro absorption recommendations by target slice.
