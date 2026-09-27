# MED-CRM-007 — Decision

**Decision status:** DESIGNED  
**Baseline:** `OARANHA/crmfisio@7e04f9d4c3bc84e95d90b7ad1ef2a15d02632120`  
**Date:** 2026-09-27

## Decision statement

The next bounded Commercial CRM micro-slice is **Commercial Lead Activity Timeline V1**.

MED-CRM-007 will reuse the already-RELEASED per-Lead activity read authority and make it visible inside the Commercial CRM Board. It will not introduce a new activity store, writer, audit path or Patient/clinical authority.

## Why this candidate was selected

The current Commercial CRM already persists meaningful operational events, but the visible Board cannot show them.

That creates a concrete living-system gap:

```text
canonical commands
  -> crm_lead_activities
  -> existing current-clinic read RPC
  -> [missing frontend consumption]
  -> operator cannot inspect the commercial history in the Board
```

This candidate has high reuse and low authority expansion compared with competing next slices.

## Candidates considered

| Candidate | Existing authority reusable | New authority required | Scope/risk | Decision |
| --- | --- | --- | --- | --- |
| Lead Activity Timeline | high | no new writer | small / frontend | SELECT |
| Lead edit/qualification | partial | yes | medium | DEFER |
| Pipeline/Stage admin | schema only | yes | medium/high | DEFER |
| Lost-reason catalog/reporting | partial | likely | medium | DEFER |
| Lead follow-up / next action | low | yes | high | DEFER |
| Unified Inbox | partial channel foundations | yes | high | DEFER |
| Attribution | partial Lead fields | yes | medium/high | DEFER |
| Lead → Patient | Patient Registry exists | yes, cross-domain | high | DEFER |
| Commercial AI/automation | domain commands exist | yes, broader dependencies | high | DEFER |

The comparison is not a permanent product ranking. It is the decision for the next micro-slice under the current proved state.

## Architectural decision

V1 remains a read-only frontend integration if the existing RPC contract remains sufficient.

Authoritative flow:

```text
authenticated current user
  -> existing /crm module + crm.access gates
  -> CommercialCrmBoard
  -> frontend adapter
  -> list_current_clinic_crm_lead_activities(lead_id)
  -> crm_current_reader_clinic_id()
  -> current tenant / reader-role / crm.access enforcement
  -> crm_lead_activities
  -> bounded UI projection
```

The browser supplies the Lead identifier for the requested resource, but does not choose tenant authority. The RPC verifies the Lead inside the current clinic before returning the timeline.

## Presentation boundary

The RPC returns generic `metadata jsonb`, but V1 must not treat that as a generic UI payload.

The frontend renderer must be explicit and bounded:

- `lead_created`: human-readable creation event;
- `stage_changed`: human-readable stage transition, resolving known stage IDs against the already-loaded CRM stage projection;
- `contact_identity_resolved`: human-readable identity-resolution outcome without exposing raw Contact signals or internal candidate lists;
- unknown event type: neutral commercial-event label, no arbitrary metadata rendering.

This avoids turning a flexible persistence envelope into an accidental information-exposure API.

## Rejected alternatives

### Add a generic activity/note writer now

Rejected. There is no proved need to expand mutation authority merely to make existing system events visible.

### Build a new Lead history table

Rejected. `crm_lead_activities` is already the canonical operational timeline.

### Read `audit_log` as the timeline

Rejected. Audit and operational timeline serve different purposes. Audit remains the canonical audit trail; operator history uses the domain activity model.

### Merge Patient Journey into the timeline

Rejected. Commercial activity does not become clinical history. Patient/Encounter/clinical data remain under their own boundaries.

### Start follow-up/Inbox/automation first

Deferred. Those capabilities create new state, writers, ownership/consent/channel semantics or async dependencies. They should build on a visible, stable Commercial CRM operational history rather than bypass it.

## Rollback characteristic

Design-only checkpoint has no runtime rollback.

A future frontend implementation is expected to be reversible by reverting the frontend commit/deploy because it should introduce no schema or backend mutation contract.

## Reconsideration triggers

Return to fresh architecture gates if any of the following is discovered before/during implementation:

- current activity RPC is missing from actual backend runtime;
- current RPC cannot safely project the required known events;
- safe UX requires a new activity writer;
- actor identity/name requires a new authority contract;
- metadata contains information that cannot be safely projected using a narrow allowlist;
- the implementation would need Patient data;
- a competing active CRM slice appears in `main`/PR state;
- role/entitlement boundaries have changed.
