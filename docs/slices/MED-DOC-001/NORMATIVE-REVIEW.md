# MED-DOC-001 — Normative Review

**Source snapshot:** `melgarafael/DeskcommCRM@8e26e2fa763dc04a565742d52c36c8172bcab3a3`

This review closes the first deep-audit block:

```text
Doctrine
+ ADR
+ Business Rules
+ selected current code/test proof
```

It does **not** assert that every Deskcomm rule is currently true. The purpose is to separate normative text from executable evidence before MedicsPro absorbs anything.

## Evidence labels

- **PROVEN** — current code/test/invariant at the audit SHA directly protects the relevant property.
- **PARTIAL** — core property is implemented/proven, but the catalog's full wording/enforcement claim is not.
- **NOT VERIFIED** — only normative/spec text was inspected so far.
- **HISTORICAL / PROVIDER-SPECIFIC** — tied to Deskcomm/WAHA/Nuvemshop/self-host specifics; not a MedicsPro contract.

## 1. Meta-rules proven by current implementation

### M1 — A doctrine item is strongest when it becomes a ratchet

**PROVEN.**

`scripts/lint-channels.ts` is a useful pattern:

- feature code may not name channel providers outside explicit boundaries;
- inherited debt is enumerated with a written reason;
- new debt fails;
- an entry that becomes clean but remains in the debt list also fails;
- the debt list can only shrink;
- the recognizer itself has a unit test because a previous regex missed `WAHA_*` / `waha_*`.

**MedicsPro:** `ABSORB`.

Candidate uses:

- provider literals outside channel seam;
- legacy clinical naming outside compatibility layer;
- raw service-role access outside allowed server boundaries;
- tenant tables without proof;
- generic AI/MCP tools outside catalog.

### M2 — Test the property, not only today's value

**PROVEN.**

ADR-0003 records a concrete failure mode: several tests asserted the current extension destination `/app/tasks`, but none asserted the security property that a package may **name a capability but never choose the URL**.

`tests/unit/extensoes-capacidade-nao-vem-do-pacote.test.ts` now protects the property:

- route destination must come from a server-owned resolver;
- no raw URL, concatenation or broad `startsWith('/app')`;
- destinations cannot enter credential/admin/settings surfaces;
- every permitted destination exists;
- unknown capability fails closed.

**MedicsPro:** `ABSORB`.

This is especially important for:

- MCP/agent tools;
- navigation generated from configuration;
- provider callbacks;
- clinical instrument routing;
- capability→action mapping.

### M3 — Documentation authority itself needs mechanical guards

**PROVEN.**

`tests/unit/documentacao-aponta-para-o-que-existe.test.ts` intentionally scans only documents used to **decide/act** and rejects:

- dead relative links;
- cited code paths that no longer exist;
- known stale “still pending” phrases after the relevant gate became active.

Historical planning documents are intentionally excluded to avoid a noisy, useless gate.

**MedicsPro:** `ADAPT`.

Do not scan every historical slice/handoff. Start with `AGENTS.md`, doctrine, runbooks, current-state router and other authority docs.

### M4 — Security completeness needs a discovery gate, not a hand-maintained list

**PROVEN.**

`tests/invariants/rls-completude-varredura.test.ts` exists because a fixed test list can forget a new tenant table.

The current pattern:

1. derives tenant-aware tables from the database catalog;
2. requires each to have real behavioral isolation proof or a named proof elsewhere;
3. inherited uncovered tables are classified as known debt;
4. a **new** table is not allowed to join inherited debt;
5. `RLS enabled + policy exists` is explicitly treated as insufficient; cross-tenant behavior must be exercised.

**MedicsPro:** `ABSORB STRONGLY`.

This is a high-value future invariant for `clinic_id`.

### M5 — Security chain shape is behavior

**PROVEN.**

`tests/unit/before-send-chain-shape.test.ts` freezes the order and version of the outbound safety chain.

At the audit SHA the code/test shows **11 gates**, chain version 7:

```text
stop
lgpd
pacing
messaging_window
spinning
promise
semantic_promise
case_promise
internal_vocabulary
agenda_stall
disclosure
```

