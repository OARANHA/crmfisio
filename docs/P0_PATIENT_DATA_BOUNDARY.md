# P0 — Patient clinical data boundary

Status: in execution.

## Problem

`patients` currently mixes operational registration fields with clinical fields (`queixa_principal`, `cid10`, `anamnese`). Row-level RLS isolates clinics, but row-level policies cannot hide selected columns from reception/finance roles inside the same tenant.

## Target contract

- Operational directory: identity/contact/insurance/status/WhatsApp and other administrative fields needed by reception and finance.
- Clinical snapshot: complaint, CID-10 and anamnesis, available only to `owner`, `admin` and `fisio` through a canonical server-side contract.
- Frontend must not use `patients.select('*')` for the global clinic bootstrap.
- Final database boundary must also remove table-wide SELECT permission for `authenticated` and grant only operational columns directly; clinical columns remain reachable only through the clinical contract.

## Safe rollout order

1. Add `list_patient_clinical_snapshot()` as a backward-compatible SECURITY DEFINER RPC guarded by canonical tenant/role resolvers.
2. Change frontend bootstrap to request an explicit operational patient projection and merge the clinical snapshot only for clinical roles.
3. Validate production behavior for owner/admin/fisio and recep/finance.
4. Revoke table-wide `SELECT` on `patients` from `authenticated` and grant only the operational column set.
5. Audit patient write paths so reception cannot mutate clinical columns through direct table privileges or registry RPC payloads.

This order deliberately avoids a period where an auto-deployed frontend depends on a database RPC that has not yet been installed.
