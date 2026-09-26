# MED-DOC-001 — Testing, Evidence & Operations Review

**Deskcomm snapshot:** `melgarafael/DeskcommCRM@8e26e2fa763dc04a565742d52c36c8172bcab3a3`

This phase asks:

> What does the reference project consider sufficient proof, and which parts should MedicsPro absorb, strengthen or reject?

## 1. Test/evidence layers discovered

Deskcomm does not rely on one testing layer.

Observed proof families include:

```text
static/code property test
→ unit behavior
→ DB invariant
→ local integration
→ browser E2E
→ deliberate sabotage / counterexample
→ local receiver / transport test
→ real provider controlled call
→ VPS rehearsal
→ production observation
```

These levels are not interchangeable.

A useful MedicsPro rule is:

> Name the strongest proof actually executed; never let a weaker proof inherit the label of a stronger one.

## 2. User Journey Map

`docs/testing/user-journey-map.md` is a valuable bridge between product promise and executable proof.

It records:

- persona/journey;
- case;
- expectation;
- priority;
- test/evidence;
- PASS / FAIL / WARN / pending;
- bugs discovered while executing the journey.

Examples show the map catching problems that code-centric tests alone would miss:

- hidden/incorrect navigation;
- tenant leakage in lists;
- a lead appearing without understandable origin;
- UI configuration that writes a value nobody consumes;
- an archived object with no path back;
- state that looks successful while downstream delivery failed.

### MedicsPro decision

`ADAPT STRONGLY`.

Future journey families:

```text
J-PATIENT
J-RECEPTION
J-PROFESSIONAL
J-CRM
J-FINANCE
J-OWNER
J-PLATFORM
```

Clinical journeys must also state the authorization context and whether synthetic clinical data is used.

## 3. Sabotage / counterfactual proof

Deskcomm repeatedly uses a high-quality testing practice:

1. write/identify the property;
2. introduce the exact defect the test is supposed to catch;
3. predict which tests should fail;
4. run the sabotage;
5. confirm the expected red set;
6. restore;
7. re-run green.

This is stronger than “test passes”.

Examples in the audited material include:

- reversing handoff notification order;
- removing provider/channel guards;
- weakening architecture connectivity;
- breaking a parser boundary;
- removing a required catalog/handler relation.

### MedicsPro decision

`ABSORB` for high-value invariants.

Use selectively for:

- RLS/tenant isolation;
- clinical authorization;
- Lead→Patient conversion boundary;
- provider/channel seam;
- event parity;
- destructive changes;
- MCP/AI tool scope;
- migration verifier behavior.

Do not require sabotage for trivial presentation tests.

## 4. Vacuity guards

A recurring strong pattern:

> A test that iterates a set must prove the set is non-empty or derived correctly.

Examples:

- map suite asserts maps exist;
- handler/catalog suite asserts tools exist;
- JobKind map test fails if it cannot find the union;
- documentation gate deliberately scans only authority documents.

### MedicsPro decision

`ABSORB`.

A “green” invariant over an empty discovered set is failure, not success.

## 5. Real database invariants

Deskcomm uses an ephemeral/raw Postgres path for invariants and explicitly tests behaviors RLS metadata alone cannot prove.

Notable patterns:

- cross-tenant reads/writes;
- DB CHECK vocabulary vs TypeScript vocabulary;
- claim/retry/reaper behavior;
- migration install + update behavior;
- idempotency under replay;
- stale revision/CAS behavior.

### MedicsPro decision

`ABSORB STRONGLY`.

For MedicsPro, the highest-value DB invariants include:

```text
clinic isolation
clinical authorship boundaries
service-role scope
Contact != Lead != Patient
explicit Lead→Patient conversion
event/idempotency
append-only clinical correction history
worker/outbox replay
migration install + upgrade
```

## 6. Browser E2E as product proof

Deskcomm's E2E discipline emphasizes driving the **frontend**, not using DB/API shortcuts to simulate success.

The database may be inspected after the action to prove state.

This is a valuable distinction:

```text
UI ACTION
→ actual app path
→ server/domain effect
→ DB/state proof
```

not:

```text
seed final DB state
→ open screen
→ screenshot
```

### MedicsPro decision

`ABSORB`.

Especially for beta-critical flows:

- clinic onboarding;
- invite/team access;
- first Patient;
- appointment;
- Encounter start/finalize;
- clinical correction/addendum;
- CRM Lead→Patient;
- WhatsApp connect/send;
- finance/payment state.

## 7. Evidence files — useful but dangerous

Deskcomm stores visual/text evidence for many journeys.

This improves reviewability, but its own threat model recognizes a serious risk: authenticated screenshots can contain real personal information.

### MedicsPro healthcare adaptation

`ADAPT WITH STRICTER RULES`.

Repository evidence must use:

- synthetic/test identities;
- fixture clinics;
- synthetic phone/e-mail;
- fake clinical records;
- redacted/sanitized logs;
- no access token/secret;
- no production patient screenshot;
- no real clinical note, diagnosis, document or attachment;
- no production health record exported to Git.

If a production incident requires evidence containing sensitive material:

- keep the artifact outside Git in the approved secure operational system;
- commit only sanitized reproduction metadata/reference;
- document enough to reproduce without exposing the payload.

