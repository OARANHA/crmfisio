# MED-CRM-001 — Evidence

**Readback:** `OARANHA/crmfisio main@a0e8fd717302ddca3366d0fc6731a0ed2642269b`  
**Scope:** design-only; no runtime/VPS evidence required.

## E1 — Patient currently owns the mixed funnel field

`supabase-schema.sql`:

- `patients.funil_stage`;
- values `lead | avaliacao | tratamento | alta`;
- default `lead`;
- index by `clinic_id, funil_stage`.

Interpretation: current physical schema mixes pre-care/commercial language and patient care journey.

## E2 — Patient Registry creates every Patient as `lead`

`supabase-migrations/20260903_patient_registry_v2_polish.sql` explicitly inserts:

```text
funil_stage = 'lead'
status       = 'ativo'
```

Therefore existing Patient with `funil_stage='lead'` is not proof of an historical Commercial Lead.

This blocks automatic Patient→Lead backfill.

## E3 — Patient Journey is partly clinical authority

`patient_journey_events` is append-only to authenticated clients.

`transition_patient_journey()`:

- locks the Patient;
- requires reason;
- emits journey event;
- changes Patient stage/status;
- handles operational `lead→avaliacao`;
- handles clinical `avaliacao→tratamento`, `tratamento→alta`, `alta→tratamento`.

`20260909_clinical_authorization_reconciliation.sql` makes clinical transitions require same-transaction proof and clinical identity/capability.

Conclusion: `patient_journey_events` must not be repurposed as generic commercial Lead activity.

## E4 — Current CRM board is Patient-backed

`src/pages/Crm.tsx`:

- reads `usePatients()`;
- groups Patient by `funilStage`;
- displays NPS, churn/continuity and reactivation context;
- uses `setFunilStage()` for drag/advance.

This page mixes acquisition, care state, retention and satisfaction.

## E5 — There are two current stage mutation paths

Path A:

```text
Crm.tsx
→ patientContext.setFunilStage
→ repository.updatePatientStage
→ UPDATE patients.funil_stage
```

Path B:

```text
PatientJourneyControl
→ transition_patient_journey RPC
→ patient_journey_events
→ UPDATE patients.funil_stage
```

Migration 20260909 blocks direct authenticated clinical transitions without RPC proof, but non-clinical edits such as `lead→avaliacao` can still differ in side effects.

Conclusion: current writer parity is incomplete.

## E6 — Patient journey is consumed outside CRM

`ReceptionPatients.tsx`:

- filters Patient by `funilStage`;
- shows stage metadata;
- uses `PatientJourneyControl`.

`PatientCareCockpit.tsx` shows Patient journey context.

Therefore `funil_stage` cannot simply become Lead stage or be removed during Commercial Core foundation.

## E7 — Reception quick-create creates Patient prematurely

`ReceptionNewPatientModal` calls `addPatient()` and sends:

- administrative identity;
- fallback CPF when empty;
- `funilStage='lead'`;
- `status='ativo'`.

This is a strong candidate for future pre-clinical Contact/Lead flow.

It is not changed by the design-only slice.

## E8 — Appointment is Patient-bound

`supabase-schema.sql` has `appointments.paciente_id NOT NULL REFERENCES patients(id)`.

Therefore MED-CRM-001 V1 does not schedule a pre-patient Lead directly.

Evaluation scheduling requires explicit conversion/registration first.

## E9 — Current authorization baseline

Current product semantics:

- `crm.access` entitlement gates the CRM route;
- owner/admin/recep can mutate the operational CRM funnel;
- professional and financeiro have read-only CRM UI access;
- clinical authority is separate from CRM authority.

New Lead domain must preserve this separation.

## E10 — No dedicated Contact/Lead foundation found

Tree readback at the stated main SHA found no canonical:

- `contacts`;
- `crm_leads`;
- `crm_pipelines`;
- `crm_stages`;
- `crm_lead_activities`.

This is a snapshot claim, not eternal absence. Recheck before implementation.

## E11 — Product backlog already requires the separation

`TODO.md`, P2 CRM requires keeping the clinic commercial funnel separate from the clinical record.

MED-CRM-001 therefore implements an existing product direction rather than creating a parallel roadmap.

## E12 — Patient Registry predates the canonical professional cutover

The source migration and legacy verifier for Patient Registry V2 still contain the historical role vocabulary `fisio`.

The later professional-role verifier proves the clinic role model itself is canonicalized, but the Patient Registry verifier does not prove that this specific RPC body was reconciled.

Conclusion:

> Lead→Patient conversion must not blindly call/copy the old registry function. The implementation micro-slice must read the final replayed function definition and either reuse a reconciled core or first repair/refactor that boundary.

This is a prerequisite for conversion work, not a reason to expand the first schema-only micro-slice.

## Evidence limits

- No production database readback was necessary for design.
- No claim is made that the proposed schema exists.
- No provider proof is relevant yet.
- Function bodies must be re-read on the implementation branch because later migrations may replace older definitions.

## Production release proof — 2026-09-27

MED-CRM-001 is now **RELEASED** for its bounded backend scope.

Production target and database:

```text
host = 28server
container = supabase-db
image = supabase/postgres:17.6.1.136
```

Before rollout, the pinned production verifier failed with:

```text
commercial_core_table_missing:contacts
```

The first migration attempt failed closed on a pre-existing baseline gap:

```text
function public.update_updated_at_column() does not exist
```

Because the Core migration is explicitly transactional and was executed with `ON_ERROR_STOP=1`, immediate pinned readback proved rollback: `public.contacts` remained absent.

PR #529 then added the canonical additive reconciliation migration `20260927_updated_at_helper_reconciliation.sql`. In production:

```text
reconciliation migration = COMMIT
VERIFY UPDATED_AT HELPER RECONCILIATION OK
```

A read-only preflight proved the other external prerequisites present: `clinics`, `patients`, `profiles`, `audit_log`, `current_active_profile()`, `current_clinic_entitlement_allowed(text)`, `auth.uid()` and required columns.

The unchanged MED-CRM-001 migration was then staged from current canonical main and its SHA-256 was proved on the host and inside `supabase-db`:

```text
23c433e36e0513aeddc9eae8ba6c1c34ba7c17854d07c4f3a796c66e2f8c0331
```

The production apply completed through `COMMIT`. The pinned verifier SHA-256:

```text
da5f4bcfbd25c15fc2c654a59761e1fb9863e88608a65d57e6d44d8253913c8c
```

passed all 11 checks and returned:

```text
COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED
```

The verifier was run again after MED-CRM-002 rollout and remained green.

Release does not change the slice boundaries: Contact, Lead and Patient remain distinct; Patient Journey remains separate; no Board cutover, Lead→Patient conversion, Inbox, follow-up engine, provider authority, automation engine or Commercial AI is implied.
