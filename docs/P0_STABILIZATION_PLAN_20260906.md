# MedicsPro — P0 Stabilization Plan

Date: 2026-09-06

## Why this document exists

MedicsPro has reached the point where continuing product polish without closing a small number of high-impact security and contract gaps would increase pilot risk. The current priority is therefore stabilization before further expansion.

This plan does not invalidate the Platform Admin redesign, onboarding improvements, first-access UX, clinic lifecycle, entitlements or guided configuration work already merged. Those changes remain part of the product baseline. This document defines the execution order from this point forward.

## Product and engineering posture

Keep the existing React + Supabase + PostgreSQL architecture. Do not rewrite or introduce microservices to solve these issues.

Use the 80/20 rule: first close authorization boundaries and broken contracts that can expose data, cross tenants or make a critical workflow fail. Then reduce architectural coupling incrementally.

A green frontend CI is necessary but not sufficient evidence for RLS, RPC or Edge Function correctness.

## P0 — must close before expanding the pilot

### P0.1 Clinical data separation

Problem:
- `patients` currently contains both operational registration data and clinical fields such as `anamnese`, `queixa_principal` and `cid10`.
- clinic-wide loading currently requests `patients.select('*')`.
- UI hiding is not an authorization boundary.

Target:
- `recep` and `financeiro` must not receive unnecessary clinical fields in the browser.
- the database/server boundary must enforce the separation.
- preserve the operational patient fields needed for registration, agenda, communication and finance.

Implementation direction:
- introduce a canonical role-aware patient read boundary (RPC/projection or equivalent server-enforced contract);
- migrate frontend readers to that contract;
- remove broad direct reads that bypass the role-aware projection;
- add two-clinic/five-role access tests.

### P0.2 WhatsApp worker tenant isolation

Problem:
- a clinic user can invoke a worker that uses privileged credentials and claims from a global queue.

Target:
- global queue processing must be internal/server-only, or a human-triggered invocation must be constrained to the caller clinic derived from the authenticated session.
- no cross-tenant message metadata may be returned to clinic users.

Implementation direction:
- separate internal global-worker authorization from clinic-session authorization;
- scope claim RPCs explicitly when a clinic-scoped path is retained;
- test clinic A cannot process or observe clinic B queue items.

### P0.3 Consent mutation contract

Problem:
- the canonical migration makes `consent_terms` browser sessions read-only for mutation and requires `accept_patient_consent`.
- frontend still performs a direct `UPDATE` and optimistic success.

Target:
- all acceptance goes through `accept_patient_consent`;
- UI only reports success after server confirmation;
- failure preserves previous state.

Status:
- implementation starts in the same change that introduces this plan.

### P0.4 Temporary password server boundary

Problem:
- `must_change_password` currently blocks normal UI navigation, but the authoritative server/domain paths must also reject normal operations while the temporary password is pending.

Target:
- a user with `must_change_password = true` may authenticate only for the minimal first-access/password-change path;
- domain RPCs and sensitive Edge Functions fail closed until the flag is false;
- password-change operation itself remains available.

Implementation direction:
- centralize the server-side eligibility check so new RPCs/Functions do not reimplement it inconsistently;
- add tests proving direct API calls with the temporary password are denied.

## P1 — operational completeness after P0

1. Replace global unbounded clinic loading with domain/period-scoped reads and pagination.
2. Generate complete LGPD exports from dedicated server-side queries, including current assessment/Nexus domains.
3. Complete prepaid cancellation operational handling through refund/credit settlement.
4. Make team mutations atomic or compensating-safe; validate unit links before destructive synchronization.
5. Add uncertain-delivery/reconciliation semantics and explicit timeouts to WhatsApp delivery.
6. Add integration tests for RLS/RPC/Edge Functions with two clinics, all canonical roles, inactive users and suspended clinics.

## P1 architecture — incremental store decomposition

The current `store.tsx` is an architectural risk because it owns data, persistence, permissions, notifications and multiple business domains simultaneously.

Do not perform a big-bang rewrite. Extract behavior with tests and preserve product continuity.

Recommended extraction order:

1. Auth/session identity — one canonical source based on existing `useAuth`.
2. Finance — period-scoped reads, Promise-based mutations and persistence-confirmed state.
3. Agenda — visible-range loading and explicit downstream effects on packages/finance.
4. Patient/clinical data — operational and clinical projections with independent loading/error states.
5. Keep only truly global UI/session preferences in the shared application context.

The goal is not merely smaller files. Each domain should own its query lifecycle, errors, mutations and cache/update behavior so login no longer means loading the entire clinic history.

## P2 — engineering maturity

- lazy-load major routes and reduce initial bundle;
- add lint incrementally, especially hooks/promises/accessibility;
- improve modal focus management and accessible naming;
- align Node version across CI and Docker;
- update README and deployment/release composition docs;
- define timezone contract for tests;
- track frontend commit + required migrations + Edge Function versions as one release composition.

## Release gates during stabilization

For every P0 change:

1. inspect current frontend, migration/RPC and Edge Function contracts before changing code;
2. prefer fail-closed behavior;
3. preserve tenant isolation and auditability;
4. run `npm ci`, `npm test`, `npm run typecheck`, `npm run build` through CI;
5. add database/Edge verification scripts when server behavior changes;
6. do not claim production deployment from repository merge alone;
7. record exact server steps when a migration or Edge Function must be deployed.

## Definition of pilot-ready foundation

The foundation can be considered ready for broader professional testing only when:

- operational roles cannot retrieve unnecessary clinical content;
- clinic users cannot process another tenant's message queue;
- consent acceptance uses the canonical audited mutation path;
- temporary-password users cannot call normal domain operations directly;
- inactive users and suspended clinics fail closed;
- the main clinic workflows have repeatable integration verification.

After this foundation is proven, resume commercial plan/entitlement expansion and broader UX/product work without carrying these security debts forward.
