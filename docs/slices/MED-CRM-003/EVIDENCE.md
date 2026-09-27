# MED-CRM-003 — Deep Review Evidence

**Audited against:** `OARANHA/crmfisio main@72a60262d09a14ce8382f3da9db12afcd15a8464`  
**Date:** 2026-09-27  
**Scope:** pre-execution deep review only. No feature code, schema, runtime or production mutation was executed.

## REAL NOW / proven state

- MED-CRM-001 = PROVED + MERGED + RELEASED.
- MED-CRM-002 = PROVED + MERGED + RELEASED.
- MED-CRM-003 = ANALYZED.
- current `/crm` commercial board still reads `usePatients()`, groups `Patient[]` by `funilStage` and mutates through `setFunilStage()`.
- NPS/churn in `Crm.tsx` and `TreatmentContinuityWatch` in `CrmOperational.tsx` remain Patient-domain.
- PR #525 is historical only: OPEN, head `c00364b1395cdaf911c70cc56db03c7831b4c2ac`, non-mergeable, compare against current main = diverged, 2 ahead / 7 behind.
- no MED-CRM-003 implementation branch existed at the start of this review.

Runtime was not re-read because the blocker below is provable from the released executable contract itself. Repeating the already-proved MED-CRM-001/002 production rollout would add no authority.

## Revalidated released read contracts

`list_current_clinic_crm_pipelines()`:

- derives tenant through `crm_current_reader_clinic_id()`;
- requires active profile + `crm.access`;
- permits the five canonical clinic roles;
- returns active and archived pipelines, including `is_default` and `archived_at`.

`list_current_clinic_crm_stages(uuid)`:

- derives the same current-clinic read authority;
- returns active and archived stages;
- exposes `pipeline_id`, `stage_kind`, `position` and `archived_at`.

`list_current_clinic_crm_leads()`:

- returns non-deleted Leads joined to Contact/Pipeline/Stage;
- exposes `contact_anonymized_at`, Contact PII fields, pipeline/stage IDs and stage semantics;
- does not filter archived pipeline/stage context, so legacy/archive Leads remain projectable.

## Revalidated released mutation contract

`transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)`:

- derives clinic server-side through the current active profile;
- restricts writers to `owner | admin | recep` + `crm.access`;
- locks the Lead `FOR UPDATE`;
- requires target stage in the same current pipeline;
- rejects a target stage whose `crm_stages.archived_at` is not null;
- requires a nonblank reason for `stage_kind='lost'`;
- derives terminal fields server-side;
- emits `crm_lead_activities` + `audit_log` in the same transaction.

Raw authenticated DML over the Commercial Core remains closed.

## Deep-review findings that are frontend-bounded

The following concerns can be handled without creating authority:

1. **Multi-pipeline:** list every active pipeline in a selector; choose the active default initially when present; deterministic first-active fallback otherwise; no pipeline administration.
2. **Archived stage target:** never offer archived stages as a target. The RPC also rejects them server-side.
3. **Legacy visibility:** correlate full pipeline/stage projections with Lead rows and keep archived/missing context visible in an explicit read-only legacy/archive section.
4. **Lost reason:** reuse `Modal + Field + Input`; do not call the RPC until the trimmed reason is nonempty.
5. **Contact anonymization:** when `contact_anonymized_at` is set, suppress Contact name/phone/email and use neutral presentation. Do not create Patient navigation from `contact_patient_id`. A conservative UI should also avoid rendering free-form Lead title for an anonymized Contact.
6. **Authorization presentation:** `isOperationalRole()` may control affordances only; the RPC remains tenant/role/entitlement authority.
7. **Patient domain:** NPS, churn and Treatment Continuity remain Patient-domain; commercial metrics must be derived from canonical Lead projections.
8. **Projection after command:** after a successful transition, refetch canonical projections. A post-COMMIT refetch failure must be reported as stale projection, not as command failure; do not use optimistic client state as authority.
9. **Testability:** existing Vitest + `react-test-renderer` + current-user mocks and static boundary-test patterns are sufficient.

