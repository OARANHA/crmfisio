# MED-CRM-002 — Commercial Command Boundary

**Status:** PROVED + MERGED — PR #524 → `main@7a8badf5ad81e92746e82bedd142ba75899a4080`; not RELEASED
**Capability:** canonical authenticated Commercial Core mutations
**Base:** `main@652ea7b3aea4cd03a09944b780ef697168016bc3`
**Branch:** `feat/med-crm-002-commercial-command-boundary`

## Objective

Tornar a foundation Commercial Core operável por uma única boundary server-side sem abrir raw DML e sem criar nova autoridade de domínio.

Primeira superfície:

- criar Contact pré-clínico;
- criar Lead para Contact existente;
- transicionar Lead entre stages do mesmo pipeline;
- emitir activity/audit na mesma transaction;
- preservar idempotência de retry sem nova tabela/engine.

## GAPS

O estado pós-#522 está mapeado em [NEXT_CAPABILITY_MAP](../MED-CRM-001/NEXT_CAPABILITY_MAP.md).

Gap destravador:

```text
Commercial Core exists
        ↓
read projections exist
        ↓
raw browser DML denied
        ↓
NO canonical commercial mutation operation
```

Sem esse primitive, board, reception pre-clinical intake, follow-up, Inbox, attribution, automation e AI não podem convergir numa mesma porta de domínio.

## Capability authority / reuse gate

### Reuse

- `clinic_id`/tenant: `current_active_profile()`;
- entitlement: `crm.access`;
- CRM writer roles: `owner | admin | recep`;
- Contact/Lead/Pipeline/Stage/Activity: MED-CRM-001;
- audit: `audit_log`;
- stage/outcome invariants: existing #522 constraints/triggers;
- browser direct-DML denial: existing #522 ACL/RLS posture.

### Not reused as authority

- `patients.funil_stage`: Patient Journey compatibility, not Commercial Core;
- Patient Registry: conversion is outside this slice;
- Evolution/`wa_logs`: channel transport, not CRM mutation authority;
- reactivation/waitlist: Patient/Agenda operations, not Lead follow-up;
- Nexus: clinical intelligence, not commercial mutation authority.

### New helper justification

A narrow internal mutator guard may be added because:

- the existing CRM read guard intentionally allows professional/financeiro;
- the Patient funnel trigger is coupled to `patients.funil_stage`;
- no callable Commercial Core writer guard exists.

It will only compose existing authority; it will not create a role, entitlement or tenant source.

## Decision

See [DECISION.md](DECISION.md).

Exactly three browser-facing commands are in scope:

1. `create_current_clinic_crm_contact(...)`;
2. `create_current_clinic_crm_lead(...)`;
3. `transition_current_clinic_crm_lead_stage(...)`.

No generic CRUD API.

## Deliberate non-goals

- no Contact↔Patient link;
- no Lead→Patient conversion;
- no Patient/Encounter/Patient Journey mutation;
- no CRM board/UI cutover;
- no pipeline/stage admin;
- no Contact edit/merge/dedupe;
- no automatic matching by phone/e-mail;
- no attribution model/campaign/UTM contract;
- no next-action/task/follow-up engine;
- no Inbox/Conversation;
- no provider/Evolution changes;
- no automation worker changes;
- no AI/MCP/RAG tools;
- no Event Core.

## Invariants

- Contact != Lead != Patient;
- `clinic_id` is derived server-side;
- `crm.access` + active `owner/admin/recep` are required for mutations;
- professional/financeiro remain read-only;
- Contact creation cannot set `patient_id`;
- phone/email remain match signals, not identity keys;
- Lead creation starts only in an active `open` stage;
- stage transition stays inside the Lead's current pipeline;
- stage transition serializes the Lead row;
- terminal fields are server-derived from target `stage_kind`;
- exact retry must not duplicate state/activity/audit;
- retry with same aggregate ID but different contract must fail explicitly;
- raw authenticated DML remains denied;
- audit detail contains identifiers/operation facts, not contact PII.

