# MED-CRM-010 — Decision

**Status:** DESIGNED  
**Execution authorized:** NO  
**Product-contract baseline:** `main@17298d78e910951e8c719906b3305579d24ce0b0`  
**Design baseline:** `main@7be73d0c51c8633d829776913645681adcf35785`  
**Date:** 2026-09-28

## Decision statement

Approve the **Pipeline / Stage Administration Contract V1** and its exact Implementation Plan as `DESIGNED`, while keeping EXECUTION unauthorized until a separate implementation branch is deliberately started from an integrated, revalidated main.

The proven problem is not missing schema or missing reads. It is the absence of a safe, clinic-admin mutation authority for configuration that the current Commercial CRM already consumes.

## Candidate comparison

| Candidate | Proven current gap | Reuse available | New authority required | Current decision |
| --- | --- | --- | --- | --- |
| Pipeline/Stage admin | modeled/read/used, but not safely configurable | high: schema, projections, entitlement, Board, audit pattern | owner/admin config commands | **SELECT FOR DESIGN** |
| Lost reason taxonomy | free-form loss exists, structured catalog absent | stage transition + loss fields | taxonomy/config/reporting | defer |
| Follow-up / next action | no canonical Lead task aggregate | limited; async reuse audit needed | task/time/ownership engine | defer |
| Inbox / Conversation | no Lead conversation aggregate | Patient-oriented messaging cannot be reused by convenience | conversation/handoff authority | defer |
| Attribution | manual `source` only | Lead fields | acquisition/campaign chain | defer |
| Lead → Patient | no conversion command | Contact link + Patient registry separate | explicit clinical-boundary conversion | defer |

This is a current engineering/product decision, not a permanent roadmap ranking.

## Authority decision

### Existing read authority

Keep:
- `crm_current_reader_clinic_id()`;
- `list_current_clinic_crm_pipelines()`;
- `list_current_clinic_crm_stages(uuid)`;
- current reader roles + `crm.access`.

### Existing operational mutation authority

Do **not** use `crm_current_mutator_clinic_id()` as the configuration authority because it includes `recep`.

### Required future configuration authority

A future implementation may introduce a narrow internal CRM configuration guard only if it:
- derives tenant from the same canonical active-profile source;
- requires `crm.access`;
- permits owner/admin only;
- grants no platform_admin shortcut;
- remains internal, not a browser tenant-selection RPC.

That is a distinct capability boundary, not a duplicate tenant authority.

## Audit decision

Pipeline/Stage configuration changes should use the existing `audit_log`.

`crm_lead_activities` remains a Lead operational timeline. Do not emit Lead activities for configuration-only changes unless a future explicit operation also mutates Leads.

## Approved Product Contract

1. **Pipeline archive:** reject while any nondeleted nonterminal Lead remains; terminal historical Leads may remain frozen/read-only; reject last-active-Pipeline archive; default archive requires explicit replacement atomically.
2. **Stage archive:** reject while any nondeleted Lead references the Stage; reject last active open Stage archive; reassignment is a separate future capability.
3. **Default:** exactly one active default while active Pipelines exist; transfer is atomic and optimistic-conflict aware; restored Pipelines do not silently reclaim default.
4. **Create lifecycle:** no draft in V1; active Pipeline + ordered initial Stages are created atomically and must include at least one open Stage.
5. **Stage kind:** immutable after creation in V1.
6. **Reorder:** one atomic server command with expected-current-order precondition, deterministic locking and collision-safe two-phase position rewrite.
7. **Delete:** no authenticated physical delete command in V1; archive/restore only, with restore invariants revalidated.

## Concurrency decision discovered in second review

Lifecycle admin commands alone cannot guarantee these invariants.

The implementation design must also preserve linearizable compatibility with already RELEASED writers:

- serialize CRM configuration with a current-clinic row lock;
- harden `create_current_clinic_crm_lead(...)` with compatible clinic/Pipeline/initial-Stage locks before real creation;
- harden the target-Stage read in `transition_current_clinic_crm_lead_stage(...)`;
- preserve the existing Pipeline/Stage locking behavior of `update_current_clinic_crm_lead_details(...)`;
- preserve exact retry/idempotency semantics and avoid deadlock through one documented lock order.

Because Contact Identity Resolution composes the canonical Lead-create command, the hardening is reused there automatically rather than duplicated.

## Status decision

The seven Product Contract decisions are closed strongly enough to move **ANALYZED → APPROVED** after this docs-only change is integrated.

The slice is **not DESIGNED**. Exact RPC/helper signatures, migration composition, lock proof, retry/precondition matrix, audit event schema and behavioral/verifier test plan remain the next gate.

**Execution authorized: NO.**


## Implementation Plan Review decision — 2026-09-29

The design gate is closed by [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

Exact decisions now include:

- internal `crm_lock_current_configurator_clinic() RETURNS uuid`, owner/admin-only, `crm.access`-gated, server-derived clinic, current clinic row `FOR UPDATE`;
- ten narrow authenticated configuration RPCs for Pipeline/Stage create, rename, default, archive, restore and reorder;
- no generic writer, no physical delete, no mutable `stage_kind`;
- existing `create_current_clinic_crm_lead(...)` signature/authority preserved and hardened with clinic/Pipeline/Stage compatible locks;
- existing `transition_current_clinic_crm_lead_stage(...)` signature/authority preserved and hardened so real changes lock Pipeline before target Stage;
- Lead Details lock ordering preserved;
- desired-state retry branches precede stale rejection where specified;
- configuration evidence uses `audit_log`, not `crm_lead_activities`;
- isolated PostgreSQL 16/17 verifier/regression/concurrency proof is mandatory before PROVED.

The second adversarial review found and corrected the dangerous inverse `Stage → Pipeline` lock order. No unresolved design blocker remains at this checkpoint.

**Status:** DESIGNED.  
**Execution authorized:** NO.