## Blocking contract gap

The deep review found one server-side semantic gap that prevents the proposed frontend-only slice from making archived pipelines read-only without creating a UI-only domain rule.

The schema allows:

```text
crm_pipelines.archived_at IS NOT NULL
while
crm_stages.archived_at IS NULL
```

No schema trigger couples pipeline archival to stage archival.

The released transition RPC resolves the target with conditions equivalent to:

```sql
s.id = p_to_stage_id
AND s.clinic_id = v_clinic
AND s.pipeline_id = v_lead.pipeline_id
AND s.archived_at IS NULL
```

It does **not** join/check `crm_pipelines.archived_at`.

Therefore an authenticated Commercial CRM writer can directly invoke the canonical RPC and move a Lead between non-archived stages inside an archived pipeline. Hiding that affordance in the Board would make the frontend the only enforcement of the proposed “archived pipeline = read-only” semantic.

That conflicts with the authority/reuse doctrine: UI presentation may narrow affordances, but a domain mutation invariant must not depend on bypassable browser logic.

Existing MED-CRM-002 verifier/tests prove same-pipeline, stage-active, locking, role/entitlement, activity/audit and Patient separation. They do not prove archived-pipeline immutability.

## GAPS

Primary product conflict still exists:

```text
/crm
→ Patient.funil_stage
→ setFunilStage()
```

But the prerequisite gap is now more specific:

```text
archived pipeline
→ canonical transition RPC can still mutate through a non-archived stage
→ Board cannot truthfully promise archived-pipeline read-only semantics by frontend alone
```

## CAPABILITY AUTHORITY / REUSE GATE

**REUSE:**

- current tenant/active profile;
- `crm.access`;
- released Commercial Core projections;
- released stage-transition command;
- activity/audit authority;
- canonical role model.

**DO NOT CREATE:**

- browser-side tenant authority;
- raw table writer;
- alternate CRM transition writer;
- UI-only mutation invariant presented as domain authority.

Result: reuse gate does not authorize a frontend-only workaround for archived pipeline immutability.

## DECISION

Choice **C — a prior contract/capability is still missing**.

MED-CRM-003 remains `ANALYZED`. No Board feature implementation is authorized.

Before re-opening MED-CRM-003 execution, a separate prerequisite change must make the canonical command fail closed for archived pipeline context and prove that behavior mechanically. At minimum the prerequisite should re-run its own gates and add:

- server-side rejection when the Lead/current pipeline is archived;
- verifier assertion for the function definition/contract;
- behavioral PostgreSQL case proving archived pipeline transition is rejected even if the target stage itself is not archived;
- regression proof for tenant/RBAC, same-pipeline, lost reason, activity/audit and Patient separation;
- production rollout/readback if the command contract changes in production.

The exact prerequisite slice identifier is intentionally not invented here; it must be created through the normal slice gate.

## SECOND ADVERSARIAL REVIEW

Earlier review, before the archived-pipeline contract was isolated:

```text
route = deep_review
deep_review = 0.71
proceed_fast = 0.22
block = 0.06
split_task = 0.01
confidence = 0.62
```

Fresh review with the server-side archived-pipeline gap made explicit:

```text
route = block
block = 0.70
deep_review = 0.29
split_task = 0.01
proceed_fast = 0.00
confidence = 0.59
```

JEV is advisory. The deterministic reason for blocking is the executable RPC contract described above.

## Validation boundary

No capability implementation was executed, so no implementation validation or release claim is made.

The review itself was cross-checked against current main source, migrations, SQL cases/verifiers, permissions, UI primitives and frontend test patterns.

## Result

```text
A) one frontend-only micro-slice now     NO
B) split MED-CRM-003 implementation     NO — the issue precedes Board execution
C) prior contract/capability missing     YES
```
