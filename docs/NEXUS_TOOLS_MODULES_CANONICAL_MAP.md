# Nexus Tools & Modules — Canonical Map

Status: product/architecture decision record
Last reviewed: 2026-09-13
Canonical runtime: `OARANHA/crmfisio`
Upstream clinical intelligence reference: `OARANHA/nexus`

> Read this document when deciding what clinical tools still come from Nexus, what should be implemented next, or how Nexus-backed functionality should be packaged commercially in MedicsPro.

## 1. Why this document exists

This file prevents repeated rediscovery of the Nexus inventory and records the agreed product direction.

The current priority is:

```text
1. mature the clinical tools themselves;
2. integrate them canonically into MedicsPro;
3. only then package them into commercial modules/add-ons;
4. expose clinic-level configuration inside the entitlement granted by Platform Admin.
```

Do not prematurely redesign the tools around pricing or plans. First make the clinical capability correct, useful, safe and reusable.

The current repository/code/schema always overrides this snapshot if implementation has advanced.

---

## 2. Canonical product rule

Nexus is not a second MedicsPro runtime.

Use the repositories with these roles:

- `OARANHA/crmfisio`: canonical product, authorization, tenant, Encounter, persistence, UI and runtime;
- `OARANHA/nexus`: upstream/laboratory for specialized clinical intelligence, validated instruments, deterministic calculators, evidence and clinical decision-support concepts;
- `OARANHA/medicspro`: historical UX/workflow reference only.

Absorb useful Nexus intelligence into MedicsPro without importing old or parallel authorization/runtime boundaries.

For clinical instruments preserve:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

For SaaS packaging preserve:

```text
PLATFORM ENTITLEMENT != CLINIC CONFIGURATION != USER AUTHORIZATION
```

A feature being sold, enabled, visible or clinically relevant never grants clinical authority by itself.

---

## 3. Commercial/module architecture — agreed direction

The user's proposed direction is valid and should be treated as the target model, with one important distinction: the same concept must not be represented by duplicate toggles with duplicate meaning.

### Layer A — Platform Admin / entitlement

Platform Admin controls whether a clinic is entitled to a first-party MedicsPro module or add-on.

Examples of future responsibilities:

- module/add-on catalog;
- plan inclusion;
- clinic-specific entitlement override;
- trial/rollout flags;
- activation/deactivation dates;
- billing/commercial state;
- audit trail.

Platform Admin answers:

> `Esta clínica tem direito a este módulo?`

Platform Admin must not implicitly grant clinical data access or clinical authorship.

### Layer B — Clinic configuration

Clinic owner/admin configures the behavior of modules already available under the clinic entitlement.

Examples:

- enable/disable an entitled instrument for the clinic;
- choose institutional defaults/protocols;
- order/relevance presentation;
- enable patient-facing delivery when supported;
- define clinic workflow preferences.

Clinic configuration answers:

> `Dentro do que contratamos, queremos usar isto nesta clínica?`

A clinic must never be able to enable a module it is not entitled to use.

### Layer C — User/clinical authorization

A specific actor still needs the correct role/identity/capability/authorship/care-relationship/Encounter boundary.

Authorization answers:

> `Este usuário pode executar esta ação clínica neste contexto?`

For sensitive clinical operations this remains server-authoritative.

### Layer D — relevance and Encounter context

Profession, specialty, patient context and Encounter state may control recommendation, ordering and presentation.

They do not grant entitlement or authorization.

### Effective availability

Conceptually:

```text
available_to_actor =
  platform_entitlement
  AND clinic_configuration
  AND actor_authorization
  AND valid_context
```

For display/recommendation add relevance after those security/product boundaries.

---

## 4. Module versus plugin terminology

Prefer the following language unless future architecture gives a concrete reason to change it:

- **Module / Add-on**: first-party MedicsPro capability maintained inside the canonical product, such as Nexus clinical tools, advanced clinical calculators, longitudinal outcomes or a specialty package.
- **Plugin / Integration**: externally connected provider/service or independently replaceable integration, such as payment providers, external labs, messaging providers or other third-party systems.

