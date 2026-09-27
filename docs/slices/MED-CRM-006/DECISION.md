# MED-CRM-006 — Decision

**Capability:** Contact Identity Resolution V1  
**Status:** DESIGNED  
**Decision date:** 2026-09-27  
**Reconciled against:** `main@7c5673d43262ef3a0681d3a916d554bcc9627f71`

## Context

MED-CRM-005 made `Novo prospect → Contact → Lead` operational by composing the already RELEASED Contact and Lead creation commands. Each new draft owns stable caller-supplied Contact/Lead UUIDs so uncertain retries remain idempotent.

That release deliberately did not solve identity resolution. A new draft for the same person can therefore use a different Contact UUID.

The Commercial Core already contains `phone_normalized` and `email_normalized`, but the canonical Contact create command currently stores raw `phone` / `email` only. Phone/email were explicitly designed as matching signals, not unique identity keys.

The problem is therefore **Contact Identity Resolution**, not destructive dedupe/merge.

## Decision

### 1. One normalization authority

Canonical Contact normalization will live server-side in SQL/domain helpers.

Frontend normalization may exist only for presentation or early feedback and cannot become identity authority.

Separate:

`canonical storage normalization != match equivalence`

### 2. Narrow candidate projection

Add a current-clinic, writer-scoped candidate lookup that reuses:

- `crm_current_mutator_clinic_id()`;
- current active profile;
- `crm.access`;
- owner/admin/recep writer boundary.

The projection must be CRM-safe and must not expose or join Patient identity/clinical data.

It may return only what is necessary for a human decision, including:
- Contact ID;
- minimal display name;
- phone/email needed for the decision;
- structured match reasons;
- active/open Lead count or minimal open-Lead context.

It must exclude deleted/anonymized Contacts.

### 3. Final authority is a narrow transactional orchestration command

Candidate preview is not final authority.

A final orchestration command is justified because one transaction must own:

- normalization;
- concurrency serialization;
- candidate recheck;
- explicit identity decision;
- Contact create or reuse;
- new Lead creation;
- resolution activity/audit.

The command must **compose** the existing Contact/Lead authorities rather than create a generic parallel CRM writer.

### 4. Explicit resolution modes

Supported semantic modes:

- `explicit_reuse`: selected existing Contact receives a **new Lead**;
- `explicit_distinct`: after server-side recheck, create a distinct Contact only with an explicit non-empty reason.

Candidate lookup never auto-selects a winner.

### 5. Concurrency primitive

Use transaction-scoped advisory locking with deterministic keys derived from:

`clinic_id + normalized signal type + normalized signal`

Rules:

- same clinic + same signal serializes;
- different clinics remain independent;
- multiple signal locks use deterministic sorted order;
- empty identity signals create no global lock;
- final candidate computation runs again after all locks are acquired.

The implementation-plan review must prove the exact lock-key derivation before execution.

### 6. Preserve caller-supplied UUID retry

Do not replace MED-CRM-002/005 idempotency.

Exact retry with the same Contact/Lead UUIDs and same resolution intent must remain side-effect idempotent.

A successful prior create that appears as its own candidate on retry must be recognized as the same persisted contract rather than as fresh ambiguity.

### 7. Reuse existing audit/activity authorities

Resolution decisions must be recorded in the same transaction as the Contact/Lead outcome using existing:

- `crm_lead_activities`;
- `audit_log`.

Audit metadata may carry IDs, resolution mode, match reasons and explicit-distinct reason, but not raw phone/email PII.

## Phone normalization contract

For V1:

- `phone` remains the user/display representation;
- `phone_normalized` is the canonical exact-match representation;
- explicit international `+country-code` input may generate a structurally canonical international representation;
- BR national / +55 input follows one documented BR rule;
- historical BR 9th-digit equivalence is a candidate signal only.

Do not create `UNIQUE(phone_normalized)`.

Historical WhatsApp phone handling can inform the BR rule, but it remains Patient/outbound routing logic and does not become Contact authority.

## Email normalization contract

For V1:

- trim input;
- preserve local-part;
- lowercase domain;
- no automatic plus-tag stripping;
- no Gmail dot removal;
- no provider alias rewriting;
- no mandatory lowercasing of local-part.

Possible case-fold equivalence may be a weak candidate reason only.

Do not create `UNIQUE(email_normalized)`.

## Ambiguity semantics

