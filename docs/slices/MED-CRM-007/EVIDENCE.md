# MED-CRM-007 — Evidence

**Checkpoint:** 2026-09-27  
**Canonical repository:** `OARANHA/crmfisio`  
**Audited main:** `7e04f9d4c3bc84e95d90b7ad1ef2a15d02632120`

## Repository checkpoint

Fresh readback before creating this slice:

- `main = 7e04f9d4c3bc84e95d90b7ad1ef2a15d02632120`;
- that commit is `docs: close MED-CRM-006 after production readback (#549)`;
- MED-CRM-001..006 are recorded as RELEASED in `docs/SLICE_LEDGER.md`;
- no `MED-CRM-007` branch, PR or slice document existed before this design branch;
- historical PR #525 remains open, non-mergeable and based on an old MED-CRM-002-era main; it is not current authority.

## Existing Commercial CRM authority

Canonical Core migration proves these existing structures/functions:

- `contacts`;
- `crm_pipelines`;
- `crm_stages`;
- `crm_leads`;
- `crm_lead_activities`;
- `crm_current_reader_clinic_id()`;
- `list_current_clinic_crm_pipelines()`;
- `list_current_clinic_crm_stages(uuid)`;
- `list_current_clinic_crm_leads()`;
- `list_current_clinic_crm_lead_activities(uuid)`.

The reader guard requires:

- authenticated user;
- active current profile;
- current clinic;
- role in owner/admin/professional/recep/financeiro;
- `crm.access`.

The activity read function validates that the requested non-deleted Lead belongs to the current clinic before returning its activity rows.

## Existing proof

The Commercial Core verifier checks that:

- raw browser privileges over Commercial Core tables are closed;
- read projections are authenticated-only SECURITY DEFINER functions;
- `list_current_clinic_crm_lead_activities(uuid)` is part of that protected read surface.

The Core behavior cases include:

- successful current-tenant activity read;
- cross-tenant activity read rejection;
- raw authenticated DML rejection.

Command/identity slices already emit operational activities:

- Lead create -> `lead_created`;
- Lead stage transition -> `stage_changed`;
- Contact Identity Resolution -> `contact_identity_resolved`.

Separate `audit_log` entries remain the audit trail.

## Frontend gap evidence

Current `src/lib/commercialCrm.ts` exposes pipelines, stages, Leads, identity candidate/resolution and stage-transition adapters, but no adapter for `list_current_clinic_crm_lead_activities(uuid)`.

Current `CommercialCrmBoard` does not consume or render the canonical Lead activity timeline.

## Runtime observation

Production frontend readback on 2026-09-27 observed:

- entry: `/assets/index-BYMym6it.js`;
- CRM chunk: `/assets/CrmOperational-6R-i_o-S.js`;
- `list_current_clinic_crm_contact_identity_candidates` PRESENT;
- `resolve_current_clinic_crm_prospect_identity` PRESENT;
- `Repetir mesma tentativa` PRESENT;
- `list_current_clinic_crm_lead_activities` ABSENT;
- old direct Prospect Intake writers absent;
- `/`, `/crm`, `/agenda`, `/pacientes` returned HTTP 200.

This runtime evidence proves the timeline is not currently wired into the live frontend. It does not by itself replace the previously recorded backend release/verifier evidence.

## Doctrine alignment

Institutional doctrine requires:

- Commercial timeline != clinical history;
- audit technical trail does not replace operator-visible domain history;
- a feature must reuse canonical authority instead of gaining authority by convenience;
- tenant remains server-side;
- `Contact != Lead != Patient`.

MED-CRM-007 follows those rules by exposing an existing read projection only.

## Second adversarial review

The first advisory review requested deeper review because a generic activity payload could become an accidental information-exposure surface.

The deterministic review therefore narrowed the design:

- no raw metadata renderer;
- no internal UUID presentation;
- no Contact phone/e-mail reconstruction;
- no `candidate_ids` presentation;
- no Patient link/data;
- no actor UUID presentation;
- unknown activity types fail to a neutral label;
- stage IDs may be resolved only against the already-loaded canonical CRM stage projection;
- no writer is added.

After those constraints, the advisory second pass returned a proceed-fast route with strong probability. Advisory output is supporting evidence only; deterministic repository/domain boundaries remain authority.

## Evidence limitations

