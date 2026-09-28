# MED-CRM-009 — Decision

**Decision status:** IMPLEMENTED / REPOSITORY PROVED / PRE-MERGE  
**Design baseline:** `OARANHA/crmfisio@1ff2825cfe5dd630ea16e4cfeda586ad390c3be7`  
**Implementation baseline:** `OARANHA/crmfisio@6bc436f2789341b95c3800d8a82cfe7dbed6c78e`  
**Date:** 2026-09-28

## Decision statement

The next bounded Commercial CRM slice is **Commercial Lead Activity Read Boundary V1**.

The smallest current gap is not a missing roadmap feature. It is a mismatch between the RELEASED Commercial activity storage contract and the browser read projection: the current authenticated reader returns the generic activity envelope, while the released Board deliberately uses only a much smaller subset.

The chosen change strengthens the existing reader rather than adding a parallel reader or changing activity persistence.

## Fresh candidate comparison

| Candidate | Proven current gap | Existing authority / reuse | New authority required | Boundary / duplicate-authority risk | Decision now |
| --- | --- | --- | --- | --- | --- |
| Lead activity read boundary | raw actor/internal metadata reaches browser before frontend drops it | activity table, reader guard, existing RPC, MED-CRM-007 bounded projection | no new domain authority; existing reader body hardening | low if signature/storage/writers stay unchanged | **SELECT** |
| Pipeline/Stage admin | schema/defaults/readers exist; clinic cannot administer lifecycle | pipeline/stage schema, constraints, projections | create/edit/archive/reorder/default command set | high: live Leads/default/archive semantics | DEFER |
| Structured lost reason/reporting | loss fields + transition exist; Board captures free text only | Lead terminal fields + stage command | taxonomy/config/reporting contract | medium: client taxonomy would become authority | DEFER |
| Follow-up/next action | no Lead temporal task/next-action capability proved | automation/outbox foundations need separate reuse audit | task/enrollment/ownership/time authority | high: duplicate async engine risk | DEFER |
| Inbox/Conversation | no Lead conversation aggregate proved | Patient-oriented messaging/outbox + provider foundations | conversation/message/handoff authority | high cross-domain risk | DEFER |
| Attribution | manual `source` exists, no campaign chain | Lead source fields | acquisition/click/campaign/conversion model | medium/high | DEFER |
| Lead → Patient | no conversion command exists | Patient registry + Contact link are separate | explicit idempotent cross-domain conversion | high clinical identity boundary | DEFER |

This comparison is a current technical decision, not a permanent roadmap ranking.

## GAPS conclusion

The current reader:

`list_current_clinic_crm_lead_activities(uuid)`

is a SECURITY DEFINER current-clinic RPC and returns:

- `id`;
- `activity_type`;
- `actor_id`;
- `actor_kind`;
- raw `metadata`;
- `created_at`.

This is broader than the released Board contract.

The strongest concrete mismatch is the identity-resolution path:

1. Contact identity candidate preview is writer-scoped through `crm_current_mutator_clinic_id()`;
2. the final resolver persists internal resolution metadata in `crm_lead_activities`;
3. the generic activity reader is available to all CRM reader roles through `crm_current_reader_clinic_id()`;
4. therefore read-only CRM roles can receive candidate Contact UUIDs and free-text resolution rationale from the raw activity envelope even though the Board never needs them.

The current frontend unit test itself demonstrates that raw secret-like values can arrive at the adapter and are discarded only there.

The free-text lost reason is **not** used as the sole argument for this slice because the canonical Lead projection already exposes Lead loss fields to authorized CRM readers. The decision rests on unnecessary generic activity metadata, writer-scope identity-resolution internals and actor identity reaching the browser.

## CAPABILITY AUTHORITY / REUSE GATE

### Reuse

- `public.crm_lead_activities` remains canonical persistence;
- `list_current_clinic_crm_lead_activities(uuid)` remains the browser read authority;
- `crm_current_reader_clinic_id()` remains tenant/role/entitlement authority;
- existing activity writers remain unchanged;
- MED-CRM-007 bounded adapter/presenter remains frontend defense in depth;
- `audit_log` remains technical audit authority.

### Explicitly do not create

- a second activity table;
- a second browser timeline RPC if the existing one can be safely narrowed;
- a new actor directory;
- a new tenant resolver;
- a new role/capability/entitlement;
- a new activity writer;
- a new audit path;
- Patient joins or Patient authority.

Decision: **EXTEND/HARDEN the existing read projection**.

## Server projection contract

Implementation-plan review must preserve function name, argument signature and return row type unless new evidence proves that impossible.

Expected bounded behavior:

### Common fields

- `id`: preserve;
- `activity_type`: preserve;
- `created_at`: preserve;
- `actor_id`: return `NULL` to the browser projection;
- `actor_kind`: may remain as coarse non-identity provenance.

### `stage_changed`

Metadata may contain only the fields already required by the current Board:

- `from_stage_id`;
- `to_stage_id`.

Do not return:

- `lost_reason_code`;
- `lost_reason_detail`;
- arbitrary future keys.

### `contact_identity_resolved`

Metadata may contain only a validated:

- `resolution_mode` in `create_if_clear | explicit_reuse | explicit_distinct`.

Do not return:

- requested Contact ID;
- resolved Contact ID;
- `candidate_ids`;
- match reasons;
- distinct-reason free text;
- arbitrary future keys.

### Other/unknown activity types

Return an empty metadata object unless a future separately-reviewed contract adds a bounded field.

Full activity persistence is unchanged.

## Concurrency and idempotency

