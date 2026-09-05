# Entitlement server enforcement rollout

## Purpose

Clinic module entitlements are a SaaS control-plane boundary, not a replacement for tenant isolation or RBAC. Sensitive operations require both the existing tenant/role authorization and the module entitlement.

## Rollout semantics

For the controlled beta rollout, common module entitlements remain backward-compatible when there is no explicit physical row. Once a clinic has an explicit row, the module is allowed only when the entitlement is enabled and inside its optional start/expiry window.

Nexus is intentionally stricter: `nexus.access` is fail-closed and requires an explicit effective row.

## Current keys

- `finance.access`
- `crm.access`
- `whatsapp.access`
- `reports.access`
- `assessments.custom`
- `nexus.access`

## Enforcement status

### Finance — GREEN

Server-side coverage:

- direct `payments` SELECT/INSERT/UPDATE through RLS;
- `payment_status_history` reads;
- package catalog administration;
- package sales.

Historical package reads and automatic package consumption remain available so disabling a commercial module does not break already-sold clinical commitments.

### Reports — GREEN as a module boundary

`reports.access` gates the official Reports module. It does not deny reads to shared base clinical/financial tables because those rows are also legitimate dependencies of Agenda, Pacientes, Financeiro and CRM.

Future report-specific APIs/RPCs may receive their own authorization boundary.

### CRM — GREEN

`crm.access` is enforced server-side on the CRM-specific mutation currently exposed by the application: changing `patients.funil_stage`.

Shared patient reads are deliberately not coupled to the CRM entitlement.

Production negative test with the pilot clinic returned HTTP 403 / SQLSTATE 42501 when CRM was explicitly blocked.

### WhatsApp / Mensagens — GREEN boundary

`whatsapp.access` protects:

- new outbound `wa_logs` queue inserts;
- message-template create/update/delete;
- authenticated human-review mutations;
- authenticated `evolution-worker` calls;
- internal worker sends by clinic before external delivery.

Provider/webhook delivery, read and reply audit updates remain possible after a module is disabled. Blocked queue rows are deferred rather than silently discarded.

Production authenticated negative test returned HTTP 403 while `whatsapp.access=false`.

### Custom assessments — GREEN

`assessments.custom` controls clinic-owned template authoring only:

- create;
- duplicate standard template into clinic-owned copy;
- rename/edit metadata;
- edit draft schema;
- create next version;
- publish;
- archive/unarchive/delete where supported.

It does not block MedicsPro standard assessments, clinical assessment responses/history, or normal use of published standard templates.

Both RPC paths and direct authenticated table mutations are guarded server-side. Blocked and liberated behavior were tested in the pilot environment.

### Nexus — GREEN, high-risk boundary

`nexus.access` is not a generic module switch. Access requires both:

- explicit effective clinic entitlement;
- active medical identity with physician `professional_type`;
- `council_type=CRM`;
- council state and registration number;
- existing tenant authorization.

Professional capability grants cannot bypass the medical identity or clinic entitlement checks. `owner`, `admin` and temporary legacy `role='fisio'` are never sufficient alone.

Protected data includes Nexus clinical results, red flags and evidence capabilities.

Production validation covered:

1. valid physician + no entitlement => denied;
2. valid physician + explicit entitlement => allowed;
3. non-physician owner + explicit entitlement => denied;
4. anon cannot execute Nexus security helpers.

## Control-plane UX

Platform Admin uses an isolated Supabase session/storage key so clinic login/logout in the same browser does not replace the platform governance session. The selected clinic in the entitlement console is persisted locally and restored only when still valid.

## Important UX debt

A clinic with no physical entitlement row may still appear semantically ambiguous in a binary toggle UI. The target UX should distinguish three states:

1. **Não configurado** — rollout/default behavior;
2. **Liberado** — explicit enabled entitlement;
3. **Bloqueado** — explicit disabled entitlement.

Nexus should communicate that "Não configurado" still means denied because it is fail-closed.

## Verification rule

Every new sensitive entitlement boundary should have:

1. versioned migration;
2. canonical SQL verifier;
3. production application pinned to a known merge commit;
4. structural verification;
5. authenticated negative test;
6. positive-path test when safe;
7. documentation update.
