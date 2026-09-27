# MED-CRM-006 — Contact Identity Resolution V1

**Status:** RELEASED
**Owner domain:** Commercial CRM  
**Design PR:** #541 — MERGED at `main@2140c3351843e5398a08d2a4bc40ba3972ac6329`  
**Plan-review PR:** #543 — MERGED at `main@1a0e96392570d69090e87895d4072f0eea640d7a`  
**Implementation PR:** #544 — MERGED as `main@837935ef82a18849dcd05986a27f7978a9cdd10b` from final validated HEAD `aed1b2752ca86c43ea37a47abf8e5684434e2811`  
**Frontend PR:** #548 — MERGED as `main@910dff50cf113a350e21192bcf5cd2209db1ab71` from final validated HEAD `d2c6356883a767f302ac98af834a9319f678529e`  
**Created:** 2026-09-27  
**Last reconciled:** 2026-09-27 against `main@910dff50cf113a350e21192bcf5cd2209db1ab71`, exact-head PR #548 CI, released backend production proof, Portainer runtime readback and route smoke

## Objective

Add a bounded Contact Identity Resolution contract for the Commercial CRM so a new prospect can explicitly reuse an existing Contact or deliberately create a distinct Contact without treating phone/email as unique identity, without creating Patient authority, and without allowing client-only lookup to become the final authority.

Backend implementation is PROVED in repository CI, merged and RELEASED in production. PR #544 final HEAD `aed1b2752ca86c43ea37a47abf8e5684434e2811` passed 21/21 workflows, including PostgreSQL 16/17 and Clinical workflow `validate` / `dependency-audit`. The exact canonical migration was then hash-proved and applied to production `28server` / `supabase-db`; the pinned production verifier and CRM regressions passed. Frontend candidate/resolution UX was completed in PR #548, PROVED on exact HEAD, protected-squash-merged and observed in production after Portainer redeploy. MED-CRM-006 is RELEASED.

## Final frontend release checkpoint — 2026-09-27

- frontend implementation PR #548 final validated HEAD: `d2c6356883a767f302ac98af834a9319f678529e`;
- all 20 workflow runs associated with that exact PR HEAD completed successfully, including `Clinical workflow CI`;
- protected squash merge produced `main@910dff50cf113a350e21192bcf5cd2209db1ab71`;
- after the Portainer redeploy, production began serving entry bundle `/assets/index-BYMym6it.js` with `Last-Modified: Sun, 27 Sep 2026 16:40:32 GMT`;
- that entry references live CRM chunk `/assets/CrmOperational-6R-i_o-S.js`;
- the live CRM chunk contains `list_current_clinic_crm_contact_identity_candidates`, `resolve_current_clinic_crm_prospect_identity`, `create_if_clear`, `explicit_reuse`, `explicit_distinct` and the exact-retry copy `Repetir mesma tentativa`;
- the live CRM chunk does not contain the old direct Prospect Intake writers `create_current_clinic_crm_contact` or `create_current_clinic_crm_lead`;
- public route smoke after redeploy returned HTTP 200 for `/`, `/crm`, `/agenda` and `/pacientes`;
- no authenticated human Contact/Lead mutation was performed as part of this final readback; release status is based on exact-head repository proof, released backend verifier evidence, live production bundle readback and public route health.

Deterministic conclusion: **MED-CRM-006 is RELEASED**. The canonical boundary remains `Contact != Lead != Patient`; phone/email remain candidate signals rather than unique identity; the server resolver remains final authority; no Patient matching/creation authority was introduced by this slice.

## Repository proof checkpoint — 2026-09-27

- PR #544 was revalidated immediately before merge: open, mergeable, 0 behind, no reviews/threads, expected 11 changed files.
- Final HEAD `aed1b2752ca86c43ea37a47abf8e5684434e2811` had 21/21 workflow runs `completed/success`.
- Dedicated `Commercial CRM Contact Identity Resolution`: PostgreSQL 16 = success; PostgreSQL 17 = success.
- `Clinical workflow CI`: `validate` = success; `dependency-audit` = success.
- Protected squash merge with exact expected HEAD produced `main@837935ef82a18849dcd05986a27f7978a9cdd10b`.
- Post-merge comparison `main` ↔ merge SHA was identical.
- Repository proof was followed by successful production rollout/readback; see the production checkpoint below.

