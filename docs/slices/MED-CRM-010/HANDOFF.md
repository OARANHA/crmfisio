# MED-CRM-010 — Handoff

## Current checkpoint

**Slice:** MED-CRM-010 — Pipeline / Stage Administration Contract V1  
**Status:** ANALYZED  
**Execution:** NOT AUTHORIZED  
**Canonical baseline used for discovery:** `main@ef4011f138585de71910ecbe6c1fa815208d0dee`  
**Branch:** `docs/med-crm-010-pipeline-stage-administration-analysis`

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
DOCUMENTATION                    IN PROGRESS ON THIS BRANCH
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

## Next safe gate

Revalidate main + this branch/PR first.

Then perform a **Product Contract Review** limited to the seven blocking semantics above. Convert the result into exact command contracts and tests before any migration/RPC/UI branch is created.
