# MED-CRM-006 — Handoff

## Current checkpoint

Canonical repository: `OARANHA/crmfisio`

Current integrated base at implementation start:

`main@2140c3351843e5398a08d2a4bc40ba3972ac6329`

Design PR:

`#541 — MERGED`

Implementation branch:

`feat/med-crm-006-contact-identity-resolution`

Status:

`IMPLEMENTING — BACKEND PHASE ONLY`

Revalidate all mutable GitHub/runtime facts before acting.

## Gates closed

The following gates were reconstructed against the merged design and current CRM schema/tests:

`GAPS → CAPABILITY AUTHORITY / REUSE → DECISION → SECOND ADVERSARIAL REVIEW`

The exact executable contract is in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).

Key closures:

- legacy Contacts with NULL normalized columns remain matchable without mass backfill;
- new Contact writes populate canonical normalized storage;
- candidate matching and locking cover the same BR legacy phone variants;
- weak email case-fold is deferred;
- advisory locks are transaction-scoped and deterministically ordered;
- direct `create_current_clinic_crm_contact(...)` cannot remain a bypass;
- Contact/Lead bodies are shared internally rather than duplicated;
- exact orchestration retry is resolved before self-candidate ambiguity;
- Patient never enters candidate input/output/join;
- resolution activity/audit contain no raw phone/email;
- backend proof precedes frontend;
- production rollout remains a separate release gate.

## Execution authorized now

Only:

- `20260927_commercial_crm_contact_identity_resolution.sql`;
- internal normalization/candidate/lock/shared-core helpers;
- writer-scoped candidate preview RPC;
- `create_current_clinic_crm_resolved_prospect(...)`;
- hardening of the existing Contact wrapper;
- per-Lead retry serialization while preserving the existing Lead public contract;
- structural verifier;
- PostgreSQL 16/17 behavioral + concurrency harness;
- CI workflow;
- MED-CRM-006 docs.

## Still forbidden

- frontend resolution UI;
- production/runtime rollout;
- Contact merge/dedupe/edit/lifecycle;
- Patient lookup/matching or Lead→Patient;
- phone/email uniqueness;
- provider/Evolution identity authority;
- new role, entitlement, tenant source or audit mechanism;
- declaring PROVED/RELEASED from implementation intent.

## Validation gate

Before `PROVED`, require:

1. migration replay in isolated DB;
2. new structural verifier PASS;
3. all MED-CRM-006 behavior cases PASS;
4. exact-phone and BR-legacy concurrency proof;
5. deterministic multi-signal behavior / no deadlock;
6. no-signal path without identity-signal lock;
7. no Patient input/output/mutation;
8. no raw PII in resolution evidence;
9. unchanged MED-CRM-002 behavioral cases PASS;
10. unchanged MED-CRM-004 guard cases PASS;
11. PostgreSQL 16 and 17 workflow success;
12. repository `validate` / `dependency-audit` and other applicable checks green on the actual implementation HEAD.

## Next exact step

Implement the backend phase on this branch exactly as [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md), open an implementation PR, then use the PR's actual head/checks as validation authority.

Do not start frontend or production rollout merely because the backend branch exists.
