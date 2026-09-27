# MED-CRM-002 — Handoff

## Start here

1. `docs/CANONICAL_INDEX.md`
2. `AGENTS.md`
3. `docs/CURRENT_STATE.md`
4. `docs/WORK_MASTER_PROMPT.md`
5. `docs/WORK_CONTEXT.md`
6. `docs/SLICE_EXECUTION_METHOD.md`
7. `docs/SLICE_LEDGER.md`
8. `docs/doctrine/README.md`
9. `docs/doctrine/sistema-vivo.md`
10. `docs/doctrine/autoridade-e-fronteiras.md`
11. `docs/slices/MED-CRM-001/NEXT_CAPABILITY_MAP.md`
12. `docs/slices/MED-CRM-002/README.md`
13. `docs/slices/MED-CRM-002/DECISION.md`
14. `docs/slices/MED-CRM-002/EVIDENCE.md`

Then resolve current `origin/main` and runtime evidence again. Mutable facts below are a checkpoint, not a future checkout instruction.

## Current proven checkpoint

```text
main = bac39b344ec807f5beb843b4ea6c9994e794f531

PR #522 = MERGED
MED-CRM-001 = PROVED + MERGED
MED-CRM-001 = NOT RELEASED

PR #524 = MERGED
MED-CRM-002 = PROVED + MERGED
MED-CRM-002 = NOT RELEASED

PR #526 = MERGED (squash)
PR #527 = MERGED (squash)
scope = documentation only
```

#526 was revalidated before merge:

- head `f6de48332da61007c327c3efd895afee53aff1bb`;
- 4 ahead / 0 behind;
- mergeable;
- six changed files, all under `docs/`;
- reviews = 0;
- review threads = 0;
- 48/48 check-runs SUCCESS;
- required `validate` = SUCCESS;
- required `dependency-audit` = SUCCESS;
- `Protect main` ruleset = squash only.

The merge was executed with the expected head SHA and GitHub returned `merged=true`.

## Release gate — current runtime evidence

The registered MEDICSPRO runtime target remains:

```text
target = medicspro-agent
environment = production
capabilityProfile = operator
transport = agent
host = 28server
allowedPaths = [/opt/wandora/ops-workspace]
```

Its **live schema** still has the older boundary:

```text
allowedDockerContainers = []
allowedDockerExecContainers = []
allowedDockerExecPrograms = []
allowedDockerActions = []
psql is NOT in allowedProcessPrograms
target_agent_prepare presets = operator-workspace | read-only
postgres_pinned_verifier_readback = ABSENT
```

However, the missing semantic capability has now been implemented upstream in the operational MCP:

```text
repository = OARANHA/Remote-Ops-MCP
PR #35 = MERGED
main = 52dbdf1bc12c44e46f52342dd73fce575b252f7c
verify = SUCCESS
publish = SUCCESS
new preset = postgres-readback
new semantic capability = postgres.pinned_readback
new tool = postgres_pinned_verifier_readback
```

The implementation is intentionally readback-only: exact verifier SQL must match a host-approved SHA-256; the proxy fixes PostgreSQL container/DB/user server-side and forces PostgreSQL read-only session/transaction semantics. It grants no generic `psql`, `docker_exec`, secret read or DB write authority.

Validation before merge included full Remote-Ops-MCP `npm run check` plus `POSTGRES_PINNED_PROXY_E2E=GREEN`, exercising Agent → proxy → fake Docker Unix socket end to end.

The control plane itself is **not yet promoted**. Runtime inspect of `remote-ops-mcp` reports:

```text
image = ghcr.io/oaranha/remote-ops-mcp:main
state = running / healthy
org.opencontainers.image.revision =
985777e0cd38a4c0e3fa96dd5aa139e1b24e8832
```

Therefore tag name `:main` must not be mistaken for current code. The live container still runs the pre-#35 revision.

No stack/Portainer/deploy/recreate MCP capability is exposed in this session, and `wandora-admin` has empty allowlists. Restarting the current container would not pull/recreate the new image, so it is not an acceptable substitute for the canonical promotion path.

## Exact repository artifacts for runtime proof

Migrations:

- `supabase-migrations/20260926_commercial_crm_core_foundation.sql`;
- `supabase-migrations/20260926_commercial_crm_command_boundary.sql`.

Readback verifiers:

