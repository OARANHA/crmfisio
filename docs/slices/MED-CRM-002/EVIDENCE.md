# MED-CRM-002 — Evidence

**Slice status target:** PROVED  
**Implementation-proven head:** `18ba481866a3af8412cfc200621290d3358a2b5e`  
**Base at proof:** `main@652ea7b3aea4cd03a09944b780ef697168016bc3`  
**PR:** #524  
**Date:** 2026-09-26

> This file records reproducible proof for the executable MED-CRM-002 scope. Later documentation-only commits do not silently become implementation proof; their GitHub checks must be revalidated separately.

## Scope proved

Executable changes are limited to:

- `supabase-migrations/20260926_commercial_crm_command_boundary.sql`;
- `supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_COMMAND_BOUNDARY.sql`;
- `tests/sql/commercial_crm_command_boundary_cases.sql`;
- `scripts/test-commercial-crm-command-boundary.sh`.

No table, column, generic engine, frontend, provider adapter, Patient mutation or production rollout was added.

## PostgreSQL proof

The isolated harness:

1. creates the existing MED-CRM-001 synthetic fixture;
2. applies the MED-CRM-001 Commercial Core migration;
3. applies the MED-CRM-002 command migration;
4. reapplies MED-CRM-002 to prove migration replay;
5. reruns the MED-CRM-001 structural verifier;
6. runs the MED-CRM-002 structural/security verifier;
7. runs the MED-CRM-002 behavior cases.

### PostgreSQL 16

Runtime used only as a disposable test host:

```text
host: 28server / medicspro-agent workspace
PostgreSQL: 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
database: commercial_crm_command_boundary_test
data dir: isolated pg16-data-medcrm002
port: isolated 55442
result: GREEN
```

Observed terminal marker:

```text
COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED
COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED
COMMERCIAL CRM COMMAND BOUNDARY BEHAVIOR CASES PASSED
MEDCRM002_PG16_GREEN
```

### PostgreSQL 17

```text
host: 28server / medicspro-agent workspace
PostgreSQL: 17.11 (Ubuntu 17.11-1.pgdg24.04+2)
database: commercial_crm_command_boundary_test
data dir: isolated pg17-data-medcrm002
port: isolated 55443
result: GREEN
```

Observed terminal marker:

```text
COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED
COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED
COMMERCIAL CRM COMMAND BOUNDARY BEHAVIOR CASES PASSED
MEDCRM002_PG17_GREEN
```

The PostgreSQL processes were stopped by the harness trap. No production database was touched.

## Behavior proof

The 12 behavior blocks prove:

1. owner creates Contact; exact retry does not duplicate row/audit;
2. divergent Contact replay fails explicitly;
3. admin/reception are writers; professional/financeiro are denied;
4. disabled `crm.access` fails closed;
5. Lead creation starts in an open stage and exact retry does not duplicate activity/audit;
6. divergent Lead replay, cross-tenant Contact and terminal initial stage fail;
7. lost transition is atomic and exact retry does not duplicate side effects;
8. conflicting same-stage terminal replay is rejected;
9. won/open transitions derive and clear terminal fields correctly;
10. stage transition cannot cross pipeline;
11. authenticated raw Commercial Core DML remains denied;
12. Patient rows, `patients.funil_stage` and Patient Journey events remain untouched.

## Security/authority verifier

The verifier proves:

- all four functions exist;
- the mutator guard is not executable by browser roles;
- the three commands are authenticated-only;
- all use SECURITY DEFINER with pinned `public, pg_temp` search path;
- mutation authority composes `current_active_profile()` + `crm.access` + `owner/admin/recep`;
- Contact command has no patient/clinic argument or Patient mutation;
- Lead creation enforces open initial stage and emits commercial activity/audit;
- stage transition locks the Lead, stays inside the current pipeline and emits activity/audit;
- raw browser DML remains closed;
- no parallel CRM task/event/conversation/idempotency table appeared.

The MED-CRM-001 verifier also passes after MED-CRM-002 is applied twice.

## Defects found by the proof itself

The proof process found two test-only defects before green:

1. the first verifier wording rejected a defensive read of `existing.patient_id`; the check was narrowed to reject a patient argument/mutation instead of rejecting safe defensive inspection;
2. the first behavior case queried closed raw CRM tables while acting as `authenticated`; the test was corrected to use the canonical authenticated read projections instead of weakening table privileges.

Neither fix broadened authorization or changed the command implementation.

## GitHub proof on implementation head

For `18ba481866a3af8412cfc200621290d3358a2b5e`:

```text
base: main@652ea7b3aea4cd03a09944b780ef697168016bc3
ahead: 14
behind: 0
mergeable: true
repository workflows: 8/8 SUCCESS
reviews: 0
review threads: 0
```

The eight successful workflows were:

- Clinical Foundation Reconciliation;
- Nexus C-06 PostgreSQL Authorization;
- Nexus C-04 PostgreSQL Clinical Record;
- Nexus C-02 PostgreSQL Write Contract;
- Nexus C-01 PostgreSQL RLS;
- Clinical workflow CI;
- Clinical Authorization Reconciliation;
- Nexus C-03 PostgreSQL Clinical Lifecycle.

## Final adversarial completion review

JEV completion review after both PostgreSQL versions and current-head GitHub checks:

```text
complete: 0.92
verify_more: 0.07
incomplete: 0.01
confidence: 0.87
```

This is advisory evidence only; deterministic repository/database proof remains authoritative.

## Explicit non-proof

This evidence does **not** prove:

- merge of #524;
- deployment of #524;
- production schema installation;
- CRM board/UI cutover;
- Contact edit/merge/dedupe;
- Lead→Patient conversion;
- Inbox/follow-up/attribution/AI/automation;
- provider-real behavior.

Therefore:

```text
PROVED != MERGED != RELEASED
```

## Reproduction

Use only a disposable database named exactly:

```text
commercial_crm_command_boundary_test
```

Then run:

```bash
scripts/test-commercial-crm-command-boundary.sh
```

The harness refuses any other database name.
