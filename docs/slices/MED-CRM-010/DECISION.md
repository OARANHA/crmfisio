# MED-CRM-010 — Decision

**Status:** ANALYZED  
**Execution authorized:** NO  
**Baseline:** `main@ef4011f138585de71910ecbe6c1fa815208d0dee`  
**Date:** 2026-09-28

## Decision statement

Create an identifiable next slice for **Pipeline / Stage Administration Contract V1**, but keep it at `ANALYZED`.

The proven problem is not missing schema or missing reads. It is the absence of a safe, clinic-admin mutation authority for configuration that the current Commercial CRM already consumes.

## Candidate comparison

| Candidate | Proven current gap | Reuse available | New authority required | Current decision |
| --- | --- | --- | --- | --- |
| Pipeline/Stage admin | modeled/read/used, but not safely configurable | high: schema, projections, entitlement, Board, audit pattern | owner/admin config commands | **SELECT FOR DESIGN** |
| Lost reason taxonomy | free-form loss exists, structured catalog absent | stage transition + loss fields | taxonomy/config/reporting | defer |
| Follow-up / next action | no canonical Lead task aggregate | limited; async reuse audit needed | task/time/ownership engine | defer |
| Inbox / Conversation | no Lead conversation aggregate | Patient-oriented messaging cannot be reused by convenience | conversation/handoff authority | defer |
| Attribution | manual `source` only | Lead fields | acquisition/campaign chain | defer |
| Lead → Patient | no conversion command | Contact link + Patient registry separate | explicit clinical-boundary conversion | defer |

This is a current engineering/product decision, not a permanent roadmap ranking.

## Authority decision

### Existing read authority

Keep:
- `crm_current_reader_clinic_id()`;
- `list_current_clinic_crm_pipelines()`;
- `list_current_clinic_crm_stages(uuid)`;
- current reader roles + `crm.access`.

### Existing operational mutation authority

Do **not** use `crm_current_mutator_clinic_id()` as the configuration authority because it includes `recep`.

### Required future configuration authority

A future implementation may introduce a narrow internal CRM configuration guard only if it:
- derives tenant from the same canonical active-profile source;
- requires `crm.access`;
- permits owner/admin only;
- grants no platform_admin shortcut;
- remains internal, not a browser tenant-selection RPC.

That is a distinct capability boundary, not a duplicate tenant authority.

## Audit decision

Pipeline/Stage configuration changes should use the existing `audit_log`.

`crm_lead_activities` remains a Lead operational timeline. Do not emit Lead activities for configuration-only changes unless a future explicit operation also mutates Leads.

## Implementation blocker

No code until lifecycle/default/live-Lead/reorder semantics are resolved and a fresh adversarial review closes.
