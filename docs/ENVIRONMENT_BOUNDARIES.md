# MedicsPro — Environment Boundaries

## Purpose

This document defines the canonical separation between development/test workspaces and the real MedicsPro production environment. Read it before any server command, migration, container operation, Portainer action, Edge Function deployment, production verifier or real smoke test.

## Canonical environments

### Production MedicsPro

```text
server:          158.220.97.145
Portainer:       http://158.220.97.145:9000
application:     https://app.medicspro.com.br
Supabase:        https://supabase.medicspro.com.br
repository:      OARANHA/crmfisio
production ref:  main / explicitly pinned merged SHA
```

`158.220.97.145` is the MedicsPro production server boundary.

Any operation that changes or validates real production state belongs here, including:

- PostgreSQL/Supabase migrations against the real MedicsPro database;
- production SQL verifiers and production-safe read-only inspections;
- frontend/container rebuild or redeploy;
- Portainer stack/container operations;
- Edge Function deployment or restart;
- production environment variables or runtime configuration;
- real logs/health inspection when used to validate a release;
- smoke tests whose result is recorded as production evidence.

Production actions require an explicit handoff to the user. The assistant prepares the exact command block, expected SHA/preconditions, stop-on-error behavior, checks and rollback posture. The user executes the block while connected to `158.220.97.145` and returns the output for review before the next production step.

## Auxiliary workspace — Wandora

```text
server:          13.140.190.149
role:            auxiliary development/test machine
example checkout:/tmp/crmfisio
production:      NO
```

Wandora is not a MedicsPro production server.

`/tmp/crmfisio` on Wandora is an intentionally disposable assistant workspace. It may be used for:

- cloning/fetching `OARANHA/crmfisio`;
- inspecting branches, commits and diffs;
- editing candidate changes before publication;
- running npm/unit/integration tests;
- typecheck, lint and production build validation;
- static analysis;
- building SQL harnesses;
- disposable/local database tests when the database is explicitly non-production;
- preparing patches, PRs, documentation and rollout commands.

It must never be treated as the deployed MedicsPro instance or as evidence of production state.

## `/tmp/crmfisio` is ephemeral by design

`/tmp/crmfisio` is not a canonical checkout and is not persistent infrastructure.

It may disappear after cleanup/reboot and may be reset, recreated or discarded at any time. Therefore:

- GitHub is the source of truth for committed code and documentation;
- a local commit in `/tmp/crmfisio` is not canonical until published to GitHub;
- production state is never inferred from files or containers on Wandora;
- production secrets must not be copied into the temporary workspace merely to make a test pass;
- no production migration/deploy should be redirected to Wandora because the repository happens to be checked out there.

## Hard production boundary

Never run the following against Wandora and describe the result as MedicsPro production:

```text
production migration
production database repair
production RLS/RPC/schema mutation
Portainer MedicsPro stack mutation
frontend production redeploy
Supabase production restart/deploy
Edge Function production deployment
real production smoke
production validation sign-off
```

If a task reaches one of those actions, stop autonomous server execution and hand the exact commands to the user for execution on `158.220.97.145`.

## Standard production handoff

Use this sequence:

```text
GitHub / CI / PR
→ merge to an explicitly known SHA
→ prepare production prechecks
→ user connects to 158.220.97.145
→ assistant provides one controlled command block
→ user returns complete output
→ assistant validates output
→ next migration/deploy/verifier step only if safe
→ real smoke
→ documentation updated to VALIDADO EM PRODUÇÃO only after evidence exists
```

Do not send a long chain of irreversible commands ahead of evidence. Prefer small stop-on-error stages with explicit preconditions and postchecks.

## Server identity guard

Before a production-changing command block, make the target explicit in the instructions:

```text
EXPECTED TARGET: 158.220.97.145 — MedicsPro production
DO NOT RUN ON:    13.140.190.149 — Wandora auxiliary workspace
```

The user must be told when the next command changes production rather than merely inspecting it.

## Source-of-truth hierarchy

```text
GitHub OARANHA/crmfisio
  = canonical code/documentation history

158.220.97.145
  = real MedicsPro production runtime/state

13.140.190.149 / /tmp/crmfisio
  = disposable assistant workspace for analysis, implementation and tests
```

A green test/build on Wandora proves the candidate code under test. It does not prove production rollout. A merge to `main` proves repository state. It does not by itself prove migration/deploy or production behavior.
