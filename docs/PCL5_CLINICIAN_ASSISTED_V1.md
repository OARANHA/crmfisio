# PCL-5 Clinician-Assisted V1

**Status:** PROD / VERIFIED / TENANT ENABLEMENT REQUIRED.
**Base:** `main@0de7a02d296f1e30be052a6f2eeb74f1807ae4ed`.
**Branch:** `feat/pcl5-clinician-assisted-v1`.
**Implementation commit:** `33143f5525eeba8c444ef0da0df8bbc96b9791d4`.
**PR:** `#491` MERGED.
**Final PR head:** `58ebddb1d9cb69d9993adfb14898756b40ee4e63`.
**Squash merge / functional main:** `44e392ef2df7e5b1fca1cf373246fb500eb7254b`.

## Decision

PCL-5 is selected as the next remaining Nexus instrument because the original measure is public domain/not copyrighted via the U.S. VA National Center for PTSD and a Brazilian Portuguese adaptation plus psychometric validation are published. This slice is clinician-assisted only and fail-closed.

Nexus remains the product/engine provenance, but the UI uses the published authorized Brazilian PCL-5 wording so the item text matches the Brazilian psychometric evidence and the versioned cutoff. Runtime interpretation is hardened for MedicsPro: all 20 answers are mandatory, no automatic diagnosis or treatment is produced, and the Brazilian psychometric study's cutoff `>=36` is frozen in the versioned rule instead of silently inheriting the older Nexus `>=33` cutoff.

## Canonical identity

```text
instrument_key:       pcl5
engine_source:        nexus
engine_module_key:    scales
engine_tool_key:      pcl5
engine_rule_key:      nexus.pcl5
engine_rule_version:  nexus-pcl5-br-2026-09-16
engine capability:    nexus.scales  # provenance only
```

Authorization remains neutral: `clinical.instrument.apply` + explicit clinic enablement + own active Encounter. No `nexus.*` grant is added.

## Clinical contract

- 20 required items, each `0..4`; total `0..80`.
- Operational positive-screen cutoff: `>=36`, based on the Brazilian validation sample's best overall efficiency.
- Score is screening/quantification only; it does not establish PTSD.
- The professional must anchor responses to a clinically appropriate traumatic event; the 20 symptom items do not independently establish DSM-5 Criterion A.
- A result below cutoff does not exclude PTSD or clinically significant post-traumatic symptoms.
- No automatic psychotherapy, medication, referral, diagnosis or safety escalation is emitted by the engine.

## Provenance

- Blevins CA et al. J Trauma Stress. 2015;28(6):489-498.
- Osório FL et al. Brazilian Portuguese cross-cultural adaptation, 2017.
- Pereira-Lima K et al. Brazilian psychometric/diagnostic utility study, 2019; cutoff 36 had the highest overall efficiency in the studied sample.
- U.S. VA National Center for PTSD: PCL-5 developed by National Center staff; public domain/not copyrighted.

## Product exposure

- `Aplicar agora`: eligible only after explicit clinic enablement.
- `Enviar ao paciente`: **not enabled in this slice**.
- public Nexus/self-assessment surface: unchanged.
- neutral longitudinal history: reused through `clinical_instrument_administrations`.

No clinic setting is inserted by migration. No professional capability is granted.

## Verification

Local gates are green: PostgreSQL 16 and PostgreSQL 17.6 behavior/replay/verifier, forged-version negative control, focused tests 29/29, full suite 116 files / 634 tests, typecheck, lint, build, dependency audit with 0 vulnerabilities and `git diff --check`. GitHub PR CI completed 51/51 and the six push workflows triggered by the squash merge completed without failure. The main tree is identical to the final reviewed PR-head tree.

The database harness also proves that the migration changes no existing clinic settings or professional capabilities and creates no PCL-5 patient-self contract.

## Production validation — 2026-09-16

Production rollout completed against PostgreSQL 17.6 with the functional runtime from `44e392ef2df7e5b1fca1cf373246fb500eb7254b`.

- migration applied with COMMIT;
- PCL-5 verifier: PASS;
- base clinician-assisted verifier: PASS;
- CAGE regression verifier: PASS;
- shared Edge engine promoted to SHA256 `0155e0c4fdabcc1793cf4c34fa72c5cc8d117c5d4ed782d71b55fafc6f53c1e3`;
- Edge Runtime returned healthy and unauthenticated clinician-assisted / Nexus processor calls returned 401;
- frontend was already auto-promoted after merge and served the PCL-5 version/text markers successfully;
- transactional writer smoke produced 36/80, idempotent replay succeeded, forged engine version was blocked, and the transaction was rolled back;
- final residue: `settings=0`, `administrations=0`, `patient_self=0`;
- no clinic was enabled and no real patient PCL-5 administration was created.

Operational evidence is retained on the production host under `/opt/medicspro-rollouts/20260916T184801Z-pcl5-v1`.

Tenant enablement remains an explicit owner/admin decision after the technical rollout.