- zero candidates: create path may continue;
- one candidate: explicit operator decision required;
- multiple candidates: explicit operator decision required;
- phone points to A and email points to B: explicit conflict, no silent choice.

Name, recency, completeness or activity do not prove identity.

## Lifecycle boundary

- anonymized Contact: not candidate, not reusable, no historical PII disclosure;
- deleted Contact: not active candidate, no implicit restore;
- a future new Contact may be created from newly supplied data without automatically relinking to deleted/anonymized history.

## Multiple Leads boundary

`Contact 1:N Lead` remains valid.

Contact Identity Resolution chooses a Contact only.

If an existing Contact has open Leads, candidate lookup may show minimal context/warning, but reuse still creates a **new Lead**. Lead resolution/merge is outside this slice.

## Patient boundary

Contact candidate resolution must not use:

- `contacts.patient_id`;
- Patient data;
- clinical data;
- Patient ranking;
- Patient input/output.

Reusing a Contact does not create, open, update or select Patient.

## Alternatives rejected

### A — only harden `create_current_clinic_crm_contact(...)`

Rejected as complete solution. It can normalize and guard creation but cannot atomically express `explicit_reuse → create new Lead` because no Contact is created in that path.

### B — resolver/helper only

Accepted as internal infrastructure but rejected as final authority. Browser-side composition after lookup leaves TOCTOU.

### D — UNIQUE / trigger-only / client-only dedupe

Rejected. Matching signals are not identity keys; hidden or client-only authority does not meet ambiguity, audit and concurrency requirements.

## Consequences

Positive:
- one server-side final authority for identity resolution;
- existing Contact/Lead command semantics remain reusable;
- no Patient boundary expansion;
- ambiguity remains human-explicit;
- race protection does not require false uniqueness.

Costs:
- new narrow orchestration command is required;
- normalization and lock-key contracts need strong PostgreSQL behavioral tests;
- MED-CRM-005 frontend will eventually need a bounded resolution UX after backend authority is proved.

## When to reconsider

Reconsider this decision if:

- MedicsPro adds canonical clinic country/region context and the normalization contract must become region-aware;
- a proven existing CRM capability supersedes the proposed orchestration without weakening atomicity;
- PostgreSQL advisory locks prove unsuitable under measured workload/runtime constraints;
- Contact lifecycle/merge is later introduced under a separate, explicit consequential-operation contract;
- identity resolution must span trusted external identifiers with a stronger authority than phone/email signals.

Do not reconsider merely because a simpler client-side dedupe appears easier to implement.


## Implementation-plan refinement — 2026-09-27

**Reconciled against:** `main@2140c3351843e5398a08d2a4bc40ba3972ac6329`

This section is normative and refines the earlier design where the implementation review found ambiguity.

### Resolution modes

The final V1 command has three semantic modes:

- `create_if_clear` — normal create intent. After deterministic signal locks and server-side recheck, there must be no active candidate other than a proven exact retry of this same committed orchestration.
- `explicit_reuse` — a selected active current-clinic candidate receives a new Lead. The selected Contact must still belong to the locked candidate set at commit time.
- `explicit_distinct` — ambiguity currently exists, but the operator deliberately creates a distinct Contact and supplies a non-empty reason. If no ambiguity remains at commit time, the override is stale/unnecessary and must fail closed rather than fabricate an override event.

`phone -> A + email -> B` remains an explicit conflict. The server never picks a winner; an authorized human may choose a candidate or deliberately choose distinct.

### Existing Contact writer must not bypass the resolver

`create_current_clinic_crm_contact(uuid,text,text,text)` remains a RELEASED public command and keeps its signature, but V1 must harden it as a **clear-only create boundary**:

1. preserve exact same-ID retry/idempotency;
2. normalize signals server-side;
3. acquire the same transaction-scoped identity locks used by the resolver;
4. recompute active candidates;
5. if another candidate exists, reject with an explicit identity-resolution-required error;
6. otherwise create the Contact and populate normalized columns.

This is required so stale clients or alternate browser callers cannot recreate the different-UUID/same-signal race by skipping the new orchestration.

The implementation may extract a revoked internal canonical Contact insert/retry helper shared by the clear-only command and the orchestration. That helper is not a tenant selector or browser mutation surface.

### Canonical helper plan

Planned internal helpers:

