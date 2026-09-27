# MED-CRM-006 — Evidence

**Checkpoint:** 2026-09-27  
**Canonical repository:** `OARANHA/crmfisio`  
**Audited main:** `2140c3351843e5398a08d2a4bc40ba3972ac6329`

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

This documentation checkpoint did not:

- mutate production;
- inspect runtime data distribution of `phone_normalized/email_normalized`;
- prove a concrete advisory-lock key implementation;
- create candidate or orchestration RPCs;
- run PostgreSQL behavior cases for Contact Identity Resolution;
- run provider or frontend E2E.

Those belong to the implementation-plan / execution / validation gates.


## Implementation-plan review evidence — 2026-09-27

### Design integration

PR #541 was revalidated on its actual head `3f6240c3dd48622e59e34ae4f44c4b6a16a37be7`:

- base = `main@7c5673d43262ef3a0681d3a916d554bcc9627f71`;
- 8 ahead / 0 behind;
- mergeable;
- six changed files, all under `docs/`;
- no reviews or review threads;
- 20/20 workflow runs completed with success;
- `validate` and `dependency-audit` jobs completed with success.

The protected squash merge used the expected head SHA and produced:

`main@2140c3351843e5398a08d2a4bc40ba3972ac6329`.

No newer competing CRM PR was found; #525 remains historical/open/non-mergeable.

### Legacy normalized-column gap

The current Contact writer still inserts raw `phone/email` only. Therefore existing Contacts created after MED-CRM-005 can legitimately have NULL `phone_normalized/email_normalized`.

A mass backfill was rejected for this phase because `contacts` has the canonical `update_updated_at` trigger. Correctness is instead preserved by candidate fallback normalization of raw Contact fields while new writes populate the normalized columns.

### Existing trigger / authority evidence

`contacts` has:

- the canonical `update_updated_at` trigger;
- Contact→Patient tenant guard only for patient linkage;
- no generic browser write authority.

The identity slice therefore must not mutate all legacy Contacts merely to obtain a candidate index hit.

### Existing command regression surface

The current PostgreSQL Command Boundary cases already prove:

- owner/admin/recep writer authority;
- professional/financeiro denial;
- disabled `crm.access` fail-closed;
- Contact exact retry / divergent retry;
- anonymized Contact rejection;
- Lead exact retry / divergent retry;
- tenant isolation;
- exactly-once Contact/Lead activity/audit;
- raw Commercial Core browser DML closed;
- no Patient / Patient Journey mutation.

The identity harness must rerun these cases unchanged.

The current MED-CRM-004 migration additionally proves the repository's preferred retry pattern: exact side-effect-free retry is recognized before a newer state-changing guard. MED-CRM-006 applies the same principle to self-candidate retry.

### PostgreSQL primitive proof

Official PostgreSQL 16 and 17 documentation confirms:

- `pg_advisory_xact_lock(bigint)` is an exclusive transaction-level advisory lock;
- transaction-level advisory locks are released automatically at transaction end;
- advisory keys are application-defined;
- `sha256(bytea)`, `convert_to(text,...)`, `encode(bytea,'hex')` and `get_byte(bytea,...)` are built-in in both target PostgreSQL versions.

The implementation uses the hash only for serialization. Candidate rows are always recomputed after lock acquisition, so a hash collision cannot select or authorize a Contact; it can only add contention.

### Historical BR phone evidence reconciled

The WhatsApp inbound migration removes formatting, handles leading BR country code in expected lengths, and treats the historical 9th digit as an equivalence for matching.

MED-CRM-006 adapts only that equivalence concept. It does not reuse Patient/outbound routing authority, and the historical variant remains candidate evidence rather than identity truth.

### Adversarial review

Advisory JEV results:

- first plan: `deep_review = 0.84`, `block = 0.01`;
- refined plan: `proceed_fast = 0.57`, `deep_review = 0.39`, `block = 0.03`.

These probabilities are recorded as review input only. The execution decision is based on deterministic closure in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).

## Evidence limitations after plan closure

Still not proved at this checkpoint:

- the new SQL compiles on PostgreSQL 16/17;
- concurrency cases pass;
- current CRM regression cases remain green after the function replacements;
- GitHub workflows for the implementation head are green;
- production contains the new migration;
- frontend uses the new preview/orchestration capability.

Therefore MED-CRM-006 is `IMPLEMENTING`, not `PROVED` or `RELEASED`.
