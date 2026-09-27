# MED-CRM-002 — Decision

## Problem

MED-CRM-001 created a safe read-only Commercial Core. Browser raw DML is deliberately closed. The product now needs a mutation boundary before any consumer can safely operate Contact/Lead.

## Chosen shape

### Internal authorization helper

A non-browser-executable helper resolves the active profile and enforces:

- authenticated user;
- active profile/clinic;
- role in `owner | admin | recep`;
- effective `crm.access`.

It returns the current clinic identifier for the command.

### Command 1 — create Contact

Conceptual contract:

```text
create_current_clinic_crm_contact(
  contact_id,
  name,
  phone?,
  email?
) → contact_id
```

Rules:

- caller supplies a UUID so an exact network retry can address the same aggregate;
- server derives clinic;
- name is required/trimmed;
- phone/e-mail are stored as supplied/trimmed signals;
- this slice does not define automatic normalization or dedupe;
- `patient_id` is always NULL;
- same ID + same contract = idempotent return;
- same ID + different contract = explicit idempotency conflict;
- successful first creation writes IDs-only audit.

### Command 2 — create Lead

Conceptual contract:

```text
create_current_clinic_crm_lead(
  lead_id,
  contact_id,
  title,
  pipeline_id?,
  stage_id?,
  owner_id?,
  value_cents?,
  source?
) → lead_id
```

Rules:

- Contact must be active and belong to current clinic;
- omitted pipeline resolves to current clinic active default;
- omitted stage resolves to first active open stage in the selected pipeline;
- selected initial stage must be active + `open`;
- terminal Lead cannot be created directly;
- source is an opaque optional label only; no attribution semantics;
- `source_metadata` remains empty in this slice;
- same ID + same contract = idempotent return;
- same ID + different contract = conflict;
- first creation emits `lead_created` activity and IDs-only audit.

### Command 3 — transition Lead stage

Conceptual contract:

```text
transition_current_clinic_crm_lead_stage(
  lead_id,
  to_stage_id,
  lost_reason_code?,
  lost_reason_detail?
) → (lead_id, from_stage_id, to_stage_id, stage_kind, closed_at)
```

Rules:

- lock Lead `FOR UPDATE`;
- Lead must belong to current clinic and be active;
- target stage must be active, same clinic and same current pipeline;
- target `open`: clear `closed_at` and lost reason;
- target `won`: set `closed_at=now()`, clear lost reason;
- target `lost`: set `closed_at=now()`, require a nonblank reason;
- exact replay to already-current stage with equivalent terminal contract is no-op;
- same-stage call with conflicting lost reason is explicit conflict;
- real transition emits exactly one `stage_changed` activity + audit.

## Why no generic CRUD

Generic CRUD would:

- expose more fields than current use cases need;
- make UI/API/AI side-effect parity harder;
- encourage callers to manage terminal semantics themselves;
- create a second authorization surface around tables that are intentionally closed.

Commands encode domain effects instead.

## Why no Event Core now

Existing MedicsPro already has outbox/automation/retry/reconciliation mechanics. This mutation slice needs a durable commercial activity and audit record, both already available.

Creating Event Core here would violate the reuse gate.

## Why no Patient link

Contact→Patient and Lead→Patient are lifecycle transitions with LGPD/clinical implications. They require a separate readback of Patient Registry and explicit conversion/idempotency design.

No command in this slice accepts `patient_id`.

## Reconsider when

Revisit this design if:

- a proven caller cannot use these commands without unsafe duplication;
- pipeline movement across pipelines becomes a real requirement;
- Contact edit/merge needs its own auditable lifecycle;
- system automation requires non-human actor provenance that cannot be represented safely with delegated authenticated context;
- an Event/Async Core reuse analysis proves a canonical event is required synchronously.
