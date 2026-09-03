# MedicsPro — Assessment Engine

## Objective

Build a reusable clinical assessment platform that supports MedicsPro-provided templates and clinic/professional-created templates without fragmenting the clinical record into specialty-specific screens.

The engine must improve clinician speed, longitudinal comparison, clinical traceability and future extensibility while preserving tenant isolation, authorship and history.

This document is architectural guidance. It does not authorize destructive migration of existing clinical data.

---

## Product model

The canonical product concepts are:

1. **Avaliações padrão** — curated templates provided by MedicsPro.
2. **Minhas avaliações** — templates created by a clinic or, where permitted, a professional.
3. **Avaliação preenchida** — a clinical record created from a specific template version for a patient.
4. **Componentes clínicos** — reusable structured controls such as text, number, scale, choice, upload and body map.
5. **Histórico longitudinal** — patient timeline where assessments, evolutions and related clinical events can be compared over time.

A standard template may be duplicated into a clinic-owned copy and customized. The original standard template is never silently modified by a tenant.

---

## Current state and migration constraint

The existing clinical workspace currently persists assessments in `physiotherapy_evaluations` with a fixed shape composed of `anamnese`, `objetivos` and `plano_terapeutico`.

That table remains a valid legacy/canonical clinical source until an explicit migration path is implemented and verified.

Do not create a second patient assessment UI that ignores the existing `ClinicalWorkspace`. The new engine should progressively replace the fixed assessment tab behind the same clinical workflow.

The transition must be additive first:

1. introduce assessment templates and versioned assessment records;
2. keep existing physiotherapy assessments readable;
3. optionally map legacy records into a read-only legacy renderer or controlled migration;
4. only deprecate the old write path after production verification;
5. never silently discard or rewrite historical clinical records.

---

## Canonical data model direction

Prefer a small number of stable relational tables with structured JSON only where schema flexibility is genuinely useful.

### `assessment_templates`

Represents the identity of a reusable assessment model.

Minimum conceptual fields:

- `id`;
- `clinic_id` nullable only for MedicsPro-owned standard templates;
- `owner_type`: `platform` or `clinic`;
- `name`;
- `description`;
- `specialty` or applicability metadata;
- `status`: draft/active/archived;
- `created_by`;
- `created_at`;
- `updated_at`.

A clinic must never be able to mutate a platform-owned template.

### `assessment_template_versions`

Published assessments must point to an immutable template version so later template edits do not change the meaning of historical records.

Conceptual fields:

- `id`;
- `template_id`;
- `version`;
- `schema` JSONB containing ordered sections/components and validation metadata;
- `published_at`;
- `published_by`.

Once used by a finalized assessment, a version is immutable.

### `clinical_assessments`

Represents one assessment performed for one patient.

Conceptual fields:

- `id`;
- `clinic_id`;
- `patient_id`;
- `professional_id`;
- `appointment_id` nullable;
- `template_id`;
- `template_version_id`;
- `status`: draft/finalized/amended;
- `answers` JSONB;
- `started_at`;
- `finalized_at`;
- `created_at`;
- `updated_at`.

Finalized records must preserve authorship, timestamp and template version.

Corrections after finalization should use an amendment mechanism rather than destructive editing.

### `assessment_body_points`

Body-map observations deserve structured storage rather than being embedded only as pixels or free text.

Conceptual fields:

- `id`;
- `clinic_id`;
- `assessment_id`;
- `component_key`;
- `view`: front/back/left/right;
- normalized `x` and `y` coordinates;
- optional anatomical region;
- laterality when applicable;
- intensity, normally 0–10 when representing pain;
- symptom/type;
- note;
- created_at.

Normalized coordinates must be independent of the rendered image size.

---

## Component schema

The first useful version should support only components that cover most clinical forms:

- heading/section;
- short text;
- long text;
- integer/decimal number;
- scale, including configurable 0–10 EVA/NRS;
- single choice;
- multiple choice;
- yes/no;
- date;
- body map;
- attachment reference;
- informational text.

Avoid a generic low-code platform in V1. Complexity must pay rent.

Each component needs at minimum a stable key, label, type, required flag, help text where useful and validation/configuration appropriate to its type.

---

## Body map V1

The body map is a first-class clinical component.

V1 interaction:

1. clinician chooses front, back, left or right view;
2. clicks/taps a body location;
3. a compact editor opens;
4. clinician can record intensity 0–10, symptom/type and note;
5. the point is saved in normalized coordinates;
6. points remain visible on the assessment;
7. points can be edited or removed while the assessment is a draft.

V1 must be usable with mouse and touch.

Do not infer diagnoses from body-map points.

### Longitudinal comparison

The data model must allow future comparison of the same assessment/component over time, including changes in pain intensity and location.

This comparison is product differentiation, but it is not required to block V1 rollout.

---

## UX direction

The clinician should never feel as if they are configuring a database schema while treating a patient.

### During an appointment

The assessment experience should live inside the clinical workspace / atendimento em andamento context.

Recommended structure:

