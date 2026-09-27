# MED-CRM-006 — Implementation Plan

**Phase:** Backend authority  
**Status:** APPROVED FOR EXECUTION  
**Approved against:** `main@2140c3351843e5398a08d2a4bc40ba3972ac6329`  
**Implementation branch:** `feat/med-crm-006-contact-identity-resolution`

## Scope of this execution

This phase may change only:

- additive Commercial CRM migration(s);
- internal SQL helpers;
- the existing Contact/Lead command wrappers as required to preserve one authority;
- one writer-scoped Contact candidate projection;
- one narrow resolved-prospect orchestration command;
- Commercial CRM verifier / PostgreSQL behavioral and concurrency harness;
- CI workflow and MED-CRM-006 documentation.

This phase does **not** change frontend, production/runtime, Contact merge/edit/lifecycle, Patient, Lead→Patient, providers, roles, entitlements or tenant authority.

## 1. Follow-up migration

Create:

`supabase-migrations/20260927_commercial_crm_contact_identity_resolution.sql`

It is additive and may `CREATE OR REPLACE` current RELEASED functions through the versioned follow-up only. Do not rewrite the historical RELEASED migration files.

The harness applies the effective CRM stack explicitly in this order:

1. `20260927_updated_at_helper_reconciliation.sql`;
2. `20260926_commercial_crm_core_foundation.sql`;
3. `20260926_commercial_crm_command_boundary.sql`;
4. `20260927_commercial_crm_archived_pipeline_transition_guard.sql`;
5. `20260927_commercial_crm_contact_identity_resolution.sql`.

The identity migration is reapplied in the isolated harness to prove replay safety.

## 2. Normalization authority

Internal helpers, revoked from browser roles:

- `crm_normalize_contact_phone(text) -> text`;
- `crm_contact_phone_candidate_variants(text) -> text[]`;
- `crm_normalize_contact_email(text) -> text`.

### Phone storage normalization

- trim input and remove formatting for analysis;
- empty/unusable input -> NULL signal;
- explicit `+55` / leading `55` with valid BR national length -> `+55<10-or-11-national-digits>`;
- unprefixed 10/11 digit input is treated as BR national V1 and receives `+55`;
- explicit non-BR international input requires leading `+` and a structurally valid 8..15 digit international form;
- unsupported ambiguous forms remain raw display data but yield no canonical identity signal.

The historical BR 9th-digit rule is **not** storage normalization. Candidate variants contain the exact canonical form plus the with/without-9 counterpart when the BR shape permits it.

### Email storage normalization

- trim;
- require one non-empty local-part and one non-empty domain;
- preserve local-part exactly;
- lowercase domain only;
- no plus-tag removal, dot removal, provider aliasing or local-part case fold.

Weak email case-fold is deliberately excluded from V1 so matching and locking use the same exact signal set.

## 3. Legacy Contact compatibility

Do **not** mass-backfill `phone_normalized/email_normalized` in this phase.

Reasons:

- current RELEASED Contact writer may have left legacy rows NULL;
- a mass UPDATE would alter `contacts.updated_at` through the canonical trigger;
- correctness does not require a backfill.

New Contact writes populate normalized columns. Candidate lookup matches both:

- stored normalized values when present; and
- server-normalized raw `phone/email` as a fallback.

A future measured performance/backfill optimization requires its own gate.

## 4. Candidate authority

Internal candidate helper:

`crm_contact_identity_candidates_for_clinic(uuid,text,text)`

It accepts server-derived clinic + raw phone/email and returns only Contact-domain candidate data and structured reasons.

Browser projection:

`list_current_clinic_crm_contact_identity_candidates(p_phone text DEFAULT NULL, p_email text DEFAULT NULL)`

Properties:

- `SECURITY DEFINER`, pinned `search_path`;
- derives current clinic through `crm_current_mutator_clinic_id()`;
- executable only by `authenticated`, not `anon`;
- writer-scoped: owner/admin/recep + `crm.access`;
- excludes deleted/anonymized Contacts;
- no Patient join, `patient_id`, clinical input/output or ranking;
- returns:
  - `contact_id`;
  - `display_name`;
  - `phone`;
  - `email`;
  - `match_reasons text[]`;
  - `open_lead_count bigint`.