- `supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_CORE_FOUNDATION.sql`;
- `supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_COMMAND_BOUNDARY.sql`.

The two verifier files were inspected mechanically: zero mutation-like statements were found. They are structurally read-only, but this session has no authorized path to execute them against the real production PostgreSQL instance.

`DEPLOY.md` remains authoritative for rollout mechanics: inspect real schema/migration history first; do not reapply blindly; use pinned migration files; stop on error; run the appropriate verifier immediately after mutation.

## Gates in this session

### GAPS

Production installation of #522/#524 is unknown. Repository integration is proved; production schema installation is not.

### CAPABILITY AUTHORITY / REUSE GATE

Reuse the canonical self-hosted Supabase/PostgreSQL runtime and the existing `medicspro-agent`. Do not create a second DB/runtime authority and do not bypass MCP boundaries.

### DECISION

Block production readback/rollout with the current capability set. Do not use `bash`/`sh`, raw secrets or network tricks to escape allowlists.

### SECOND ADVERSARIAL REVIEW

JEV result:

```text
route = block
block = 1.00
deep_review = 0.00
proceed_fast = 0.00
split_task = 0.00
confidence = 1.00
```

Therefore no production mutation was executed.

## Missing capability / authorization

The semantic DB-readback capability is no longer missing **in source**; it is missing **in deployed runtime**.

Current precise blockers:

1. promote the published Remote-Ops-MCP image for `52dbdf1b...` through a legitimate stack/Portainer deployment path;
2. confirm the live schema exposes `postgres-readback` + `postgres_pinned_verifier_readback`;
3. configure the host-local readback proxy with the **real** production PostgreSQL container and approved hashes for the two canonical verifiers, without exposing credentials;
4. only then execute production readback;
5. if readback proves either migration absent, create/use a **separate, narrow rollout authorization** for the pinned migration files plus immediate post-rollout verifier/readback.

The current session does not expose a stack deploy capability, and a restart of the old image is not sufficient.

## Exact next step

1. deploy/recreate Remote-Ops-MCP from the already published `52dbdf1b...` image using the canonical Portainer/stack authority;
2. re-open/reload the MCP connector if necessary and prove the new live schema;
3. discover the exact production PostgreSQL container through authorized runtime evidence and configure the pinned readback proxy;
4. inspect real migration/schema state for the two 20260926 migrations before any apply;
5. if both are installed, run the two read-only verifiers and capture objective evidence;
6. if either is absent, revalidate blast radius and perform a fresh SECOND ADVERSARIAL REVIEW before a separate controlled rollout;
7. after rollout, run both verifiers/readback and prove tenant/RBAC/RLS invariants;
8. only then update MED-CRM-001/002 to RELEASED, rebuild `NEXT_CAPABILITY_MAP.md`, and re-run the four pre-execution gates for any possible MED-CRM-003.

Do not start Board/UI, pre-clinical intake, follow-up, Inbox, attribution, Lead→Patient conversion, CRM automation, Commercial AI or a parallel engine while this release gate is open.

## Latest production reconciliation — 2026-09-27

This checkpoint supersedes the older runtime-release notes above/below when they conflict. Mutable runtime facts must still be re-read before the next action.

```text
canonical main = bb9482c47bc67867ac9f527f68c0ffc76074e594
PR #529 = MERGED (squash)
MED-CRM-001 = PROVED + MERGED + NOT RELEASED
MED-CRM-002 = PROVED + MERGED + NOT RELEASED
```

Runtime authority now proved on the MedicsPro production host:

```text
host = 28server
managed target = medicspro-managed-admin
readback target = medicspro-db-readback
readback semantic capability = postgres.pinned_readback
generic Docker/process/write authority on readback target = none
PostgreSQL container = supabase-db
image = supabase/postgres:17.6.1.136
```

The pinned readback path is operational. The canonical Commercial Core verifier, executed against production before rollout, failed with:

```text
commercial_core_table_missing:contacts
```

That proved the Commercial Core migration was absent.

The first controlled Core rollout then used the exact canonical file whose host/container SHA-256 was proved as:

```text
23c433e36e0513aeddc9eae8ba6c1c34ba7c17854d07c4f3a796c66e2f8c0331
```

Execution used `psql -X -v ON_ERROR_STOP=1 -f ...` inside `supabase-db` and failed at the first updated-at trigger with:

```text
function public.update_updated_at_column() does not exist
```

