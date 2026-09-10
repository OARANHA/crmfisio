# Clinical Encounter Record

Status: canonical foundation for Mission #394. This document records the pre-implementation audit, domain contract, rollout and future production runbook. The implementation must preserve every existing clinical and financial boundary cited below.

## Purpose

A clinician records the consultation once. During the encounter, `clinical_encounter_records` is the mutable working draft. After explicit human confirmation, PostgreSQL deterministically materializes that draft into the existing canonical `physiotherapy_evolutions` artifact and finalizes the appointment in one transaction.

The Encounter Record is not a second finalized chart, a specialty-specific chart, a SOAP engine, or a replacement for Evolution. `physiotherapy_evolutions` remains the canonical finalized clinical artifact used by the longitudinal history and by the current appointment-finalization boundary.

## Pre-implementation audit on main@84d7307e528a126dcc19aee839972c6f4ffbb09a

The following contracts were confirmed before SQL implementation.

### A. Exact Evolution required before finalization

Yes. The current `require_evolution_before_finalize()` boundary requires an Evolution for the same clinic, patient, appointment/session and professional who owns the appointment. The UI guard in `canFinalizeEncounter()` is only a presentation guard; PostgreSQL remains authoritative.

### B. Evolution creation requires an active encounter

Yes. Current Evolution session linkage validates the linked appointment while it is `em_atendimento` and validates the clinic, patient and professional relationship. Therefore the #394 transaction must create the Evolution before changing the appointment to `finalizado`.

### C. Evolution provenance is immutable

Yes. Current self-authorship and session-linkage guards prevent reassignment of clinic, patient, professional, session/appointment and encounter date provenance. #394 must use those existing triggers rather than bypassing them.

### D. Clinical capabilities remain mandatory

Yes. `clinical.attend` and `clinical.evolution.write` are required by the current clinical authorization/finalization boundary and remain required for saving/finalizing an Encounter Record. Commercial entitlement never substitutes clinical authorization.

### E. Expected package-coverage failures remain clinically non-blocking

Yes. The financial finalization boundary handles `package_exhausted`, `package_expired` and `package_not_eligible` as expected coverage failures, records `appointment_financial_exception`, and permits the clinical appointment transition to remain finalized.

### F. Unexpected financial integrity failures remain fail-closed

Yes. Unexpected financial/ledger integrity failures are not swallowed by the current boundary. The #394 finalization RPC must not add a catch-all handler around the appointment status update; an unexpected exception must abort the whole transaction, including the generated Evolution and Encounter Record finalization.

## Current application boundaries audited

The #394 design was checked against:

- `ClinicalEncounterWorkspaceV4.tsx`
- `ClinicalWorkspaceV3.tsx`
- `ClinicalWorkspace.tsx`
- `clinicalEncounterUx.ts`
- clinical context/provider and `physiotherapy_evolutions`
- `repository.ts`
- `appointmentOperations.ts`
- `activeClinicalEncounter.ts`
- `professionalReference.ts`
- Evolution session linkage and self-authorship migrations
- require-Evolution-before-finalize migration
- multiprofessional clinical foundation
- Clinical Foundation Reconciliation
- Clinical Authorization Reconciliation
- appointment status transitions
- Financial/Clinical Finalization Boundary and financial finalization atomicity

No conflict requiring relaxation of #387/#388/#389 was found. The safe ordering is: validate and lock → materialize Evolution while the appointment is still `em_atendimento` → freeze/link the Encounter Record → update appointment to `finalizado` → let all existing clinical/financial triggers execute → commit.

## Historical product comparison

`OARANHA/medicspro` was reopened only for the directly relevant historical flows identified by `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`.

Useful experience retained:

- `InProgressAppointmentView.vue` keeps the clinician inside a dedicated encounter workspace with the patient persistently contextualized.
- The legacy Record is appointment-oriented and is treated as the central consultation work area.
- `AnamneseFormTab.vue` demonstrates that structured clinical history can live inside the encounter without forcing every field into the patient master record.
- `SaveStatusIndicator.vue` demonstrates the product value of explicit persistence feedback.
- Patient history remains reachable from the encounter instead of replacing the active consultation.