Allowed reasons in V1:

- `phone_exact`;
- `phone_br_legacy_variant`;
- `email_exact`.

The function never chooses a winner.

## 5. Locking authority

Internal helper:

`crm_contact_identity_lock_key(p_clinic_id uuid, p_kind text, p_value text) -> bigint`

The key uses a namespaced SHA-256 over UTF-8 text containing clinic + resource kind + canonical value. A positive 63-bit bigint is assembled from the first eight hash bytes with the sign bit cleared.

Internal signal lock helper:

`crm_lock_contact_identity_signals(p_clinic_id uuid, p_phone text, p_email text) -> void`

Rules:

- all phone candidate variants receive locks, not only the storage-canonical phone;
- exact canonical email receives a lock;
- duplicate keys are deduplicated;
- keys are acquired in ascending bigint order via `pg_advisory_xact_lock(bigint)`;
- empty signals acquire zero signal locks;
- different clinics hash to different resources;
- advisory keys never decide identity; candidate state is always rechecked after locks.

A per-clinic/per-lead idempotency advisory lock is acquired before signal locks by prospect/Lead creation. This order is fixed.

Hash collision can only cause unnecessary serialization because every authorization decision comes from the post-lock database recheck.

## 6. Shared Contact/Lead cores

Extract the existing insert/idempotency/audit bodies into revoked internal helpers so wrappers and orchestration share one implementation instead of duplicating it:

- `crm_create_contact_internal(...)`;
- `crm_create_lead_internal(...)`.

The public signatures remain compatible:

- `create_current_clinic_crm_contact(uuid,text,text,text)`;
- `create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)`.

### Harden the existing Contact writer

The existing Contact command remains valid for create-if-clear and exact retry.

- exact existing Contact UUID + same persisted raw contract -> return with no new side effect;
- divergent UUID replay -> existing idempotency conflict;
- new Contact ID -> acquire all identity signal locks, recheck candidates;
- any candidate -> `crm_contact_identity_resolution_required`;
- zero candidates / no usable signals -> create through the shared core;
- new writes persist `phone_normalized/email_normalized`.

This prevents direct callers from bypassing Contact Identity Resolution.

### Preserve Lead authority

The existing Lead command keeps its public contract and uses the shared internal Lead core. It acquires the per-lead idempotency lock before the core so the orchestration and direct Lead command serialize the same Lead UUID.

## 7. Final orchestration command

Add:

`create_current_clinic_crm_resolved_prospect(`

- `p_contact_id uuid`,
- `p_lead_id uuid`,
- `p_name text`,
- `p_title text`,
- `p_resolution_mode text`,
- `p_phone text DEFAULT NULL`,
- `p_email text DEFAULT NULL`,
- `p_override_reason text DEFAULT NULL`,
- `p_pipeline_id uuid DEFAULT NULL`,
- `p_stage_id uuid DEFAULT NULL`,
- `p_owner_id uuid DEFAULT NULL`,
- `p_value_cents bigint DEFAULT NULL`,
- `p_source text DEFAULT NULL`

`) RETURNS TABLE(contact_id uuid, lead_id uuid, resolution_mode text)`

`p_contact_id` is always the **effective Contact UUID**:

- new caller-supplied UUID for `create_if_clear`;
- selected existing Contact UUID for `explicit_reuse`;
- new caller-supplied UUID for `explicit_distinct`.

Modes:

### `create_if_clear`

Post-lock recheck must return zero candidates. Otherwise fail with identity-resolution-required.

### `explicit_reuse`

`p_contact_id` must still be one of the rechecked candidates. The selected Contact is row-locked/revalidated as active. No Contact field is updated. A new Lead is created for that Contact.

### `explicit_distinct`

Creates the new `p_contact_id` despite rechecked candidates only with a bounded server-validated reason code.

V1 reason codes:

- `shared_contact_channel`;
- `stale_or_reassigned_contact_detail`;
- `operator_verified_distinct_identity`.

The reason is forbidden for the other modes.

No mode auto-selects a Contact.

## 8. Retry / self-candidate

The orchestration acquires the per-lead lock first.

