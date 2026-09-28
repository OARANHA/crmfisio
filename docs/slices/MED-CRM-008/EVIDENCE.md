# MED-CRM-008 — Evidence

## Production release proof — 2026-09-28

**Final bounded status: RELEASED.**

### Canonical repository revalidation

- canonical repository: `OARANHA/crmfisio`;
- production-release baseline revalidated as `main@ae58ba701717f4b9e41f8c95340cffae433f6b52`;
- implementation PR #554 is merged; exact final head `2e56256426994eebaa643bd6b1537053f51d22d7` completed 22/22 applicable workflows successfully before protected squash merge as `7fbd255d8bb60932cc3ee839f325f35ce7568e01`;
- documentation PR #555 is merged as `ae58ba701717f4b9e41f8c95340cffae433f6b52`;
- historical PR #525 remains open, unmerged and non-mergeable against an old base and is not current authority;
- no newer competing Lead-details writer was found before rollout.

### Exact production artifacts

Canonical migration:

`supabase-migrations/20260928_commercial_crm_lead_details.sql`

SHA-256:

`677494f6f48c9a5465c799bb677a9c139c9d6f93d5ec9ff8bc2ad4b3844a64f4`

Canonical verifier:

`supabase-verifiers/VERIFY_20260928_COMMERCIAL_CRM_LEAD_DETAILS.sql`

SHA-256:

`43afe4130ef7db4cca8a6bbeca0021d8472ce30abb973cc6b64d8b34733d6879`

Both hashes were derived from the current canonical main. The migration hash was independently matched again inside `supabase-db` before execution.

### Production pre-readback

The existing governed PostgreSQL readback channel was extended only by pinning the new verifier id/hash; generic PostgreSQL, Docker or process authority was not granted.

Before rollout the pinned MED-CRM-008 verifier reached the real production PostgreSQL and failed specifically with:

`crm_lead_details_function_missing`

Therefore the new RPC was proved absent before mutation.

### Governed rollout

The exact canonical migration was staged from current main into the operator workspace and copied to `supabase-db`.

The first in-container SHA-256 attempt as `postgres` failed with file `Permission denied`. No SQL had been executed. The specific staged file permission was changed to read-only-compatible `0644`, after which `postgres` returned the exact canonical SHA-256 shown above.

The approval-gated production apply then executed only the hash-proved file with `psql -w -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f ...`.

Observed result:

```text
BEGIN
CREATE FUNCTION
REVOKE
GRANT
COMMENT
COMMIT
```

Exit code was 0.

### Production verifier and regressions

The separate `medicspro-db-readback` target, which has only `postgres.pinned_readback`, returned:

`COMMERCIAL CRM LEAD DETAILS VERIFY PASSED`

The verifier proved:

- canonical command exists;
- authenticated-only ACL;
- SECURITY DEFINER with pinned search path;
- canonical tenant guard and Lead row lock;
- exact-retry/lifecycle/stale ordering;
- mutation surface limited to title/value/source;
- no Patient authority;
- bounded activity/audit path;
- `lead_updated_at` optimistic-concurrency projection;
- raw authenticated `UPDATE crm_leads` remains closed.

Post-rollout released regressions also passed:

- `COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED`;
- `COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED`;
- `COMMERCIAL CRM ARCHIVED PIPELINE TRANSITION GUARD VERIFY PASSED`;
- `COMMERCIAL CRM CONTACT IDENTITY RESOLUTION VERIFY PASSED`.

### Served frontend and smoke

After backend rollout, production served:

- entry: `/assets/index-DKx3td63.js`;
- CRM chunk: `/assets/CrmOperational-BBRV2_h_.js`;
- observed Last-Modified for both: `Mon, 28 Sep 2026 04:25:26 GMT`.

The served CRM chunk contains:

- `update_current_clinic_crm_lead_details`;
- `Editar detalhes`;
- `Salvar detalhes`;
- `crm_lead_details_stale`;
- explicit stale/refetch copy;
- released activity read and canonical stage transition markers.

The served CRM chunk does not contain:

- `setFunilStage`;
- `create_patient`;
- `addPatient`;
- direct `.from("crm_leads")` writer markers.