This design checkpoint does **not** claim:

- implementation exists;
- CI for MED-CRM-007 has passed;
- frontend rollout occurred;
- authenticated timeline UX was smoked;
- backend schema/RPC changed;
- production database was modified.

Status remains `DESIGNED`.


## Implementation checkpoint

After design PR #550 merged as `main@b8f7943960254ba33ec036a4462c6b2683367289`, the repository and active CRM PR state were reconstructed again. No material product authority changed, so the previously closed four gates remained valid and execution started on:

`feat/med-crm-007-lead-activity-timeline`

Implementation PR: `#551 — feat: add MED-CRM-007 lead activity timeline`

Current implementation scope:

- `src/lib/commercialCrm.ts`: adds `listCurrentClinicCrmLeadActivities(leadId)` using only the RELEASED `list_current_clinic_crm_lead_activities(uuid)` RPC;
- the adapter drops raw `metadata`, `actor_id`/actor identity, Contact candidate identifiers/signals and Patient data instead of forwarding the generic server envelope to UI;
- only stage transition IDs needed for local stage-name resolution and the bounded identity `resolution_mode` survive the adapter projection;
- `CommercialCrmBoard` loads timeline rows on demand for the selected Lead rather than preloading every Lead history;
- known `lead_created`, `stage_changed` and `contact_identity_resolved` events render bounded copy;
- unknown activity types render only `Atividade comercial registrada.`;
- loading, empty, error/retry and anonymized-Contact behavior are covered by focused tests;
- the frontend boundary test now pins the activity RPC and rejects raw-table/Patient/metadata authority drift.

No migration, backend RPC, table, RLS/RBAC, role, entitlement, tenant source, audit path or runtime mutation is part of this checkpoint.

### Repository validation

PR #551 exact HEAD:

`6714ed5672fa2b08934ce7538fbab016d3d2f8f7`

GitHub Actions readback on that exact HEAD returned:

```text
20 success
0 failure
0 queued
0 in_progress
```

The PR was then squash-merged as:

`main@7f1eda9631407ac8ddaa6fae4c87c293db024945`

The merged diff contains only the bounded frontend adapter/UI, focused tests and slice documentation. It adds no SQL, migration, backend RPC, RLS/RBAC, role, entitlement, tenant source, audit writer or Patient/clinical authority.

This is sufficient repository evidence for `PROVED + MERGED`.

### Post-merge runtime readback

The first governed production readback immediately after #551 merged still returned the prior entry:

`/assets/index-BYMym6it.js`

That correctly prevented an early RELEASED claim.

A later governed readback then observed the frontend rollout:

- entry: `/assets/index-DLkUkW9i.js`;
- CRM chunk: `/assets/CrmOperational-foLfVbZu.js`;
- `list_current_clinic_crm_lead_activities`: PRESENT;
- `list_current_clinic_crm_contact_identity_candidates`: PRESENT;
- `resolve_current_clinic_crm_prospect_identity`: PRESENT;
- `Atividade comercial registrada`: PRESENT;
- `Ver histórico`: PRESENT;
- old direct Prospect writers `create_current_clinic_crm_contact` and `create_current_clinic_crm_lead`: ABSENT;
- direct `.from("crm_lead_activities")` / `.from('crm_lead_activities')`: ABSENT;
- `candidate_ids`, `actor_id`, `p_patient_id`, `create_patient`: ABSENT;
- `/`, `/crm`, `/agenda`, `/pacientes`: HTTP 200.

The broader CRM lazy chunk still contains a `/pacientes/` string because `Crm.tsx` already composes separate Patient-domain NPS/churn content. Repository boundary tests prove `CommercialCrmBoard` itself does not introduce Patient navigation, while the timeline adapter drops Patient data from the activity projection.

No backend/database rollout was required for MED-CRM-007 because the activity RPC was already RELEASED before this slice.

### Release conclusion

MED-CRM-007 is **RELEASED** based on:

- exact-head repository proof: 20/20 successful workflows on `6714ed5672fa2b08934ce7538fbab016d3d2f8f7`;
- squash merge: `main@7f1eda9631407ac8ddaa6fae4c87c293db024945`;
- live production frontend rollout observation;
- live CRM marker/boundary readback;
- baseline public route health.

No authenticated human timeline interaction was executed in this release readback, and none is claimed. No production data mutation was needed.
