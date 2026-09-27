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

## Integration proof

PR #524 was squash-merged into the canonical repository:

```text
merged_at: 2026-09-27T01:48:03Z
merge/main SHA: 7a8badf5ad81e92746e82bedd142ba75899a4080
final PR head: cf94434ca5294e4e9cc4de70661268d9e4765045
final PR workflows: 21/21 SUCCESS
```

Therefore repository integration is proved.

## Release-gate runtime evidence

Post-merge documentation reconciliation was integrated by PR #526 as:

```text
PR #526 = MERGED (squash)
main = bac39b344ec807f5beb843b4ea6c9994e794f531
scope = documentation only
```

Production readback was then re-attempted through the registered MEDICSPRO runtime authority.

Observed target:

```text
target = medicspro-agent
environment = production
profile = operator
transport = agent
host = 28server
allowed path = /opt/wandora/ops-workspace
```

Observed capability boundary:

```text
allowedDockerContainers = []
allowedDockerExecContainers = []
allowedDockerExecPrograms = []
allowedDockerActions = []
psql in allowedProcessPrograms = false
docker_list = REMOTE_COMMAND_FAILED / docker_read_proxy_required
runtime_summary = docker unavailable for this user
target_agent_prepare presets = operator-workspace | read-only
```

The exact production artifacts that require readback are:

- `supabase-migrations/20260926_commercial_crm_core_foundation.sql`;
- `supabase-migrations/20260926_commercial_crm_command_boundary.sql`;
- `supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_CORE_FOUNDATION.sql`;
- `supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_COMMAND_BOUNDARY.sql`.

Both verifier files were mechanically inspected and contain zero mutation-like statements. The blocker is not verifier safety; it is absence of authorized connectivity/execution against the real production PostgreSQL instance.

The canonical deploy contract in `DEPLOY.md` requires schema/migration-history inspection before apply, pinned migration execution, stop-on-error and immediate verifier. Therefore GitHub integration cannot substitute this runtime proof.

Decision:

- do not use `bash`/`sh` as a program-allowlist escape;
- do not expose/read production DB credentials in chat;
- do not infer migration installation from merge/deploy intent;
- do not start MED-CRM-003.

Second adversarial review (JEV):

```text
route = block
block = 1.00
confidence = 1.00
```

The first missing authority was made concrete in `OARANHA/Remote-Ops-MCP` without broadening generic Docker or process access.

### Remote-Ops-MCP capability proof

The capability implementation passed the required pre-execution gates before code was added:

- GAPS: production installation of #522/#524 is unknown because no authorized DB readback exists;
- CAPABILITY AUTHORITY / REUSE GATE: reuse Agent Mesh + host-local Docker proxy; do not create a second DB authority;
- DECISION: add a semantic readback-only capability, not generic `psql`/`docker_exec`;
- SECOND ADVERSARIAL REVIEW: initial route `deep_review=0.79`; after forcing hash-pinned SQL + PostgreSQL read-only session/transaction + fixed server-side container/DB/user, route became `proceed_fast=0.59`.

Implemented contract:

```text
Remote-Ops-MCP PR #35 = MERGED
main = 52dbdf1bc12c44e46f52342dd73fce575b252f7c
PR head = 03aa8d29f1347a01203676f97208b477317bcd95

semantic capability = postgres.pinned_readback
MCP tool = postgres_pinned_verifier_readback
dynamic preset = postgres-readback
generic docker_exec = not granted
generic psql/process authority = not granted
database write/rollout authority = not added
```

The proxy configuration owns the exact PostgreSQL container, execution user, DB/user names and verifier-id→SHA-256 mapping. The caller supplies only `verifier_id` + SQL. The proxy rejects unknown ids or hash mismatch before Docker API access and executes only fixed `psql` argv with `default_transaction_read_only=on`, `ON_ERROR_STOP=1`, bounded statement/lock timeouts and an explicit `BEGIN TRANSACTION READ ONLY ... ROLLBACK`.

Validation before merge:

```text
npm ci = PASS (149 packages, 0 vulnerabilities)
TypeScript build = PASS
E2E OAuth/revocation = 23/23 PASS
AGENT_PAIRING_V1 = GREEN
AGENT_INSTALLER_V1 = GREEN
TARGET_AGENT_APPROVALS = GREEN
POSTGRES_PINNED_READBACK_TEST = GREEN
POSTGRES_PINNED_PROXY_E2E = GREEN
installer bash -n = PASS
```

The proxy E2E used a real loopback proxy process plus a fake Docker API over Unix socket. It verified the exact Docker exec request, fixed user/container, no shell, no password env, read-only PostgreSQL flags, and that verifier/hash rejection happens before Docker API access.

