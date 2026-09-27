# MED-CRM-006 — Evidence

**Checkpoint:** 2026-09-27  
**Canonical repository:** `OARANHA/crmfisio`  
**Audited main:** `910dff50cf113a350e21192bcf5cd2209db1ab71`

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
- backend implementation is PROVED, MERGED and RELEASED; frontend PR #548 is also PROVED, MERGED and observed in production, so the whole MED-CRM-006 slice is RELEASED.


## Backend implementation proof — PR #544

Canonical artifacts integrated by PR #544:

- `supabase-migrations/20260927_commercial_crm_contact_identity_resolution.sql`;
- `supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_CONTACT_IDENTITY_RESOLUTION.sql`;
- `tests/sql/commercial_crm_contact_identity_resolution_cases.sql`;
- `scripts/test-commercial-crm-contact-identity-resolution.sh`;
- `scripts/test-commercial-crm-contact-identity-resolution-concurrency.sh`;
- `.github/workflows/commercial-crm-contact-identity-resolution.yml`.

The dedicated workflow proves both PostgreSQL 16 and PostgreSQL 17 behavior. The harness includes the effective CRM migration stack, structural verifier, identity-resolution behavior cases, MED-CRM-002 and MED-CRM-004 regressions, and the real two-session concurrency harness. The repository proof is tied to final HEAD `aed1b2752ca86c43ea37a47abf8e5684434e2811` and merge `837935ef82a18849dcd05986a27f7978a9cdd10b`.


## Production backend release proof — 2026-09-27

Runtime authority and rollout evidence:

- host: `28server` (Ubuntu 24.04.3 LTS observed at rollout);
- PostgreSQL container: `supabase-db`;
- `medicspro-db-readback`: read-only Agent Mesh target with only `postgres.pinned_readback`;
- `medicspro-managed-admin`: approval-gated managed-admin path used for exact administrative steps;
- the PostgreSQL read proxy remained pinned to `supabase-db`, exec user `postgres`, DB user `postgres`, DB `postgres`;
- a dedicated `med-crm-006-verifier.conf` drop-in added only the new verifier id/hash mapping, preserving the prior four verifier mappings and existing service hardening;
- before migration, the newly authorized pinned verifier reached PostgreSQL and failed with `crm_identity_function_missing`; this proved the MED-CRM-006 backend was absent and the pin/readback path was live;
- canonical migration SHA-256: `f36f036f172b997292654f251b8a9d386839bc9ef41204636aa11de95605d31b`;
- the migration hash was proved in the operator workspace and again inside `supabase-db` as user `postgres`;
- exact migration execution used `psql -w -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/20260927_commercial_crm_contact_identity_resolution.sql`;
- execution returned `BEGIN`, function/ACL/index operations and final `COMMIT` with exit code 0;
- canonical verifier SHA-256: `4da932b767d18decbd8c0d881b679dc29735364abcbf3b5b0c73c2d75d88f785`;
- the separate pinned read-only verifier passed checks 1..12 and returned `COMMERCIAL CRM CONTACT IDENTITY RESOLUTION VERIFY PASSED`;
- post-rollout pinned regressions returned:
  - `COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED`;
  - `COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED`;
  - `COMMERCIAL CRM ARCHIVED PIPELINE TRANSITION GUARD VERIFY PASSED`.

Deterministic conclusion: MED-CRM-006 backend authority is RELEASED in production. Frontend identity-resolution UX is also PROVED, merged and observed in production; the whole slice is RELEASED.


## Repository state

- PR #545 is merged as `main@7e1ab2fba50d6188e718411c6b51b201ae417954` and records the post-#544 repository proof checkpoint before production rollout.
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

## Frontend execution evidence — PR #548 (PROVED + MERGED + RELEASED)

Fresh reconstruction before execution proved:

- live `origin/main = e2902917f247ab92683988e3beed8b5e4badd225`, the #547 frontend handoff merge;
- PRs #544, #546 and #547 are merged; backend RELEASED evidence remains intact;
- historical PR #525 remains open/non-mergeable and is not authority;
- no newer open Prospect/Contact Identity Resolution PR was found before opening #548;
- `/crm` still routes through `CrmOperational → Crm → CommercialCrmBoard` behind the CRM module gate, `crm.access` entitlement gate and privacy boundary;
- the current intake generated caller Contact/Lead UUIDs once when opening the draft and preserved them after uncertain errors;
- the pre-#548 intake still composed `create_current_clinic_crm_contact` then `create_current_clinic_crm_lead`, which now fails closed on identity ambiguity but could only surface a generic frontend error.

The frontend reuse gate selected only RELEASED capabilities: candidate lookup, final resolver, existing writer/tenant authority, resolver-owned Contact/Lead/activity/audit behavior, stable draft IDs and canonical CRM projections.

PR #548 changed only frontend adapter/UI/tests/docs. Product code adds no SQL/schema/RPC/table/role/entitlement/tenant/audit authority. Prospect Intake now uses the dedicated candidate projection for preview and the final resolver for commit; it has no fallback to the old separate Contact/Lead browser writers.

New tests cover:

- zero candidates → `create_if_clear`;
- one candidate → human decision required;
- multiple candidates → human decision required;
- phone/email split conflict;
- `explicit_reuse` only after candidate selection;
- `explicit_distinct` blocked until reason is non-empty;
- stale server rejection refreshes candidates instead of creating a Contact client-side;
- retry after transport uncertainty preserves the same Contact/Lead draft IDs;
- adapter shape for candidate/resolver RPCs and no Patient fields;
- static frontend boundary: no Prospect Intake fallback to old Contact/Lead writers and no Lead projection used as identity matching authority.

Final PR #548 HEAD `d2c6356883a767f302ac98af834a9319f678529e` completed all 20 applicable GitHub workflows successfully before protected squash merge as `main@910dff50cf113a350e21192bcf5cd2209db1ab71`.

## Frontend adversarial retry correction — 2026-09-27

A post-implementation deterministic review found one retry bug before proof/merge: after a transport-uncertain `create_if_clear` attempt, rerunning candidate preview first could observe the caller's own just-committed Contact as a new candidate and prevent the resolver from exercising its canonical self-candidate exact-retry path.

PR #548 was corrected so transport uncertainty stores the exact resolution intent and freezes the draft fields. The next action repeats the same resolver call directly with the same Contact UUID, Lead UUID and resolution intent **without re-running candidate preview**. Known semantic stale/ambiguity errors clear this retry state and return to canonical candidate review instead.

The regression test deliberately prepares a self-candidate for a hypothetical second preview, then proves that the retry performs no second candidate lookup and repeats `create_if_clear` with the same IDs. This closes the frontend retry/idempotency gap without changing backend authority.

## Evidence limitations

This checkpoint proves backend repository implementation, production migration and production-safe readback; exact-head frontend repository proof; protected merge; live Portainer bundle observation; and public route health. It does **not** claim a human-authenticated production Contact/Lead mutation session or a role-by-role manual UX walkthrough.

Historical normalized Contact distribution was not mass-backfilled or used as release authority; legacy correctness remains server-side normalization of stored raw values. MED-CRM-006 is RELEASED on the evidence recorded above.


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
