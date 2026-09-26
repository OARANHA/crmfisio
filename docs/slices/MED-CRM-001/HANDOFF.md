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
13. `docs/slices/MED-CRM-001/IMPLEMENTATION-001.md`

Depois resolva a `origin/main` atual e repita REAL NOW antes de implementar.

## Slice

- ID: `MED-CRM-001`
- status: `IMPLEMENTING`
- objective: separar Contact/Lead comercial de Patient, com conversão explícita e auditável;
- execution: **foundation micro-slice em andamento**;
- design readback: `main@a0e8fd717302ddca3366d0fc6731a0ed2642269b`;
- design branch: `docs/med-crm-001-design`;
- implementation branch: `feat/med-crm-001-commercial-core-foundation`;
- implementation readback: `main@948223da46bd2a8dec3ff1f73f00d91fe8ed52d9`.

## Proven

- CRM atual `/crm` é Patient-backed e usa `patients.funil_stage`;
- Patient Registry cria Patient com `funil_stage='lead'`, então não existe base para Patient→Lead backfill;
- `patient_journey_events` contém jornada assistencial e não é timeline comercial genérica;
- migration 20260909 protege transições clínicas por boundary própria;
- `/crm` e `PatientJourneyControl` ainda usam writers diferentes para a mesma coluna em parte do fluxo;
- `ReceptionPatients` cria Patient cedo demais para alguns casos pré-clínicos;
- `PatientCareCockpit` e Recepção consomem a jornada Patient fora do CRM;
- Appointment permanece Patient-bound;
- TODO canônico já pede funil comercial separado do prontuário;
- Patient Registry V2/verifier ainda carregam vocabulário histórico `fisio`; a conversão futura exige readback/refactor do boundary final antes de reutilização.

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

## Current implementation

See [`IMPLEMENTATION-001.md`](IMPLEMENTATION-001.md).

Created on the implementation branch:

- `supabase-migrations/20260926_commercial_crm_core_foundation.sql`;
- `supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_CORE_FOUNDATION.sql`;
- `tests/sql/commercial_crm_core_foundation_fixture.sql`;
- `tests/sql/commercial_crm_core_foundation_cases.sql`;
- `scripts/test-commercial-crm-core-foundation.sh`.

No UI, mutation RPC, conversion, Inbox, automation or provider code is part of this micro-slice.

## Runtime proof completed

The isolated Commercial Core harness is now proven on:

- PostgreSQL 16.15 — GREEN;
- PostgreSQL 17.11 — GREEN.

Both runs applied the migration twice, then passed the structural verifier and
behavior cases. The first PostgreSQL 16 run exposed a `RETURNS TABLE(position
integer)` parse failure. The public column name was preserved and quoted as
`"position" integer`; the fix is commit
`9f1bc6629fa7815172d9a81911d1ce4df29e5bda`.

The proof ran through `medicspro-agent` on `28server` in an isolated
`/opt/wandora/ops-workspace` runtime. No production PostgreSQL service/database
was touched.

## Next exact step

1. reconcile repository-required workflows on the final PR head;
2. inspect final diff against current main;
3. update PR evidence/readback;
4. only then consider the foundation `PROVED`.

Do not start the next mutation/board micro-slice until final repository
reconciliation is green.

## Implementation validation required

Completed in isolated PostgreSQL 16 and 17 proof:

- migration replay/idempotency;
- cross-clinic relationship guards;
- `crm.access` read gate;
- role/read matrix;
- raw authenticated DML denial;
- Contact↔Patient link uniqueness;
- no competing `crm_leads.status`;
- open/won/lost semantics;
- activity actor/lead tenant integrity;
- no clinical columns/joins in CRM projection.

Still required:

- final repo gates on the final PR head;
- final diff/readback against current main.

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

MED-CRM-001 is IMPLEMENTING.
Resolve current origin/main and repeat REAL NOW.

The current micro-slice is feat/med-crm-001-commercial-core-foundation.
Read IMPLEMENTATION-001.md and validate/fix that foundation before starting anything else.
Do not build the CRM board, Inbox, automation, attribution or Lead→Patient conversion
in the same change.

Preserve clinic_id, crm.access, RBAC/RLS, Patient/Patient Journey, Agenda and
clinical boundaries. No Patient→Lead backfill. No direct authenticated writer that
can skip commercial activity/audit.

Before migration, re-read the final Patient Registry and audit helpers.
Use JEV only as second adversarial review and MCP_WANDORA_VPS only for runtime proof.
```