A prior `contact_identity_resolved` activity for the same Lead is the persisted orchestration contract. An exact retry validates:

- same clinic;
- same effective Contact UUID;
- same resolution mode;
- same override reason code;
- same persisted Contact contract for modes that created Contact;
- same persisted Lead title/owner/value/source and any explicitly supplied pipeline/stage.

It then returns with no new Contact, Lead, activity or audit.

A preexisting Lead UUID without a matching identity-resolution record is a conflict and is never silently adopted.

This makes the post-create self-candidate case an exact retry, not fresh ambiguity.

## 9. Resolution evidence

Add one partial unique index:

`crm_lead_contact_identity_resolution_once`

on `crm_lead_activities(lead_id)` where `activity_type='contact_identity_resolved'`.

First successful orchestration writes exactly once:

### `crm_lead_activities`

`activity_type = 'contact_identity_resolved'`

JSON metadata contains:

- `resolution_mode`;
- `contact_id`;
- `candidate_ids[]`;
- `match_reasons[]`;
- `override_reason` only for explicit distinct.

No raw phone/email is recorded.

### `audit_log`

`acao = 'CRM_CONTACT_IDENTITY_RESOLVED'`

Text detail contains only:

- lead ID;
- Contact ID;
- resolution mode;
- candidate count;
- bounded override reason code when applicable.

No raw phone/email/name.

Existing `CRM_CONTACT_CREATED`, `CRM_LEAD_CREATED` and `lead_created` evidence remains owned by the shared Contact/Lead cores.

## 10. PostgreSQL proof

Add:

- `supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_CONTACT_IDENTITY_RESOLUTION.sql`;
- `tests/sql/commercial_crm_contact_identity_resolution_cases.sql`;
- `scripts/test-commercial-crm-contact-identity-resolution.sh`;
- `.github/workflows/commercial-crm-contact-identity-resolution.yml`.

Run the harness on PostgreSQL 16 and 17.

Required cases:

1. exact phone normalization/candidate;
2. exact email normalization/candidate;
3. BR with/without 9th-digit candidate equivalence;
4. legacy Contact with NULL normalized columns still found;
5. new Contact stores normalized values;
6. zero candidates;
7. one candidate;
8. multiple candidates;
9. phone -> A / email -> B conflict returned, never auto-selected;
10. writer role allowed; professional/financeiro denied candidate RPC;
11. deleted/anonymized excluded;
12. no Patient input/output/join and no Patient mutation;
13. `create_if_clear`;
14. direct old Contact writer blocked when a candidate exists;
15. `explicit_reuse`;
16. `explicit_distinct` with allowed reason;
17. explicit distinct without/invalid reason rejected;
18. same IDs exact orchestration retry has exactly-once side effects;
19. divergent retry rejected;
20. self-candidate retry succeeds as retry;
21. different UUID exact-phone concurrency serializes/rechecks;
22. different UUID legacy-equivalent-phone concurrency serializes/rechecks;
23. deterministic multi-signal locking produces no deadlock;
24. cross-tenant lock keys/candidates remain independent;
25. no-signal path has no identity-signal advisory lock;
26. no raw PII in resolution activity/audit;
27. existing MED-CRM-002 command behavior remains green;
28. MED-CRM-004 archived-pipeline guard behavior remains green.

## 11. Rollout boundary

This implementation branch does not mutate production.

After backend code is PROVED + MERGED, production requires a separate rollout/readback gate:

`migration -> pinned/read-only verifier -> evidence`.

Frontend resolution UX is a subsequent phase and must not depend on the new RPC until backend authority is proved and released.

## Second adversarial review closure

The deep review specifically closed:

- direct old Contact RPC bypass;
- different-UUID exact and BR-legacy race;
- lock-order deadlock;
- empty-signal global locking;
- self-candidate retry;
- existing NULL normalized rows;
- audit PII;
- Patient boundary;
- orchestration becoming a generic CRM writer;
- frontend-before-backend deployment dependency.

JEV was advisory only. An initial review routed to `deep_review`; after these refinements the follow-up routed to `proceed_fast` with moderate confidence. Deterministic repository/PostgreSQL evidence remains the execution authority.
