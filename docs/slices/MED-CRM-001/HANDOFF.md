# MED-CRM-001 — Handoff

## Start here

Leia:

1. `AGENTS.md`
2. `docs/doctrine/README.md`
3. `docs/doctrine/sistema-vivo.md`
4. `docs/doctrine/autoridade-e-fronteiras.md`
5. `docs/SLICE_EXECUTION_METHOD.md`
6. `docs/CURRENT_STATE.md`
7. `docs/SLICE_LEDGER.md`
8. `docs/DESKCOMM_ADOPTION_MATRIX.md`
9. `docs/slices/MED-DOC-001/FINAL-ABSORPTION-SYNTHESIS.md`
10. `docs/slices/MED-CRM-001/README.md`
11. `docs/slices/MED-CRM-001/EVIDENCE.md`
12. `docs/slices/MED-CRM-001/DECISION.md`

Depois resolva a `origin/main` atual e repita REAL NOW antes de implementar.

## Slice

- ID: `MED-CRM-001`
- status: `DESIGNED`
- objective: separar Contact/Lead comercial de Patient, com conversão explícita e auditável;
- execution: **não iniciada**;
- design readback: `main@a0e8fd717302ddca3366d0fc6731a0ed2642269b`;
- design branch: `docs/med-crm-001-design`.

## Proven

- CRM atual `/crm` é Patient-backed e usa `patients.funil_stage`;
- Patient Registry cria Patient com `funil_stage='lead'`, então não existe base para Patient→Lead backfill;
- `patient_journey_events` contém jornada assistencial e não é timeline comercial genérica;
- migration 20260909 protege transições clínicas por boundary própria;
- `/crm` e `PatientJourneyControl` ainda usam writers diferentes para a mesma coluna em parte do fluxo;
- `ReceptionPatients` cria Patient cedo demais para alguns casos pré-clínicos;
- `PatientCareCockpit` e Recepção consomem a jornada Patient fora do CRM;
- Appointment permanece Patient-bound;
- TODO canônico já pede funil comercial separado do prontuário.

## Design decisions

- `contacts` = identidade tenant pré-clínica/comunicacional;
- `crm_leads` = oportunidade comercial; Contact 1:N Leads;
- `crm_pipelines` + `crm_stages` configuráveis;
- `crm_stages.stage_kind` é a única fonte `open|won|lost`; sem `lead.status` concorrente;
- `crm_lead_activities` = timeline comercial append-only;
- Contact pode vincular opcionalmente a Patient; Patient nunca exige Contact;
- telefone/e-mail são match signals, não chaves únicas;
- nenhuma conversão implícita e nenhum Patient→Lead backfill;
- mutations via operação server-side canônica; authenticated direct write negado;
- conversão Lead→Patient atômica/idempotente e reutiliza/refatora Patient Registry core;
- Appointment continua Patient-bound em V1;
- `/crm` deve deixar de usar Patient stage como pipeline comercial no cutover;
- LGPD de Contact/Lead e reconciliação com Patient são gate obrigatório antes de release.

## Deliberate non-links

- CRM não recebe EHR/CID/evolution/documentos por conveniência;
- provider não define domínio;
- pipeline comercial não controla Patient Journey;
- Lead não cria Patient implicitamente;
- Patient não depende de Contact;
- phone/email não fazem merge automático.

## JEV

Design review em 2026-09-26:

- primeira rota: `deep_review`, probabilidade 0.80;
- desenho refinado: `allow`, probabilidade 0.56, confiança 0.42.

A confiança moderada significa: manter os gates explícitos; não ampliar o design sem nova evidência.

## Next exact step

Abrir a primeira micro-slice de implementação **schema + authorization boundaries only**.

Antes de escrever migration:

1. resolver main atual;
2. re-read da função final Patient Registry em replay;
3. confirmar audit helpers atuais;
4. definir migration + production-safe verifier;
5. criar apenas Contact/Pipeline/Stage/Lead/Activity foundation + RLS/ACL/projections;
6. provar tenant isolation, direct-write denial e stage_kind source-of-truth;
7. não construir board, Inbox, automação ou attribution no mesmo PR.

## Implementation validation required

- fresh install/replay;
- update replay;
- PostgreSQL version(s) usadas pelo projeto;
- cross-clinic RLS;
- `crm.access`;
- role matrix;
- direct-write deny;
- server-derived clinic;
- contact↔patient link uniqueness;
- activity append-only;
- lost reason invariant;
- conversion idempotency in later conversion micro-slice;
- LGPD linked-data behavior before release;
- final repo gates.

## VPS/runtime

- required now: **no**;
- usar MCP_WANDORA_VPS só quando a implementação precisar provar schema/deploy/runtime real.

## Copy-paste prompt for a new chat

```text
Continue MED-CRM-001 in OARANHA/crmfisio.

Do not rely on prior chat memory.

Read AGENTS.md, docs/doctrine/README.md, docs/doctrine/sistema-vivo.md,
docs/doctrine/autoridade-e-fronteiras.md, docs/SLICE_EXECUTION_METHOD.md,
docs/CURRENT_STATE.md, docs/SLICE_LEDGER.md, docs/DESKCOMM_ADOPTION_MATRIX.md,
docs/slices/MED-DOC-001/FINAL-ABSORPTION-SYNTHESIS.md and all files under
docs/slices/MED-CRM-001/.

MED-CRM-001 is DESIGNED but not implemented.
Resolve current origin/main and repeat REAL NOW.

Implement only the first micro-slice: schema + authorization boundaries for
contacts, crm_pipelines, crm_stages, crm_leads and crm_lead_activities.
Do not build the CRM board, Inbox, automation, attribution or Lead→Patient conversion
in the same change.

Preserve clinic_id, crm.access, RBAC/RLS, Patient/Patient Journey, Agenda and
clinical boundaries. No Patient→Lead backfill. No direct authenticated writer that
can skip commercial activity/audit.

Before migration, re-read the final Patient Registry and audit helpers.
Use JEV only as second adversarial review and MCP_WANDORA_VPS only for runtime proof.
```
