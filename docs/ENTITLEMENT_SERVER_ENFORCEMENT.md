# Entitlement server enforcement rollout

## Purpose

Clinic module entitlements are a SaaS control-plane boundary, not a replacement for tenant isolation or RBAC. Sensitive operations must require both the existing tenant/role authorization and the module entitlement when the clinic has been explicitly configured.

## Rollout semantics

During the beta rollout, an entitlement that has **no explicit row** remains backward-compatible and allowed. Once a clinic has an explicit row, the module is allowed only when the entitlement is enabled and inside its optional start/expiry window.

This mirrors the application route/menu rollout while avoiding an unsafe global cutover for existing clinics that have not yet been seeded.

## First server-side slice: Finance

The initial enforcement slice covers:

- direct `payments` SELECT/INSERT/UPDATE through RLS;
- `payment_status_history` reads;
- package catalog administration (`upsert_session_package`);
- package sales (`sell_session_package`).

Existing tenant and role restrictions remain required in addition to the entitlement.

### Deliberately not gated in this slice

Historical package reads and automatic package consumption are not disabled when `finance.access` is turned off. Packages may represent already-sold treatment commitments; disabling a commercial module must not silently break clinical continuity or corrupt package consumption.

Internal service/trigger flows are also preserved so appointment finalization and background integrity rules are not coupled to browser-level module visibility.

## Next slices

After the finance gate is verified in a seeded pilot clinic, repeat the same pattern deliberately for:

1. reports;
2. CRM;
3. WhatsApp/messaging;
4. custom assessments;
5. Nexus only after doctor-only server authorization is proven.

Nexus remains a separate high-risk gate: `nexus.access` alone is never sufficient. Professional identity and medical registration requirements remain mandatory.