- `crm_normalize_contact_phone(text) -> text`;
- `crm_contact_phone_legacy_match_key(text) -> text`;
- `crm_normalize_contact_email(text) -> text`;
- internal deterministic signal-lock helper;
- internal current-clinic candidate helper;
- internal canonical Contact insert/retry helper.

All internal helpers that accept `clinic_id` are revoked from browser roles. Public wrappers obtain clinic authority only through `crm_current_mutator_clinic_id()`.

### Phone V1

Canonical exact storage:

- trim/remove non-digits;
- explicit `+55` 12/13-digit input -> keep the resulting digits;
- BR national 10/11-digit input -> prefix `55`;
- other explicit `+country-code` input -> keep resulting digits;
- otherwise retain the digit-only representation rather than invent a foreign country context.

Historical BR 9th-digit equivalence is a separate weak candidate key. It never changes `phone_normalized` and never proves identity.

### Email V1

- trim;
- preserve local-part;
- lowercase domain only;
- no plus-tag stripping;
- no provider alias rewriting;
- no Gmail dot rewriting;
- no local-part case-fold matching in V1.

### Lock-key contract

For every request, derive distinct lock materials from the current clinic and every active match key:

- `phone_exact`;
- `phone_br_legacy` when applicable;
- `email_exact`.

Material shape is namespaced and tenant-bound, equivalent to:

`medicspro|crm-contact-identity-v1|<clinic_uuid>|<signal_type>|<normalized_value>`

Acquire locks in lexical material order.

V1 uses `pg_advisory_xact_lock(bigint)` with a deterministic 64-bit key derived from the first 64 bits of `md5(material)`. PostgreSQL 16/17 document transaction advisory locks as automatically released at transaction end.

Hash collision is not identity authority: because candidates are rechecked after locks, a collision can only over-serialize unrelated requests. The PostgreSQL 16/17 harness must prove the exact SQL conversion and deterministic ordering before PROVED.

No signal means no identity lock.

### Legacy normalized columns

Do not mass-backfill existing Contacts in V1.

Reason: the current Contact `updated_at` trigger would turn derived-field normalization into fabricated Contact update timestamps.

Candidate matching must therefore use the canonical normalizers against raw stored phone/email for legacy rows and may use stored normalized columns as an optimization. All new Contact writes populate normalized columns.

### Candidate projection

Public RPC:

`list_current_clinic_crm_contact_identity_candidates(text,text)`

Writer-scoped via `crm_current_mutator_clinic_id()`.

Return only:

- `contact_id`;
- minimal display name;
- phone/email needed for the human decision;
- structured `match_reasons[]`;
- `open_lead_count`.

No `patient_id`, Patient join, clinical field or Patient ranking is allowed.

### Final orchestration

Planned public command:

`resolve_current_clinic_crm_prospect_identity(uuid,uuid,text,text,text,text,text,uuid,uuid,text)`

Semantic arguments, in order:

1. caller-supplied Contact UUID;
2. caller-supplied Lead UUID;
3. Contact name;
4. Lead title;
5. resolution mode;
6. phone;
7. email;
8. pipeline UUID;
9. selected Contact UUID;
10. distinct reason.

Optional values may be NULL where the selected mode permits.

The command remains narrow to Prospect Intake and does not add owner/value/source/stage administration.

### Retry and audit atomicity

A committed resolution adds exactly one `crm_lead_activities.activity_type='contact_identity_resolved'` entry.

After Contact/Lead outcome is established, the orchestration locks the Lead row before checking/inserting that activity so concurrent same-Lead retries cannot duplicate resolution activity/audit.

Stable retry intent compares the committed mode, requested/resolved Contact IDs and distinct reason. Candidate IDs/match reasons are evidence observed at commit time, not mutable retry authority.

The existing `audit_log` is text-only. A `CRM_CONTACT_IDENTITY_RESOLVED` audit entry may contain IDs, mode and candidate count, but never raw phone/email or the free-text reason.

### Rollout order

MED-CRM-006 remains one slice with two release phases:

1. backend authority migration + verifier + PostgreSQL 16/17 behavioral proof;
2. controlled production DB rollout/readback;
3. only then frontend/API adapter + human resolution UX;
4. production frontend observation/smoke;
5. final MED-CRM-006 release reconciliation.

The temporary post-DB/pre-UI behavior is deliberately fail-closed: zero-candidate stale-client creation continues; ambiguous creation is rejected instead of silently duplicating Contact.

No frontend is allowed to depend on the new RPC before backend production proof.
