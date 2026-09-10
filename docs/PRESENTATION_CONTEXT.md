# Presentation Context — Consultório / Gestão

Status: frontend presentation/privacy boundary. This domain does not authorize any operation and does not change server identity.

## Contract

`PresentationContext = 'clinical' | 'management'` is presentation state only.

It may change:

- shell/navigation visibility;
- dashboard presentation;
- visual privacy boundary for administrative routes;
- interface focus during care.

It must never change or substitute:

- clinic role;
- JWT/session claims;
- tenant/clinic identity;
- `professional_id`;
- RLS;
- clinical capabilities;
- commercial entitlements;
- `ModuleAccessGate` or `ClinicEntitlementGate`.

The route composition deliberately keeps real authorization gates outside the presentation privacy boundary. Presentation can hide an already-authorized surface; it cannot grant one.

## Context matrix

| Actor | Consultório | Gestão | Default |
| --- | --- | --- | --- |
| `professional` | yes | no | Consultório |
| `owner` with valid clinical identity + `clinical.attend` | yes | yes | stored scoped preference, otherwise Gestão |
| `admin` with valid clinical identity + `clinical.attend` | yes | yes | stored scoped preference, otherwise Gestão |
| `owner/admin` without both clinical conditions | no | yes | Gestão |
| `recep` | no | yes | Gestão |
| `financeiro` | no | yes | Gestão |

Owner/admin clinical eligibility is resolved fail-closed from the existing read-only server identity helper plus the existing `clinical.attend` capability. No new role or authorization matrix is introduced.

## Scoped persistence

The preference is stored locally because it is not authority. Its key is isolated by both authenticated user and clinic:

`medicspro:presentation-context:<user_id>:<clinic_id>`

A new user or clinic produces a different key. The provider never reuses the previous scope's in-memory selection. Owner/admin presentation is withheld while clinical eligibility is resolving so a stored clinical preference cannot briefly expose management chrome during session resolution.

## Consultório shell

The assistential shell keeps only presentation-safe items after all existing module/capability/entitlement filters have run:

- Meu dia;
- Agenda;
- Pacientes;
- Nexus when the existing capability + entitlement checks allow it;
- Mensagens when the existing module + entitlement checks allow it.

It visually hides:

- global Financeiro;
- managerial CRM;
- administrative/financial Relatórios;
- Configurações.

The notification badge does not include overdue financial transactions in Consultório. Existing unsigned clinical-consent information may remain. Finance data providers are intentionally not dismantled in this slice; this is a visual privacy boundary, not a loading-architecture rewrite.

The existing desktop collapsed sidebar, mobile drawer and light/dark theme remain part of the same shell.

## Gestão shell

Gestão keeps the existing role-aware/module-aware navigation and commercial entitlement filtering. Switching to Gestão does not make any `canView` result, entitlement or server policy more permissive.

## Direct administrative URLs during Consultório

`/financeiro`, `/crm`, `/relatorios` and `/config` keep their existing real gates first. If those gates authorize the current real actor but Consultório is active, the administrative page is not rendered. The privacy boundary explains that the user must leave Consultório to continue.

A clinical-only professional is never offered a Gestão action. In particular, direct `/financeiro` navigation cannot produce a misleading all-zero global finance dashboard while the professional is in the clinical presentation.

## Dashboard semantics

- `professional` remains on the clinical dashboard path already used by the product when `clinical.attend` is valid;
- clinically eligible owner/admin in Consultório use the same clinical dashboard composition;
- owner/admin in Gestão use the management dashboard;
- reception keeps its operational dashboard;
- finance and other non-clinical roles keep their existing operational behavior.

No duplicate dashboard was created.

## Canonical encounter boundary

The current encounter resolver remains authoritative: `resolveOwnActiveEncounter()` identifies only the actor's real `em_atendimento` appointment through the canonical professional reference. Historical encounters remain read-only and never become proof for entering a clinical workflow.

Automatic mode entry is deliberately deferred in this slice. The current UI has multiple navigation points into an encounter, while the verified appointment transition itself is not exposed as one single presentation callback that all entry paths share. Auto-entering based only on route/query/path or on the mere existence of an active appointment would be a weaker heuristic than the mission allows. A follow-up can wire `setContext('clinical')` immediately after the canonical start/continue command confirms the actor's own active encounter, once that command surface is centralized.

Manual Consultório/Gestão switching therefore ships without a fragile auto-entry heuristic.

## Legacy MedicsPro UX audit

The historical `OARANHA/medicspro` application was reopened as experience reference only.

Concepts retained:

- `InProgressAppointmentView.vue`: a dedicated consultation workspace rather than forcing the clinician to bounce through administrative pages;
- persistent patient and appointment context in the consultation shell;
- a compact auxiliary clinical navigation around the active encounter;
- `AnamneseFormTab.vue`: structured clinical forms can live inside the encounter;
- `PrescriptionTab.vue`, `ExamOrderTab.vue`, `ExamReportTab.vue`, `CertificateTab.vue` and `RecordAttachments.vue`: clinically related tools belong near the consultation context when their canonical backend contracts exist;
- `SaveStatusIndicator.vue`: persistence feedback is valuable when it reflects confirmed state;
- `Sidebar.vue` / `DefaultLayout.vue`: responsive drawer/collapsed-shell ergonomics are useful concepts.

Explicitly rejected:

- Vue/Pinia/Mongo/store architecture;
- historical authorization/plan-access assumptions;
- broad management navigation during the consultation simply because the actor can administratively access it;
- generic debounced autosave;
- the historical idle save indicator that could display `Salvo` without a fresh server confirmation;
- fake/future clinical tools without current canonical contracts;
- the historical finish flow that saved the record and then coupled completion to checkout;
- role masquerading or changing auth claims to implement a visual mode.

## Finance inside an encounter — reserved follow-up

This slice does not implement contextual finance. A future independently authorized component may present only `Cobertura deste atendimento` (for example particular/package and that encounter's allowed coverage/payment state). It must never expose clinic cash, monthly billing, another professional's repasse/commission, profit or global balances inside Consultório.
