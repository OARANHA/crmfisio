# Clinical Documents Foundation (D2-A)

This is a backend-only foundation. It does not add a Prescription workspace,
template editor, PDF/signature integration, or automatic clinical content.

## Scope

The only document types are:

- `medication_prescription` — requires the base clinical-document boundary and
  an active physician identity with CRM, state and registration.
- `therapeutic_guidance` — requires the base clinical-document boundary only.

The base boundary is server-side: active authenticated profile, active current
clinic, valid clinical identity, `clinical.documents`, and the professional's
own appointment in `em_atendimento`. Owner/admin and platform roles have no
implicit clinical-document bypass.

The document lifecycle is `draft -> issued -> canceled`. Issuance stores the
payload, patient/clinic/issuer context, template definition and plain-text
render snapshot. Issued snapshots and events are append-only; cancellation
requires a reason. A future corrected document must supersede rather than edit
the issued snapshot.

## Template library

Four versioned, published platform templates are seeded with stable IDs:

- Receita simples
- Receita com orientações
- Orientação terapêutica geral
- Orientações pós-atendimento

Template selection is visibility plus typed issuance eligibility. Platform
templates are not editable by a clinic professional; clinic templates remain
tenant-bound. Relevance metadata is informational and never authorization.

## Verification

`scripts/test-clinical-documents-foundation.sh` is the PostgreSQL 16 contract
gate. It applies the canonical fixture, migration and verifier, exercises
behavior as `authenticated` with RLS enabled, replays the migration in the
same installation, compares policy state, and reruns the behavioral cases.