This also proves why mutable counts should come from code/tests, not doctrine prose that once said 7, 9, then 10.

**MedicsPro:** `ABSORB PRINCIPLE`.

Any ordered policy chain whose order changes semantics should have a shape/version test.

## 2. Falar ≠ Operar — now a proven pattern, not only doctrine

### Evidence

- `operator_turn` exists in the real job kind/runtime and is registered by the worker.
- `docs/specs/16-spec-tres-papeis-do-agente.md` formalizes Converser / Operator / Security.
- `evidence/ia-360-w4/medicao-vazamento/RELATORIO.md` measured leakage with a real model.
- current before-send code includes `internal_vocabulary` and its chain is tested.

### Measured defect

With the gate disabled on the measured test path:

| Prompt/context | Turns | leaked internal vocabulary/data |
| --- | ---: | ---: |
| operator-style | 10 | 3 (30%) |
| customer-facing attendance | 8 | 0 |

The leaks came through three independent surfaces:

1. tool description;
2. tool name;
3. **raw tool result data**, including internal error codes and IDs.

The production-path observation then showed an `internal_vocabulary` veto, model rewrite, second-pass clean delivery.

### MedicsPro decision

`ADAPT STRONGLY / PROVEN PATTERN`.

Target separation:

```text
Front Desk Converser
!= Operator Agent
!= Clinical Intelligence
!= Human Professional
```

Additionally:

> Hiding a tool name is insufficient. Output projection must ensure the target model never receives internal data it does not need to communicate.

## 3. Demand / ServiceBoundary — upgraded from concept to implemented evidence

Earlier review treated “demand as unit of purpose” as mostly conceptual. Current code disproves that simplification.

### Current proof

`lib/atendimento/fronteira.ts` captures an immutable origin token:

```text
organization_id
contact_id
conversation_id
service_revision
demanda_id
demanda_revision
```

`lib/atendimento/fronteira-server.ts` revalidates that boundary before mutable effects and wraps mutable tools.

`tests/invariants/service-boundary.test.ts` proves, among other cases:

- concurrent inbound creates one demand;
- a demand can relate to conversations without collapsing their lifecycle;
- close/reopen increments the relevant revision and invalidates old work;
- stale async work cannot mutate a newer service episode;
- forged cross-tenant origin is rejected;
- old operational context can be excluded while durable facts survive.

### MedicsPro decision

`INSPIRE → DEEP ADAPT REVIEW`.

Do **not** create a universal `demand` entity by reflex.

Absorb the deeper invariant:

> asynchronous work that can cause a mutable effect should carry the identity/version of the domain episode that authorized it; execution must revalidate that the episode is still current.

Potential future applications:

- AI/automation acting on a Lead after stage/ownership changed;
- appointment confirmation/recovery after appointment state changed;
- Encounter assistance after Encounter was finalized;
- financial exception resolution after the exception changed;
- conversation/handoff automation after human takeover.

This deserves its own future architecture decision, not a hidden implementation detail.

## 4. High-value Business Rules — current proof review

### Tenancy

| Rule | Audit status | Current evidence | MedicsPro decision |
| --- | --- | --- | --- |
| T-01 tenant-aware tables have tenant boundary + RLS | **PROVEN STRONGLY as a Deskcomm discipline** | RLS behavioral suite + completeness scan | ABSORB pattern with `clinic_id` |
| T-02 service-role query filters trusted tenant | **PARTIAL / catalog overstates enforcement** | many handlers follow rule; audit flag exists; current docs themselves note no generic automatic write gate for every new handler | ABSORB principle; design stronger MedicsPro gate |
| T-03 JWT carries tenant claim | NOT VERIFIED / Deskcomm-specific auth detail | catalog/spec only in this phase | REJECT as required shape; MedicsPro resolves tenant through canonical membership/RLS |
| T-04 platform admin is cross-tenant role | CONFLICTS WITH MEDICSPRO AUTHORITY | Deskcomm product model differs | REJECT; MedicsPro platform admin does not get implicit clinic data access |
| T-05 subdomain or X-Tenant-ID routing | NOT VERIFIED / product-specific | no reason to import | REJECT as requirement |
| T-06 seed default pipeline | NOT VERIFIED | useful UX pattern, not security invariant | ADAPT later in Commercial Core |
| T-07 globally unique webhook path token | NOT VERIFIED | provider/webhook-specific | ADAPT principle if path-token endpoints exist |
| T-08 every query/log/metric tenant-scoped | PARTIAL / broad principle | numerous examples but impossible to prove from catalog alone | ABSORB principle; enforce per boundary |

