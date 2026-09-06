# MedicsPro — P0 Stabilization Status

Date: 2026-09-06

## Status

The P0 stabilization items defined in `docs/P0_STABILIZATION_PLAN_20260906.md` are now closed at repository level and, where applicable, verified in production.

### Closed — temporary password domain boundary

- `current_clinic_id()` and `current_app_role()` fail closed while `must_change_password = true`.
- active-profile and active-clinic lifecycle checks remain part of the canonical resolver contract.
- `admin-team` permits only `change_own_password` while the temporary-password flag is active.
- `nexus-self-assessment-invite` rejects temporary-password sessions before patient access or WhatsApp queueing.
- production verifier returned true for both temporary-password resolver checks and the preserved lifecycle guard.
- updated `admin-team` and `nexus-self-assessment-invite` Edge Functions were deployed and the runtime returned healthy.

### Closed — consent mutation contract

- browser acceptance no longer performs a direct optimistic `UPDATE` on `consent_terms`.
- acceptance uses `accept_patient_consent` and only reports success after reading the persisted state back from the server.

### Closed — WhatsApp worker isolation

- `evolution-worker` no longer accepts ordinary authenticated clinic sessions.
- execution requires the internal worker secret.
- production smoke test without `x-worker-secret` returned HTTP 401 with `Worker não autorizado`.

### Closed — patient clinical read separation

- clinic bootstrap no longer uses `patients.select('*')`.
- the application reads an explicit operational patient projection.
- `queixa_principal`, `cid10` and `anamnese` are read through `list_patient_clinical_snapshot()` only for `owner`, `admin` and `fisio`.
- authenticated table-wide SELECT on `patients` was removed.
- direct authenticated SELECT on the three clinical columns was removed while required operational columns remain readable.
- production verifier returned true for all six privilege checks, including denial of direct clinical reads and preserved guarded RPC execution.

## Current P1 transition

The next phase is architectural and operational hardening without a big-bang rewrite.

Execution order:

1. Auth/session identity — establish one shared authentication state instead of independent `useAuth()` subscriptions and duplicate profile/tenant lookups.
2. Finance — move toward period-scoped loading, Promise-returning mutations and persistence-confirmed state.
3. Agenda — visible-range loading and explicit downstream refresh semantics.
4. Patient/clinical data — separate operational and clinical loading lifecycles further so login does not imply loading every clinical domain.
5. Reduce `store.tsx` until it owns only genuinely shared application state and UI preferences.

## P1 first implementation

The first P1 refactor centralizes authentication under `AuthProvider` while preserving the existing `useAuth()` consumer API. This removes duplicate Supabase auth subscriptions created by `ClinicSessionGate`, `Shell` and `Login`, and creates a single canonical session/profile/tenant-access source before deeper `store.tsx` decomposition.

No database migration or Edge Function deployment is required for this P1 refactor.
