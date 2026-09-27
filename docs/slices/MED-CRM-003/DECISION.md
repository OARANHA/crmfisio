# MED-CRM-003 — Decision

**Decision date:** 2026-09-27  
**Audited main:** `01a2b947e13144a885549c248acceb25021c36a2`  
**Implementation PR:** #536 — `feat/med-crm-003-commercial-board-cutover-v1`  
**Status:** PROVED + MERGED / NOT RELEASED

## Context

MED-CRM-004 is RELEASED and closed the server-side archived-pipeline transition gap that previously blocked MED-CRM-003.

The current-state reconstruction was repeated after PR #535 merged. The visible `/crm` Board on canonical main still used:

```text
usePatients()
→ Patient[]
→ patients.funil_stage
→ setFunilStage()
```

while the RELEASED Commercial CRM authority is:

```text
Contact
→ Lead
→ crm_pipelines
→ crm_stages
→ list_current_clinic_crm_*
→ transition_current_clinic_crm_lead_stage(...)
```

The old MED-CRM-003 BLOCK is historical evidence only. It was not reused as a current decision.

## GAPS

Fresh source/schema/test review confirmed:

1. the visible Board still used Patient funnel state as commercial authority;
2. the Patient-derived `leads no funil` metric also represented the wrong domain;
3. there was no frontend adapter/component dedicated to the RELEASED Commercial CRM projections/command;
4. the Board still needed explicit treatment for:
   - multiple active pipelines;
   - archived/legacy Lead visibility;
   - archived stage targets;
   - lost reason;
   - anonymized Contact presentation;
   - writer/read-only affordances;
   - post-COMMIT projection refresh semantics.

No missing server capability remained after MED-CRM-004.

## CAPABILITY AUTHORITY / REUSE GATE

The slice reuses only already-RELEASED authority:

- `list_current_clinic_crm_pipelines()`;
- `list_current_clinic_crm_stages(uuid)`;
- `list_current_clinic_crm_leads()`;
- `transition_current_clinic_crm_lead_stage(...)`;
- server-derived current tenant;
- active profile + `crm.access`;
- `owner | admin | recep` as Commercial CRM writers;
- `professional | financeiro` as read-only;
- canonical `crm_lead_activities` + `audit_log` side effects;
- existing `Modal + Field + Input` UI pattern;
- existing command/projection stale-warning pattern;
- existing Vitest + react-test-renderer + static boundary-test patterns.

No new RPC, table, migration, role, entitlement, tenant source, audit path or parallel writer is required.

## DECISION

Proceed with one bounded **frontend-only Commercial Board Cutover V1**.

The accepted boundary is:

1. add a narrow adapter for the existing current-clinic CRM RPCs;
2. replace only the Patient-backed commercial Board with canonical Lead/Pipeline/Stage projections;
3. enumerate every active pipeline explicitly;
4. select the active default only as the initial selection, with deterministic first-active fallback;
5. use only non-archived stages as mutation targets;
6. keep Leads whose pipeline or stage is archived in an explicit read-only legacy section;
7. collect a trimmed non-empty reason before a `lost` transition;
8. suppress Contact PII and free-form Lead title when `contact_anonymized_at` is present;
9. create no Patient navigation from `contact_patient_id`;
10. use `isOperationalRole()` only for browser affordance;
11. keep the canonical RPC as the mutation authority;
12. refetch canonical projections after a successful command;
13. report post-COMMIT refetch failure as stale projection, not command failure;
14. keep NPS, churn and Treatment Continuity in Patient-domain;
15. remove `setFunilStage()` and Patient-stage authority from the commercial Board.

## Deterministic deep review

Before execution, the initially advisory JEV route requested deeper review. The deterministic review then confirmed:

- Lead FKs preserve Contact/Pipeline/Stage references for live Leads through tenant-safe constraints;
- active/archived Pipeline and Stage projections contain the archive state required for frontend correlation;
- MED-CRM-004 enforces archived-current-pipeline immutability server-side for real state changes;
- archived target stages and cross-pipeline transitions remain server-rejected;
- anonymized Contact output requires a conservative presentation boundary because projection rows may still contain raw Contact fields;
- lost reason can reuse the existing server contract without inventing a taxonomy;
- command success and projection refresh can remain separate without optimistic client authority.

No remaining deterministic blocker was found.

## SECOND ADVERSARIAL REVIEW

Initial advisory route before deterministic deep review:

```text
route = deep_review
deep_review = 0.72
proceed_fast = 0.26
block = 0.01
split_task = 0.01
confidence = 0.63
```

After the deterministic deep review:

```text
route = proceed_fast
proceed_fast = 0.83
deep_review = 0.15
block = 0.02
split_task = 0.00
confidence = 0.76
```

JEV remained advisory. Execution was authorized by the deterministic repository evidence above, not by the probability output.

## Execution result

PR #536 implemented the approved frontend-only slice and was squash-merged after the final documentation HEAD passed all applicable checks. Pre-merge implementation HEAD:

```text
50ff38ff1427f71b30c62120b26259838a6b94b0
```

had all 9 applicable GitHub check-runs `completed + success`, including:

- full `npm test`;
- TypeScript typecheck;
- ESLint;
- production build;
- dependency audit;
- Nexus/clinical reconciliation workflows.

The first CI attempt had exposed a test-fixture typing error after all tests passed. That error was corrected and the new HEAD then passed the full validation chain. This is recorded rather than hidden.

## Post-implementation adversarial review

The completion advisory returned `verify_more = 0.67` because two non-code gates intentionally remain:

- institutional documentation reconciliation;
- merge + production frontend rollout/readback.

Those are real continuation gates, not a discovered server-authority blocker.

## Status boundary

`PROVED` here means the branch implementation and its behavioral/boundary tests are mechanically green.

It does **not** mean:

- PR #536 is merged;
- the feature is on canonical main;
- the production frontend has been promoted;
- MED-CRM-003 is RELEASED.

Merge is now separately proved: PR #536 was squash-merged as `main@9962a14cb31ff09666234129590b59524a2d85c3` after the final PR HEAD `2f0d8bc3cf9a7b61677abc053a64218d120dacf6` was `0 behind`, mergeable, with 9/9 check-runs `completed + success` and no blocking review/thread.

`RELEASED` still requires observed production frontend rollout/readback. Immediate post-merge public readback served the previous bundle and did not contain the MED-CRM-003 markers, so release is not inferred from merge.
