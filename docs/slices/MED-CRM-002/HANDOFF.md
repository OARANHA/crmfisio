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
