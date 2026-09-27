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

Depois resolva a `origin/main` atual, revalide a PR #522 (HEAD, base, diff, checks e merge state) e reconstrua o **ESTADO ATUAL COMPROVADO** antes de decidir ou executar.

A PR documental #523 propõe a nova disciplina de continuidade e o `docs/CANONICAL_INDEX.md`; revalide o estado dela. Não assuma que já está em `main`.

## Slice

- ID: `MED-CRM-001`
- status: `PROVED`
- objective: separar Contact/Lead comercial de Patient, com conversão explícita e auditável;
- execution: **foundation micro-slice PROVED; PR #522 ainda aberta/unmerged**;
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

## Final reconciliation proved

Além do runtime proof PostgreSQL 16/17:

- os 8 repository-required workflows ficaram `completed/success` no head reconciliado `472891f2ebd61902e5b323a0f821766822650c30`;
- compare contra `main@948223da46bd2a8dec3ff1f73f00d91fe8ed52d9`: 13 commits à frente, 0 atrás;
- diff limitado a 9 arquivos esperados da foundation + documentação;
- não entrou board/UI, Inbox, automação, attribution, provider ou Lead→Patient conversion;
- PR #522 segue aberta e mergeable;
- `PROVED` não significa `MERGED` nem `RELEASED`.

Este update de HANDOFF/status é documental; revalide checks do HEAD atual antes do merge.

## Next exact step

1. revalidar `origin/main` e a PR #522 no HEAD atual;
2. confirmar checks/mergeability/diff após este handoff;
3. fazer revisão/decisão de merge separada para #522;
4. se mergeada, reconciliar `main` e documentação global aplicável;
5. só então iniciar o mapa de capacidades do próximo CRM slice;
6. antes de qualquer nova capability, seguir `GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW → EXECUTION → VALIDATION → DOCUMENTATION`.

A próxima slice ainda **não está escolhida**. Candidatos como mutation boundary, Contact operations, Lead operations, stage transition/activity, tasks/next action, board e conversion devem passar primeiro por GAPS + REUSE GATE e dependency graph.

## Implementation validation

Concluído:

- PostgreSQL 16.15 harness GREEN;
- PostgreSQL 17.11 harness GREEN;
- migration replay/idempotency;
- structural verifier;
- behavior cases;
- cross-clinic relationship guards;
- `crm.access` read gate;
- role/read matrix;
- raw authenticated DML denial;
- Contact↔Patient link uniqueness;
- ausência de `crm_leads.status`;
- open/won/lost semantics;
- activity actor/lead tenant integrity;
- ausência de clinical joins/columns na projeção CRM;
- final diff/readback;
- 8/8 repository-required workflows no head reconciliado.

Antes do merge, revalidar apenas o estado GitHub mutável do HEAD mais recente.
## VPS/runtime

- required now: **no**;
- usar MCP_WANDORA_VPS só quando a implementação precisar provar schema/deploy/runtime real.

## Copy-paste prompt for a new chat

```text
Retome o projeto MEDICSPRO pelo estado canônico do repositório OARANHA/crmfisio.

Não dependa da memória deste chat.

Revalide origin/main, a slice MED-CRM-001, PR #522 e PR #523.
Leia AGENTS.md, docs/CURRENT_STATE.md, docs/WORK_CONTEXT.md,
docs/doctrine/, docs/SLICE_EXECUTION_METHOD.md, docs/SLICE_LEDGER.md
e todos os arquivos de docs/slices/MED-CRM-001/.

Se docs/CANONICAL_INDEX.md já estiver em main, use-o como roteador estável.

Reconstrua o ESTADO ATUAL COMPROVADO antes de decidir ou executar.

A foundation MED-CRM-001 foi provada em PostgreSQL 16/17 e teve 8/8 workflows verdes
no último head reconciliado, mas PR/merge/checks são fatos mutáveis: revalide-os.

Primeiro feche a reconciliação/decisão de merge da foundation.
Depois produza o capability map e dependency graph para a evolução máxima do CRM.

Nenhuma nova capability passa para EXECUTION sem:
GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION
→ SECOND ADVERSARIAL REVIEW → EXECUTION → VALIDATION → DOCUMENTATION.

Preserve Contact != Lead != Patient, clinic_id, RLS/RBAC, crm.access,
auditabilidade e boundaries clínicas. Não crie autoridade paralela.
```
