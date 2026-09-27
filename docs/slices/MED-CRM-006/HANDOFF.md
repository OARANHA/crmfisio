# MED-CRM-006 — Handoff

## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

Frontend handoff baseline after #546:

`main@1107dd95b5f00af9e6a0c518db6f6e21489abbe2`

Backend release documentation:

`#546 — MERGED` via protected squash as `main@1107dd95b5f00af9e6a0c518db6f6e21489abbe2`

Design PR:

`#541 — MERGED`

Implementation-plan review:

`#543 — MERGED`

Canonical backend implementation:

`#544 — MERGED` via protected squash as `main@837935ef82a18849dcd05986a27f7978a9cdd10b`

Final validated PR HEAD:

`aed1b2752ca86c43ea37a47abf8e5684434e2811`

Prototype implementation PR:

`#542 — DO NOT MERGE AS AUTHORITY`

Reason: #542 is all-green against a pre-#543 contract but materially diverges from the merged authority (wide resolver, SHA-256/ascending-key locking, plus-prefixed phone normalization and different Contact-ID semantics). Its code/tests are reuse evidence only.

Status:

`BACKEND RELEASED / FRONTEND IMPLEMENTING IN PR #548 / FRONTEND NOT YET PROVED / SLICE NOT FINAL`

Live frontend execution base was revalidated as:

`main@e2902917f247ab92683988e3beed8b5e4badd225`

Frontend implementation PR:

`#548 — feat: complete MED-CRM-006 Contact Identity Resolution frontend`

Branch:

`feat/med-crm-006-contact-identity-resolution-frontend`

Immediately before this HANDOFF refresh, the branch HEAD was `1c10c4de73cbe0e6f534043b17f2c91b5109cc23`, 0 behind its original base. This HANDOFF update itself moves the PR HEAD again, so **re-resolve the current #548 HEAD and its checks before making any GREEN/PROVED/merge statement**.

The backend authority remains RELEASED and must not be reopened without new contradictory evidence. The live work is now strictly the frontend adapter/UX phase.

Canonical backend artifacts are integrated in `main@837935ef82a18849dcd05986a27f7978a9cdd10b`:

- `supabase-migrations/20260927_commercial_crm_contact_identity_resolution.sql`;
- `supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_CONTACT_IDENTITY_RESOLUTION.sql`;
- `tests/sql/commercial_crm_contact_identity_resolution_cases.sql`;
- `scripts/test-commercial-crm-contact-identity-resolution.sh`;
- `scripts/test-commercial-crm-contact-identity-resolution-concurrency.sh`;
- `.github/workflows/commercial-crm-contact-identity-resolution.yml`.

Repository proof is complete for PR #544 final HEAD `aed1b2752ca86c43ea37a47abf8e5684434e2811`: 21/21 workflows completed successfully, including `Commercial CRM Contact Identity Resolution` with PostgreSQL 16 and PostgreSQL 17 both successful, plus `Clinical workflow CI` with `validate` and `dependency-audit` successful. The protected squash merge produced `main@837935ef82a18849dcd05986a27f7978a9cdd10b`.

Production backend proof is complete on the real runtime `28server` / `supabase-db`. The canonical migration SHA-256 `f36f036f172b997292654f251b8a9d386839bc9ef41204636aa11de95605d31b` was proved in the workspace and again inside the PostgreSQL container as user `postgres`, then applied with `ON_ERROR_STOP=1` and completed through `COMMIT`. The pinned verifier SHA-256 `4da932b767d18decbd8c0d881b679dc29735364abcbf3b5b0c73c2d75d88f785` passed all 12 checks and returned `COMMERCIAL CRM CONTACT IDENTITY RESOLUTION VERIFY PASSED`. Core, Command Boundary and Archived Pipeline Guard pinned regressions also passed afterward.

The backend authority is therefore RELEASED. Frontend resolution UX is now authorized as the next phase, but MED-CRM-006 as a whole is not final until the frontend is implemented, merged and observed in production.

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

PostgreSQL 16 and 17 proof is complete on PR #544 final HEAD `aed1b2752ca86c43ea37a47abf8e5684434e2811`.

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

Implemented public RPC:

`list_current_clinic_crm_contact_identity_candidates(text,text)`

It is writer-scoped and returns only:

- Contact ID;
- minimal display name;
- phone/email needed for the decision;
- structured match reasons;
- open Lead count.