The migration itself begins with `BEGIN;`. Immediate pinned readback after the failure again returned `commercial_core_table_missing:contacts`, proving rollback of the failed attempt.

Repository reconstruction showed:

- `public.update_updated_at_column()` exists in `supabase-schema.sql`;
- the CRM synthetic fixture also defines it;
- no prior versioned migration guaranteed the helper in older production environments;
- `DEPLOY.md` forbids using `supabase-schema.sql` as the continuous production migration mechanism.

PR #529 therefore added a canonical additive repair instead of a production-only patch:

- `supabase-migrations/20260927_updated_at_helper_reconciliation.sql`;
- `supabase-verifiers/VERIFY_20260927_UPDATED_AT_HELPER_RECONCILIATION.sql`;
- dedicated PostgreSQL 16/17 reconciliation harness;
- Commercial CRM PostgreSQL 16/17 harness now includes this prerequisite before the unchanged 20260926 CRM migrations.

All PR #529 checks completed successfully before squash merge, including `validate`, `dependency-audit`, both reconciliation PostgreSQL jobs and both Commercial CRM PostgreSQL jobs.

### Exact next release sequence

1. re-read current `origin/main`, active PRs and runtime before mutation;
2. pin/stage `20260927_updated_at_helper_reconciliation.sql`, prove its exact hash on host/container and apply it with stop-on-error;
3. run `VERIFY_20260927_UPDATED_AT_HELPER_RECONCILIATION.sql`;
4. perform read-only preflight of the remaining external CRM prerequisites (`clinics`, `patients`, `profiles`, `audit_log`, `current_active_profile()`, `current_clinic_entitlement_allowed(text)`, `auth.uid()`);
5. only if preflight is clean, retry the unchanged pinned Commercial Core migration and immediately run its pinned verifier;
6. only if Core passes, apply the unchanged pinned Command Boundary migration and immediately run its pinned verifier;
7. only after both production verifiers pass, update MED-CRM-001/002 to RELEASED and reconsider MED-CRM-003.

Do not start MED-CRM-003, Board/UI, Inbox, follow-up, attribution, Lead→Patient conversion, automation or Commercial AI while this release gate is open.

## Final production release proof — 2026-09-27

MED-CRM-002 is now **RELEASED** for its bounded backend command scope.

After MED-CRM-001 passed its production verifier, the pre-rollout Command Boundary verifier returned:

```text
commercial_crm_command_function_missing
```

That proved the command boundary was still absent before mutation.

The exact canonical migration was staged from current main and proved on the host and inside `supabase-db` with SHA-256:

```text
f8f38a0db0fd020713a89eeecb6abd6df4e414b89ffb2ae6457ee8c777ac9a13
```

The approval-gated production apply completed with:

```text
BEGIN
...
COMMIT
exit_code = 0
```

Immediately afterward, both canonical verifiers were executed through the separate pinned readback target in PostgreSQL read-only transactions.

Core verifier:

```text
sha256 = da5f4bcfbd25c15fc2c654a59761e1fb9863e88608a65d57e6d44d8253913c8c
COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED
```

Command Boundary verifier:

```text
sha256 = 7d4a4ff23f9d70c3e808e0a8fcb696c2b8565ef0a64955532566de0a69753b34
COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED
```

The production command verifier proved:

1. all MED-CRM-002 functions exist;
2. helper is internal and browser commands are authenticated-only;
3. SECURITY DEFINER + pinned search path remain correct;
4. mutator authority composes tenant/role/entitlement boundaries;
5. Contact command cannot choose clinic or link Patient;
6. Lead create remains open-stage only and emits activity/audit;
7. stage transition locks the Lead, remains in the same pipeline and emits activity/audit;
8. raw Commercial Core browser DML remains closed;
9. no parallel commercial tables were introduced.

Production write actions used exact one-time managed-admin approvals. Verification used `medicspro-db-readback`, which has only `postgres.pinned_readback` and no generic Docker/process/write authority.

Therefore the bounded release statement is now:

```text
MED-CRM-001 = PROVED + MERGED + RELEASED
MED-CRM-002 = PROVED + MERGED + RELEASED
```

This does not release Board/UI, pre-clinical intake, Contact edit/merge/dedupe, Lead→Patient conversion, Inbox, follow-up, attribution, provider changes, automation or Commercial AI.
