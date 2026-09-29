# MED-CRM-010 — Handoff

## Current checkpoint

**Slice:** MED-CRM-010 — Pipeline / Stage Administration Contract V1  
**Status:** ANALYZED  
**Execution:** NOT AUTHORIZED  
**Canonical baseline used for discovery:** `main@ef4011f138585de71910ecbe6c1fa815208d0dee`  
**Branch:** `docs/med-crm-010-pipeline-stage-administration-analysis`  
**PR:** #562 — `docs(crm): analyze Pipeline/Stage Administration contract`

This slice exists because the four discovery gates identified a real configuration gap. Its existence does not authorize implementation.

## Gate status

```text
REAL NOW / PROVEN EVIDENCE       CLOSED FOR DISCOVERY
GAPS                             CLOSED FOR DISCOVERY
CAPABILITY AUTHORITY / REUSE     CLOSED FOR DISCOVERY
DECISION                         CLOSED: SELECT FOR DESIGN
SECOND ADVERSARIAL REVIEW        CLOSED: EXECUTION BLOCKED
EXECUTION                        NOT AUTHORIZED
VALIDATION                       DOCS/REPO EVIDENCE ONLY
DOCUMENTATION                    UPDATED; PR #562 STILL OPEN
```

## Proven design direction

Reuse:
- Pipeline/Stage schema;
- current read projections;
- `crm.access`;
- active-profile tenant derivation;
- `audit_log`;
- raw table closure.

Do not directly reuse:
- `crm_current_mutator_clinic_id()` for admin writes, because it includes `recep`.

Future admin authority, if approved:
- owner/admin only;
- current clinic derived server-side;
- same `crm.access`;
- SECURITY DEFINER + explicit search_path;
- no Patient authority;
- no raw browser DML;
- audit configuration mutations.

## Blocking decisions before implementation

1. Pipeline archive with referenced Leads.
2. Stage archive with referenced Leads.
3. exactly-one/default transfer semantics.
4. atomic usable Pipeline creation vs draft lifecycle.
5. Stage kind mutability.
6. atomic/concurrency-safe reorder.
7. archive/restore/delete lifecycle.

Do not implement until these are explicitly resolved and the adversarial review is repeated.

## Runtime note

The production readback target is correctly restricted to hash-pinned verifiers. No ad-hoc SQL or operator bypass was used for this discovery.

## Prompt-generation revalidation — 2026-09-28

The next-chat handoff was revalidated against GitHub rather than inherited from chat memory.

Before this HANDOFF refresh:

- `origin/main` resolved through the PR compare baseline to `ef4011f138585de71910ecbe6c1fa815208d0dee`;
- PR #562 was OPEN, not merged and not draft;
- exact PR HEAD was `2213776d15aefb09189c3838e4b77d4947720f60`;
- compare against `main`: 8 ahead / 0 behind;
- changed files were exactly six documentation files:
  - `docs/CURRENT_STATE.md`;
  - `docs/SLICE_LEDGER.md`;
  - `docs/slices/MED-CRM-010/DECISION.md`;
  - `docs/slices/MED-CRM-010/EVIDENCE.md`;
  - `docs/slices/MED-CRM-010/HANDOFF.md`;
  - `docs/slices/MED-CRM-010/README.md`;
- reviews: 0;
- review threads: 0;
- combined commit statuses: none;
- 20 associated workflow runs existed on that exact HEAD;
- at the latest pre-refresh readback, 9/20 were completed/success, 2 were in progress and 9 were queued;
- no completed workflow had a non-success conclusion;
- GitHub reported `mergeable=false` while checks were still unsettled.

Therefore PR #562 was **not GREEN** and was **not merged**. No merge should be forced or inferred from the docs-only diff.

This HANDOFF refresh itself moves the PR HEAD. Consequently every next chat must re-read the exact current PR HEAD and its checks; the workflow counts above are historical evidence for the pre-refresh HEAD only.

## Next safe gate

1. Reconstruct REAL NOW from `origin/main` and the exact current HEAD of PR #562.
2. Verify state/base/HEAD, ahead-behind, full diff/file set, reviews, review threads and all workflows/checks for that exact HEAD.
3. If and only if the current HEAD is docs-only, 0 behind, mergeable, all required/associated checks are completed successfully and there is no review/thread blocker, protected-squash-merge PR #562 using `expected_head_sha`.
4. Confirm `merged=true` and resolve the resulting `main` SHA. Do not label MED-CRM-010 PROVED or RELEASED; it remains ANALYZED.
5. Re-read the MED-CRM-010 docs from the integrated `main`.
6. Then perform a **Product Contract Review** limited to the seven blocking semantics above.
7. Convert approved semantics into exact owner/admin-only command contracts, locking/idempotency behavior and behavioral/verifier tests.
8. Repeat SECOND ADVERSARIAL REVIEW before any migration/RPC/frontend implementation is authorized.

No code, schema or production mutation is authorized by this handoff.
