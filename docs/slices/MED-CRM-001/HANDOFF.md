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

Depois resolva a `origin/main` atual e reconstrua o **ESTADO ATUAL COMPROVADO**. A PR #522 já foi integrada; use GitHub/main para confirmar o estado atual, sem tratá-la novamente como trabalho aberto.

A PR documental #523 foi integrada em `main` como `542fd289bb8060c7c0c69b20359f0b758092d946`; `docs/CANONICAL_INDEX.md` agora é o roteador estável. Ainda assim, sempre resolva a `main` atual antes de executar.

## Slice

- ID: `MED-CRM-001`
- status: `PROVED`
- objective: separar Contact/Lead comercial de Patient, com conversão explícita e auditável;
- execution: **foundation micro-slice PROVED + MERGED em #522; ainda não RELEASED sem rollout produtivo observado**;
- design readback: `main@a0e8fd717302ddca3366d0fc6731a0ed2642269b`;
- design branch: `docs/med-crm-001-design`;
- implementation branch: `feat/med-crm-001-commercial-core-foundation`;
- implementation readback: `main@948223da46bd2a8dec3ff1f73f00d91fe8ed52d9`;
- merge-decision readback: `main@542fd289bb8060c7c0c69b20359f0b758092d946` após #523; mudança documental disjunta dos 9 arquivos da foundation;
- merge final #522: `main@652ea7b3aea4cd03a09944b780ef697168016bc3`.

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

- o último head com implementação inalterada antes desta reconciliação documental, `ec48f9561c99d818af90001dbed133cf079822eb`, teve 8/8 repository-required workflows `completed/success`;
- #523 foi mergeada depois e moveu `main` para `542fd289bb8060c7c0c69b20359f0b758092d946`, sem sobrepor nenhum arquivo da #522;
- compare revalidado: 17 ahead / 1 behind exclusivamente por essa mudança documental disjunta; mergeability voltou a `true` após recálculo do GitHub;
- migration/verifier/fixture/cases/harness continuam inalterados desde o proof PostgreSQL 16/17;
- não entrou board/UI, Inbox, automação, attribution, provider ou Lead→Patient conversion;
- decisão de merge foi concluída e #522 está integrada em `main@652ea7b3aea4cd03a09944b780ef697168016bc3`;
- estado da foundation: `PROVED + MERGED`, ainda **não RELEASED** sem rollout observado;
- capability map pós-foundation: [`NEXT_CAPABILITY_MAP.md`](NEXT_CAPABILITY_MAP.md);
- MED-CRM-002 Commercial Command Boundary: PROVED + MERGED em #524 / `main@7a8badf5ad81e92746e82bedd142ba75899a4080`, ainda não RELEASED;
- capability map re-medido após #524: [`NEXT_CAPABILITY_MAP.md`](NEXT_CAPABILITY_MAP.md);
- próxima continuidade comercial selecionada: MED-CRM-003 — Commercial Board V1, DESIGNED e ainda não executada.

## Next exact step

MED-CRM-001 não é mais a slice de execução ativa.

1. confirmar a `main` atual e não inferir rollout de #522/#524;
2. ler [`NEXT_CAPABILITY_MAP.md`](NEXT_CAPABILITY_MAP.md);
3. para continuidade atual, seguir `docs/slices/MED-CRM-003/HANDOFF.md`;
4. MED-CRM-003 está DESIGNED, não IMPLEMENTING; revalidar o estado antes de EXECUTION;
5. toda capability posterior continua sujeita a `GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW → EXECUTION → VALIDATION → DOCUMENTATION`.

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

Merge concluído em #522; revalidar runtime apenas quando a pergunta depender de rollout/deploy.
## VPS/runtime

- required now: **no**;
- usar MCP_WANDORA_VPS só quando a implementação precisar provar schema/deploy/runtime real.

## Continuity

O prompt histórico desta slice foi removido porque ficou stale após o merge da #522.

Para um novo chat, use a frase estável de `docs/CANONICAL_INDEX.md`, reconstrua o estado atual e leia o HANDOFF da slice realmente ativa. Neste checkpoint, a continuidade comercial está em `docs/slices/MED-CRM-003/HANDOFF.md`.
