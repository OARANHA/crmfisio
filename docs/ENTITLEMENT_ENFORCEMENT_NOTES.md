# Entitlement enforcement notes

## Reports

`reports.access` gates the official Relatórios module through the server-evaluated clinic entitlement state used by the route guard. The current reports UI derives aggregates from base clinic data that is also legitimately required by Agenda, Pacientes, Financeiro and CRM.

For that reason, **do not** enforce `reports.access` by denying access to shared base tables such as `appointments`, `patients` or `payments`: doing so would break unrelated operational modules. A future reporting API may centralize derived aggregates, but the entitlement is a feature gate rather than a confidentiality boundary over source rows already authorized for the user's role.

## CRM

CRM shares patient and appointment data with clinical workflows, but changing `patients.funil_stage` is CRM-specific. Server-side enforcement therefore targets that mutation only. If `crm.access` is explicitly disabled or ineffective, authenticated users cannot change the funnel stage even through a direct Supabase update, while non-CRM patient operations remain available according to existing RLS/RBAC.
