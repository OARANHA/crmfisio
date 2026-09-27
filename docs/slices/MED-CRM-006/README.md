# MED-CRM-006 — Contact Identity Resolution V1

**Status:** DESIGNED  
**Owner domain:** Commercial CRM  
**Branch/PR:** `docs/med-crm-006-contact-identity-resolution` / PR pending  
**Created:** 2026-09-27  
**Last reconciled:** 2026-09-27 against `main@7c5673d43262ef3a0681d3a916d554bcc9627f71`

## Objective

Add a bounded Contact Identity Resolution contract for the Commercial CRM so a new prospect can explicitly reuse an existing Contact or deliberately create a distinct Contact without treating phone/email as unique identity, without creating Patient authority, and without allowing client-only lookup to become the final authority.

This slice is design-only at this checkpoint. Product/runtime execution has not started.

## Non-goals

- Contact merge/dedupe;
- Contact edit;
- Contact delete/restore/anonymize implementation;
- Patient matching or Patient lookup;
- Lead→Patient conversion;
- automatic Contact winner selection;
- `UNIQUE(phone)`, `UNIQUE(email)`, `UNIQUE(phone_normalized)` or `UNIQUE(email_normalized)`;
- provider/WhatsApp identity becoming Contact identity authority;
- frontend-only dedupe authority;
- pipeline administration, Inbox, follow-up, attribution, automation, AI/MCP/RAG.

## 0. ESTADO ATUAL COMPROVADO

- `origin/main`: `7c5673d43262ef3a0681d3a916d554bcc9627f71`;
- latest integrated CRM reconciliation: PR #540 merged;
- no successor CRM slice or `MED-CRM-006` branch existed before this slice;
- PR #525 remains historical/open/non-mergeable and is not authority;
- MED-CRM-001..005 are RELEASED;
- MED-CRM-005 keeps the bounded path `Novo prospect → Contact → Lead`;
- runtime/VPS is not required for this design checkpoint.

### Evidência comprovada

| Evidência | Fonte | O que prova | Limitação |
| --- | --- | --- | --- |
| `contacts.phone_normalized` / `email_normalized` and tenant-scoped indexes exist | `20260926_commercial_crm_core_foundation.sql` | normalization storage/index foundation already exists | does not prove values are populated |
| `create_current_clinic_crm_contact(...)` writes raw `phone/email`, not normalized columns | `20260926_commercial_crm_command_boundary.sql` | canonical Contact writer does not currently own normalization | historical function may be replaced only by additive follow-up migration |
| caller-supplied UUID retry is idempotent | command migration + PostgreSQL behavior cases | exact Contact/Lead retries do not duplicate side effects | does not resolve different UUIDs for the same person |
| `crm_current_mutator_clinic_id()` derives current clinic server-side and enforces writer roles + `crm.access` | command migration + verifier | tenant/write authority already exists | helper is internal only |
| current Lead projection exposes `contact_patient_id` | core foundation | existing Lead projection is too broad for identity resolution | should not be reused as Contact identity projection |
| WhatsApp inbound contains BR phone-equivalence logic | `20260906_whatsapp_inbound_tenant_lifecycle_boundary.sql` | historical BR matching rule exists | Patient/outbound routing authority, not Contact authority |

## 1. GAPS

1. canonical Contact normalization authority is missing even though normalized columns/indexes exist;
2. current-clinic Contact identity candidate lookup does not exist;
3. candidate preview alone cannot close the create race / TOCTOU window;
4. explicit `reuse` vs `distinct` resolution is not persisted atomically with the Contact/Lead operation it authorizes;
5. MED-CRM-002 idempotency protects same UUID retry, not different UUIDs representing potentially the same person;
6. no existing projection is sufficiently narrow because Contact identity resolution must not expose Patient identity or clinical data.

## 2. CAPABILITY AUTHORITY / REUSE GATE

| Capability | Autoridade canônica | Reuso | Decisão |
| --- | --- | --- | --- |
| tenant / writer boundary | `crm_current_mutator_clinic_id()` | current active profile + `crm.access` + owner/admin/recep | REUSE |
| Contact creation | `create_current_clinic_crm_contact(...)` | caller UUID idempotency + audit | EXTEND/COMPOSE, do not replace |
| Lead creation | `create_current_clinic_crm_lead(...)` | caller UUID idempotency + activity/audit | REUSE/COMPOSE |
| normalized storage | `contacts.phone_normalized/email_normalized` | existing indexes | EXTEND with one canonical normalizer |
| candidate lookup | none | existing Contact table only | BUILD narrow current-clinic projection |
| concurrency resolution | none | existing transaction semantics | BUILD narrow transaction-scoped guard |
| resolution audit | `crm_lead_activities` + `audit_log` | existing server-side audit mechanisms | REUSE |
| Patient identity | Patient domain | not required | REJECT |
| Deskcomm identity patterns | MED-DOC-001 | invariants only | ADAPT |

### Reuse conclusion

A new orchestration command is justified only because the final identity decision, race protection, Contact create/reuse, Lead creation and resolution audit need one server-side transaction. It must compose existing authorities rather than recreate generic Contact/Lead writers.

## 3. DECISION

### Chosen implementation authority

Use:

1. **canonical SQL/domain helpers** for Contact normalization and candidate-match derivation;
2. **writer-scoped/current-clinic candidate lookup** returning only CRM-safe identity-resolution data;
3. **one narrow transactional orchestration command** for the final resolution;
4. **deterministic transaction-scoped advisory locks** derived from `clinic_id + signal type + normalized signal`;
5. server-side candidate **recheck after locks**;
6. explicit modes:
   - `explicit_reuse`: create a new Lead for the selected existing Contact;
   - `explicit_distinct`: create a distinct Contact only with explicit reason after recheck;
