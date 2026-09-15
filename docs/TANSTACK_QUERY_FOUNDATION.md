# MedicsPro — TanStack Query Foundation

## Status

**DRAFT SLICE — STACKED ON UI FOUNDATION V2 (#463) — NOT PRODUCTION.**

This slice introduces TanStack Query only for patient server-state. It does not change Supabase authorization, RLS, RPCs, migrations, clinical boundaries or production behavior outside the frontend state layer.

## Objective

Replace manual patient remote-state machinery with a canonical query/mutation layer while preserving MedicsPro session and tenant isolation.

The first migrated domain is `PatientProvider` because it already carried manual loading/error state, refresh ordering, optimistic updates and rollback behavior.

## Canonical layering

```text
Supabase / RPC / RLS
        ↓
repository / domain functions
        ↓
TanStack Query
        ↓
PatientProvider
        ↓
UI
```

TanStack Query is cache/orchestration infrastructure. It is never an authorization boundary.

## Cache scope

Patient query keys are explicitly scoped by:

```text
clinicId + userId + role
```

The `ClinicQueryProvider` is mounted inside the keyed `ClinicDataBoundary` session lifetime. A clinic, user, role, profile-active-state or tenant-access-state change remounts the boundary with a fresh `QueryClient`.

Token renewal deliberately does **not** change that lifetime, so open work and valid cache are preserved during ordinary Supabase session refresh.

Logout followed by login, even to the same clinic, receives a new client lifetime because the boundary passes through an unauthenticated scope.

## Mutation rules

Patient mutations cancel an in-flight patient query before committing cache changes. This prevents a stale read from overwriting a successful mutation.

`setFunilStage` keeps an optimistic snapshot and rolls back only within the same query client. A late failure from an old clinic session cannot write into the next clinic's client.

Patient creation and anonymization remain server-first; the cache changes only after the repository operation succeeds.

## Refresh semantics

Explicit patient refresh uses TanStack Query `refetch` with cancellation enabled. Two same-session refreshes preserve the existing MedicsPro contract: the later refresh wins and an older response cannot restore stale state.

Query and mutation retries are disabled by default in this foundation. Clinical and operational writes must not be repeated implicitly by the client library.

## Decision → second review → execution

### Decision

Adopt TanStack Query as the server-state foundation and begin with `PatientProvider`.

### Second review

The first implementation exposed two real problems in tests:

- the new provider contract was absent from an isolated test harness;
- a new-clinic initial read could race a new-clinic patient creation and overwrite its cache.

The implementation was corrected instead of weakening those tests. Creation/anonymization now cancel the current read before cache writes, and explicit refresh uses Query's own cancellation semantics.

### Execution result

The patient slice now passes the existing cross-session rollback, logout/login, token-renewal and concurrent-refresh regression suite.

## Validation and bundle

Validated in the disposable Wandora workspace with Node 22:

- full Vitest suite green;
- TypeScript green;
- ESLint green with zero warnings;
- Vite production build green;
- `git diff --check` green;
- patient-session isolation regressions green.

The UI Foundation V2 branch measured about `484.55 KB gzip` JavaScript. With TanStack Query and the first patient migration, the build measured about `498.34 KB gzip`, approximately `+13.8 KB gzip`.

The pre-existing monolithic chunk warning remains. Query does not remove the need for a future code-splitting slice.

## Promotion rules

Do not migrate all providers mechanically. Each server-state domain must earn migration by removing real manual complexity and preserving its own concurrency and authorization tests.

Next candidates may include Agenda, Finance, Clinical, entitlements or directory data, but only in separate reviewed slices.

Do not adopt TanStack Router or TanStack Start through this foundation. React Router remains canonical and the current Vite + Supabase deployment architecture remains unchanged.

## Production

No production action is required for this draft. There are no migrations, RPC changes, RLS changes or Edge Function changes.

## Agenda server-state slice

The second reviewed migration moves `AgendaProvider` onto the same clinic-scoped Query foundation.

The Agenda key is independently scoped by `clinicId + userId + role`; it cannot collide with the patient cache. Existing repository commands remain canonical: appointment creation still uses `insertAppointment()` and status transitions still use `updateAppointmentStatus()`.

The migration preserves four explicit contracts:

- the latest explicit Agenda refresh wins;
- an in-flight read cannot overwrite a successful appointment creation;
- status updates remain optimistic and roll back on canonical mutation failure;
- a late rollback from an old clinic-session lifetime cannot write into the next clinic's QueryClient.

The Agenda slice does not modify Encounter lifecycle, referral continuity, recurrence commands, finance projections, RLS, RPCs or appointment authorization. Existing consumers continue calling `refreshAgenda()` through the same context API.

Validation after the second review:

- five consecutive runs of the Agenda/session concurrency suite: `23/23` each;
- full suite: `103/103` files and `563/563` tests;
- TypeScript green;
- ESLint green with zero warnings;
- Vite production build green;
- `git diff --check` green;
- JavaScript bundle remains approximately `498.34 KB gzip`, with no material increase over the Patient Query foundation.
