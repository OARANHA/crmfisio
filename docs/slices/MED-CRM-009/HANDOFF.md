# MED-CRM-009 — Handoff

## Design checkpoint — 2026-09-28

Canonical repository:

`OARANHA/crmfisio`

Design baseline:

`1ff2825cfe5dd630ea16e4cfeda586ad390c3be7`

Slice:

`MED-CRM-009 — Commercial Lead Activity Read Boundary V1`

Current methodological state:

```text
GAPS                              CLOSED
CAPABILITY AUTHORITY / REUSE      CLOSED
DECISION                          CLOSED
SECOND ADVERSARIAL REVIEW         CLOSED
EXECUTION                         DESIGN/DOCS ONLY
PRODUCT IMPLEMENTATION            NOT STARTED
```

## Why this slice exists

The RELEASED activity RPC is tenant/entitlement protected but returns a generic persistence envelope to the authenticated browser.

That envelope includes actor identity and identity-resolution metadata not required by the Commercial Board. The MED-CRM-007 adapter removes those values only after they reach browser code.

The smallest safe correction is to harden the existing RPC projection server-side while keeping:

- the same activity table;
- the same reader guard;
- the same function identity/signature/row shape if implementation review confirms compatibility;
- the same activity writers;
- the same audit path;
- the existing frontend allowlist as defense in depth.

No parallel reader should be created merely for convenience.

## Next safe gate after this design PR

1. validate the exact HEAD of the design/docs PR;
2. merge only if docs-only scope, base, mergeability and all applicable checks are proved;
3. re-resolve `origin/main`;
4. re-read this slice from the integrated main;
5. search all current repository consumers of `list_current_clinic_crm_lead_activities(uuid)`;
6. close the exact implementation plan for a follow-up migration that preserves compatibility;
7. repeat adversarial review if any consumer/contract differs from this design;
8. only then create a fresh implementation branch.

Do not implement product/schema on the design branch.

## Implementation constraints

Expected direction:

- harden `list_current_clinic_crm_lead_activities(uuid)`;
- do not change canonical stored activity metadata;
- `actor_id` must not cross the browser read projection;
- stage activity metadata exposes only from/to stage IDs;
- identity-resolution metadata exposes only validated `resolution_mode`;
- other/unknown activity metadata fails closed to an empty object;
- tenant/RBAC/`crm.access` stay unchanged;
- no Patient authority;
- no new writer/table/audit/role/entitlement/tenant source;
- frontend sanitization stays as defense in depth.

## Competing candidates

Pipeline/Stage admin, lost-reason taxonomy/reporting, follow-up, Inbox/Conversation, attribution and Lead→Patient remain open candidate areas, but none is authorized by this slice.

Reconstruct them again after MED-CRM-009 is closed; do not inherit a roadmap order.

## JEV

JEV advisory review requested deep review:

```text
deep_review = 0.87
confidence = 0.82
```

Deterministic review, not JEV, closed the gate by narrowing the change to the existing read authority and preserving storage/writers/signature.

## Rule

Never declare MED-CRM-009 PROVED, MERGED or RELEASED from this design checkpoint.

If a future chat is generated, first revalidate `origin/main`, active branch/PR HEAD, checks and merge state, then update this HANDOFF.
