# MED-CRM-003 — Commercial Board V1

**Status:** DESIGNED — execution not started
**Capability:** canonical Lead/Pipeline/Stage board on `/crm`
**Design base:** `main@7a8badf5ad81e92746e82bedd142ba75899a4080`

## Objective

Replace only the Patient-backed commercial funnel block in `/crm` with the canonical Commercial Core already integrated.

## GAPS

Current source still uses `Patient[] → patients.funil_stage → setFunilStage` as the visible commercial board while canonical Lead/Stage read and transition authority now exists.

## Reuse gate

Reuse:

- `crm.access` route boundary;
- Commercial Core pipeline/stage/lead projections;
- `transition_current_clinic_crm_lead_stage`;
- `isOperationalRole` for UX affordance only;
- Patient continuity/NPS/churn for their own Patient-domain sections.

Do not create a new tenant/RBAC/entitlement/writer/audit authority.

## Decision

See [DECISION.md](DECISION.md).

In scope:

1. load canonical pipelines/stages/leads;
2. render Lead cards by canonical stage;
3. move Leads only through the existing stage-transition command;
4. professional/financeiro remain read-only;
5. preserve Treatment Continuity, NPS and churn as Patient-domain content;
6. remove/replace Patient-derived commercial metrics.

## Non-goals

- no Contact/Lead creation UI;
- no intake rewrite;
- no Contact edit/merge/dedupe;
- no pipeline admin;
- no Lead→Patient conversion;
- no Patient/Encounter/Patient Journey mutation;
- no follow-up/Inbox/attribution/provider/automation/AI;
- no backend/schema/RPC/table/column change.

## Invariants

- Contact != Lead != Patient;
- board never writes `patients.funil_stage`;
- browser never writes CRM tables directly;
- server command remains authorization authority;
- no clinical payload enters commercial cards;
- no implicit Patient creation/conversion.

## Gate state

```text
GAPS                 DONE
REUSE GATE            DONE
DECISION              DONE
SECOND ADVERSARIAL    DONE
EXECUTION             NOT STARTED
VALIDATION            NOT STARTED
```

Adversarial review details: [EVIDENCE.md](EVIDENCE.md).

## Next exact step

Revalidate current main, concurrent PRs, `Crm.tsx`, route, permissions and RPC signatures. If unchanged, create a narrow implementation PR for the frontend board only. If changed materially, rerun the four pre-execution gates.

Do not add Contact→Lead creation to this slice.
