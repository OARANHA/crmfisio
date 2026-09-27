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

The registered MEDICSPRO runtime target is:

```text
target = medicspro-agent
environment = production
capabilityProfile = operator
transport = agent
host = 28server
allowedPaths = [/opt/wandora/ops-workspace]
```

Current registry/runtime boundary:

```text
allowedDockerContainers = []
allowedDockerExecContainers = []
allowedDockerExecPrograms = []
allowedDockerActions = []
psql is NOT in allowedProcessPrograms
docker_list -> REMOTE_COMMAND_FAILED / docker_read_proxy_required
runtime_summary -> docker unavailable for this user
```

`target_agent_prepare` currently exposes only these presets:

```text
operator-workspace
read-only
```

Re-preparing the same target therefore does not add production database or Docker authority.

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

The next step is not a CRM feature. The missing runtime authority is:

1. **read-only production PostgreSQL readback**, with server-side credential handling and no secret exposure; valid shapes include:
   - a dedicated semantic DB-readback capability; or
   - Docker read proxy + the production PostgreSQL container explicitly allowlisted + `psql` explicitly allowlisted;
2. if readback proves either migration absent, a **separate, narrow rollout authorization** for the pinned migration files plus immediate post-rollout verifier/readback.

A generic `operator-workspace` target is insufficient.

## Exact next step

1. extend/authorize the MEDICSPRO runtime boundary with controlled production PostgreSQL readback;
2. inspect real migration/schema state for the two 20260926 migrations before any apply;
3. if both are installed, run the two read-only verifiers and capture objective evidence;
4. if either is absent, revalidate blast radius and perform a fresh SECOND ADVERSARIAL REVIEW before the separate controlled rollout;
5. after rollout, run both verifiers/readback and prove tenant/RBAC/RLS invariants;
6. only then update MED-CRM-001/002 to RELEASED if evidence supports it;
7. rebuild `NEXT_CAPABILITY_MAP.md` against current main + runtime;
8. only then re-run GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW for a possible MED-CRM-003.

Do not start Board/UI, pre-clinical intake, follow-up, Inbox, attribution, Lead→Patient conversion, CRM automation, Commercial AI or a parallel engine while this release gate is open.
