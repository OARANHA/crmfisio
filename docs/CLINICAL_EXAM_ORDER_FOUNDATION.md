# Clinical Exam Order Foundation — D2-D0

> Backend foundation for a canonical `exam_order` document type. This slice itself did not add the Encounter UI, exam fulfillment/results, scheduling or integrations.

**Merge canônico:** `main@2f4fea83dbb1085c7bea2309ccd4dd1b8bc846db`  
**Estado:** VALIDADO EM PRODUÇÃO

## Why this is a document type

`Pedido de Exames` is not modeled as a button, free-form note, or subtype of `therapeutic_guidance`. It is an explicit clinical act with its own structured payload, eligibility and immutable issued snapshot:

```text
Encounter ativo
→ exam_order template version
→ draft
→ structured exam request
→ explicit human review
→ issue
→ immutable snapshots/history
```

This keeps Clinical Documents as the authority for documentary lifecycle while leaving a future exam fulfillment/results subsystem separate.

## Legacy reuse decision

Historical references:

- `OARANHA/medicspro@app-agendadoutor/src/components/pages/appointments/ExamOrderTab.vue`
- `OARANHA/medicspro@app-agendadoutor/src/models/ExamOrder.js`

Reused concepts:

- structured list of requested exams;
- optional exam code/category/instructions;
- clinical indication and impression;
- request priority;
- observations;
- historical printing/listing as a product workflow.

Rejected from the legacy architecture:

- Vue/Pinia/Mongo contracts;
- frontend-authoritative authorization;
- coupling request issuance to exam scheduling, completion, result/report upload or operational status;
- mutable issued document behavior;
- generic HTML as clinical truth.

D2-D0 creates only the request-document foundation. Results, fulfillment and integrations remain separate future domains.

## Authorization

The common D2-A boundary remains unchanged:

- authenticated active profile;
- active tenant derived server-side;
- valid clinical identity;
- `clinical.documents`;
- own active Encounter through the D2-A `appointments.fisio_id` contract;
- patient/tenant consistency.

D2-D0 deliberately starts `exam_order` conservatively as a medical document. In V1 the issuer must also have an active physician identity with CRM, UF and registration, matching the existing medication-prescription regulatory identity check.

```text
profession/specialty != authorization
```

Specialty/relevance never grants the right to issue. Broadening exam-order authorship to other regulated professions, if product/regulatory requirements demand it, must be a dedicated authorization slice rather than a silent widening of `clinical.documents`.

Owner/admin/platform roles receive no clinical authorship bypass.

## Structured payload

Drafts may be incomplete. Issuance requires at least one valid exam item.

Canonical V1 shape:

```json
{
  "items": [
    {
      "exam_name": "Hemograma completo",
      "code": "optional",
      "category": "optional",
      "instructions": "optional",
      "urgent": false
    }
  ],
  "clinical_indication": "optional",
  "impression": "optional",
  "priority": "routine | high | urgent",
  "observations": "optional"
}
```

Server-side issuance rejects:

- absent/empty `items`;
- item without non-blank `exam_name`;
- invalid optional item field types;
- priority outside `routine|high|urgent`;
- non-string clinical indication/impression/observations.

The foundation does not infer diagnoses, indications or exam choices.

## Platform template

D2-D0 seeds one stable platform template:

- `Pedido de exames`

The first published version uses `clinical-document/plain-text-v1` only as a safe foundation renderer. D2-D1 consumes that immutable version for the first Encounter UX; D2-D2 may publish a new professional A4 version without altering historical documents.

## Database delta

Migration:

`supabase-migrations/20260912_clinical_exam_order_foundation.sql`

It only:

1. extends the two document-type check constraints to include `exam_order`;
2. extends `current_user_can_issue_clinical_document(text)` conservatively;
3. extends typed payload validation;
4. extends the internal plain-text snapshot renderer allowlist;
5. seeds the platform template/version;
6. preserves the existing grants and direct-write denial model.

No RLS policy is broadened. The existing D2-A policies continue to derive availability from the server eligibility helper and clinical-history reads from `can_access_patient_clinical_record()`.

## PostgreSQL 16 proof

Dedicated harness:

`scripts/test-clinical-exam-order-foundation.sh`

Production-safe verifier:

`supabase-verifiers/VERIFY_20260912_CLINICAL_EXAM_ORDER_FOUNDATION.sql`

Behavior matrix:

`tests/sql/clinical_exam_order_foundation_cases.sql`

The harness reconstructs the effective Clinical Documents stack through D2-C.1, applies D2-D0, proves positive and negative authorship/payload cases, reruns the Prescription and Therapeutic Guidance renderer verifiers, and replays the new migration to ensure it does not mutate existing exam-order state.

## Produção

D2-D0 foi mergeado e aplicado em produção em 2026-09-12.

Evidência operacional:

```text
main
→ 2f4fea83dbb1085c7bea2309ccd4dd1b8bc846db

backup
→ /root/medicspro_before_d2d0_20260912_213628.dump

migration
→ COMMIT

verifier
→ CLINICAL EXAM ORDER FOUNDATION VERIFY PASSED
→ VERIFIER_EXIT=0
```

O `ROLLBACK` observado ao fim do verifier pertence somente à transação de verificação e não desfaz a migration já commitada.

## Explicitly not delivered by D2-D0

- Encounter tab/workspace `Exames`;
- live preview or professional A4 renderer;
- clinic template administration for exam orders;
- exam catalog/autocomplete;
- lab/imaging integrations;
- authorization/payment workflows;
- scheduling/fulfillment/status tracking;
- result/report storage;
- Nexus automatic ordering.

## Successor slice

**D2-D1 — Exam Order Encounter UX V1** consumes this exact server contract and does not introduce a parallel engine.

Document: `docs/CLINICAL_EXAM_ORDER_ENCOUNTER_V1.md`.
