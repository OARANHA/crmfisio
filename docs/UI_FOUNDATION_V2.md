# MedicsPro — UI Foundation V2

## Status

**PILOT SLICE — PATIENT DIRECTORY. NOT PRODUCTION.**

This slice evaluates a more comfortable visual density for MedicsPro and introduces TanStack Table only where it already solves a real operational table problem.

## Product problem

The current interface remains visually dense for prolonged clinical/operational use. Several surfaces still combine small labels, compact controls, narrow row heights and many competing columns.

The goal is not global browser zoom. The goal is a coherent hierarchy with larger reading sizes, larger interaction targets and less visual compression.

## Pilot

The first pilot is `Pacientes` because it is a high-frequency operational directory and exposes the tradeoff between information density and readability clearly.

## Visual direction

Default density should be comfortable rather than compact:

- page title around 30–34px where appropriate;
- primary reading text around 15–17px;
- operational controls around 44–48px high;
- patient table rows with materially larger vertical padding;
- stronger distinction between primary and secondary information;
- larger click/focus targets;
- compact density may exist later as an explicit option, not as the default.

The pilot preserves the existing MedicsPro theme and component language. This is an evolution, not a redesign that replaces the product identity.

## TanStack decision

Canonical dependency decision for this slice:

```text
TanStack Table: ADOPT IN PILOT
TanStack Query: DEFER
TanStack Router: NO CHANGE
TanStack Start: NO CHANGE
```

## Decision → second review → execution record

### Decision

Evaluate TanStack Query + TanStack Table together as a possible frontend foundation.

### Second review

The review found that Query would add bundle/runtime cost before replacing any current server-state flow. Table, however, already replaces hand-built sorting/table state in the patient directory.

Result: narrow the decision before execution.

### Execution

Only `@tanstack/react-table` remains in the pilot. Query is intentionally deferred until a dedicated server-state slice can prove real simplification, tenant-aware query keys and invalidation behavior.

## Compatibility reviewed

- React requirement: compatible with React 18;
- Node requirement: `>=20`;
- canonical Docker build currently uses Node 20;
- package is MIT licensed;
- selected release is the current npm `latest` during the pilot.

## Safety boundaries

UI Foundation V2 does not change authorization. RLS/RPC/capabilities/tenant boundaries remain server-authoritative.

The patient directory remains operational, not a clinic-wide clinical-content surface:

- no complaint column;
- no CID column;
- no anamnesis content;
- search remains limited to operational identifiers;
- the care-relationship copy remains explicit;
- extracting the table to a component must not weaken the boundary test.

Keyboard access is preserved for patient-row opening and sortable headers remain explicit controls.

## Bundle observation

Baseline main build observed approximately `472.34 KB gzip` JavaScript.

The Table-only pilot observed approximately `484.45 KB gzip`, an increase of about `12.1 KB gzip` in the current monolithic bundle. The existing >500KB minified chunk warning predates this slice.

This is acceptable for the pilot, but the product still needs future code-splitting work independently of TanStack adoption.

## Promotion rule

Do not extrapolate this pilot into a whole-product rewrite. Promote the visual system incrementally as real surfaces are touched and only adopt TanStack primitives when they remove real complexity.


## System-scale expansion

The pilot now covers the authenticated clinical shell, not only the patient directory. The comfortable density contract includes a 292 px expanded / 88 px compact desktop sidebar, 48 px class navigation and primary actions, larger clinician-home hierarchy, and light-theme-specific surface treatment.

`ClinicianDashboard` is the canonical post-login visual reference for a clinical-only professional: **Meu dia → next movement → today metrics → agenda → clinical priorities**. Management-only information must not be reintroduced into this surface merely to fill space.

TanStack adoption remains capability-driven. Table V9 is part of this PR because it already owns operational directory state. TanStack Query is intentionally split into a follow-up foundation slice so server-state migration can be tenant/user/role-scoped, session-cleared, and reviewed independently from visual changes. TanStack Router/Start remain out of scope.
