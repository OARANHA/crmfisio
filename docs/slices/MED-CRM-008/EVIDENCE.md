# MED-CRM-008 — Evidence

**Checkpoint:** 2026-09-27  
**Canonical repository:** `OARANHA/crmfisio`  
**Audited main:** `7b75b77c667b1c17b6eb408ee7047ad866e78a73`

## Repository state

Fresh GitHub reconstruction proved:

- current `main` is `7b75b77c667b1c17b6eb408ee7047ad866e78a73` (`docs: close MED-CRM-007 after production readback (#552)`);
- PR #552 is merged; its exact head was `40b761c1ee58cbe1e8ee3d8a01f3562f5befdc8f`;
- MED-CRM-001..007 are RELEASED in the current ledger;
- no MED-CRM-008 or newer CRM slice/PR existed before this design branch;
- PR #525 remains OPEN, unmerged and non-mergeable, based on the old `main@7a8badf5...`; it is historical evidence only.

Runtime was not re-read for this design decision because the question is which capability is missing from the canonical source/contract. MED-CRM-007 release/runtime evidence is already recorded in current institutional docs; no claim beyond that is added here.

## Current product evidence

`src/lib/commercialCrm.ts` projects these Lead fields:

- `title`;
- `valueCents`;
- `source`;
- server projection field `lead_updated_at` (currently not mapped by the typed adapter);
- `ownerId`;
- lost/closed fields;
- Contact/pipeline/stage context.

It currently exposes:

- pipeline/stage/Lead/activity reads;
- Prospect identity resolution;
- Contact/Lead creation adapters retained for released compatibility;
- stage transition.

It exposes no Lead-details update adapter.

`CommercialCrmBoard` currently:

- creates a prospect with Contact name, optional phone/e-mail, Lead title and pipeline;
- moves Lead through stages;
- collects free-text loss reason for the lost stage;
- shows bounded Lead history;
- does not expose editable Lead value/source/owner/detail form;
- does not administer pipeline/stage configuration.

## Server authority evidence

Commercial Core schema already owns:

- `crm_leads.title text NOT NULL`;
- `crm_leads.value_cents bigint` with non-negative constraint;
- `crm_leads.source text`;
- `crm_leads.owner_id`;
- Lead timestamps and terminal fields.

Current command boundary provides:

- `crm_current_mutator_clinic_id()` = active profile + owner/admin/recep + `crm.access`;
- `create_current_clinic_crm_lead(...)`, which already accepts title/value/source/owner on creation;
- `transition_current_clinic_crm_lead_stage(...)` as the separate canonical stage writer.

Raw browser INSERT/UPDATE/DELETE on Commercial CRM tables remain revoked. Behavioral tests explicitly prove direct authenticated `UPDATE crm_leads` is rejected.

`guard_crm_lead_semantics()` already validates:

- stage/terminal consistency;
- archived-stage mutation rules;
- owner belongs to an active profile in the same clinic.

## Candidate readiness evidence

### Lead commercial details

Strong evidence now: state already exists, read projection exists, no edit command/UI exists, and all relevant authorization/audit foundations are reusable. The existing Lead projection already returns `lead_updated_at`, so stale-edit protection can reuse the canonical row timestamp without adding a second version authority.

### Pipeline/Stage admin

Schema/read foundation exists but no command authority exists. Safe administration must define create/edit/archive/reorder/default behavior and effects on active Leads. Larger prerequisite surface.

### Lost reason/reporting

The stage RPC already supports `lost_reason_code + lost_reason_detail`, but current UI only sends detail. No canonical tenant loss-reason catalog was found. A client-side code list would create authority by convenience.

### Follow-up / next action

No current CRM commit/slice implementing follow-up was found. Deskcomm absorption explicitly positions follow-up after Event/Async + Conversation/channel boundaries; MedicsPro foundations must be re-audited before creating a Lead task engine.

### Inbox / Conversation

Messaging/outbox/provider foundations exist elsewhere, but current Commercial CRM has no proved Conversation authority. This requires a separate channel/identity/handoff reuse gate.

### Attribution

The Lead has `source/source_metadata`, but a true attribution capability needs acquisition identity/campaign/click/downstream conversion contracts. Manual `source` editing does not equal attribution.

### Lead → Patient

Doctrine requires explicit, auditable, idempotent conversion. It crosses from commercial opportunity to clinical identity and is not a safe incidental extension of the Board.

## Security/boundary conclusion

The selected slice can remain entirely inside Commercial CRM if it updates only `title/value_cents/source` through the existing mutator guard and keeps all other entity/lifecycle fields immutable.

Implementation-plan review additionally proved that `FOR UPDATE` alone is insufficient against stale full-form overwrites. The final design requires `lead_updated_at` as an optimistic-concurrency token after row lock, while exact desired-state retries remain side-effect-free no-ops.

No production mutation, schema rollout or human smoke is claimed by this design checkpoint.
