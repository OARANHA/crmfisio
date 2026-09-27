# MED-CRM-002 — Evidence

**Slice status:** PROVED
**Implementation-proven head:** `1d7655d3e282962f8ebc5760f3f2b17f84c73bf5`
**Base at proof:** `main@652ea7b3aea4cd03a09944b780ef697168016bc3`
**PR:** #524
**Date:** 2026-09-26

> This file records reproducible proof for the executable MED-CRM-002 scope. Later documentation-only commits do not silently become implementation proof; their GitHub checks must be revalidated separately.
>
> The older `18ba481...` proof remains historical only. The current proof below includes the later `anonymized_at` hardening and the 13-case behavior suite.

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

The 13 behavior blocks prove:

1. owner creates Contact; exact retry does not duplicate row/audit;
2. divergent Contact replay fails explicitly;
3. admin/reception are writers; professional/financeiro are denied;
4. disabled `crm.access` fails closed;
5. anonymized Contact cannot be replayed as active and cannot receive a new Lead;
6. Lead creation starts in an open stage and exact retry does not duplicate activity/audit;
7. divergent Lead replay, cross-tenant Contact and terminal initial stage fail;
8. lost transition is atomic and exact retry does not duplicate side effects;
9. conflicting same-stage terminal replay is rejected;
10. won/open transitions derive and clear terminal fields correctly;
11. stage transition cannot cross pipeline;
12. authenticated raw Commercial Core DML remains denied;
13. Patient rows, `patients.funil_stage` and Patient Journey events remain untouched.

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

The proof process found test/verifier defects without broadening domain authority:

1. the first verifier wording rejected a defensive read of `existing.patient_id`; the check was narrowed to reject a patient argument/mutation instead of rejecting safe defensive inspection;
2. the first behavior case queried closed raw CRM tables while acting as `authenticated`; the test was corrected to use the canonical authenticated read projections instead of weakening table privileges;
3. after the anonymized-Contact hardening, commit `0161da95520383aa79f9cac7ed571814a879be79` introduced malformed PL/pgSQL delimiters `DO $` / `END $;` in behavior case 5. Dedicated PostgreSQL 16/17 CI failed at the same parser line. The fix changed only those two lines to `DO $$` / `END $$;`.

No item above weakened authorization or changed the intended command contract.

## GitHub proof on latest executable head

For `1d7655d3e282962f8ebc5760f3f2b17f84c73bf5`:

```text
base: main@652ea7b3aea4cd03a09944b780ef697168016bc3
ahead: 36
behind: 0
mergeable: true
reviews: 0
review threads: 0
validate: SUCCESS
dependency-audit: SUCCESS
Commercial CRM Command Boundary run: 36286051483
PostgreSQL 16.15: SUCCESS
PostgreSQL 17.11: SUCCESS
```

Both PostgreSQL jobs logged:

```text
COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED
COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED
5) anonymized Contact cannot be replayed or receive a new Lead
COMMERCIAL CRM COMMAND BOUNDARY BEHAVIOR CASES PASSED
commercial CRM command boundary: PostgreSQL verifier and behavior cases passed
```

The active `Protect main` ruleset requires squash merge and the `validate` + `dependency-audit` status checks; it requires zero approving reviews.

## Final adversarial completion review

Independent JEV completion review after the latest executable proof:

```text
complete: 0.89
verify_more: 0.08
incomplete: 0.03
confidence: 0.84
```

The deterministic evidence above remains authoritative. This review supports closing VALIDATION and marking MED-CRM-002 PROVED; it does not decide merge or rollout.

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