- patient and appointment context remains visible;
- quick access to last assessment and last evolution;
- selector for **Avaliações padrão** and **Minhas avaliações**;
- recently/frequently used templates surfaced first;
- assessment opens inline or in a focused workspace, not as a disconnected CRUD screen;
- autosave draft where safe;
- explicit finalization action;
- clear feedback that the finalized assessment entered the medical record.

### Template administration

Template creation belongs in clinical/settings administration, not mixed into the patient record.

The builder should use sections and ordered fields, with preview and duplication, but V1 should not become a full drag-and-drop low-code product unless real users prove that need.

---

## Permissions

UI visibility is not authorization.

Initial policy direction:

- `fisio`: read permitted clinical records and create/finalize assessments within authorized clinic scope;
- `owner`/`admin`: may manage clinic assessment templates where product policy allows, but administrative role alone must not imply authorship/signature of clinical acts;
- `recep`: no access to clinical assessment contents;
- `financeiro`: no access to clinical assessment contents;
- `platform_admin`: no implicit tenant clinical-data access.

Exact RLS and RPC rules must be implemented and tested server-side before the engine is considered production ready.

Platform standard-template management must be a separate platform operation from tenant clinical-data access.

---

## RLS / integrity requirements

Treat any cross-clinic access as P0.

Before production use, enforce at minimum:

- tenant isolation on template ownership where applicable;
- patient and professional belong to the same authorized clinic as the assessment;
- platform templates are readable to entitled tenants but not tenant-mutable;
- clinic templates cannot be read or changed by another tenant;
- finalized assessments cannot be silently overwritten;
- assessment versions referenced by historical records cannot be deleted destructively;
- body points inherit the assessment tenant and cannot be attached cross-tenant;
- authorization cannot depend only on frontend role checks.

Prefer server-side functions/constraints for integrity rules that span multiple tables.

---

## SaaS entitlement

Availability of the assessment engine and premium components should eventually be controlled separately from clinic RBAC.

Conceptually:

`platform entitlement -> clinic feature configuration -> user role/permission`

Examples:

- a plan may include standard assessments but not custom template building;
- a premium plan may enable custom templates, body-map comparison or advanced reports;
- the clinic owner may disable a feature available in the plan;
- individual users still require an authorized clinical role.

Do not encode plan names directly into clinical components.

---

## V1 — 80/20 delivery

The first production-usable slice should be deliberately small:

1. list **Avaliações padrão**;
2. list **Minhas avaliações**;
3. create/rename/archive a clinic template;
4. duplicate a standard template into a clinic template;
5. builder with the core component types;
6. fill an assessment from the patient clinical workspace;
7. draft save;
8. finalization with professional/timestamp/version;
9. body map with points + 0–10 intensity + note;
10. show finalized assessments in patient clinical history.

Do not block the pilot on advanced scoring formulas, AI, complex branching logic or specialty marketplaces.

---

## V1 acceptance criteria

A V1 is not complete merely because the screens render.

Minimum acceptance criteria:

- Clinic A cannot read or mutate Clinic B templates or assessments.
- Reception and finance roles cannot read clinical assessment payloads.
- A standard MedicsPro template cannot be modified by a tenant.
- Duplicating a standard template produces an independent clinic-owned template.
- A historical finalized assessment keeps the exact template version used at finalization.
- A professional can create a draft, leave the screen, return and continue without data loss.
- Finalization records professional identity and timestamp.
- A finalized record cannot be silently edited.
- Body points survive responsive layout changes because coordinates are normalized.
- Existing `physiotherapy_evaluations` remain readable during transition.
- The common flow can be completed comfortably between appointments.

---

## Future opportunities after pilot evidence

Only after the core flow is proven with clinicians:

- compare current vs previous assessment;
- visual trend of pain intensity/regions;
- validated clinical scales with scoring rules;
- specialty template packs;
- clinic template sharing/import-export with safeguards;
- structured outcome reports;
- voice-assisted draft capture;
- AI summarization and completeness assistance with human review;
- patient pre-assessment forms with explicit consent and clinician validation.

AI must never silently finalize or alter clinical records.

---

## Implementation sequence

Recommended sequence:

### Phase A — foundation

- define migration and RLS for templates, immutable versions and assessments;
- add domain types/services;
- add tests for tenant and role boundaries;
- keep legacy assessment path intact.

### Phase B — standard/custom templates

- minimal template administration;
- standard vs clinic ownership;
- duplication and publishing/versioning.

### Phase C — clinical use

- integrate template picker into `ClinicalWorkspace`;
- render core components;
- draft/finalize workflow;
- patient history.

### Phase D — body map

- reusable body-map component;
- structured body-point persistence;
- responsive/touch validation.

### Phase E — legacy transition

- controlled display/migration strategy for `physiotherapy_evaluations`;
- remove legacy write path only after verified parity and rollback planning.

---

## Competitive principle

The objective is not to reproduce legacy clinic software menus.

MedicsPro should combine:

- fast clinical documentation;
- structured longitudinal data;
- strong privacy and tenant isolation;
- flexible templates without low-code complexity;
- a premium, modern interaction model;
- operational integration with agenda, treatment continuity and finance where clinically appropriate.

The benchmark is not feature count. The benchmark is whether clinicians can document better and faster while clinic operators gain a safer and more coherent system.