It must exclude deleted/anonymized Contacts and must not join or expose Patient data.

## Final orchestration

Implemented public command:

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

`BACKEND RELEASED / FRONTEND EXECUTION AUTHORIZED`

## Frontend implementation checkpoint — PR #548

The four frontend gates were closed again against live `main@e2902917f247ab92683988e3beed8b5e4badd225` before execution.

### GAPS proved

- current `Novo prospect` still created stable draft Contact/Lead UUIDs but sequenced the old Contact writer then Lead writer;
- the now-hardened Contact writer correctly failed closed on ambiguity, but the UI reduced that to a generic retry error;
- the released candidate projection/resolver had no frontend adapter or human-resolution surface;
- no newer competing Prospect/identity PR was found; historical #525 remains non-authoritative.

### Reuse gate

Frontend reuses only:

- `list_current_clinic_crm_contact_identity_candidates(text,text)`;
- `resolve_current_clinic_crm_prospect_identity(...)`;
- the existing stable draft UUIDs;
- server-side tenant/writer/`crm.access` authority;
- resolver-owned Contact/Lead/activity/audit behavior;
- canonical CRM projection refresh.

No frontend fallback to the old separate Contact/Lead writers is allowed.

### Decision implemented

- zero candidates → `create_if_clear`;
- one or multiple candidates → explicit human decision;
- split phone/email candidate sets → explicit conflict message, no automatic winner;
- candidate selection → `explicit_reuse`;
- distinct Contact → `explicit_distinct` with non-empty reason;
- stale commit-time rejection → re-query candidates and remain fail-closed;
- retry uncertainty → preserve the same draft Contact/Lead UUIDs;
- no Patient identity input/output/navigation/matching is added.

### Second adversarial review

Deterministic review covered auto-reuse, Patient leak, browser authority, TOCTOU, UUID retry, duplicate Lead, distinct reason, split-signal conflict, stale-error handling, read-only roles, PII logging, zero-candidate regression and Board refresh. No deterministic blocker remained.

Fresh JEV advisory returned `deep_review=0.58`, `proceed_fast=0.35`, `block=0.00`, confidence `0.44`. The deterministic deep review was therefore completed before execution; JEV did not authorize the change.

### Post-execution adversarial correction

A fresh deterministic review after the first UI implementation found a transport-uncertainty edge case: a second preview before exact retry could surface the newly committed self Contact and derail the canonical resolver retry contract. #548 now records the exact pending resolution intent after an uncertain response, freezes the draft and offers `Repetir mesma tentativa`; that retry calls the resolver directly with the same IDs/decision and does not query candidates again. A focused test proves a hypothetical self-candidate remains unread because the second preview is intentionally skipped.

### Validation status

Frontend/unit/boundary tests have been added but **the exact current PR HEAD is not yet declared GREEN or PROVED**. Repository CI, typecheck, lint, build, validate and dependency-audit must all be revalidated on the post-HANDOFF HEAD.

## Rollout order

1. [x] implement/prove backend authority on a fresh branch from current `main`;
2. [x] merge only after PostgreSQL 16/17 + repo checks are green;
3. [x] controlled DB rollout + production-safe verifier/readback;
4. [x] implement frontend candidate/resolution UX in PR #548;
5. [ ] validate exact #548 HEAD and merge only if GREEN;
6. [ ] observe frontend production and reconcile MED-CRM-006 final release state.

Between backend DB rollout and frontend UX rollout, stale frontend behavior is intentionally fail-closed:

- zero-candidate Contact creation continues;
- ambiguous creation is rejected instead of silently creating another Contact.

## Next exact step

1. re-resolve live `origin/main` and PR #548 current HEAD after this HANDOFF refresh;
2. prove #548 remains 0 behind, mergeable and scoped to frontend/tests/docs only;
3. inspect every applicable workflow/check on that exact HEAD;
4. if any test/typecheck/lint/build/validate/dependency-audit check fails, fix only the bounded frontend implementation and rerun;
5. only after the exact #548 HEAD is fully GREEN, record frontend PROVED evidence and merge through the protected path;
6. re-resolve the resulting `main`;
7. observe the actual frontend deployment, verify the live CRM chunk exposes the candidate/resolver UX without Patient creation or old Prospect writer fallback, and smoke the relevant routes;
8. only after production observation, reconcile whether MED-CRM-006 as a whole can be marked RELEASED.

Do not mark the whole slice RELEASED until the frontend phase is observed in production.
