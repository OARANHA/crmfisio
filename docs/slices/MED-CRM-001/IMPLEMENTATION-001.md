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

### Commercial Core SQL harness — still a hard blocker

- PostgreSQL 16 harness: **NOT RUN**;
- PostgreSQL 17 harness: **NOT RUN**.

A dedicated GitHub Actions workflow for this harness was attempted but the repository-file action was blocked by OpenAI platform security controls. The block was not bypassed.

A second isolated validation path was attempted through `MCP_WANDORA_VPS`:

1. PR #522 was cloned successfully under `/opt/wandora/ops-workspace/med-crm-001-pr522`;
2. the host has no `psql`;
3. `postgres:16` and `postgres:17` images were not cached;
4. `docker pull postgres:16` was denied by the governed Docker proxy with `405 Method Not Allowed`;
5. the alternate `wandora-admin` target exposes no process allowlist;
6. the temporary clone was removed successfully (`cleanup_ok`);
7. no PostgreSQL image/container/database was created and no production service/database was touched.

Therefore **PR #522 must not be merged yet**. Existing CI is valid application-regression evidence, but it is not proof of this new SQL contract.

### Remaining required evidence

- PostgreSQL 16: fixture → migration twice → verifier → behavior cases;
- PostgreSQL 17: same sequence;
- final diff/readback after any SQL fixes;
- final PR checks after the last commit.

## Next exact step

Run:

```bash
PGDATABASE=commercial_crm_core_foundation_test \
  bash scripts/test-commercial-crm-core-foundation.sh
```

against isolated PostgreSQL 16 and 17 environments.

If either run fails, fix the migration/verifier/cases and rerun both. Only after both database versions and final PR checks are green may this micro-slice move to `PROVED`.

Do not start mutation RPCs or UI while this foundation is unproved.
