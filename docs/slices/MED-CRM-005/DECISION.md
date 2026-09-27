# MED-CRM-005 — Decision

**Decision date:** 2026-09-27  
**Audited main:** `cae02c03345302737e8738a77da6841224659518`  
**Branch:** `feat/med-crm-005-prospect-intake-v1`  
**Status:** PROVED + MERGED + RELEASED

## GAPS

After MED-CRM-003 became RELEASED, the canonical `/crm` Board could list and transition Leads but exposed no product path to create a prospect.

The backend capability already existed through MED-CRM-002.

## CAPABILITY AUTHORITY / REUSE GATE

Authority remains:

`Contact → Lead → Pipeline → Stage`

The slice reuses only:

- `create_current_clinic_crm_contact(...)`;
- `create_current_clinic_crm_lead(...)`;
- canonical Commercial CRM projections;
- server-derived current clinic;
- `crm.access`;
- released writer/read-only role policy;
- released command audit/activity and idempotency semantics.

An initially considered composite `create_current_clinic_crm_prospect` RPC was rejected by the reuse gate. MED-CRM-002 explicitly reserved command redesign for a proven caller that cannot safely use the released commands. Stable caller-supplied UUIDs allow safe exact retries without a fourth writer.

## DECISION

Proceed with a frontend-only Prospect Intake V1:

1. create Contact through the released Contact command;
2. create Lead through the released Lead command using the same stable draft IDs;
3. expose only active pipelines;
4. send `stage_id = owner_id = value_cents = source = null`;
5. let existing server logic choose the first active open stage;
6. keep the same Contact/Lead UUIDs while retrying an uncertain attempt;
7. after both commands return, refresh canonical projections;
8. if only that refresh fails, report stale projection instead of command failure;
9. do not create or navigate to Patient.

## SECOND ADVERSARIAL REVIEW

A first design considered an atomic composite RPC. Advisory review requested deeper inspection. Deterministic review of MED-CRM-002 then showed the new wrapper would duplicate released authority, so it was removed.

Final advisory route for the frontend-only reuse design:

```text
route = proceed_fast
proceed_fast = 0.61
deep_review = 0.38
block = 0.01
confidence = 0.48
```

JEV is advisory only. Execution authority came from released command contracts plus code/schema/test evidence.

## Status boundary

`PROVED ON BRANCH` was the pre-merge boundary only. The later gates are now separately proved: PR #538 final HEAD `6df9f1ba39b474454fe33ee93d0143677cd12f6d` passed 8/8 applicable workflows and was protected-squash-merged as `main@004fcb2c6c60ff7611bf6c1156e90edaac27ae9a`. Production readback proved the new frontend entry/chunk and Prospect Intake markers while the rejected composite RPC and Patient-creation markers remained absent. MED-CRM-005 is therefore PROVED + MERGED + RELEASED.
