# MED-CRM-006 — Handoff

## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

Integrated base:

`main@1a0e96392570d69090e87895d4072f0eea640d7a`

Design PR:

`#541 — MERGED`

Implementation-plan review:

`#543 — MERGED`

Canonical backend implementation branch / PR:

`feat/med-crm-006-contact-identity-resolution-canonical` / `#544 — feat: implement canonical MED-CRM-006 Contact Identity Resolution V1`

Prototype implementation PR:

`#542 — DO NOT MERGE AS AUTHORITY`

Reason: #542 is all-green against a pre-#543 contract but materially diverges from the merged authority (wide resolver, SHA-256/ascending-key locking, plus-prefixed phone normalization and different Contact-ID semantics). Its code/tests are reuse evidence only.

Status:

`IMPLEMENTING / VALIDATION PENDING / FRONTEND NOT AUTHORIZED`

Current canonical backend artifacts exist on the implementation branch:

- `supabase-migrations/20260927_commercial_crm_contact_identity_resolution.sql`;
- `supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_CONTACT_IDENTITY_RESOLUTION.sql`;
- `tests/sql/commercial_crm_contact_identity_resolution_cases.sql`;
- `scripts/test-commercial-crm-contact-identity-resolution.sh`;
- `scripts/test-commercial-crm-contact-identity-resolution-concurrency.sh`;
- `.github/workflows/commercial-crm-contact-identity-resolution.yml`.

They have not yet earned PROVED. PR #544 is the canonical implementation PR; require PostgreSQL 16/17 plus all applicable repository checks on its exact HEAD before any merge.

Revalidate all mutable values before acting.

## What the implementation-plan review closed

The #541 architecture remains valid but needed two explicit refinements:

1. normal zero-candidate creation is `create_if_clear`, not `explicit_distinct`;
2. the existing public Contact create command must be hardened as clear-only so stale clients cannot bypass identity resolution.

Final semantic modes:

- `create_if_clear` — locked recheck must find no other active candidate;
- `explicit_reuse` — selected current candidate receives a new Lead;
- `explicit_distinct` — current ambiguity exists and an explicit non-empty reason authorizes a distinct Contact.

## Authority plan

Reuse:

- `crm_current_mutator_clinic_id()`;
- current profile + `crm.access`;
- owner/admin/recep writer boundary;
- `create_current_clinic_crm_lead(...)`;
- `crm_lead_activities`;
- `audit_log`;
- existing Contact table + normalized columns/indexes.

Extend:

- `create_current_clinic_crm_contact(...)` keeps its public signature but becomes clear-only, normalized and signal-serialized.

Add only as narrow infrastructure:

- canonical Contact phone/email normalizers;
- BR legacy phone candidate key;
- revoked deterministic signal-lock helper;
- revoked internal candidate helper;
- revoked internal canonical Contact insert/retry helper;
- writer-scoped candidate projection;
- one final Prospect Intake orchestration command.

No Patient authority, no Contact merge/edit/dedupe, no new tenant source, role, entitlement or audit table.

## Exact backend artifacts

- `supabase-migrations/20260927_commercial_crm_contact_identity_resolution.sql`
- `supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_CONTACT_IDENTITY_RESOLUTION.sql`
- `tests/sql/commercial_crm_contact_identity_resolution_cases.sql`
- `scripts/test-commercial-crm-contact-identity-resolution.sh`
- `.github/workflows/commercial-crm-contact-identity-resolution.yml`

The harness must apply the effective CRM stack in order, including:

1. updated_at helper reconciliation;
2. Commercial Core;
3. Commercial Command Boundary;
4. Archived Pipeline Transition Guard;
5. Contact Identity Resolution V1;
6. applicable verifiers and regressions.

PostgreSQL 16 and 17 are required before PROVED.

## Locking contract

Lock every distinct active match key:

- exact phone;
- BR legacy-phone equivalence when applicable;
- exact email.

Lock material is tenant-bound and namespaced:

`medicspro|crm-contact-identity-v1|<clinic_uuid>|<signal_type>|<normalized_value>`

Sort materials before acquiring `pg_advisory_xact_lock(bigint)`.

The implementation uses a deterministic 64-bit key derived from `md5(material)`; collision is allowed to over-serialize only because candidates are always recomputed under the acquired locks.

No signal => no identity advisory lock.

## Legacy normalized rows