### Rule

> Evidence must be reproducible without becoming a data leak.

## 8. Real-provider proof is its own level

Recent Deskcomm docs do a good job of distinguishing local integration proof from provider-real proof.

Examples:

- social-channel local ingest/send harness does not automatically claim real provider delivery;
- ads E2E does not claim a real ad account call;
- pre-go-live E2E does not claim a paid model + real phone end-to-end;
- Meta template work separately records a controlled real Graph API acceptance/error.

### MedicsPro decision

`ABSORB`.

Use explicit labels:

```text
E2E_LOCAL_PROVEN
PROVIDER_SANDBOX_PROVEN
PROVIDER_REAL_PROVEN
PRODUCTION_OBSERVED
```

## 9. Runbooks — mutation is not completion

The deploy runbook contains a critical operational principle:

> container `healthy` does not prove the public product is reachable.

A real incident had:

- app internally healthy;
- reverse-proxy labels missing;
- public domain returning 404.

The runbook therefore requires independent external readback after deploy.

### MedicsPro decision

`ABSORB STRONGLY`.

For every consequential operational action define:

```text
PRECHECK
→ MUTATION
→ INDEPENDENT READBACK
→ USER-RELEVANT SMOKE
→ ROLLBACK / RECOVERY
```

Examples:

- deploy;
- migration;
- worker restart;
- provider credential rotation;
- Evolution reconnect;
- restore;
- background-job repair.

## 10. Runbooks distinguish rehearsed vs unverified steps

`remediar-worker-congelado.md` marks steps as `ENSAIADO` versus `NÃO VERIFICADO` and records where an earlier claim was wrong.

This is a strong operational habit.

It also preserves:

- what happened;
- impact;
- diagnostic read-only path;
- alternatives;
- blast radius;
- rollback;
- environment limitations;
- what the rehearsal did **not** cover;
- later production evidence separately.

### MedicsPro decision

`ABSORB`.

Recommended runbook markers:

```text
VERIFIED_LOCAL
VERIFIED_STAGING
REHEARSED_RUNTIME
PRODUCTION_OBSERVED
NOT_VERIFIED
```

## 11. “Main contains it” != “released installation has it”

The worker-remediation runbook records a dangerous false assumption:

- code existed on `main`;
- documentation implied released installations had the behavior;
- the published tag did not contain it.

### MedicsPro decision

`ABSORB AS RELEASE INVARIANT`.

When asserting runtime behavior, identify:

```text
repo SHA
release/tag/image digest
deployed version
runtime readback
```

Do not infer deployed capability from current main.

## 12. Proof taxonomy for slices

Recommended MedicsPro proof record:

| Level | Meaning |
| --- | --- |
| `DOC_ONLY` | claim/design exists |
| `CODE_PRESENT` | implementation path exists |
| `UNIT_PROVEN` | isolated behavior proven |
| `DB_INVARIANT_PROVEN` | real DB behavior/isolation proven |
| `INTEGRATION_PROVEN` | multiple real components exercised |
| `E2E_LOCAL_PROVEN` | real product path in local/staging browser |
| `SABOTAGE_PROVEN` | test shown to fail under the target defect |
| `PROVIDER_SANDBOX_PROVEN` | provider sandbox/test environment |
| `PROVIDER_REAL_PROVEN` | real external provider accepted/returned expected result |
| `RUNTIME_REHEARSED` | operational procedure rehearsed on runtime-like system |
| `PRODUCTION_OBSERVED` | effect/readback observed in production |

Multiple labels can apply.

## 13. What not to copy

### Do not require screenshots everywhere

Visual evidence has storage/privacy cost and often adds no value to backend invariants.

Use it when the user-visible state matters.

### Do not treat a screenshot as security proof

RLS, tenant isolation, authorization, idempotency and clinical authorship require executable server/DB proof.

### Do not store real patient data as test evidence

MedicsPro must be stricter than the reference project here.

### Do not equate current passing tests with complete operational readiness

A worker/provider/deploy capability also needs ownership, visibility and recovery.

## 14. MedicsPro Definition-of-Done implications

For a significant slice, validation should ask:

```text
[ ] What user journey does this change?
[ ] What server/domain invariant does it change?
[ ] What DB/tenant/clinical boundary does it touch?
[ ] What is the strongest proof actually executed?
[ ] Did we prove the test detects the intended defect where risk justifies sabotage?
[ ] Is any external provider still unproved?
[ ] Can failure become invisible?
[ ] Is there a recovery/readback path?
[ ] Does evidence contain only synthetic/sanitized data?
[ ] If deployed, did we verify the actual release/image/runtime rather than main?
```

## 15. Next phase

The audit now has three strong layers:

1. normative discipline;
2. spec/architecture/proof tracing;
3. testing/evidence/operations.

Next:

```text
RESEARCH
→ HANDOFFS
→ SUPERPOWERS / PLANS
→ recurring failure patterns
→ FINAL MEDICSPRO ABSORPTION SYNTHESIS
```

The goal is to find lessons repeatedly rediscovered during implementation that deserve promotion into MedicsPro doctrine, ADR templates, CI gates or future manual chapters.