Historical behavior explicitly rejected:

- Vue/Pinia/Mongo/API architecture and historical authorization model.
- Debounced generic autosave from `InProgressAppointmentView.vue`.
- The legacy save indicator's idle state displaying `Salvo`, which can claim persistence without a server confirmation.
- Mutable broad Record update APIs without the current self-authorship/tenant boundaries.
- Reassociation of authorship or encounter provenance.
- Legacy finish flow that saves and then opens checkout; clinical finalization must remain independent from checkout.
- Future-tool buttons or tabs without a real canonical backend contract.

## Domain model

One canonical Encounter Record exists at most per appointment.

Conceptual fields:

- `id`
- `clinic_id`
- `appointment_id`
- `patient_id`
- `professional_id`
- `reason`
- `history`
- `findings`
- `assessment`
- `plan`
- `additional_notes`
- `status` (`draft` or `finalized`)
- `revision`
- `evolution_id`
- `created_at`
- `updated_at`
- `finalized_at`

The linkage fields are server-derived and immutable. The browser supplies the appointment and editable clinical text, never a trusted tenant or professional identity.

### Clinical semantics

- `reason`: motivo / demandas da consulta
- `history`: história atual / HDA
- `findings`: achados / exame
- `assessment`: avaliação clínica / problemas
- `plan`: plano / conduta
- `additional_notes`: observações complementares opcionais

Individual fields are optional. Finalization requires only that deterministic materialization produce non-empty clinical text. No diagnosis inference, AI summary, `Não informado`, `N/A`, or generated content is permitted.

## Longitudinal versus encounter data

Patient fields remain longitudinal. Encounter Record fields describe only the current appointment. In particular, `patient.queixaPrincipal` must never be relabeled or overwritten as the reason for the current consultation, and encounter HDA/findings/assessment/plan must never be persisted into longitudinal patient fields as a shortcut.

## Lifecycle

### Draft

A draft can be created or changed only when all current conditions are true:

- authenticated actor has an active profile in the active clinic;
- current clinical identity is valid;
- actor owns the appointment as the exact professional;
- appointment belongs to the same clinic and patient and is `em_atendimento`;
- `clinical.attend` is allowed;
- `clinical.evolution.write` is allowed;
- no canonical legacy Evolution already exists for that appointment before a new record is created.

Draft writes are RPC-only for the browser. Authenticated direct INSERT/UPDATE/DELETE is not part of the contract.

### Optimistic concurrency

`revision` is an integer version. Each save includes `expected_revision`. A save succeeds only when the expected value equals the current server value. A stale tab receives an explicit conflict and cannot overwrite a newer version.

Example: A and B open revision 2; B saves revision 3; A tries expected revision 2; A is rejected and B remains unchanged.

### Finalized

Finalization is a single PostgreSQL transaction. It locks the appointment and Encounter Record, revalidates actor/tenant/ownership/capabilities/revision/status, rejects competing Evolution provenance, materializes one canonical Evolution, freezes the Encounter Record and then updates the appointment to `finalizado` through the existing trigger chain.

A finalized Encounter Record cannot return to draft, change content/provenance/evolution linkage, or be hard-deleted by the browser. Future corrections will use an auditable addendum/rectification model; that model is intentionally not implemented in #394.

## Evolution materialization

The canonical Evolution text is deterministic and includes only non-empty sections, in this order:

```text
Motivo / demandas
<reason>

História atual
<history>

Achados / exame
<findings>

Avaliação clínica / problemas
<assessment>

Plano / conduta
<plan>

Observações
<additional_notes>
```

Empty sections are omitted. No LLM participates in canonical materialization. The resulting Evolution preserves the existing exact clinic, patient, professional, session/appointment, date, text and authorship contract.

## Idempotency and encounter-level serialization

Finalization must be safe for double-click/retry. A completed logical finalization returns the already-finalized record instead of creating a second Evolution or repeating the appointment transition.