Do not mass-backfill V1.

Existing Contacts may have NULL normalized fields because MED-CRM-002 never populated them.

Correctness for historical rows comes from applying the canonical normalizers to stored raw phone/email during candidate evaluation. New Contact writes populate normalized columns.

This avoids rewriting `contacts.updated_at` merely to fill derived fields.

## Candidate RPC

Planned public RPC:

`list_current_clinic_crm_contact_identity_candidates(text,text)`

It is writer-scoped and returns only:

- Contact ID;
- minimal display name;
- phone/email needed for the decision;
- structured match reasons;
- open Lead count.

It must exclude deleted/anonymized Contacts and must not join or expose Patient data.

## Final orchestration

Planned public command:

`resolve_current_clinic_crm_prospect_identity(uuid,uuid,text,text,text,text,text,uuid,uuid,text)`

Semantic inputs:

1. caller Contact UUID;
2. caller Lead UUID;
3. Contact name;
4. Lead title;
5. resolution mode;
6. phone;
7. email;
8. pipeline UUID;
9. selected Contact UUID;
10. distinct reason.

The command is Prospect-Intake-specific. It does not add generic Lead owner/value/source/stage administration.

## Retry / audit

A committed orchestration emits exactly one:

`crm_lead_activities.activity_type = 'contact_identity_resolved'`

After the Contact/Lead outcome, lock the Lead row before checking/inserting the resolution activity so concurrent same-Lead retries cannot duplicate it.

Stable retry authority uses persisted Contact/Lead contracts plus stable resolution intent. Candidate IDs/reasons are commit-time evidence, not future retry authority.

`audit_log` is text-only. Resolution audit contains IDs/mode/count only; no raw phone/email and no free-text reason.

## Required behavior proof

At minimum:

- canonical phone/email normalization;
- exact phone candidate;
- exact email candidate;
- BR legacy phone candidate;
- zero candidate + `create_if_clear`;
- one/multiple candidates force resolution;
- phone→A + email→B conflict is explicit;
- explicit reuse;
- explicit distinct + reason;
- explicit distinct without reason rejected;
- explicit distinct when ambiguity disappeared fails closed;
- hardened old Contact create rejects new-ID ambiguity;
- old Contact create exact same-ID retry remains idempotent;
- same Lead exact orchestration retry has one resolution activity/audit;
- divergent same-ID retry rejected;
- two different UUID same exact phone concurrent serialization;
- BR legacy pair concurrent serialization;
- deterministic two-signal order;
- cross-tenant independence;
- no-signal no-global-lock;
- deleted/anonymized excluded;
- professional/financeiro denied;
- crm.access disabled denied;
- no Patient input/output/join;
- no raw phone/email in audit;
- MED-CRM-002 command regressions remain green;
- MED-CRM-004 archived-pipeline regressions remain green.

## Second adversarial review

First JEV pass: `deep_review=0.82`, confidence `0.76`.

After the deterministic refinements above: `proceed_fast=0.72`, `deep_review=0.26`, `block=0.01`, confidence `0.63`.

JEV is advisory only.

Deterministic conclusion:

`BACKEND EXECUTION AUTHORIZED`

Frontend execution is **not** yet authorized.

## Rollout order

1. implement/prove backend authority on a fresh branch from current `main`;
2. merge only after PostgreSQL 16/17 + repo checks are green;
3. controlled DB rollout + production-safe verifier/readback;
4. only then implement frontend candidate/resolution UX;
5. observe frontend production and reconcile MED-CRM-006 release state.

Between backend DB rollout and frontend UX rollout, stale frontend behavior is intentionally fail-closed:

- zero-candidate Contact creation continues;
- ambiguous creation is rejected instead of silently creating another Contact.

## Next exact step

1. finish and merge this plan-review docs PR only if its current HEAD is docs-only, 0 behind, mergeable and GREEN;
2. re-resolve `origin/main`;
3. create a fresh implementation branch from that main;
4. change MED-CRM-006 to `IMPLEMENTING` on the implementation branch;
5. implement **backend authority only**;
6. do not add frontend UX in the same backend movement;
7. validate structural + behavioral + concurrency cases on PostgreSQL 16/17;
8. run repository checks;
9. run a fresh adversarial review before merge.

Never call backend implementation PROVED by static SQL inspection alone. Behavioral concurrency and retry evidence are required.
