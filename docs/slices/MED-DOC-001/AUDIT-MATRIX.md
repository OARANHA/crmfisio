# MED-DOC-001 — Audit Matrix

**Deskcomm snapshot:** `8e26e2fa763dc04a565742d52c36c8172bcab3a3`

Legenda:

- **ABSORB** — princípio transferível quase diretamente.
- **ADAPT** — padrão útil, redesenhado na arquitetura/domínio MedicsPro.
- **INSPIRE** — ideia útil, sem contrato imediato.
- **DEFER** — potencialmente útil, sem necessidade atual.
- **REJECT** — conflita com autoridade/domínio MedicsPro.

## Documentation discipline

| Pattern | Evidence | Proof level | Decision | MedicsPro target |
| --- | --- | --- | --- | --- |
| typed documentation taxonomy | `docs/index.md` + folders | repository structure | ABSORB | documentation discipline |
| precedence between knowledge types | `docs/index.md` | documented; index itself can stale | ADAPT | doctrine/method |
| dated snapshots | `docs/current-state.md`, audits | explicit SHA/date/limitations | ABSORB | CURRENT_STATE/audits |
| measure instead of hardcoded mutable facts | audits + doctrine/versioning | commands included | ABSORB | all canonical docs |
| reconciliation log | `docs/specs/RECONCILIATION-LOG.md` | explicit conflicts/decisions | ADAPT | future cross-contract conflicts |
| evidence separate from claim | evidence/testing/runbooks | mixed proof strengths | ABSORB | slices/validation |
| handoff as execution state | handoffs | historical/self-reported | ADAPT | slice HANDOFF |
| research epistemic labels | research | explicit CONFIRMADO/INFERIDO/PROPOSTO | ABSORB | research + reuse mining |

## Doctrine / architecture

| Pattern | Underlying problem | Claimed enforcement | Proven in audit so far | Decision |
| --- | --- | --- | --- | --- |
| nothing is an island | dead/unused features | Living System checklist + maps | map/navigation tests referenced in repo | ABSORB |
| UI destination must have a door | hidden features | navigation registry + CI | `navegacao-completude.test.ts` referenced by AGENTS/doctrine | ABSORB |
| mechanical property becomes gate | review memory fails | unit/lint/invariant | multiple concrete examples found | ABSORB |
| AI↔human continuity | context lost at handoff | structured handoff state | documented + implementation references | ADAPT |
| speak != operate | tool vocabulary/data leaks | context separation + before-send safety net | measured leak report + spec references | ADAPT |
| tool output projection | internal data leaks despite hidden tools | output projection | defect documented; deep code proof pending | ADAPT |
| provider seam | provider literals spread | `lint:channels` + capability matrix | lint references found | ABSORB |
| non-applicable restriction is explicit | silent bypass | trace `skipped` | doctrine/trace references; runtime proof pending | ADAPT |
| configuration needs UI surface | invisible backend feature | UI read/write + visible failure | several historical defects documented | ABSORB |
| automation feedback loop | logs become dead stock | named feedback consumer | mixed/partial by doctrine's own admission | ADAPT |
| architecture source != render | derived docs drift | JSON source | architecture README explicit | ABSORB PRINCIPLE |
| plan map != actual implementation | future design mistaken as state | map labeling/prose | explicit warning | ABSORB |
| demand as first-class unit | conversation/person poor denominator | proposed domain entity | partly conceptual, not universal | INSPIRE |
| interruptibility by irreversibility | human authority too slow | timing/confirmation/gates | doctrine + destructive tests | ABSORB |

## ADR discipline

| Pattern | Decision |
| --- | --- |
| context measured at a SHA | ABSORB |
| list rejected alternatives | ABSORB |
| record consequences/assumptions | ABSORB |
| record reconsideration trigger | ABSORB |
| distinguish law changed by ADR | ADAPT |
| implementation-specific self-host packaging choices | DEFER/REJECT depending on MedicsPro deployment |

## Business rules catalog

Snapshot contains **62 rules** across 7 domains.

Structural audit of the catalog text:

- 62/62 declare origin;
- 62/62 declare type;
- 62/62 declare enforcement;
- 54/62 explicitly label an exception line;
- only 3 rule blocks directly cite tests;
- only 5 directly cite concrete code paths.

Interpretation:

> The catalog is a semantic rule index, not current-state proof.

### MedicsPro consequence

If a MedicsPro business-rule catalog is created, prefer a record shape like:

```text
rule_id
statement
domain authority
type
enforcement owner
proof link / invariant test
exception
last reconciled
```

Do not make the catalog a second source of executable truth.

## Normative phase — proof upgrade

Detailed current-code review: [`NORMATIVE-REVIEW.md`](NORMATIVE-REVIEW.md).

Key upgrades:

- `FALAR != OPERAR` is now classified as **proven pattern**, not doctrine-only: current worker has `operator_turn`; leakage was measured; output projection is required because raw tool data leaks independently of tool names.
- Demand/ServiceBoundary is now **implemented evidence**, not only conceptual: revisioned origin tokens are revalidated before mutable async effects and covered by DB invariant tests.
- `clinic/tenant isolation completeness` should be guarded by discovery + behavioral proof, not a fixed table list.
- property tests are preferred over tests that only freeze today's value.
- T-02 service-role filter enforcement is **PARTIAL**: principle is strong, catalog wording overstates generic mechanical coverage.
- W-03 automatic blocked-contact veto is strong, but the exact human double-confirm/`manual_override_blocked` catalog claim was not confirmed.
- current before-send chain is 11 gates / version 7; older prose counts are historical drift.

## Audit completion

1. Doctrine + ADR + Business Rules — **completed**
2. Specs + reconciliation — **completed for the high-value/current contract set**
3. Architecture maps — **inventory complete; proof semantics audited**
4. Testing + evidence — **completed**
5. Research/handoffs/plans — **cross-cutting recurring lessons mined**
6. Runbooks + deploy/operations — **completed for operational discipline**
7. Security/threat-model implications — **integrated, including healthcare evidence restrictions**
8. Final MedicsPro absorption synthesis — **completed**

See:
- [`NORMATIVE-REVIEW.md`](NORMATIVE-REVIEW.md)
- [`SPEC-ARCH-PROOF-REVIEW.md`](SPEC-ARCH-PROOF-REVIEW.md)
- [`TESTING-OPERATIONS-REVIEW.md`](TESTING-OPERATIONS-REVIEW.md)
- [`CROSS-CUTTING-LESSONS.md`](CROSS-CUTTING-LESSONS.md)
- [`FINAL-ABSORPTION-SYNTHESIS.md`](FINAL-ABSORPTION-SYNTHESIS.md)

Optional deep dives remain demand-driven; they are not blockers to the audit result.