Public post-rollout smoke:

```text
/          200
/crm       200
/agenda    200
/pacientes 200
```

### Release conclusion

The release proof combines repository/CI evidence, exact canonical artifact hashes, pre-rollout absence proof, approval-gated transactional backend rollout, pinned production verifier and released CRM regressions, served frontend readback and public route health.

No authenticated human edit against real production data was performed. No destructive or business-data mutation was used merely as a release probe.

Preserved invariant:

`Contact != Lead != Patient`

No owner assignment, Contact mutation, Patient mutation/creation, pipeline/stage administration, Lead→Patient conversion, follow-up, Inbox, attribution, provider, automation or AI authority was introduced.

**MED-CRM-008 is RELEASED and closed. MED-CRM-009 is not started by this closure.**



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

The selected slice can remain entirely inside Commercial CRM if it updates only `title/value_cents/source` through the existing mutator guard and keeps all other entity/lifecycle fields immutable. The current Board already treats archived pipeline/stage Leads as legacy read-only and suppresses identifiable Lead title/Contact PII after Contact anonymization; the server mutation must preserve those semantics rather than relying on UI affordances.

Implementation-plan review also identified two direct-RPC bypass risks: editing a Lead whose Contact is anonymized/deleted, and editing a Lead currently in archived pipeline/stage despite the released Board presenting that state as read-only. The command contract therefore rejects both server-side.

Implementation-plan review additionally proved that `FOR UPDATE` alone is insufficient against stale full-form overwrites. The final design requires `lead_updated_at` as an optimistic-concurrency token after row lock, while exact desired-state retries remain side-effect-free no-ops.

No production mutation, schema rollout or human smoke is claimed by this design checkpoint.


## Implementation checkpoint — 2026-09-28

Fresh repository revalidation after implementation:

- docs-only design PR #553 was squash-merged into `main@4654bd95c4d1305754d44886c0d1fbad7fd59126`;
- implementation branch is `feat/med-crm-008-lead-commercial-details`;
- implementation PR is #554;
- exact implementation head validated before this documentation refresh: `eb58c09d7f9aeed99eef52f5d71304049b43e6cb`;
- that head was `0 behind` canonical main, mergeable, non-draft, with no reviews and no review threads;
- all 10 applicable pull-request workflows completed with `success`.

Server implementation evidence on that exact head:

- additive `public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text)`;
- tenant/role/entitlement authority reused from `crm_current_mutator_clinic_id()`;
- current-clinic non-deleted Lead locked `FOR UPDATE`;
- exact desired-state retry returns before privacy/archive/stale write guards and emits no duplicate evidence;
- real changes revalidate Contact, pipeline and stage under `FOR SHARE`;
- stale `expected_updated_at` fails explicitly with no overwrite;
- only `title`, `value_cents` and `source` are updated;
- `lead_details_updated` activity contains bounded `changed_fields` metadata only;
- `CRM_LEAD_DETAILS_UPDATED` audit contains Lead ID/change categories only;
- raw authenticated `UPDATE crm_leads` remains denied;
- Patient/Patient Journey stay untouched in behavior tests.

Validation evidence:

- `Commercial CRM Lead Details` workflow passed on PostgreSQL 16 and 17;
- its harness re-runs released Commercial Core, Command Boundary, Archived Pipeline Guard and Contact Identity Resolution verifiers/regressions, plus the Contact identity concurrency proof and MED-CRM-008 behavior cases;
- `Commercial CRM Contact Identity Resolution` remained green on the exact implementation head;
- `Clinical workflow CI` completed with success and its workflow runs `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`;
- Board tests prove writer/read-only role behavior, exact projection concurrency token usage, stale refetch without silent retry, no edit affordance for anonymized/legacy archived Leads, and bounded activity rendering.

Adversarial review:

- advisory JEV final review routed `deep_review` with low block probability;
- deterministic review retained the designed lock/idempotency ordering and found no competing Lead-details writer or authority expansion in the PR;
- `Contact != Lead != Patient` remains preserved.

This is source/CI evidence only. Production deployment and runtime readback are not claimed here.