7. reuse `crm_lead_activities` and `audit_log` for side-effect evidence without raw PII.

### Normalization contract

Storage normalization and match equivalence remain separate.

Phone:
- keep user/display value in `phone`;
- derive canonical `phone_normalized` server-side;
- BR 9th-digit legacy equivalence may be a candidate signal, never identity truth.

Email:
- trim;
- preserve local-part;
- lowercase domain only for canonical storage;
- do not automatically strip plus-tags, dots or provider aliases;
- possible case-fold equivalence is weak candidate evidence only.

### Candidate semantics

- 0 candidates → normal create may proceed;
- 1 candidate → no auto-reuse; explicit human decision;
- N candidates → explicit human decision;
- phone → Contact A and email → Contact B → explicit conflict;
- name/recency/completeness must not decide identity.

Exclude `deleted_at IS NOT NULL` and `anonymized_at IS NOT NULL`; do not expose tombstone/Patient data.

### Concurrency contract

- same clinic + same signal serializes;
- different clinics do not interfere;
- multiple signals acquire locks in deterministic sorted order;
- no phone/email signal must not create a global lock;
- final authority always rechecks after lock acquisition;
- uniqueness constraints on phone/email are not a substitute.

### Retry contract

Preserve MED-CRM-002/005 caller-supplied UUID idempotency.

Important case: after a successful creation, an exact retry may see the caller-supplied Contact as a candidate; the command must recognize the same persisted contract as retry, not as a new ambiguity.

### Alternatives rejected

- **A — only harden Contact create:** insufficient for explicit reuse because no Contact is created in that path and Lead/audit atomicity crosses aggregates;
- **B — helper/resolver only:** required internally but insufficient as final authority because browser composition leaves TOCTOU;
- **D — UNIQUE/trigger/client dedupe:** rejected because matching signals are not identity keys and client-only authority is bypassable.

### Data/security impact

Must preserve:
- tenant isolation;
- server-derived `clinic_id`;
- `crm.access`;
- owner/admin/recep writer authority;
- professional/financeiro read-only behavior;
- raw CRM DML closed;
- Contact != Lead != Patient;
- no Patient join/input/output/ranking;
- no raw phone/email in audit detail.

### Compatibility / migration

Implementation, if later approved, should be an additive follow-up migration. Do not rewrite already RELEASED production migrations silently.

### Rollback

Design checkpoint only. No runtime rollback is needed. A future implementation must define additive rollback/readback strategy before rollout.

## 4. SECOND ADVERSARIAL REVIEW

### Deterministic review

Closed at architecture/design level.

Reviewed failure modes:
- parallel authority;
- same-UUID retry regression;
- different-UUID same-person race;
- cross-tenant contamination;
- Patient boundary leak;
- ambiguous phone/email conflict;
- anonymized/deleted disclosure;
- advisory-lock deadlock;
- empty-signal global locking;
- audit PII leakage;
- Contact resolution accidentally becoming Lead resolution.

Conclusion: implementation authority is coherent if helper + candidate projection + final orchestration are separated and the orchestration reuses existing Contact/Lead/audit authorities.

### JEV

No fresh JEV execution is claimed by this documentation checkpoint. JEV remains advisory and must not substitute deterministic implementation-plan review, behavioral tests or runtime proof.

### MEDICSPRO DOCTRINE GATE

- [x] sistema-vivo applied at design level
- [x] authority/boundaries applied
- [x] AI↔human not expanded
- [x] external channels not granted identity authority
- [x] destructive merge/dedupe explicitly excluded
- [x] concrete authority artifacts recorded
- [x] candidate concurrency/idempotency properties identified for mechanical tests

Living System answers:
- input: phone/email identity signals + explicit operator resolution intent;
- output: explicit candidate set or committed Contact/Lead resolution;
- record/audit/activity: existing `crm_lead_activities` + `audit_log`;
- visible surface: Commercial CRM prospect intake;
- legitimate entry point: authenticated Commercial CRM writer;
- next step: implementation-plan review;
- configuration surface: none in V1;
- AI↔human continuity: no AI decision authority added;
- feedback signal: explicit ambiguity/conflict/failure state;
- authority reused: current clinic, CRM writer, Contact/Lead commands, activity/audit;
- authority not granted: Patient, provider identity, frontend dedupe, merge.

## 5. EXECUTION

**NOT STARTED.**

No migration, RPC, frontend, runtime or production mutation belongs to this documentation PR.

## 6. VALIDATION

For the later implementation plan, require at minimum:

- same UUID exact retry;
- same UUID divergent replay conflict;
- different UUID same exact phone race;
- different UUID same exact email race;
- phone/email split-conflict;
- BR legacy phone variant candidate;
- explicit reuse;
- explicit distinct + reason;
- deterministic multi-signal lock order;
- no-signal no-global-lock;
- different tenant isolation;
- deleted/anonymized exclusion;
- no Patient input/output/join;
- no PII in audit;
- existing Lead activity/audit remains correct;
- PostgreSQL 16/17 behavioral proof if repository policy remains current;
- current verifiers plus new structural/behavior verifier;
- frontend tests only after backend authority is proved.

## 7. DOCUMENTATION

- [x] create slice README
- [x] create DECISION
- [x] create EVIDENCE
- [x] create HANDOFF
- [ ] update ledger in this branch
- [ ] open docs-only PR
- [ ] merge only after current HEAD checks are green

## Residual / next exact step

Perform an **implementation-plan review before EXECUTION**. That review must name the exact follow-up migration, helper/function signatures, candidate projection shape, orchestration command contract, lock-key strategy, audit metadata and PostgreSQL behavioral/verifier cases. Do not write product code in the same movement merely because the design is now closed.
