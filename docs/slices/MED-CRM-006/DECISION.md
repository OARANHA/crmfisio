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
