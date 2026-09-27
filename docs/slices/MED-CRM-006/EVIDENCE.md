# MED-CRM-006 — Evidence

**Checkpoint:** 2026-09-27  
**Canonical repository:** `OARANHA/crmfisio`  
**Audited main:** `837935ef82a18849dcd05986a27f7978a9cdd10b`

## Canonical implementation checkpoint — 2026-09-27

- plan-review PR #543 merged at `main@1a0e96392570d69090e87895d4072f0eea640d7a`;
- canonical implementation PR #544 final HEAD was `aed1b2752ca86c43ea37a47abf8e5684434e2811`;
- immediately before merge, PR #544 was mergeable, 0 behind, had the expected 11 changed files, no reviews and no review threads;
- all 21 workflow runs on that exact HEAD completed successfully;
- dedicated `Commercial CRM Contact Identity Resolution`: PostgreSQL 16 = success; PostgreSQL 17 = success;
- `Clinical workflow CI`: `validate` = success; `dependency-audit` = success;
- protected squash merge with `expected_head_sha=aed1b2752ca86c43ea37a47abf8e5684434e2811` produced `main@837935ef82a18849dcd05986a27f7978a9cdd10b`;
- post-merge comparison proved `main` identical to that merge SHA;
- PR #542 remains non-authoritative prototype/reuse evidence only;
- backend implementation is therefore PROVED in repository evidence and MERGED, but production rollout/readback has not occurred and frontend work remains unauthorized.


## Backend implementation proof — PR #544

Canonical artifacts integrated by PR #544:

- `supabase-migrations/20260927_commercial_crm_contact_identity_resolution.sql`;
- `supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_CONTACT_IDENTITY_RESOLUTION.sql`;
- `tests/sql/commercial_crm_contact_identity_resolution_cases.sql`;
- `scripts/test-commercial-crm-contact-identity-resolution.sh`;
- `scripts/test-commercial-crm-contact-identity-resolution-concurrency.sh`;
- `.github/workflows/commercial-crm-contact-identity-resolution.yml`.

The dedicated workflow proves both PostgreSQL 16 and PostgreSQL 17 behavior. The harness includes the effective CRM migration stack, structural verifier, identity-resolution behavior cases, MED-CRM-002 and MED-CRM-004 regressions, and the real two-session concurrency harness. The repository proof is tied to final HEAD `aed1b2752ca86c43ea37a47abf8e5684434e2811` and merge `837935ef82a18849dcd05986a27f7978a9cdd10b`.


## Repository state

- PR #540 is merged and is the latest integrated CRM handoff refresh at this checkpoint.
- No branch matching `MED-CRM-006` existed before opening this slice.
- PR #525 remains historical/open/non-mergeable and is not implementation authority.
- `docs/SLICE_LEDGER.md` records MED-CRM-001..005 as RELEASED.
- No successor CRM slice was recorded in the ledger before MED-CRM-006.

## Proven Commercial CRM foundation

### Normalized columns/indexes already exist

From `supabase-migrations/20260926_commercial_crm_core_foundation.sql`:

- `contacts.phone_normalized text`;
- `contacts.email_normalized text`;
- `contacts_phone_normalized_idx (clinic_id, phone_normalized)`;
- `contacts_email_normalized_idx (clinic_id, email_normalized)`.

The indexes are not UNIQUE.

### Canonical Contact writer does not populate normalized columns

From `supabase-migrations/20260926_commercial_crm_command_boundary.sql`:

`create_current_clinic_crm_contact(uuid,text,text,text)` currently inserts:

- `id`;
- `clinic_id`;
- `name`;
- `phone`;
- `email`.

It does not write `phone_normalized` or `email_normalized`.

No Contact normalization trigger/helper was found in the Commercial Core/Command Boundary migrations audited for this decision.

## Existing mutation authority

### `crm_current_mutator_clinic_id()`

Proven current behavior:

