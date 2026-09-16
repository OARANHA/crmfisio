# CAGE Clinician-Assisted V1

**Status:** implementation candidate; not merged and not production.
**Base:** `main@b99c5ca24b3c57e07475eb96acfb8dcb8e691366`.
**Branch:** `feat/cage-clinician-assisted-v1`.

## Decision

CAGE is the first new remaining Nexus instrument selected after the 2026-09-16 reconciliation because its rights/provenance state is materially clearer than the other Wave 1 candidates. This slice is clinician-assisted only and fail-closed.

The four Portuguese item wordings are preserved from the Nexus operational definition. The runtime/scoring behavior is not copied verbatim: Nexus defaults unanswered items to zero, labels a positive screen too close to diagnosis/dependence, and embeds conduct suggestions. MedicsPro instead requires all four answers explicitly and keeps result language as screening only.

## Canonical identity

```text
instrument_key:       cage
engine_source:        nexus
engine_module_key:    scales
engine_tool_key:      cage
engine_rule_key:      nexus.cage
engine_rule_version:  nexus-cage-2026-09-16
engine capability:    nexus.scales  # provenance only
```

Authorization remains neutral:

```text
clinical.instrument.apply
+ explicit clinic enablement
+ own active Encounter
= may administer CAGE
```

No `nexus.*` grant is added.

## Clinical/provenance contract

CAGE has four yes/no items. All four are mandatory. The canonical V1 score is the sum `0..4`; `>=2` is recorded as a positive screen under the classic cutoff, never as a diagnosis.

Operational provenance: the Nexus CAGE formulation used here was prepared by Dr. Adolfo Aranha and presented to professional peers before incorporation into MedicsPro. This internal provenance is recorded separately from the published validation references below; it must not be described as if MedicsPro authored or revalidated the original CAGE instrument.

Primary sources recorded for the versioned engine:

- Ewing JA. _Detecting alcoholism: The CAGE questionnaire_. JAMA. 1984;252(14):1905-1907.
- Masur J, Monteiro MG. Brazilian validation. Braz J Med Biol Res. 1983;16(3):215-218.

Brazilian studies report cutoff performance varying by population. V1 therefore stores the explicit cutoff identity in the rule version and avoids claiming that a negative result excludes risky drinking or that a positive result establishes dependence.
Rights review: the U.S. Federal Interagency TBI Research Informatics System marks the CAGE form structure as not copyrighted, and the original author encouraged widespread clinical use. The Brazilian Ministry of Health also publishes a Portuguese CAGE rendering. This is recorded as provenance evidence, not legal advice.

## Product exposure

- `Aplicar agora`: eligible after explicit clinic enablement.
- `Enviar ao paciente`: **not enabled in this slice**.
- public Nexus self-assessment: unchanged; CAGE is not added.
- longitudinal neutral history: reuses the existing `clinical_instrument_administrations` projection after a real administration exists.

No clinic setting is inserted by migration. No professional capability is granted by migration.

## Safety / interpretation

The engine must:

- reject missing or non-binary answers;
- return `0..4` deterministically;
- use `moderate` severity for a positive screen only as UI/result emphasis, not diagnostic severity;
- state that the result does not establish alcohol use disorder or dependence;
- create no automatic diagnosis, prescription, referral or treatment action;
- emit no fabricated safety signal.

## Verification

Local verification completed before PR:

- PostgreSQL 16 behavior + replay + verifier: PASS;
- PostgreSQL 17.6 behavior + replay + verifier: PASS;
- focused engine/catalog/boundary tests: 26/26 PASS;
- full suite: 116 files / 631 tests PASS;
- migration snapshot proves no existing clinic setting or professional capability is changed;
- CAGE remains absent from the patient-self/public catalog;
- typecheck, lint, production build, dependency audit and `git diff --check`: PASS.

## Out of scope

- AUDIT/AUDIT-C integration;
- CAGE patient-self delivery;
- automatic alcohol diagnosis or clinical conduct;
- auto-enabling any tenant;
- commercial packaging/entitlement changes.