## Production backend release checkpoint — 2026-09-27

- production host: `28server`; PostgreSQL container: `supabase-db`;
- governed readback target: `medicspro-db-readback` with only `postgres.pinned_readback`;
- governed mutation path: approval-gated `medicspro-managed-admin`;
- verifier pin was added without widening container/DB/user authority;
- before migration, the newly pinned verifier reached PostgreSQL and failed closed with `crm_identity_function_missing`, proving the capability was absent;
- canonical migration SHA-256: `f36f036f172b997292654f251b8a9d386839bc9ef41204636aa11de95605d31b`;
- the same migration hash was proved in the operator workspace and inside `supabase-db` as user `postgres`;
- migration execution used `psql -w -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f ...` and completed through `COMMIT`;
- pinned verifier SHA-256: `4da932b767d18decbd8c0d881b679dc29735364abcbf3b5b0c73c2d75d88f785`;
- production verifier returned `COMMERCIAL CRM CONTACT IDENTITY RESOLUTION VERIFY PASSED` after 12 checks;
- pinned regressions also passed for Commercial CRM Core, Command Boundary and Archived Pipeline Transition Guard;
- backend authority is RELEASED; the frontend proof and production observation are recorded in the final release checkpoint below.

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

- frontend execution was completed in PR #548 from the revalidated base; final validated HEAD was `d2c6356883a767f302ac98af834a9319f678529e` and protected squash merge produced `main@910dff50cf113a350e21192bcf5cd2209db1ab71`;
- canonical implementation PR #544 is merged; its final validated HEAD was `aed1b2752ca86c43ea37a47abf8e5684434e2811`;
- PR #542 is a green prototype built from the pre-#543 contract and is not merge authority because it diverges on RPC width, lock-key derivation/order and phone normalization;
- PR #525 remains historical/open/non-mergeable and is not authority;
- MED-CRM-001..005 are RELEASED;
- MED-CRM-005 keeps the bounded path `Novo prospect → Contact → Lead`;
- repository validation is complete: 21/21 workflows success; PostgreSQL 16 and 17 dedicated jobs success; Clinical workflow `validate` and `dependency-audit` success;
- production backend rollout/readback is complete; frontend candidate/resolution UX is PROVED, merged and observed in production; MED-CRM-006 is RELEASED.

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

**BACKEND IMPLEMENTATION + PRODUCTION ROLLOUT COMPLETE.**

PR #544 implemented the canonical migration, verifier, behavioral cases, concurrency harness and PostgreSQL 16/17 workflow, then merged through the protected branch path. Production rollout used the exact hash-proved migration through the approval-gated managed-admin path and completed through `COMMIT`.

No frontend mutation is claimed by the backend rollout.

## Frontend execution checkpoint — PR #548

Frontend work started only after re-resolving live `main@e2902917f247ab92683988e3beed8b5e4badd225`, auditing the current Prospect Intake code/tests, closing GAPS + REUSE + DECISION + SECOND ADVERSARIAL REVIEW, and creating a fresh branch from that exact base.

Implemented scope in PR #548:

- candidate preview through `list_current_clinic_crm_contact_identity_candidates(text,text)`;
- zero candidates → final resolver with `create_if_clear`;
- one or multiple candidates → explicit human decision, never auto-reuse;
- phone/email split candidates → explicit conflict copy, no automatic winner;
- selected candidate → `explicit_reuse` and a new Lead through the server resolver;
- distinct Contact → `explicit_distinct` with required reason;
- final commit authority only through `resolve_current_clinic_crm_prospect_identity(...)`;
- server rejection after stale preview re-enters candidate review fail-closed;
- caller Contact/Lead UUIDs remain stable for retry uncertainty;
- canonical CRM refetch remains the post-command projection authority;
- no Patient input/output/matching, no backend SQL change, and no fallback from Prospect Intake to the old Contact + Lead browser sequencing.

Frontend tests cover zero/one/multiple candidates, split conflict, reuse, distinct reason, stale server rejection, exact retry intent, Patient boundary and no-writer-fallback boundary. Final PR #548 HEAD `d2c6356883a767f302ac98af834a9319f678529e` completed all 20 applicable GitHub workflows successfully before merge.

## 6. VALIDATION

