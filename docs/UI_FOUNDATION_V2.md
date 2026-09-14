# MedicsPro — UI Foundation V2

## Status

**SYSTEM PILOT — CLINICAL SHELL + HOME + PATIENT DIRECTORY. NOT PRODUCTION.**

This slice evaluates a more comfortable visual density for MedicsPro and introduces TanStack Table only where it already solves a real operational table problem.

## Product problem

The current interface remains visually dense for prolonged clinical/operational use. Several surfaces still combine small labels, compact controls, narrow row heights and many competing columns.

The goal is not global browser zoom. The goal is a coherent hierarchy with larger reading sizes, larger interaction targets and less visual compression.

## Pilot

The pilot now spans three connected surfaces:

- authenticated `Shell` / sidebar;
- `ClinicianDashboard` as the post-login clinical home;
- `Pacientes` as the first high-frequency operational directory.

This lets the visual system be evaluated in context rather than as an isolated page.

## Visual direction

Default density should be comfortable rather than compact:

- page title around 30–42px where appropriate;
- primary reading text around 15–17px;
- operational controls around 44–48px high;
- sidebar navigation around 48px high;
- patient table rows with materially larger vertical padding;
- stronger distinction between primary and secondary information;
- larger click/focus targets;
- compact density may exist later as an explicit option, not as the default.

The pilot preserves the existing MedicsPro theme and component language. This is an evolution, not a redesign that replaces the product identity.

## TanStack decision

Canonical dependency decision for this slice:

```text
TanStack Table: ADOPT IN PILOT
TanStack Query: NEXT FOUNDATION SLICE
TanStack Router: NO CHANGE
TanStack Start: NO CHANGE
```

## Decision → second review → execution record

### Decision

Evaluate TanStack Query + TanStack Table together as a possible frontend foundation.

### Second review

The review found that Query has real value in current manual server-state flows, but mixing that refactor into a visual PR would make authorization/cache review unnecessarily harder. Table, however, already replaces hand-built sorting/table state in the patient directory.

Result: narrow and sequence the decision before execution.

### Execution

`@tanstack/react-table` remains in this pilot. TanStack Query moves to a dedicated follow-up slice where query keys, invalidation and session clearing can be reviewed explicitly.

## Compatibility reviewed

- React requirement: compatible with React 18;
- Node requirement: `>=20`;
- canonical Docker build currently uses Node 20;
- package is MIT licensed;
- selected Table release is current npm `latest` during the pilot.

## Safety boundaries

UI Foundation V2 does not change authorization. RLS/RPC/capabilities/tenant boundaries remain server-authoritative.

The patient directory remains operational, not a clinic-wide clinical-content surface:

- no complaint column;
- no CID column;
- no anamnesis content;
- search remains limited to operational identifiers;
- the care-relationship copy remains explicit;
- extracting the table to a component must not weaken the boundary test.

The clinician home remains a clinical-context surface. Management-only information must not be reintroduced merely to fill space.

Keyboard access is preserved for patient-row opening and sortable headers remain explicit controls.

## Bundle observation

Baseline main build observed approximately `472.34 KB gzip` JavaScript.

The Table-only/system UI pilot observed approximately `484.55 KB gzip`, an increase of about `12.2 KB gzip` in the current monolithic bundle. The existing >500KB minified chunk warning predates this slice.

This is acceptable for the pilot, but the product still needs future code-splitting work independently of TanStack adoption.

## System-scale expansion

The comfortable density contract includes:

- 292 px expanded / 88 px compact desktop sidebar;
- 48 px-class navigation and primary actions;
- larger clinician-home hierarchy;
- larger metric cards and agenda rows;
- light-theme-specific surface treatment;
- consistent spacing between shell and working content.

`ClinicianDashboard` is the canonical post-login visual reference for a clinical-only professional: **Meu dia → next movement → today metrics → agenda → clinical priorities**.

TanStack adoption remains capability-driven. Table V9 is part of this PR because it already owns operational directory state. TanStack Query is intentionally split into a follow-up foundation slice so server-state migration can be tenant/user/role-scoped, session-cleared, and reviewed independently from visual changes. TanStack Router/Start remain out of scope.

## Preview

Auxiliary preview only, with fictitious data:

- clinical home + sidebar: `https://status.wandora.com.br/medicspro-home-preview/`
- patient directory: `https://status.wandora.com.br/medicspro-preview/`

The home preview opens in light mode by default and can switch to dark mode. These previews are not production and must not be treated as runtime evidence.

## Promotion rule

Do not extrapolate this pilot into a whole-product rewrite. Promote the visual system incrementally as real surfaces are touched and only adopt TanStack primitives when they remove real complexity.
