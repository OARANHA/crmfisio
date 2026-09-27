# MED-CRM-005 — Prospect Intake V1

**Status:** PROVED ON BRANCH / NOT MERGED / NOT RELEASED  
**Base audited:** `main@cae02c03345302737e8738a77da6841224659518`  
**Depends on:** MED-CRM-001 / 002 / 003 / 004 RELEASED

## Purpose

Make the released Commercial CRM usable for creating a pre-clinical prospect from `/crm` without creating a Patient and without introducing a new mutation authority.

## Scope

- add a `Novo prospect` flow to the canonical Commercial Board;
- collect Contact name, optional phone/email, Lead title and one active pipeline;
- reuse only the RELEASED `create_current_clinic_crm_contact(...)` and `create_current_clinic_crm_lead(...)` commands;
- generate Contact/Lead UUIDs once per draft and reuse them on retry;
- let the Lead command choose the first active `open` stage;
- keep `owner | admin | recep` as UI writers and `professional | financeiro` read-only;
- refresh only canonical Commercial CRM projections after successful commands;
- treat a post-persist projection failure as stale UI state.

## Non-goals

No ReceptionPatients rewrite, Patient creation/mutation, Lead→Patient conversion, Contact edit/merge/dedupe, pipeline administration, Inbox, follow-up, attribution, provider changes, automation or AI.

No table, migration, RPC, RLS policy, role, entitlement, tenant source or audit path is added by this slice.

## Proof checkpoint

Implementation proof HEAD before documentation refresh:

`c2650234615cd4fd77dfcebd4a8e830a37b3415b`

Controlled workspace validation:

- focused Commercial CRM tests: 22/22 PASS;
- full Vitest suite: 128 files / 690 tests PASS;
- `npm run typecheck`: PASS;
- `npm run lint`: PASS;
- `npm run build`: PASS;
- `npm audit --audit-level=high`: exit 0; two pre-existing moderate Vitest/@vitest-mocker advisories remain and require a breaking major upgrade.

Merge, final-HEAD GitHub checks and production readback remain separate gates.
