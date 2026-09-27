# MED-CRM-001 — Implementation 001 — Commercial Core Foundation

**Status:** PROVED  
**Branch:** `feat/med-crm-001-commercial-core-foundation`  
**Base readback:** `main@948223da46bd2a8dec3ff1f73f00d91fe8ed52d9`  
**Scope:** schema + authorization/read boundaries only.

## Scope

This micro-slice creates the additive Commercial Core foundation only:

- `contacts`;
- `crm_pipelines`;
- `crm_stages`;
- `crm_leads`;
- `crm_lead_activities`;
- tenant/link integrity triggers;
- generic default pipeline/stages for existing clinics;
- authenticated read-only CRM projections;
- production-safe structural verifier;
- isolated PostgreSQL fixture/cases/harness.

It does **not** implement:

- Lead mutation RPCs;
- Lead→Patient conversion;
- CRM board/UI cutover;
- Inbox;
- automation/follow-up;
- attribution;
- provider integration;
- Patient Journey changes.

## Files

- `supabase-migrations/20260926_commercial_crm_core_foundation.sql`
- `supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_CORE_FOUNDATION.sql`
- `tests/sql/commercial_crm_core_foundation_fixture.sql`
- `tests/sql/commercial_crm_core_foundation_cases.sql`
- `scripts/test-commercial-crm-core-foundation.sh`

## Invariants implemented

### Identity and tenant

- Contact remains distinct from Patient.
- `contacts.patient_id` is optional.
- active Contact↔Patient link is unique per clinic.
- Contact→Patient cross-clinic link fails.
- phone/e-mail are not unique identity keys.
- Lead→Contact/Pipeline/Stage foreign keys carry `clinic_id`.

### Lead outcome

- no mutable `crm_leads.status`;
- `crm_stages.stage_kind` is the outcome source: `open | won | lost`;
- at most one active `won` and one active `lost` stage per pipeline;
- open Lead cannot carry terminal fields;
- won Lead requires `closed_at` and cannot carry lost reason;
- lost Lead requires `closed_at` and a loss reason.

### Authorization surface

- RLS enabled on all five foundation tables.
- PUBLIC/anon/authenticated receive no raw table privileges.
- service_role retains foundation DML.
- CRM reader helper requires:
  - authenticated active profile;
  - current clinic;
  - canonical clinic role;
  - `crm.access`.
- browser receives only SECURITY DEFINER read projections.
- Lead projection has no clinical record/CID/evolution/document joins.

### Commercial timeline

- activity belongs to Lead in the same clinic;
- actor cannot cross tenant;
- normal browser has no direct activity DML.

### Compatibility

- no Patient→Lead backfill;
- no Patient data is rewritten;
- `patients.funil_stage`, `patient_journey_events` and `transition_patient_journey` remain untouched;
- Appointment remains Patient-bound.

## Starter pipeline

Existing non-deleted clinics receive one generic default pipeline:

```text
Novo
Contato iniciado
Interessado
Avaliação a agendar
Convertido [won]
Perdido    [lost]
```

This is bootstrap configuration, not clinical semantics.

Future owner/admin pipeline mutation belongs to another micro-slice.

## Read projections

- `list_current_clinic_crm_pipelines()`
- `list_current_clinic_crm_stages(uuid)`
- `list_current_clinic_crm_leads()`
- `list_current_clinic_crm_lead_activities(uuid)`

No mutation RPC is introduced in this micro-slice.

## Test harness

`scripts/test-commercial-crm-core-foundation.sh`:

1. creates an isolated fixture with two clinics;
2. reproduces canonical auth/profile/entitlement helpers;
3. applies the migration twice to test replay/idempotency;
4. runs the structural verifier;
5. runs behavioral cases for tenant isolation, terminal stage semantics, read roles, entitlement deny and raw DML denial.

Expected database:

`commercial_crm_core_foundation_test`

## JEV preflight

2026-09-26 schema-foundation preflight:

- decision: `allow`;
- allow probability: `0.79`;
- confidence: `0.73`.

## Validation evidence

### Proven on PR #522

Existing repository PR workflows are green: **8/8**.

The `Clinical workflow CI / validate` job executed successfully:

- `npm ci`;
- `npm test`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`.

The dependency-audit job also passed.

The other seven clinical/Nexus regression workflows passed, so no known regression was introduced into the existing clinical boundaries.

### Commercial Core SQL harness — proven on PostgreSQL 16 and 17

Runtime proof executed through the paired `medicspro-agent` on host `28server`, entirely under `/opt/wandora/ops-workspace`.

PostgreSQL was used portably inside the workspace; no PostgreSQL package/service was installed on the host and no production database/service was touched.

Evidence:

- PostgreSQL 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1): **GREEN**;
- PostgreSQL 17.11 (Ubuntu 17.11-1.pgdg24.04+2): **GREEN**;
- fixture created successfully;
- migration applied twice successfully on both versions;
- structural verifier passed on both versions;
- behavior cases passed on both versions;
- final harness marker:
  - `MED_CRM_001_POSTGRES16_HARNESS=GREEN`;
  - `MED_CRM_001_POSTGRES17_HARNESS=GREEN`.

The first PostgreSQL 16 run exposed one real SQL portability bug in
`list_current_clinic_crm_stages()`: `position` in the `RETURNS TABLE`
signature parsed as a keyword. The public result column name was preserved and
the declaration was changed only to `"position" integer`.

Fix commit:

`9f1bc6629fa7815172d9a81911d1ce4df29e5bda`

No schema semantics, identity rules, tenant rules, Patient boundaries, mutation
surface or UI scope were expanded by the fix.

### Final reconciliation

- repository-required workflows: **8/8 SUCCESS** on reconciled head `472891f2ebd61902e5b323a0f821766822650c30`;
- final compare against `main@948223da46bd2a8dec3ff1f73f00d91fe8ed52d9`: **13 ahead / 0 behind**;
- changed files: **9**, limited to the intended foundation + slice documentation;
- no UI/board, mutation RPC, Inbox, automation, attribution, provider or Lead→Patient conversion entered the slice.

Therefore this implementation is **PROVED**. This does not mean merged or released.

The subsequent status/handoff updates are documentation-only. Revalidate GitHub
checks on the latest PR HEAD before merge.

## Next exact step

Revalidate PR #522 on its latest HEAD and make the merge decision separately.
After merge/reconciliation, choose the next CRM micro-slice only through GAPS,
CAPABILITY AUTHORITY / REUSE GATE, DECISION and SECOND ADVERSARIAL REVIEW.