This slice adds no mutation path and therefore no new write concurrency or retry authority.

Implementation must prove it does not alter:

- stage-transition locking/idempotency;
- Contact identity-resolution advisory-lock/idempotency behavior;
- Lead-details optimistic concurrency/retry behavior;
- bounded activity creation;
- audit emission.

The reader remains STABLE/read-only.

## Rollout strategy

Because the intended change preserves the existing function signature and the exact fields consumed by the current frontend adapter, backend-first rollout should be compatible with the RELEASED Board.

Implementation still must grep/re-audit all canonical consumers before changing the function body. If a legitimate current consumer depends on raw metadata or actor UUIDs, stop and return to REUSE/DECISION rather than silently breaking it.

Expected rollout:

1. repository implementation + PG16/17 behavior proof;
2. exact-head CI and protected merge;
3. production pre-readback of current function contract;
4. hash-pinned transactional migration;
5. pinned read-only verifier/regression proof;
6. served frontend/readback confirming timeline remains healthy;
7. no production data mutation is required merely to prove the read boundary.

## Objective PROVED criteria

Repository-level PROVED requires, at minimum:

- current-clinic reader roles receive the bounded projection;
- `actor_id` is not exposed through the browser RPC;
- stage activity metadata excludes loss free text and arbitrary keys while preserving from/to stage IDs;
- identity-resolution activity excludes Contact candidate/internal IDs, match reasons and distinct reason while preserving valid `resolution_mode`;
- unknown activity metadata fails closed to an empty object;
- raw authenticated activity-table access remains denied;
- cross-tenant read remains denied;
- missing `crm.access`, inactive profile and anonymous access remain denied;
- full internal `crm_lead_activities` persistence remains unchanged;
- no Patient input/output/join is added;
- existing Commercial CRM writer/idempotency regressions remain green;
- frontend timeline tests remain green as defense in depth;
- typecheck/lint/build and exact-head workflows are green.

## Objective RELEASED criteria

RELEASED requires production evidence corresponding to the implementation, including:

- exact canonical migration/verifier hash;
- production pre-readback;
- governed migration apply if absent;
- pinned production verifier;
- relevant RELEASED CRM regressions;
- live frontend/timeline readback and route health;
- no claim of authenticated human smoke unless actually executed.

## SECOND ADVERSARIAL REVIEW

### Deterministic findings

The first hardening hypothesis was narrowed during deep review:

- **not every raw field is a new privacy gap**: Lead loss fields already belong to the canonical Lead read projection, so loss detail alone does not justify the slice;
- **the stronger privilege mismatch is identity-resolution metadata**: candidate preview is writer-scoped, while generic activity read is available to professional/financeiro read-only roles;
- frontend sanitization is defense in depth but cannot be the only boundary because the raw RPC payload has already crossed into the browser;
- adding a second narrow browser RPC would create avoidable parallel read authority; hardening the existing function is preferred;
- changing return columns would add compatibility risk; preserving the signature/row type and narrowing values is preferred;
- the identity resolver reads the activity table directly for retry semantics, so server-side projection hardening must not alter canonical stored metadata;
- implementation must still search all current repository consumers before changing the function body.

### JEV advisory review

JEV was asked whether this should proceed quickly, be split, blocked or receive deeper review.

Result:

```text
route = deep_review
deep_review = 0.87
proceed_fast = 0.09
block = 0.03
split_task = 0.01
confidence = 0.82
```

The advisory result did not authorize execution. The deterministic deep review above resolved the material objections by selecting same-RPC projection hardening, preserving storage/writers/signature and requiring a consumer audit before implementation.

### Final adversarial conclusion

No deterministic blocker remained for the design.

After #558 integrated, the implementation gate was repeated against `main@6bc436f2789341b95c3800d8a82cfe7dbed6c78e`. The consumer audit found no legitimate dependency on raw actor UUIDs or generic metadata, and the retry/writer paths continue to read/write canonical persistence directly.

A fresh JEV advisory review returned:

```text
proceed_fast = 0.87
deep_review = 0.12
block = 0.01
confidence = 0.83
```

This advisory result did not authorize execution by itself. Deterministic consumer/schema/test evidence closed the implementation gate.

The implemented decision therefore remains: harden the **same released RPC** with no new reader authority, no storage mutation and no Patient authority.

## Reconsideration triggers

Return to the appropriate gate if:

- `main` changes the activity reader or activity metadata contract;
- another active CRM PR introduces a competing activity projection;
- a legitimate current browser consumer requires raw metadata/actor identity;
- the function cannot be narrowed without a breaking return-contract change;
- safe projection requires Patient or clinical data;
- minimization cannot preserve current timeline behavior.


## Implemented decision — PR #559

The implementation uses the additive follow-up migration:

`supabase-migrations/20260928_commercial_crm_lead_activity_read_boundary.sql`

It preserves:

- `list_current_clinic_crm_lead_activities(uuid)` identity, arguments and return row type;
- SECURITY DEFINER + STABLE semantics and pinned search path;
- authenticated-only ACL;
- `crm_current_reader_clinic_id()` tenant/role/`crm.access` authority;
- canonical `crm_lead_activities` rows and metadata;
- all existing writers, locking/idempotency and audit paths.

It changes only returned values according to the reviewed projection allowlist. No frontend change is necessary because MED-CRM-007 already consumes only this bounded subset and remains defense in depth.

Repository proof on exact HEAD `5e22d610024e0b5ba46acda481e3f11f111eed28` satisfied the PROVED criteria. Merge and production release remain separate gates.
