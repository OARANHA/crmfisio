# MED-CRM-004 — Decision

**Decision date:** 2026-09-27  
**Audited main:** `2bcadc00a730eb9a1c1c063a688ccebf8982ce35`  
**Decision state:** APPROVED → execution started

## GAPS

Direct inspection of the RELEASED schema and command proved:

- `crm_pipelines.archived_at` and `crm_stages.archived_at` are independent;
- no trigger couples pipeline archive to stage archive;
- `create_current_clinic_crm_lead(...)` already requires an active pipeline;
- `transition_current_clinic_crm_lead_stage(...)` locks the Lead and requires an active same-pipeline target stage, but never reads `crm_pipelines`;
- the MED-CRM-002 verifier and PostgreSQL cases do not prove archived-pipeline immutability.

Therefore an authorized writer can request a real stage change inside an archived pipeline when the target stage remains active.

## CAPABILITY AUTHORITY / REUSE

Authority remains the existing canonical command:

`transition_current_clinic_crm_lead_stage(...)`

Reused without duplication:

- `crm_current_mutator_clinic_id()`;
- current active profile / canonical tenant;
- `crm.access`;
- writer roles `owner | admin | recep`;
- same-pipeline target contract;
- lost-reason invariant;
- `crm_lead_activities`;
- `audit_log`;
- raw browser DML closure.

No new table, RPC authority, role, entitlement, tenant source or audit mechanism is introduced.

## DECISION

Use an additive follow-up migration and redefine the same canonical RPC.

For an actual stage change:

1. lock the Lead as today;
2. resolve the active same-pipeline target stage as today;
3. preserve reason validation and exact same-stage idempotency;
4. acquire `FOR SHARE` on the current `crm_pipelines` row while requiring the same tenant and `archived_at IS NULL`;
5. reject with `crm_current_pipeline_archived` if the active pipeline row is unavailable;
6. only then update the Lead and emit activity/audit.

The pipeline row lock serializes a concurrent archive with the transition: an archive committed first causes the transition to re-read and fail; a transition that acquired the share lock first completes before the archive can update that row.

### Exact retry semantics

An exact same-stage replay that would produce no database mutation remains idempotent even if the pipeline was archived after the original successful command. This preserves the RELEASED idempotency contract without permitting a new state change.

A conflicting same-stage retry remains an idempotency conflict.

## Alternatives rejected

- **Frontend-only read-only guard:** bypassable through the canonical RPC.
- **New transition RPC:** parallel authority.
- **Rewrite the RELEASED MED-CRM-002 migration:** violates additive rollout discipline.
- **Cascade-archive every stage when a pipeline is archived:** broader lifecycle semantic not required to close this command gap.
- **Reject every exact retry on archived pipeline:** unnecessary regression of the established side-effect-free idempotency contract.

## SECOND ADVERSARIAL REVIEW

Deterministic review found no additional authority or domain expansion.

JEV advisory input included the current schema, command behavior, test coverage, additive migration decision, row-locking approach and explicit boundaries.

Result:

```text
route = proceed_fast
proceed_fast = 0.73
deep_review = 0.25
block = 0.01
split_task = 0.01
confidence = 0.65
```

JEV is advisory only. Execution was authorized by the deterministic GAPS / REUSE / DECISION evidence above, not by the probability score.

## Reconsider

If validation shows the row-lock semantics do not close the archive race, or if a legitimate product flow requires state-changing transitions after pipeline archive, return to DECISION before merging. Do not weaken the invariant in frontend code.
