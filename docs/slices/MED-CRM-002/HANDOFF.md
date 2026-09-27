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

## Current release checkpoint

Mutable facts must still be re-read before the next action.

```text
repository checkpoint before this docs-only reconciliation:
main = 9ed72fa51b536a9efa8b35b910fbb49547daf7fa

PR #522 = MERGED
MED-CRM-001 = PROVED + MERGED + RELEASED

PR #524 = MERGED
MED-CRM-002 = PROVED + MERGED + RELEASED

PR #529 = MERGED
baseline reconciliation = RELEASED in production
```

Production evidence:

```text
host = 28server
PostgreSQL container = supabase-db
image = supabase/postgres:17.6.1.136

updated_at helper reconciliation:
VERIFY UPDATED_AT HELPER RECONCILIATION OK

Commercial Core:
COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED

Commercial Command Boundary:
COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED
```

Runtime authority:

- exact write actions used one-time approval-gated `medicspro-managed-admin`;
- verification used `medicspro-db-readback`;
- the readback target has only `postgres.pinned_readback`, with no generic Docker/process/write authority;
- verifier hashes are pinned server-side and execute in PostgreSQL read-only transactions.

## Current boundaries

Released backend authority is:

```text
Contact
→ Lead
→ crm_stages
→ current-clinic CRM projections/commands
```

Preserved boundaries:

- `Contact != Lead != Patient`;
- Patient Journey remains independent and continues to own `patients.funil_stage`;
- raw browser Commercial Core DML remains closed;
- `crm.access` + active profile + canonical role boundary remain authoritative;
- owner/admin/recep are writers; professional/financeiro remain read-only;
- no Lead→Patient conversion exists;
- no Inbox/follow-up/attribution/provider/automation/AI authority was added.

## Next exact gate

MED-CRM-002 is closed as a release slice. Do not add more behavior to it.

The leading known conflict is the legacy `/crm` board still backed by `Patient.funil_stage`, while the commercial backend is now released. A Board cutover is only a **candidate**.

Before creating or executing MED-CRM-003:

1. resolve current `origin/main`;
2. re-read open CRM PRs/branches, especially any stale design PR;
3. re-read `docs/slices/MED-CRM-001/NEXT_CAPABILITY_MAP.md`;
4. run **GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW** from current evidence;
5. only after those four gates may any next capability enter EXECUTION.

Do not infer that release of MED-CRM-001/002 authorizes Board/UI, pre-clinical intake, follow-up, Inbox, attribution, Lead→Patient conversion, automation or Commercial AI.

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
