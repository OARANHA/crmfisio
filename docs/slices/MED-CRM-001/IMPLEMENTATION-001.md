# MED-CRM-001 — Implementation 001 — Commercial Core Foundation

**Status:** IMPLEMENTING  
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

## Validation gate before merge

Required:

- PostgreSQL 16 harness: pending;
- PostgreSQL 17 harness: pending;
- repository tests: pending;
- typecheck: pending;
- lint: pending;
- build: pending;
- final diff/readback: pending.

A dedicated new GitHub Actions workflow was not added in this pass. The harness is repository-native and must be executed before merge; do not treat existing unrelated CI as proof of the SQL contract.

## Next exact step

1. execute the PostgreSQL harness on 16 and 17;
2. fix any migration/verifier/case failure;
3. run application gates;
4. open/review PR;
5. only after all required evidence is green decide whether this micro-slice is `PROVED`.

Do not start mutation RPCs or UI while this foundation is unproved.