### Messaging / channel rules

| Rule | Audit status | Current evidence | MedicsPro decision |
| --- | --- | --- | --- |
| W-01 fixed WAHA throttle/jitter | provider-specific | numeric physics tied to Deskcomm/WAHA | REJECT numeric rule; preserve capability/pacing seam |
| W-02 opt-out detection blocks automation | PARTIAL/strong current implementation around shared detection | code/tests exist beyond original regex | ADAPT with MedicsPro consent/communication policy |
| W-03 blocked contact never receives automated outbound | **PARTIAL** | stop/before-send behavior is strongly exercised; catalog's claimed human double-confirm + `manual_override_blocked` was not found in current code search | ABSORB automated veto; do not import undocumented manual override |
| W-04 24h window | provider-specific semantics | channel restriction principle is good | ADAPT through channel capabilities |
| W-05 inbound idempotency by tenant+external id | **PROVEN** | current ingest implementations + unique constraint behavior + duplicate/echo tests | ABSORB invariant, adapted to `clinic_id`/connection/provider |
| W-06 new-number daily numeric cap | provider-specific | not a MedicsPro universal law | REJECT numeric constant |
| W-07 courtesy hours + Sunday policy | product/provider policy | not universal | DEFER to clinic/channel configuration |
| W-08 media storage vs inline base64 | implementation-specific | good efficiency/security idea | ADAPT if current Evolution media path benefits |
| W-09 groups do not create leads | Deskcomm product choice | may be useful but not universal | DEFER |
| W-10 `message.any` | WAHA-specific | Evolution differs | REJECT literal rule |
| W-11 recreate corrupt WAHA session | WAHA-specific | Evolution differs | REJECT |
| W-12 recover stuck sending and surface critical notice | **PROVEN** | route + unit tests + central-alert convergence | ABSORB principle: stuck external effect needs owner + visible recovery |

### CRM / Lead

| Rule | Audit status | Current evidence | MedicsPro decision |
| --- | --- | --- | --- |
| P-01 one pipeline per lead | current Deskcomm domain choice | multiple current lead handlers assume it | ADAPT only if MED-CRM design chooses same invariant |
| P-02 won/lost derived from terminal stage | **PROVEN** | DB trigger + shared lead closing code + consumers | ADAPT candidate |
| P-03 loss requires reason | **PROVEN** | DB CHECK/current server flows; newer migration adds category/origin | ADAPT strongly for Commercial Core |
| P-04 reopen is audited | current architecture supports reopen semantics | full event proof not completed in this phase | ADAPT principle |
| P-05 fractional card ordering | implementation choice | useful if Kanban order requires it | INSPIRE/DEFER |
| P-06 deep clone pipeline | product feature | not foundation | DEFER |
| P-07 vocabulary changes labels, not data | strong product design principle | code proof not fully audited yet | ADAPT |
| P-08 multiple leads for same contact allowed | important semantic pattern | aligns Contact != Lead | ADAPT STRONGLY; confirm MedicsPro product need |

### Attendance / operations

| Rule | Audit status | Current evidence | MedicsPro decision |
| --- | --- | --- | --- |
| AT-01 conversation and demand have distinct revisioned lifecycles | **PROVEN STRONGLY** | ServiceBoundary + DB invariant tests | ABSORB underlying stale-work invariant; do not copy entity blindly |
| AT-02 “I handle” atomic claim | PARTIAL in current routing/claim functions | DB conditional update patterns visible; exhaustive proof pending | ADAPT for Inbox/human cases |
| AT-03 round-robin online agents | feature policy | not relevant to first MedicsPro slices | DEFER |
| AT-04 supervisor read vs mutate boundary | product/RBAC-specific | MedicsPro roles differ | ADAPT only through MedicsPro authorization |
| AT-05 internal notes never outbound | high-value invariant | direct claimed implementation not fully located in this pass | ABSORB principle; require proof in future Inbox slice |
| AT-06 batch max 50 | arbitrary product number | no universal value | REJECT as law |
| AT-07 4096 chunking | provider detail | provider capability should own | REJECT literal value |
| AT-08 idle→offline timing | operational policy | not foundation | DEFER |

