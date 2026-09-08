# Nexus C-05 — Longitudinal comparability

## Scope

C-05 hardens the existing Nexus longitudinal view. It does not add scales, change C-04, alter the clinical record, or create database schema.

## Audit findings

Before C-05:

- `toLongitudinalPoints()` filtered by `toolKey` and human review, but did not separate `ruleKey`/`ruleVersion`;
- `summarizeTrend()` used first/last score whenever at least one point existed, so a single point could produce a zero delta;
- `radarComparison()` filled missing answers with `0`, conflating absence with a legitimate zero;
- max-score/range compatibility was not checked before delta calculation;
- the sign of mathematical delta was shown without an explicit per-tool clinical-direction contract;
- only score-bearing tools were listed, so EEM could not be represented as a non-directional longitudinal event;
- the panel could retain previous-patient results while a new request was loading/failing.

C-03 already provides the correct human-evidence boundary for this purpose: `reviewed` and `signed` results are eligible; `processed`, `legacy-frozen` and drafts are not. C-04 incorporation remains independent because Nexus longitudinal analysis is not the official chart-write action.

## Architecture

C-05 is code-only.

A closed TypeScript registry defines the current comparable metric contracts:

| Tool | Rule | Version | Metric | Unit | Range | Direction |
| --- | --- | --- | --- | --- | --- | --- |
| PHQ-9 | `nexus.phq9` | `nexus-2026-09-03` | `total_score` | points | 0–27 | `higher_is_worse` |
| GAD-7 | `nexus.gad7` | `nexus-2026-09-03` | `total_score` | points | 0–21 | `higher_is_worse` |
| EEM | `nexus.eem` | `nexus-eem-2026-09-03` | clinical event | event | n/a | `non_directional` |

No cross-version equivalence exists. A different `ruleVersion` therefore fails closed as `incomparable_version`.

## Comparison contract

Quantitative comparison requires:

- same `toolKey`;
- same `ruleKey`;
- same `ruleVersion`;
- registered metric contract;
- same metric and unit;
- same min/max range;
- same clinical direction;
- actual score present in both points;
- deterministic clinical sequence.

Failures are explicit, not hidden behind generic `null`:

- `insufficient_data`;
- `incomparable_version`;
- `incompatible_metric`;
- `incomparable_tool`;
- `missing_measurement`;
- `non_directional`.

Valid directional comparisons become:

- `stable`;
- `improved`;
- `worsened`.

For `higher_is_worse`, decreasing score is improvement and increasing score is worsening. The inverse applies to `higher_is_better` if a future reviewed contract uses it.

## Missing data and zero

`null`, missing fields and non-numeric values remain absent. They are never converted to zero.

A real score of zero remains `0` and can be compared. A baseline of zero makes percentage change undefined, but does not invalidate absolute comparison.

Radar answers preserve missing positions; if either compared snapshot lacks an answer, radar comparison is refused rather than filling the gap with zero.

## Temporal behavior

Points are ordered by the human-review timestamp when available, then by immutable result id for deterministic presentation.

Duplicate instances of the same result id are deduplicated.

Equal clinical timestamps do not establish a reliable before/after sequence, so trend inference returns `insufficient_data`.

A change of professional, current patient inactivity, a completed appointment, or a long interval does not by itself invalidate historical mathematical comparability. These are contextual facts, not implicit causal rules.

## EEM

EEM remains a reviewed/signed longitudinal clinical event, but has no approved single ordinal metric in the current Nexus contract. C-05 therefore displays it without `improved`, `worsened` or `stable` classification.

## Patient/tenant isolation

The database/RLS boundary remains authoritative. The pure longitudinal projection also accepts an explicit patient/clinic scope so mixed fixtures or caller errors do not silently contaminate a series.

## UI

The existing panel now:

- clears prior patient state before loading another patient;
- distinguishes loading failure from empty data;
- surfaces comparison validity state;
- shows relevant rule versions when they differ;
- suppresses trend charts/arrows when comparison is invalid;
- explains EEM as non-directional;
- preserves the C-04 boundary unchanged.

## Persistence and rollout

No migration, RPC, RLS policy or database verifier is added by C-05.

After merge, no database command is required. The change ships with the normal frontend deployment.
