# PHQ-15 Clinician-Assisted Administration V1

## Status

**PRODUCTION BACKEND INSTALLED / FAIL-CLOSED VALIDATED — CLINIC ENABLEMENT PENDING.**

Branch: `feat/phq15-clinician-assisted-v1`

PR: `#461 — feat: add PHQ-15 clinician-assisted V1`

Implementation commit: `c26a27764d400590c750fc784151e9b5827723eb`

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

GitHub CI on implementation commit `c26a27764d400590c750fc784151e9b5827723eb` is fully green: `10/10` workflows completed successfully, including the dedicated disposable PostgreSQL 16 workflow `PHQ-15 Clinician-Assisted V1`, C-01/C-02/C-03/C-04/C-06, clinical foundation/authorization reconciliation, the general clinical workflow CI, and the existing clinician-assisted instrument gate.

Production rollout was executed on 2026-09-14 (America/Sao_Paulo; 2026-09-15 UTC) on the canonical `28server / 158.220.97.145` environment. The database migration is installed, the production-safe verifier passed, and the shared Edge engine plus public processor are pinned to the merged implementation. No clinic was enabled automatically.

## Out of scope

- public/patient-self PHQ-15;
- new `nexus.*` grants;
- automatic diagnosis or treatment;
- automatic referral/prescription;
- longitudinal PHQ-15 dashboard;
- module/plan packaging changes;
- automatic clinic enablement;
- persistent production administration without an explicit clinic setting and authenticated human smoke.

## Production rollout evidence

Production rollout on 2026-09-14 (America/Sao_Paulo; 2026-09-15 UTC) established:

- migration installed: one `nexus_result_contracts` row and one active `clinical_instrument_catalog` row for PHQ-15;
- production verifier: passed read-only;
- Edge shared engine SHA-256: `79670f0ddafbfb6e4bb03ae3910da5cde4fa3eaf755b04a692731167b0526ab8`;
- public processor SHA-256: `4b8f1a0020f79a3e4d849212045fe4d0d1181fcdf937d8ee154ad4fd79ab301f`;
- public processor rejects `phq15` with HTTP 400 while preserving PHQ-9/GAD-7 public exposure;
- clinician-assisted endpoint remains HTTP 401 without a session;
- no persistent clinic setting was created (`settings=0`);
- no persistent PHQ-15 administration exists from rollout (`ledger=0`).

A positive writer smoke used one real active Encounter only inside a rollback-only transaction. The existing professional satisfied tenant, clinical identity and `clinical.instrument.apply`; a temporary PHQ-15 clinic setting allowed the canonical writer to create the versioned snapshot; replay returned the same row as idempotent; direct mutation was blocked by `clinical_instrument_administration_immutable`; `ROLLBACK` left zero PHQ-15 setting and zero PHQ-15 ledger residue.

This proves the installed server contract and fail-closed/immutable writer behavior without fabricating a persistent clinical act. It is **not** a substitute for the first authenticated human `Aplicar agora` after a clinic deliberately enables PHQ-15.

## Continuity / next safe action

Do **not** auto-enable PHQ-15 for any tenant. The next operational step belongs to clinic configuration:

1. owner/admin explicitly enables PHQ-15 for the chosen clinic through the canonical settings boundary;
2. an authorized professional with an active own Encounter performs one authenticated `Aplicar agora` smoke;
3. confirm the persisted versioned/immutable administration and normal UI result rendering;
4. keep public self-assessment PHQ-15 rejected;
5. only then call that clinic operationally validated for PHQ-15.

Future agents should start from `docs/CURRENT_STATE.md`, this document, and the production release evidence; do not recreate the implementation, reapply the migration, or broaden public exposure.