### AI

The catalog's individual AI thresholds are less valuable than the architecture now proven by the newer agent runtime.

| Rule family | Audit status | MedicsPro decision |
| --- | --- | --- |
| opt-out/window/authorization guardrails | current deterministic chain exists | ABSORB pattern |
| configurable RAG top-K / sentiment thresholds | model/product tuning | DEFER; never doctrine constants |
| multiple handoff triggers | current human handoff is first-class and strongly implemented | ADAPT |
| bot does not automatically reassume after human handoff | current `force_human`/silence boundary is strongly represented | ADAPT strongly |
| commercial promises need deterministic/human guard | before-send promise gates exist | ABSORB pattern |
| tenant AI budget and cost ledger | current `llm_calls` + budget SQL/tests exist | ADAPT for clinic-scoped cost governance |
| Nuvemshop-specific catalog behavior | ecommerce-specific | REJECT for MedicsPro |

### Billing / usage

Mostly Deskcomm SaaS/infra policy. Useful transferable principle:

> cost/usage measurements that drive limits need one canonical calculation and tenant scope.

Current Deskcomm migration/comments/tests show work to avoid a second “monthly spend” ruler.

**MedicsPro:** `ADAPT` for LLM/provider costs; do not import Deskcomm quotas.

## 5. Normative drift found during this phase

### D1 — T-02 enforcement wording is stronger than current generic enforcement

Catalog:

`Code review + linter custom + audit log`.

But current project documentation explicitly records that generic `createAdminClient` use is widespread and automatic enforcement for “every new handler filters organization_id from trusted source” is incomplete.

**Lesson:** rule catalog must link to the actual gate or mark the enforcement as `REVIEW_ONLY` / `PARTIAL`.

### D2 — W-03 manual override wording is not proven

Automated blocking is strongly represented in current guardrails.

The exact catalog promise:

- human can manually override blocked contact;
- double confirmation;
- audit event `manual_override_blocked`;

was not found in current code search during this phase.

**Classification:** `UNCONFIRMED CLAIM`, not absorbed.

### D3 — before-send gate count drifted

Doctrine/history has carried several counts. Current test says 11 / chain version 7.

**Lesson:** document the named source (`BEFORE_SEND_GATES`) rather than a hand-maintained number.

## 6. ADR method — MedicsPro format candidate

Based on the three audited ADRs, future MedicsPro ADRs should contain:

```text
Status
Date
Context measured against SHA
Problem
Evidence
Decision
Alternatives rejected
Authority preserved
Security/data consequences
Compatibility/migration
Operational consequences
Assumptions
Reconsider if...
Verification/gates
Related doctrine/spec/slice
```

The `Reconsider if...` field is especially valuable: it prevents an old architecture choice from turning into dogma.

## 7. Completion of normative phase

### Doctrine

Deep read complete enough to extract transferable principles and identify the highest-value executable gates.

### ADR

All three current ADR files at the snapshot were reviewed.

### Business Rules

All 62 rules were structurally inventoried and triaged; selected high-value rule families were checked against current code/tests.

This is **not** a claim that all 62 were individually runtime-verified. Rules still marked NOT VERIFIED remain hypotheses/contracts, not current-state evidence.

## Next phase

```text
SPECS
→ ARCHITECTURE MAPS
→ TESTS / EVIDENCE
```

Goals:

1. identify which Deskcomm specs are still contracts versus historical designs;
2. map each high-value capability from spec → current code → invariant test → evidence;
3. detect spec/code drift systematically;
4. extract architecture patterns relevant to MedicsPro;
5. strengthen `DESKCOMM_ADOPTION_MATRIX.md` with proof levels, not feature names alone.
