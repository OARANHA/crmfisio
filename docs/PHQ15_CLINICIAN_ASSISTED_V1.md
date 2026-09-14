# PHQ-15 Clinician-Assisted Administration V1

## Status

**MERGED TO MAIN — NOT DEPLOYED TO PRODUCTION.**

Original branch: `feat/phq15-clinician-assisted-v1`

PR: `#461 — MERGED`

Implementation commit: `c26a27764d400590c750fc784151e9b5827723eb`

Merge commit: `7bcf7b109b661e4c0ee4b7c4eada4097210edc0a`

Original base: `main@5f01832afc35284b8fa5bacc6c0e23b4572bc7b5`

This slice adds PHQ-15 to the canonical MedicsPro clinician-assisted instrument path without widening the public self-assessment surface.

Before any production action, read `docs/ENVIRONMENT_BOUNDARIES.md`. The real MedicsPro production server is `158.220.97.145`; Wandora `13.140.190.149` and `/tmp/crmfisio` are auxiliary/disposable development-test workspace only.

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

GitHub CI on implementation commit `c26a27764d400590c750fc784151e9b5827723eb` is fully green: `10/10` workflows completed successfully, including the dedicated disposable PostgreSQL 16 workflow `PHQ-15 Clinician-Assisted V1`, C-01/C-02/C-03/C-04/C-06, clinical foundation/authorization reconciliation, the general clinical workflow CI, and the existing clinician-assisted instrument gate.

Post-merge CI on `main@7bcf7b109b661e4c0ee4b7c4eada4097210edc0a` is also green for all three triggered workflows: Clinical Instrument Encounter Authorization, Clinician-Assisted Clinical Instruments V1 and PHQ-15 Clinician-Assisted V1.

Production verification remains pending because no production migration/deploy/smoke has been executed yet.

## Out of scope

- public/patient-self PHQ-15;
- new `nexus.*` grants;
- automatic diagnosis or treatment;
- automatic referral/prescription;
- longitudinal PHQ-15 dashboard;
- module/plan packaging changes;
- production migration/deploy.

## Continuity / next safe action

The implementation is merged and repository/CI state is green. It is **not production state**.

Next sequence:

1. use `158.220.97.145` as the only MedicsPro production target;
2. the assistant prepares one controlled production command block at a time;
3. the user executes it on `158.220.97.145` and returns the complete output;
4. apply `supabase-migrations/20260913_phq15_clinician_assisted_v1.sql` only after production prechecks;
5. deploy the affected application/runtime surfaces as required;
6. smoke the fail-closed clinic setting, authorized `Aplicar agora`, immutable/versioned administration snapshot, and the public rejection of PHQ-15;
7. only then update `docs/CURRENT_STATE.md` and this document to `VALIDADO EM PRODUÇÃO`.

If another chat/agent resumes this work, start from `docs/CURRENT_STATE.md`, `docs/ENVIRONMENT_BOUNDARIES.md`, this document, and merged PR #461; do not recreate the PHQ-15 implementation or broaden public exposure.
