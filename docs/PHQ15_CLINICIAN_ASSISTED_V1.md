# PHQ-15 Clinician-Assisted Administration V1

## Status

**IMPLEMENTATION SLICE — NOT DEPLOYED TO PRODUCTION.**

Branch: `feat/phq15-clinician-assisted-v1`

Base: `main@5f01832afc35284b8fa5bacc6c0e23b4572bc7b5`

This slice adds PHQ-15 to the canonical MedicsPro clinician-assisted instrument path without widening the public self-assessment surface.

## Canonical identity

```text
instrument_key:       phq15
engine_source:        nexus
engine_module_key:    scales
engine_tool_key:      phq15
engine_rule_key:      nexus.phq15
engine_rule_version:  nexus-phq15-2026-09-13
engine capability:    nexus.scales  # provenance/engine contract only
```

Clinician-assisted authorization remains the neutral clinical boundary:

```text
clinical.instrument.apply
+ explicit clinic enablement
+ patient/tenant/Encounter context
+ own active Encounter
= may administer PHQ-15
```

`nexus.scales` is not granted or required for the neutral clinician-assisted act.

## Clinical contract

PHQ-15 is implemented as a 15-item somatic symptom severity instrument covering the previous four weeks.

- each item: `0..2`;
- total: `0..30`;
- `0..4`: minimal range;
- `5..9`: low range;
- `10..14`: moderate range;
- `15..30`: high range.

Primary provenance: Kroenke K, Spitzer RL, Williams JB. *Psychosomatic Medicine*. 2002;64(2):258-266.

The menstrual item is retained without inferring gender. When it is not applicable, the operational instruction records `0` so the deterministic 15-item scoring contract remains stable.

PHQ-15 is a screening/severity instrument. It does not diagnose etiology, does not distinguish organic from functional causes, does not replace evaluation of alarm signs/differential diagnoses, and does not trigger automatic referral, prescribing or other clinical conduct.

## Product exposure

PHQ-15 is exposed only in the clinician-assisted catalog used by `Aplicar agora`.

The public self-assessment surface remains explicitly limited to PHQ-9 and GAD-7. The public processor has its own allowlist, so adding an instrument to the shared server engine cannot make it remotely processable by accident.

## Persistence and authorization

The slice reuses the existing immutable `clinical_instrument_administrations` ledger and the service-only writer.

The migration:

- registers the versioned Nexus engine contract;
- registers the neutral clinical instrument mapping;
- does **not** insert clinic settings;
- does **not** grant professional capabilities;
- is replay-safe.

A clinic must explicitly enable PHQ-15 through the existing settings boundary before it becomes available.

## Verification

Local Node 22 validation before PR:

- targeted PHQ-15/clinician-assisted tests: green;
- full suite: `100` test files / `553` tests green;
- typecheck: green;
- lint: green;
- production build: green;
- `git diff --check`: green.

PostgreSQL 16 behavior is exercised by the dedicated disposable-database workflow `PHQ-15 Clinician-Assisted V1`. Production verification is intentionally deferred until after review/merge and an explicit production action.

## Out of scope

- public/patient-self PHQ-15;
- new `nexus.*` grants;
- automatic diagnosis or treatment;
- automatic referral/prescription;
- longitudinal PHQ-15 dashboard;
- module/plan packaging changes;
- production migration/deploy.
