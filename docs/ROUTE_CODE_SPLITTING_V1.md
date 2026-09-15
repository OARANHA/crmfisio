# MedicsPro — Route Code Splitting V1

## Status

**DRAFT SLICE — STACKED ON #465 — NOT PRODUCTION.**

## Decision → second review → execution

Decision: split routed page modules with `React.lazy()` so the application does not download every MedicsPro module during initial load.

Second review rejected a global `Suspense` around the authenticated shell because it would hide the sidebar/header while a route chunk loads. The accepted design keeps providers, authorization gates and `Shell` eager, with the nested fallback only around the `Outlet`.

Execution preserves existing route expressions and authorization boundaries. `ModuleAccessGate`, entitlement gates and presentation privacy boundaries remain outside the lazy page render path.

## Loading contract

- public and Platform routes use a full-page loading boundary;
- authenticated module routes keep the clinical Shell visible;
- only the nested route content shows a skeleton while its chunk loads;
- route modules remain named exports adapted to `React.lazy()` without changing page APIs;
- no backend, RLS, RPC, migration or data-fetching behavior changes.

## Measured result

Baseline on #465: about `498.34 KB gzip` in the initial monolithic JavaScript chunk.

With route-level splitting: the initial JavaScript chunk is about `162.22 KB gzip`, approximately **67% smaller**. Total JavaScript across all chunks stays similar; the improvement is deferred loading, not code deletion.

Large clinical modules such as Patients, Nexus Longitudinal, Agenda and Config are emitted as separate chunks and downloaded when needed.

## Validation

- full Vitest suite: `104/104` files, `566/566` tests;
- TypeScript green;
- ESLint green with zero warnings;
- Vite production build green;
- `git diff --check` green;
- architecture regression test prevents routed pages from returning to eager imports and verifies the Shell-local Suspense boundary.

No production action is required for this draft.