Repository validation is complete for final implementation HEAD `aed1b2752ca86c43ea37a47abf8e5684434e2811`, including PostgreSQL 16/17, behavioral/concurrency cases, Clinical workflow `validate` and `dependency-audit`, and all 21 applicable workflows.

Production validation is also complete:

- pre-rollout verifier failed closed with `crm_identity_function_missing`;
- migration SHA-256 matched canonical source before execution;
- production migration completed through `COMMIT`;
- MED-CRM-006 pinned verifier passed all 12 checks;
- Core pinned verifier passed;
- Command Boundary pinned verifier passed;
- Archived Pipeline Transition Guard pinned verifier passed;
- verification ran through the separate read-only semantic target.

This proves the backend authority RELEASED in production. Frontend repository proof, protected merge, live bundle readback and route smoke are also complete, so the whole MED-CRM-006 slice is RELEASED.

## 7. DOCUMENTATION

- [x] slice README
- [x] DECISION
- [x] EVIDENCE
- [x] HANDOFF
- [x] ledger
- [x] canonical backend implementation PR #544
- [x] exact-head repository validation
- [x] protected squash merge
- [x] controlled production DB rollout
- [x] production-safe verifier/readback
- [x] backend RELEASED after runtime proof
- [x] frontend resolution UX authorized
- [x] frontend implementation / exact-head validation / protected merge
- [x] frontend production observation after Portainer redeploy
- [x] final MED-CRM-006 release reconciliation

## Implementation-plan review — CLOSED

The implementation-plan review on `main@2140c3351843e5398a08d2a4bc40ba3972ac6329` found and closed two design gaps before execution:

1. **normal zero-candidate intent:** V1 needs `create_if_clear` in addition to `explicit_reuse` and `explicit_distinct`; using `explicit_distinct` when there is no ambiguity would fabricate an override;
2. **legacy writer bypass:** leaving `create_current_clinic_crm_contact(...)` able to create a new UUID for an already-matching signal would bypass the new authority.

Normative refinement:

- `create_if_clear` = create only if the locked server-side recheck still finds no other active candidate;
- `explicit_reuse` = selected current candidate receives a new Lead;
- `explicit_distinct` = create a distinct Contact only after current ambiguity is rechecked and a non-empty reason is supplied;
- the released Contact writer keeps its public signature but becomes **clear-only**: exact same-ID retry remains valid, while a new-ID ambiguous create fails closed with an identity-resolution-required error;
- a revoked internal Contact insert/retry helper is shared by the clear-only writer and orchestration; it is implementation reuse, not a browser authority;
- the released Lead command remains the canonical Lead creation authority;
- no historical normalized-column backfill is required in V1; legacy rows are matched by applying the same canonical helpers to raw stored values, avoiding a migration that would rewrite Contact `updated_at` merely for derived fields;
- all new Contact writes populate `phone_normalized` / `email_normalized`;
- lock coverage includes every active match key: exact phone, BR legacy-phone equivalence when applicable, and exact email;
- lock acquisition is transaction-scoped and deterministically ordered; final candidates are always recomputed after all locks;
- a `contact_identity_resolved` entry in existing `crm_lead_activities` records the committed resolution without automatically copying raw phone/email;
- existing text-only `audit_log` gets IDs/mode/count only; it does not receive raw phone/email or free-text reason.

### Exact backend implementation artifacts

- migration: `supabase-migrations/20260927_commercial_crm_contact_identity_resolution.sql`;
- verifier: `supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_CONTACT_IDENTITY_RESOLUTION.sql`;
- behavior cases: `tests/sql/commercial_crm_contact_identity_resolution_cases.sql`;
- harness: `scripts/test-commercial-crm-contact-identity-resolution.sh`;
- PostgreSQL 16/17 workflow: `.github/workflows/commercial-crm-contact-identity-resolution.yml`.

### Execution boundary

**Backend authority phase is authorized after this plan-review documentation is integrated.**

Frontend resolution UX is a later phase inside MED-CRM-006 and must not depend on the new RPC until the backend migration is RELEASED in production.

The backend rollout is intentionally backward-compatible for ordinary creation: zero-candidate stale clients continue to work; an ambiguous stale-client create fails closed instead of silently creating another Contact.

The slice remains `DESIGNED` until implementation actually starts.