- reads `current_active_profile()`;
- permits `owner | admin | recep`;
- requires `current_clinic_entitlement_allowed('crm.access')`;
- returns server-derived `clinic_id`;
- is revoked from browser roles and acts as an internal helper.

### Contact create retry

`create_current_clinic_crm_contact(...)` uses caller-supplied Contact UUID:

- insert with `ON CONFLICT(id) DO NOTHING`;
- exact persisted contract returns success;
- divergent replay raises `crm_contact_idempotency_conflict`;
- anonymized/deleted/patient-linked conflicting replay is rejected;
- creation emits one `CRM_CONTACT_CREATED` audit record without raw Contact PII.

The PostgreSQL behavior cases prove exact retry does not create a duplicate Contact or duplicate audit record.

### Lead create retry

`create_current_clinic_crm_lead(...)`:

- accepts caller-supplied Lead UUID;
- requires an existing current-clinic non-deleted/non-anonymized Contact;
- chooses/validates active pipeline and open stage;
- exact retry returns the same Lead;
- divergent retry raises `crm_lead_idempotency_conflict`;
- first creation emits `crm_lead_activities.activity_type='lead_created'`;
- first creation emits `CRM_LEAD_CREATED` audit.

## Current read projection is not the identity-resolution boundary

`list_current_clinic_crm_leads()` returns Contact fields including:

- Contact ID/name/phone/email;
- `contact_patient_id`;
- `contact_anonymized_at`.

This projection is intentionally a Lead/Board projection. Reusing it as Contact Identity Resolution output would leak Patient linkage into a flow whose contract explicitly excludes Patient from matching, ranking, input and output.

Therefore a separate minimal candidate projection is justified.

## Existing reader/writer role distinction

Commercial Core already has an internal read helper that allows:

- owner;
- admin;
- professional;
- recep;
- financeiro;

behind `crm.access`.

Commercial mutation authority is narrower:

- owner;
- admin;
- recep.

Because Contact Identity Resolution directly authorizes Contact/Lead creation/reuse, the candidate projection should reuse the writer boundary rather than widen identity-resolution PII to read-only roles without a proven need.

## Historical BR phone equivalence evidence

`supabase-migrations/20260906_whatsapp_inbound_tenant_lifecycle_boundary.sql` contains historical Brazilian phone matching behavior:

- remove non-digits;
- strip leading `55` in expected BR lengths;
- tolerate historical 9th-digit variation for candidate comparison.

That implementation belongs to WhatsApp inbound Patient/outbound-ledger routing. It is evidence of an existing BR equivalence rule, not Contact identity authority.

## MED-CRM-005 frontend behavior

`src/lib/commercialCrm.ts` proves the released Prospect Intake composition:

1. `createCurrentClinicCrmContact(...)`;
2. `createCurrentClinicCrmLead(...)`;
3. refresh canonical Commercial CRM projections.

Stable caller-supplied UUIDs are explicitly relied on for uncertain retry.

This preserves transport idempotency for the same draft but does not solve a different draft generating a different Contact UUID for the same person.

## Concurrency gap

No current Commercial CRM command was found that serializes candidate identity signals across different caller-supplied Contact UUIDs.

Therefore this race remains possible in principle:

`A lookup 0 → B lookup 0 → A creates C1 → B creates C2`

A frontend preview cannot be final authority.

## Audit foundation

Existing authorities already available for reuse:

- `crm_lead_activities`;
- `audit_log`.

A new browser-only audit path is unnecessary and would create parallel authority.

## Deskcomm absorption evidence

From `docs/DESKCOMM_ADOPTION_MATRIX.md` and `docs/slices/MED-DOC-001/FINAL-ABSORPTION-SYNTHESIS.md`:

- Contact and Lead remain distinct;
- Contact may have multiple Leads;
- ambiguity must fail safely rather than guess;
- external tenancy/RBAC is rejected;
- stage/human/AI operations should converge on canonical domain authority;
- external/reference proof does not become MedicsPro proof automatically.