Therefore Nexus-backed first-party clinical functionality should normally be sold/configured as **modules/add-ons**, not called plugins merely because it can be turned on and off.

The UI may later use friendlier commercial labels, but architecture should keep this distinction.

---

## 5. Nexus clinical instrument inventory

At the 2026-09-13 review, Nexus contains 21 scale/instrument definitions across its main and additional scale catalogs.

### Already being canonicalized in MedicsPro

- PHQ-9 — depression screening/monitoring;
- GAD-7 — anxiety screening/monitoring.

These must remain one validated engine identity/version across administration modes. Do not duplicate scoring in frontend or Assessment Engine.

### Remaining candidates from Nexus

#### Mood / anxiety

- HAM-A;
- HCL-32;
- MDQ.

#### ADHD / attention

- ASRS-18;
- SNAP-IV.

#### OCD

- Y-BOCS.

#### Trauma / PTSD

- PCL-5;
- PC-PTSD-5.

#### Suicide / safety

- C-SSRS.

C-SSRS should not be treated as an ordinary bulk-import scale. It should have a dedicated safety/risk slice because positive findings may require explicit clinician review, risk documentation and safety workflow. No automatic diagnosis, prescription or referral.

#### Alcohol / substance screening

- AUDIT;
- AUDIT-C;
- CAGE.

#### Perinatal mental health

- EPDS.

#### General mental health / distress

- SRQ-20.

#### Sleep

- ISI.

#### Somatic symptoms

- PHQ-15.

#### Cognition

- MEEM.

#### Quality of life

- EUROHIS-QOL;
- WHOQOL-SRPB.

Instrument presence in Nexus is not enough to ship it. Before canonicalization verify licensing/use conditions, validated wording/version, scoring semantics, safety behavior, intended population, provenance and the correct MedicsPro authorization boundary.

---

## 6. Other Nexus tools worth bringing into MedicsPro

Nexus value is larger than the scale catalog.

### A. Structured Mental Status Examination — EEM

Nexus has a structured EEM model covering domains such as:

- appearance;
- attitude;
- speech;
- mood;
- affect;
- thought course/form/content;
- perception;
- orientation;
- attention/memory;
- insight;
- judgment;
- free observations.

Product direction:

```text
Encounter
  -> Exame do Estado Mental
  -> click-first structured findings
  -> optional free detail
  -> professional synthesis/review
  -> canonical authored clinical record
```

EEM remains an advanced clinical capability and must preserve its explicit Nexus/clinical authorization boundary.

### B. Deterministic clinical calculators

Nexus currently includes concepts/implementations for:

- antidepressant switching support;
- antipsychotic dose equivalence / CPZE;
- renal function / CKD-EPI 2021;
- cardiovascular risk / SBC-Framingham with relevant metabolic context.

These should become server-traceable clinical decision-support tools integrated with the Encounter, not isolated frontend calculators.

Where a result is incorporated into the record, persist provenance such as tool identity/version, inputs, output snapshot and human confirmation where appropriate.

### C. Antidepressant switching

Treat this separately from a generic calculator because it can materially influence prescribing decisions.

It should remain clinician decision support, not an autonomous medication change mechanism.

Likely future surface:

```text
Nexus / Psicofarmacologia
  -> Troca de antidepressivos
```

and only for an appropriately authorized prescriber/clinical identity.

### D. Longitudinal clinical outcomes

Nexus already models longitudinal/result views.

High-value MedicsPro direction:

```text
PHQ-9: 18 -> 14 -> 9 -> 5
GAD-7: 16 -> 12 -> 8 -> 4
ISI:   21 -> 15 -> 8
```

This should become longitudinal clinical outcome tracking tied to immutable instrument administrations, not just a list of historical forms.

This is strategically valuable because MedicsPro can show objective progression over time in addition to storing narrative records.

### E. Patient education / evidence / therapeutic guidance

Nexus models patient education and evidence concepts in areas such as:

- ADHD;
- depression;
- anxiety;
- sleep;
- crisis/safety;
- psychopharmacology.

Do not create a parallel document subsystem for this.

Prefer reusing/evolving the canonical MedicsPro Therapeutic Guidance / Clinical Documents foundation so a professional can select, customize, review and deliver material while preserving provenance and immutable issued documents.

---

## 7. Suggested implementation priority

Do not migrate all remaining Nexus scales in one large change.

### Wave 1 — broad utility / relatively low product complexity

Suggested candidates:

- ISI;
- SRQ-20;
- AUDIT-C and/or CAGE;
- PHQ-15;
- EUROHIS-QOL.

The exact order should still be decided against licensing, validation, user value and current beta priorities.

### Wave 2 — contextual/specialized screening

- ASRS-18;
- HCL-32 / MDQ;
- PCL-5 / PC-PTSD-5;
- EPDS;
- full AUDIT.

### Wave 3 — specialist/context-sensitive instruments

- Y-BOCS;
- MEEM;
- HAM-A;
- SNAP-IV.

### Dedicated safety slice

- C-SSRS.

### Parallel high-value tool tracks

- Structured EEM V2;
- Clinical Calculators foundation;
- longitudinal outcomes;
- evidence/patient education integrated with Therapeutic Guidance.

---

## 8. Focus decision — tools first, packaging second

Until the core Nexus-backed tools are mature, prefer product work in this order:

```text
clinical correctness
-> canonical engine/server contract
-> authorization boundary
-> immutable provenance/history
-> Encounter UX
-> production verification
-> module packaging/entitlement
-> clinic configuration polish
-> commercial plan composition
```

This avoids building a sophisticated module marketplace around immature clinical functionality.

However, every new tool should be implemented in a way that can later participate in the entitlement/configuration model without redesigning its clinical engine.

---

## 9. Possible future first-party module families

These are packaging hypotheses, not current entitlements and not authorization rules.

Potential commercial families include:

- **Clinical Instruments Core** — broad multiprofessional screening/outcome instruments;
- **Nexus Mental Health Advanced** — specialist mental-health instruments and EEM;
- **Nexus Psychopharmacology** — medication-related decision support and advanced calculators;
- **Clinical Calculators** — deterministic general medical calculators where appropriate;
- **Longitudinal Outcomes** — trend/comparability dashboards and outcome analytics;
- **Clinical Safety & Risk** — dedicated structured safety/risk workflows;
- **Patient Education & Guidance** — curated evidence-backed guidance delivered through canonical clinical documents.

Do not hardcode these names or package boundaries into clinical authorization today. They may change after product validation.

---

## 10. Non-negotiable safeguards

When absorbing Nexus functionality:

- never grant `nexus.*` merely because a neutral/multiprofessional instrument uses a Nexus engine internally;
- never let platform entitlement replace clinical authorization;
- never let clinic configuration replace user authorization;
- never let specialty/profession alone grant capability;
- never accept browser authority for clinic, patient, actor or validated engine version when the server can derive it;
- never duplicate deterministic validated scoring in multiple clients;
- never mutate historical signed/final clinical results when a tool definition evolves;
- never auto-diagnose, auto-prescribe or auto-refer from a screening/calculator result;
- safety signals must remain explicit and independently reviewable;
- any tool affecting clinical decision support should carry deterministic provenance/versioning and appropriate auditability.

---

## 11. Quick answer for future agents

If asked again, "what still comes from Nexus?", start here:

1. remaining clinical instruments/scales;
2. structured EEM;
3. antidepressant switching;
4. antipsychotic equivalence / CPZE;
5. CKD-EPI renal calculation;
6. cardiovascular risk calculation;
7. longitudinal outcomes/results;
8. evidence and patient-education content.

If asked, "how should this be sold/enabled?", answer:

```text
Platform Admin grants module entitlement
        ↓
Clinic owner/admin configures entitled modules/tools
        ↓
User still needs the correct clinical authorization
        ↓
Encounter/profession/specialty influence valid context and relevance
```

That layering is intentional, not redundant.
