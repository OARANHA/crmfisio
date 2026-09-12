# Clinical Documents Foundation (D2-A)

D2-A is a backend-only foundation for versioned clinical documents. It does not
add a Prescription UI, template administration UI, PDF/digital-signature
integration, automatic prescribing, or a medication catalog.

## Document types

The only document types in this slice are:

- `medication_prescription`
- `therapeutic_guidance`

The common server-side authorship boundary is an active authenticated profile in
an active clinic, valid clinical identity, `clinical.documents`, and ownership
of the active Encounter through the canonical `appointments.fisio_id` relation.
The appointment must be in `em_atendimento` for create/save/issue. The legacy or
compatibility `appointments.professional_id` column never grants D2-A authorship.

`medication_prescription` additionally requires an active physician identity
with CRM, state and registration. Owner/admin, reception, finance and unscoped
platform actors receive no clinical-document authorship bypass.

## Draft versus issuance contract

Draft payloads may be incomplete so the future UI can save work incrementally.
Issuance is stricter and is validated server-side by document type:

- medication prescription: `items` must be a non-empty array and every item must
  have a non-blank `medication_name`;
- therapeutic guidance: `items` must be a non-empty array and every item must
  have non-blank `guidance` content.

This is deliberately a minimum structural contract, not a medication knowledge
base or prescribing engine.

## Lifecycle, snapshots and cancellation

The lifecycle is `draft -> issued -> canceled`.

Issuance freezes the payload, patient/clinic/issuer context, template definition,
plain-text rendering and renderer version. Issued provenance and snapshots are
immutable. Events are append-only. A corrected future document must supersede an
issued document rather than edit it.

Cancellation is a historical action, not a continuation of the active Encounter.
It therefore does not require the appointment to remain `em_atendimento`. V1 is
conservative: the document must still be `issued`, the caller must be in the same
tenant, must be the original issuer, must still satisfy the identity/capability
and document-type eligibility boundary, and must provide a non-blank reason.
Cancellation changes only lifecycle/audit fields; the issued snapshots remain
unchanged.

## Identifier

`document_identifier` remains unique and human-readable while carrying the full
UUID entropy: `DOC-YYYYMMDD-` followed by all 32 hexadecimal UUID characters.
It does not use sequence/count/max allocation or the previous 8-hex truncation.

## Template library

Four published platform templates are seeded with stable IDs:

- Receita simples
- Receita com orientações
- Orientação terapêutica geral
- Orientações pós-atendimento

Platform templates are read-only to clinical professionals. Clinic-owned
templates remain tenant-bound. Relevance metadata is informational and is never
an authorization input.

## Clinical history reads

D2-A does not duplicate or weaken patient-history authorization. Document and
event read policies delegate to the canonical post-#426
`can_access_patient_clinical_record()` boundary:

- active owner/admin tenant managers retain the clinical-history read behavior
  intentionally preserved by #426;
- a `professional` needs valid clinical identity, `clinical.timeline.read` and a
  concrete care relationship;
- appointment care relationship is established by `appointments.fisio_id`;
- appearing only in `appointments.professional_id` does not grant history read;
- reception, finance, inactive, unscoped and cross-tenant actors are denied.

These history-read rules do not imply D2-A authorship eligibility.

## PostgreSQL 16 gate

`scripts/test-clinical-documents-foundation.sh` reconstructs the effective
runtime used by #426 from the canonical versioned migrations/builders, applies
the real care-relationship reconciliation, and only then loads D2-A scenario
data. The D2 fixture never redefines tenant, role, identity, capability or care
helpers.

The behavior matrix proves, under `ROLE authenticated` with RLS enabled:

- canonical `fisio_id` authorship and inverse `professional_id` denial;
- typed medication/guidance issuance with incomplete drafts still allowed;
- `clinical.documents` and clinical identity enforcement;
- canonical #426 history allow/deny cases including `clinical.timeline.read`,
  care relationship, manager reads, reception/finance and cross-tenant denial;
- immutable published versions, issued snapshots and append-only events;
- cancellation by the eligible original issuer after Encounter finalization;
- identifier shape/uniqueness;
- replay idempotency for policies, functions, seeds and existing document/event
  state.

The D2 workflow also reruns the affected Clinical Authorization, Clinical
Foundation, #426 care-read and Clinical Encounter PostgreSQL 16 regressions plus
application tests, typecheck, lint and build.