GitHub on the merge commit:

```text
verify = SUCCESS
publish = SUCCESS
```

Therefore the **capability implementation is proved and merged/published**, but that still does not prove runtime deployment.

### Control-plane deployment boundary

Live runtime was re-read after Remote-Ops-MCP #35 merged.

`remote-ops-mcp` is healthy, but its inspect label is still:

```text
org.opencontainers.image.revision =
985777e0cd38a4c0e3fa96dd5aa139e1b24e8832
```

The live MCP schema correspondingly still exposes only:

```text
target_agent_prepare preset =
operator-workspace | read-only

postgres_pinned_verifier_readback =
ABSENT
```

No MCP capability for Portainer/stack deploy/recreate is exposed in this session, and `wandora-admin` has empty operational allowlists. A plain container restart would keep the old image and is not a valid promotion path.

The final adversarial completion review after the new proxy E2E returned:

```text
incomplete = 0.53
verify_more = 0.33
complete = 0.14
confidence = 0.30
```

This result is consistent with the deterministic boundary: code/CI/publish are complete, runtime promotion/configuration are not.

The remaining authority is therefore narrower than before: **legitimate deployment of the published Remote-Ops-MCP image plus host-side configuration of the production PostgreSQL readback proxy**. The exact production PostgreSQL container must be discovered through authorized runtime evidence rather than guessed. If migrations are absent after readback, rollout still requires a separate narrowly authorized write capability for pinned migration files plus post-rollout verifier/readback.

## Explicit non-proof

This evidence still does **not** prove:

- deployment of #522/#524;
- production schema installation;
- CRM board/UI cutover;
- Contact edit/merge/dedupe;
- Lead→Patient conversion;
- Inbox/follow-up/attribution/AI/automation;
- provider-real behavior.

Therefore:

```text
PROVED + MERGED != RELEASED
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

## Production release evidence — 2026-09-27

### Production attempt and rollback proof

On 2026-09-27 the governed production path was executed against `28server` using `medicspro-managed-admin` plus the separate read-only target `medicspro-db-readback`.

Pre-rollout pinned verifier result:

```text
commercial_core_table_missing:contacts
```

The Core migration artifact was staged from canonical `crmfisio/main` and its SHA-256 was verified both on the host and inside `supabase-db`:

```text
23c433e36e0513aeddc9eae8ba6c1c34ba7c17854d07c4f3a796c66e2f8c0331
```

The exact production apply command was approval-gated and used:

```text
docker exec --user postgres supabase-db
psql -w -X -v ON_ERROR_STOP=1 -U postgres -d postgres
-f /tmp/medicspro-commercial-crm-core-23c433e3.sql
```

Observed failure:

```text
NOTICE: trigger "update_updated_at" for relation "public.contacts" does not exist, skipping
ERROR: function public.update_updated_at_column() does not exist
```

No Command Boundary migration was attempted.

The Core file has explicit `BEGIN;` / `COMMIT;`. Immediate pinned readback after failure again returned:

```text
commercial_core_table_missing:contacts
```

Therefore the failed apply did not leave `public.contacts` installed and the CRM remained NOT RELEASED.

### Baseline drift repair proof

Canonical repository inspection found the helper definition in `supabase-schema.sql` and the CRM fixture, but not in a versioned production migration. This was treated as baseline drift rather than as authority to patch production ad hoc.

PR #529 implemented the repair:

```text
PR #529 = MERGED
merge commit = bb9482c47bc67867ac9f527f68c0ffc76074e594
artifact = supabase-migrations/20260927_updated_at_helper_reconciliation.sql
verifier = supabase-verifiers/VERIFY_20260927_UPDATED_AT_HELPER_RECONCILIATION.sql
```

The migration creates `public.update_updated_at_column()` only when absent and does not touch CRM tables, Patient, Lead, Contact, RLS/RBAC or application data. The verifier is catalog-read-only and checks function presence, PL/pgSQL language, trigger return type, non-SECURITY-DEFINER posture and expected body shape.

Validation before merge:

```text
Updated At Helper Reconciliation / PostgreSQL 16 = SUCCESS
Updated At Helper Reconciliation / PostgreSQL 17 = SUCCESS
Commercial CRM Command Boundary / PostgreSQL 16 = SUCCESS
Commercial CRM Command Boundary / PostgreSQL 17 = SUCCESS
validate = SUCCESS
dependency-audit = SUCCESS
all observed PR #529 checks = SUCCESS
```

This proves the repository repair and its test composition. It does **not** prove production application of the 20260927 reconciliation migration or release of MED-CRM-001/002.