#394 also serializes encounter-record commands and linked Evolution insertion at the appointment level so that a concurrent legacy insertion cannot silently race the new transaction. The implementation must fail closed when two competing sources of truth are detected.

## Compatibility with existing Evolutions

Rollout does not fabricate Encounter Records for old Evolutions and performs no clinical backfill.

- Active appointment with an existing canonical Evolution and no Encounter Record: preserve the legacy finalization path; do not create another Evolution or retroactive Encounter Record.
- Active appointment with no Evolution: the Encounter Record can become the source of the final clinical act.
- Draft Encounter Record followed by an external/legacy Evolution for the same session: fail closed as a recoverable conflict; do not choose a winner and do not duplicate either artifact.

## Reading and RLS

The Encounter Record does not invent a new clinical-read philosophy. Tenant isolation is mandatory and SELECT aligns with the existing patient clinical-record access helper used by clinical timeline/Evolution reading. RLS is defense-in-depth; commercial plan/entitlement does not grant clinical authority.

The verifier must cover author, authorized clinical reader, unauthorized other professional, other tenant, anonymous actor, inactive profile and non-clinical administrative actor under the existing boundaries.

## Relationship with Assessment

Clinical Assessment remains a separate, optional, versioned artifact. #394 does not copy Assessment answers into Encounter Record fields. A future explicit `incorporar achado` action may be designed separately.

## Relationship with Nexus

Nexus C-01…C-06 remain unchanged. Nexus results do not populate Encounter Record fields or the generated Evolution automatically. Existing entitlement, capability, identity, care relationship, review, signature and explicit incorporation rules remain authoritative.

## Relationship with Finance

Encounter Record finalization performs no checkout, payment, receivable or finance mutation of its own. It only updates the appointment through the existing clinical finalization route inside the same PostgreSQL transaction. Existing financial triggers therefore remain authoritative:

- expected package-coverage failures create the current financial exception and do not roll back clinical finalization;
- unexpected financial integrity errors propagate and roll back the entire transaction.

## Minimal UX contract

For an own active appointment without a legacy Evolution, the universal Evolution textarea is replaced by one consultation record with flexible fields for reason, history, findings, assessment, plan and optional notes. The clinician may fill them in any order and may leave irrelevant sections empty.

Persistence states are truthful: `Não salvo`, `Salvando...`, `Rascunho salvo`, `Conflito de versão`, or `Erro ao salvar`. No generic autosave is introduced.

A saved valid draft offers `Revisar e concluir`. Review may show the deterministic final text but does not create a second editable Evolution field. Human confirmation makes clear that the record becomes definitive, the official Evolution is generated and the appointment is finalized.

## Future production runbook — document only, do not execute in #394

1. Merge only after all frontend, PostgreSQL 16, clinical authorization/foundation, financial finalization and Nexus gates are green.
2. Back up/confirm database restore posture and verify the deployed application is compatible with the migration.
3. Apply the additive #394 migration once using `psql -v ON_ERROR_STOP=1` under the normal MedicsPro migration procedure.
4. Run the #394 PostgreSQL verifier against the deployed schema.
5. Re-run the existing Clinical Foundation, Clinical Authorization and Financial/Clinical Finalization verification scripts.
6. Deploy the compatible frontend only after database verification succeeds.
7. Smoke-test: new structured draft/save/finalize, legacy Evolution compatibility, stale revision conflict, expected package-coverage exception and an unauthorized access case.
8. Do not backfill historical Evolutions into Encounter Records.

#394 itself performs none of these production steps.

## Deliberately deferred

#394 does not implement a structured problem list, diagnosis coding engine, prescriptions, exams, certificates, reports, referrals, attachments, generic autosave, AI-generated charting, new finance, Nexus lifecycle changes or broad redesign.

Future #395 should be chosen only after this foundation is verified in the pilot. The most natural next slice is an auditable correction/addendum path for finalized encounter records, unless pilot evidence shows that a real document workflow (prescription or certificate) has higher immediate value.