Deskcomm is used only for patterns/invariants, never as authority for MedicsPro identity semantics.

## Evidence limitations

This checkpoint proves repository implementation and merge only. It does **not** prove:

- that `20260927_commercial_crm_contact_identity_resolution.sql` has been applied to the real production PostgreSQL runtime;
- production dependency/preflight state at rollout time;
- production-safe verifier/readback success;
- production distribution of historical normalized Contact values;
- frontend candidate/resolution UX;
- observed frontend production behavior after a later UI rollout.

No production mutation is claimed by this checkpoint. MED-CRM-006 must not be called RELEASED until the controlled database rollout and production verifier/readback are completed.


## Implementation-plan review evidence — 2026-09-27

### Repository reconciliation

- PR #541 final HEAD `3f6240c3dd48622e59e34ae4f44c4b6a16a37be7` was 8 ahead / 0 behind, docs-only and mergeable.
- Current HEAD had 20/20 workflow runs `completed + success`.
- `Clinical workflow CI / validate` passed `npm ci`, `npm test`, typecheck, lint and build.
- `dependency-audit` passed.
- reviews = 0; review threads = 0.
- protected squash merge produced `main@2140c3351843e5398a08d2a4bc40ba3972ac6329`.
- PR #525 remains historical/open/non-mergeable and is not authority.
- no newer competing CRM PR was found at this checkpoint.

### New deterministic gaps found by the plan review

1. The design had only `explicit_reuse` / `explicit_distinct`, but zero candidates require a normal non-override intent. This is now `create_if_clear`.
2. The released Contact command remained directly callable and could otherwise bypass identity resolution with a new UUID. V1 must harden it as clear-only while preserving exact same-ID retry.

These findings refine the #541 design; they do not create a second Contact authority.

### Existing audit shape

The repository proves `audit_log.detalhe` is `text`, while `crm_lead_activities.metadata` is `jsonb`.

Therefore:

- structured resolution context belongs to the existing Lead activity timeline;
- audit remains an append-only summary with IDs/mode/count;
- raw phone/email must not be copied to audit;
- no new audit table or browser audit path is justified.

### Historical normalized data

The current Contact writer never populated `phone_normalized/email_normalized`, so existing Contacts may legitimately have NULL derived fields.

A V1 mass backfill was rejected during plan review because the Contact `updated_at` trigger would rewrite business timestamps for a derived-field migration.

Chosen compatibility rule:

- canonical helper applied to raw stored value remains the correctness path for legacy rows;
- stored normalized columns may optimize new rows;
- all new Contact writes populate the derived columns.

Runtime distribution of historical NULL values is not required to decide this correctness contract. A production readback may measure it before rollout without changing the design.

### PostgreSQL advisory-lock reference check

Current PostgreSQL 16/17 documentation confirms:

- `pg_advisory_xact_lock(bigint)` is an exclusive transaction-level advisory lock;
- transaction-level advisory locks are automatically released at transaction end;
- advisory keys are application-defined;
- deadlocks remain possible when locks are acquired in inconsistent order.

MED-CRM-006 therefore requires deterministic material ordering plus server-side candidate recheck after all locks.

### Second adversarial review

JEV remains advisory.

First plan pass, before refinements:

- route = `deep_review`;
- deep_review = 0.82;
- proceed_fast = 0.09;
- block = 0.08;
- confidence = 0.76.

After adding `create_if_clear`, hardening the old Contact writer, covering BR legacy lock keys, defining retry activity locking and backend-first fail-closed rollout:

- route = `proceed_fast`;
- proceed_fast = 0.72;
- deep_review = 0.26;
- block = 0.01;
- confidence = 0.63.

Deterministic review, not JEV, is the execution authority.

### Deterministic conclusion

No blocker remains for the **backend authority implementation phase** provided the code and tests match the refined decision.

Frontend implementation and production rollout are not authorized by this review alone.
