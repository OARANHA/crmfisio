# MED-CRM-003 — Decision

**Status:** APPROVED DESIGN / execution not started
**Decision base:** `main@7a8badf5ad81e92746e82bedd142ba75899a4080`
**Date:** 2026-09-26

## Context

After #524, backend Commercial Core authority exists, but `src/pages/Crm.tsx` still presents Patient stage as the commercial funnel. Patient Journey is also consumed outside CRM and cannot be repurposed or deleted.

## Decision

MED-CRM-003 is a frontend-only Commercial Board V1:

```text
Commercial Core projections
→ /crm Lead board
→ existing stage-transition command
```

The board is a caller, never authority.

Patient Treatment Continuity, NPS and churn remain Patient-domain content.

## Why now

- retires the highest visible source-of-truth conflict;
- reuses #522/#524 instead of creating backend;
- low schema/clinical blast;
- makes the canonical command boundary operational;
- reduces duplication risk for later intake/follow-up/Inbox/analytics.

## Rejected / deferred

**Board + Lead creation:** rejected for this slice. Sequential Contact→Lead calls create a distinct partial-state/retry problem.

**Pre-clinical intake first:** deferred; changing when Patient identity exists has larger domain blast.

**Reuse `patients.funil_stage`:** rejected; conflicts with Contact != Lead != Patient.

**Raw CRM DML:** rejected; intentional denial remains.

**Pipeline admin/follow-up/Inbox/attribution/conversion/AI:** deferred as separate semantics.

## Authorization

`isOperationalRole(role)` may hide/show mutation controls only. Server RPC remains authoritative for tenant, active profile, role, `crm.access`, stage semantics, activity and audit.

Professional/financeiro remain read-only.

## Reconsider when

Re-open if `/crm` is already cut over, RPC contracts changed, route/permissions changed, the board proves it cannot remain frontend-only, or product first requires a canonical atomic Contact→Lead composition contract.
