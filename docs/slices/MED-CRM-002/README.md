# MED-CRM-002 — Commercial Command Boundary

**Status:** PROVED
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

The repository SQL harness proved:

- migration replay/idempotency;
- helper/function ACL and SECURITY DEFINER contract;
- active profile + role + `crm.access`;
- owner/admin/recep success;
- professional/financeiro denial;
- tenant isolation/cross-tenant negative cases;
- Contact retry success + replay conflict;
- Lead retry success + replay conflict;
- initial terminal stage denial;
- stage transition same-pipeline only;
- lost/won/open terminal semantics;
- stage retry no duplicate activity/audit;
- raw authenticated table DML remains denied;
- no Patient row or Patient Journey mutation;
- audit details exclude supplied name/phone/email;
- existing Commercial Core structural verifier still passes.

Proof completed:

- PostgreSQL 16.15 — GREEN;
- PostgreSQL 17.11 — GREEN;
- MED-CRM-001 foundation verifier still GREEN after MED-CRM-002 replay;
- MED-CRM-002 verifier — GREEN;
- 12 behavior blocks — GREEN;
- implementation head `18ba481866a3af8412cfc200621290d3358a2b5e`: 8/8 repository workflows SUCCESS, 0 behind, mergeable, no reviews/threads;
- final adversarial completion review: complete probability 0.92, confidence 0.87.

Full reproducible evidence: [EVIDENCE.md](EVIDENCE.md).

`PROVED` does not mean `MERGED` or `RELEASED`.

## Next exact step

1. revalidate the latest documentation head of PR #524: base, diff, checks, reviews and mergeability;
2. make the merge decision separately from the proof decision;
3. if merged, reconcile current `main` and keep status below RELEASED until production rollout is actually observed;
4. only after that, return to the post-foundation capability map for the next slice.

Do not append board/UI, Inbox, follow-up, attribution, conversion or AI to PR #524.
