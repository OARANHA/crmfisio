# MED-CRM-006 — Handoff

## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

Audited base before this documentation slice:

`main@7c5673d43262ef3a0681d3a916d554bcc9627f71`

Branch:

`docs/med-crm-006-contact-identity-resolution`

Status:

`DESIGNED / EXECUTION NOT STARTED`

Revalidate all mutable values before acting.

## What is closed

The Contact Identity Resolution architecture/design contract is closed enough to formalize MED-CRM-006:

- Contact identity resolution is distinct from Contact edit and destructive merge/dedupe;
- phone/email are matching signals, not unique identity keys;
- canonical normalization lives server-side;
- storage normalization and match equivalence remain separate;
- candidate lookup is current-clinic and writer-scoped;
- Patient identity/data are excluded from candidate input/output/ranking;
- candidate preview is not final authority;
- final authority is one narrow transactional orchestration command;
- orchestration composes existing Contact/Lead authorities rather than replacing them;
- concurrency uses deterministic transaction-scoped signal locking + server-side recheck;
- ambiguity is human-explicit;
- `explicit_reuse` means create a new Lead for an existing Contact;
- `explicit_distinct` requires an explicit reason;
- caller-supplied UUID retry semantics from MED-CRM-002/005 must be preserved;
- resolution side effects reuse `crm_lead_activities` and `audit_log` without raw PII.

## What is not authorized

Do not start implementation directly from this handoff.

Still forbidden until the next implementation-plan review closes:

- writing a follow-up migration;
- adding RPCs/helpers;
- changing frontend;
- changing runtime/production;
- merge/dedupe;
- Contact edit/lifecycle commands;
- Patient matching or Lead→Patient conversion;
- UNIQUE constraints on phone/email normalized columns;
- provider/WhatsApp identity as Contact authority;
- new role, entitlement, tenant source or parallel audit mechanism.

## Next gate — IMPLEMENTATION PLAN REVIEW

Before EXECUTION, revalidate `origin/main`, this branch/PR, checks and all relevant CRM migrations/tests.

Then close the exact implementation plan for:

1. follow-up migration filename/order;
2. canonical normalization helper signatures;
3. exact BR phone normalization and legacy-match variant semantics;
4. exact email normalization helper;
5. candidate projection function signature and returned fields;
6. orchestration command signature;
7. explicit resolution-mode input contract;
8. candidate recheck semantics;
9. advisory-lock key derivation and deterministic ordering;
10. same-UUID retry/self-candidate behavior;
11. `explicit_distinct` reason validation;
12. resolution activity/audit metadata;
13. structural verifier additions;
14. PostgreSQL behavioral cases;
15. frontend/API adapter changes only after backend authority is PROVED.

## Required adversarial questions before EXECUTION

- Can two different UUIDs for the same normalized signal still create two Contacts?
- Can phone and email conflict across two Contacts without an explicit error?
- Can lock ordering deadlock when two requests carry phone + email in inverse input order?
- Can a no-signal request accidentally acquire a shared/global lock?
- Can a retry after successful create be mistaken for ambiguity?
- Can candidate lookup reveal anonymized/deleted history?
- Can Patient linkage appear in input/output/logs?
- Can professional/financeiro reach the identity-resolution lookup?
- Can the browser bypass the final resolution command and recreate the race?
- Can audit/activity leak raw phone/email?
- Can the new orchestration become a second generic Contact/Lead authority?

If any answer is unsafe or unproved, return to the relevant gate.

## Expected implementation validation

At minimum:

- exact phone candidate;
- exact email candidate;
- BR 9th-digit variant candidate;
- zero/one/multiple candidate semantics;
- phone→A + email→B conflict;
- explicit reuse;
- explicit distinct with reason;
- explicit distinct without reason rejected;
- same UUID exact retry idempotent;
- same UUID divergent retry rejected;
- different UUID same signal concurrent race serialized;
- deterministic two-signal lock order;
- different tenant does not interfere;
- no-signal path has no global lock;
- anonymized/deleted excluded;
- Patient absent;
- existing Contact/Lead command regressions remain green;
- activity/audit exactly once;
- PostgreSQL 16/17 proof if still required by current repository policy.

## Documentation state

This slice should contain:

- `README.md` — scope/method/current state;
- `DECISION.md` — normative design decision;
- `EVIDENCE.md` — measured proof and limitations;
- `HANDOFF.md` — continuity and next exact gate.

The ledger must record MED-CRM-006 as `DESIGNED`, not IMPLEMENTING.

## Next exact step

Finish this docs-only PR, validate its current HEAD, and merge only if the documentation remains coherent and checks are green. After integration, reconstruct current state again and perform the implementation-plan review before any product/runtime execution.
