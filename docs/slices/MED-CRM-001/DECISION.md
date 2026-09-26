# MED-CRM-001 — Decision

## Decision status

**DESIGNED / not implemented**

## 1. Domain model

### Contact

Neutral tenant identity used before or beside a clinical Patient.

Proposed minimum:

```text
contacts
- id uuid
- clinic_id uuid
- name text
- phone text?
- phone_normalized text?
- email text?
- email_normalized text?
- patient_id uuid?        -- optional link, never ownership
- source text?
- source_metadata jsonb
- anonymized_at timestamptz?
- deleted_at timestamptz?
- created_at / updated_at
```

Rules:

- one Contact may have many Leads;
- one Patient may be linked to at most one active Contact in a clinic;
- Patient may exist without Contact;
- phone/email are matching signals, not unique identity;
- no implicit merge by phone/email;
- no clinical fields.

### Pipeline / Stage

```text
crm_pipelines
- id
- clinic_id
- name
- is_default
- archived_at
- timestamps

crm_stages
- id
- clinic_id
- pipeline_id
- name
- position
- stage_kind: open | won | lost
- archived_at
- timestamps
```

`stage_kind` is the single source of Lead outcome state.

Do not add a second mutable `crm_leads.status` that can drift from stage.

### Lead

```text
crm_leads
- id
- clinic_id
- contact_id
- pipeline_id
- stage_id
- owner_id?
- value_cents?
- source?
- source_metadata jsonb
- lost_reason_code?
- lost_reason_detail?
- closed_at?
- converted_patient_id?
- converted_at?
- created_at / updated_at
```

Rules:

- Lead is an opportunity, not the person;
- Contact may have multiple Leads over time;
- lost reason required when entering a `lost` stage;
- conversion link does not grant CRM clinical reads;
- multiple historical Leads may link to the same Patient.

### Commercial activity

```text
crm_lead_activities
- id
- clinic_id
- lead_id
- activity_type
- actor_id?
- actor_kind
- metadata jsonb
- created_at
```

Append-only to normal application actors.

This is operational/commercial history, never clinical record.

## 2. Authority

| Domain/effect | Authority |
| --- | --- |
| clinic identity | current authenticated tenant boundary |
| Contact | neutral tenant identity foundation |
| Lead/Pipeline/Stage | Commercial Core |
| Patient | Patient Registry / clinical product |
| Patient Journey | Patient journey boundary |
| Appointment | Agenda |
| Clinical record | Encounter/EHR |
| WhatsApp/provider | communication boundary |

## 3. Access model

### Browser reads

Do not make raw Contact PII a generic table API merely because future modules may need Contact.

CRM uses safe read projections/RPCs guarded by current clinic, `crm.access` and current role/read contract.

Future Inbox/Channel reuses the same Contact through its own authorized projection.

### Mutations

Authenticated browser direct INSERT/UPDATE/DELETE on Lead core tables: **deny**.

Canonical operations derive clinic server-side.

Proposed operation family:

```text
crm_create_contact
crm_create_lead
crm_move_lead_stage
crm_mark_lead_lost
crm_convert_lead_to_patient
```

Pipeline configuration uses separate owner/admin operations.

Future UI/API/MCP/AI/automation call the same domain operations.

## 4. Mutation side effects

Every significant Lead mutation writes, atomically where applicable:

1. domain state;
2. `crm_lead_activities`;
3. technical audit using the existing MedicsPro audit authority;
4. future domain event through the same writer when MED-EVENT exists.

No alternate writer may skip these effects.

## 5. Lead → Patient conversion

Conversion has two valid modes.

### Link existing Patient

Validate same clinic, Patient eligibility, Contact linkage and prior conversion state, then link Contact + Lead to Patient atomically.

### Create new Patient

Do not duplicate Patient validation.

Implementation must refactor/reuse the canonical Patient Registry core:

```text
create_patient_registry_v2
                 ↘
              patient registry core
                 ↗
crm_convert_lead_to_patient
```

The core remains private/ungranted; public wrappers enforce their own authority.

Retry behavior:

- same Lead → same Patient result: idempotent success;
- second conversion to different Patient: fail closed;
- partial Patient without Lead linkage cannot be committed by the conversion transaction.

Conversion does **not** automatically change Patient `funil_stage`.

## 6. Existing data

No automatic Patient→Lead backfill.

Reasons:

- Patient Registry itself created every Patient as `lead`;
- historical Patient stages mix operational and clinical semantics;
- fabricating Leads would create fake acquisition timestamps/source/pipeline history.

Existing Patient can enter Commercial Core only by an explicit operation that creates/resolves Contact and creates a real Lead.

## 7. Patient Journey compatibility

Keep `patients.funil_stage`, `patient_journey_events` and `transition_patient_journey`.

After CRM cutover:

- `/crm` no longer mutates Patient stage as commercial pipeline;
- Patient journey UI continues through its canonical boundary;
- generic direct `setFunilStage` must not remain a commercial writer.

A later Patient Journey slice may rename/deprecate the legacy `lead` patient stage. MED-CRM-001 does not invent that replacement.

## 8. Appointment compatibility

Appointment remains Patient-bound.

V1 rule:

> Pre-patient Lead must convert/register before first appointment is created.

Lead→Appointment without Patient is explicitly deferred to a future Agenda/Acquisition decision.

## 9. LGPD / lifecycle

Contact/Lead adds a new PII domain and must join the existing data-subject lifecycle.

Implementation requirements:

- Contact soft-delete/anonymization;
- scrub identity fields and re-identifying source metadata when anonymized;
- preserve only non-identifying audit/history required by product/legal policy;
- Patient export/anonymization must discover linked Contact/Lead data and apply the canonical policy;
- no Patient clinical payload copied into Contact/Lead;
- no cascade deletion that destroys commercial audit unpredictably.

This must have verifier/tests before release.

## 10. Default pipeline

A new clinic may receive a generic, configurable starter pipeline.

Do not seed specialty-specific stages.

Suggested semantics are generic only:

```text
Novo
Contato iniciado
Interessado
Avaliação a agendar
Convertido        [won]
Perdido           [lost]
```

Names remain clinic-configurable. The semantic source for outcome is `stage_kind`.

## 11. Deliberate non-links

```text
Contact/Lead -X-> EHR content
CRM          -X-> CID/evolution/clinical documents by convenience
Lead create  -X-> implicit Patient
provider     -X-> domain authority
pipeline     -X-> Patient Journey authority
Patient      -X-> mandatory Contact dependency
phone/email  -X-> automatic identity merge
```

## 12. Implementation sequence

1. schema + RLS/ACL/projections + verifiers;
2. canonical Contact/Lead mutation RPCs;
3. default/configurable pipeline;
4. conversion/refactor Patient Registry core;
5. CRM UI cutover;
6. reception prospect flow;
7. patient journey writer cleanup;
8. Event/Inbox/Acquisition integration in later slices.

Do not combine all eight in one PR.

## 13. Reconsider if

Reopen this decision if evidence shows:

- Inbox/WhatsApp needs a materially different canonical identity model;
- Appointment must support pre-patient booking as a near-term business requirement;
- LGPD/legal retention requires different Contact↔Patient lifecycle;
- multi-person/household identity proves one Contact↔one Patient link inadequate;
- current Patient Registry boundary cannot be safely refactored without a dedicated foundation slice.