## Second adversarial review

JEV route preflight:

- first result: `deep_review` probability 0.60, confidence 0.46.

Refinements applied:

- explicit replay idempotency via caller-supplied aggregate UUID;
- replay-content conflict instead of silent overwrite;
- `FOR UPDATE` for stage transitions;
- initial Lead stage restricted to `open`;
- transition restricted to same pipeline;
- no patient link;
- no phone/e-mail automatic dedupe/normalization contract;
- no generic event/automation abstraction.

Refined action guard:

- decision: `allow`;
- allow probability: 0.45;
- review probability: 0.28;
- confidence: 0.27.

Low confidence is preserved as a reason for stronger mechanical validation, not hidden.

## Validation completed

Latest executable proof head: `1d7655d3e282962f8ebc5760f3f2b17f84c73bf5`.

The dedicated GitHub Actions workflow `Commercial CRM Command Boundary`, run `36286051483`, proved on that executable state:

- PostgreSQL 16.15 — GREEN;
- PostgreSQL 17.11 — GREEN;
- migration replay/idempotency;
- MED-CRM-001 foundation verifier — GREEN;
- MED-CRM-002 verifier — GREEN;
- 13 behavior blocks — GREEN, including denial of replay/new Lead for an anonymized Contact;
- final behavior marker `COMMERCIAL CRM COMMAND BOUNDARY BEHAVIOR CASES PASSED`.

Ruleset-required checks on the same executable head:

- `validate` — SUCCESS;
- `dependency-audit` — SUCCESS.

The failing dedicated runs before this proof were caused by a test-only PL/pgSQL delimiter defect introduced with the new anonymized-Contact case: `DO $` / `END $;` instead of `DO $$` / `END $$;`. The correction changed only those two delimiter lines. No migration, verifier, command, RLS/RBAC, entitlement, role, Patient or clinical boundary changed.

Current GitHub readback at proof time:

- base: `main@652ea7b3aea4cd03a09944b780ef697168016bc3`;
- compare: 36 ahead / 0 behind;
- mergeable: true;
- reviews: 0;
- review threads: 0;
- main ruleset: squash only, required `validate` + `dependency-audit`, zero approving reviews required.

Structural scope readback on the command migration:

- 0 `CREATE TABLE`;
- 0 `ALTER TABLE`;
- no Patient/Encounter/Patient Journey mutation;
- no raw Commercial Core table grant;
- exactly four narrow functions (one internal guard + three commands).

Independent JEV completion review after current-head proof:

- `complete`: 0.89;
- `verify_more`: 0.08;
- `incomplete`: 0.03;
- confidence: 0.84.

This advisory review does not replace the deterministic gates above.

Full reproducible evidence: [EVIDENCE.md](EVIDENCE.md).

`PROVED + MERGED` does not mean `RELEASED`.

## Merge integration

Final PR head `cf94434ca5294e4e9cc4de70661268d9e4765045` closed with:

- 21/21 repository workflows SUCCESS;
- PostgreSQL 16/17 dedicated proof SUCCESS;
- `validate` SUCCESS;
- `dependency-audit` SUCCESS;
- 38 ahead / 0 behind before merge;
- mergeable=true;
- reviews=0;
- review threads=0.

The separate merge gate used squash as required by the active ruleset. GitHub readback confirmed:

```text
PR #524: closed / merged=true
main: 7a8badf5ad81e92746e82bedd142ba75899a4080
```

No production rollout was inferred from the merge.

## Next exact step

MED-CRM-002 is complete as an integrated repository slice. Do not append board/UI or a new capability to #524.

Continue through the re-measured [NEXT_CAPABILITY_MAP](../MED-CRM-001/NEXT_CAPABILITY_MAP.md) and [MED-CRM-003](../MED-CRM-003/README.md). MED-CRM-003 is DESIGNED only; revalidate current state before EXECUTION.

Do not declare MED-CRM-002 RELEASED without production rollout/runtime proof.
