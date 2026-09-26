# Deskcomm → MedicsPro Adoption Matrix

> Inventário de reaproveitamento seletivo. Deskcomm é fonte de padrões e evidência de implementação externa, não autoridade do MedicsPro.
>
> **Deskcomm snapshot da auditoria profunda MED-DOC-001 em 2026-09-26:** `8e26e2fa763dc04a565742d52c36c8172bcab3a3`.
>
> O repositório evolui rapidamente. Cada slice deve revalidar a capability relevante contra a main atual antes de reutilizar código, contrato ou conclusão.

## Gate de reutilização

Para cada capability:

```text
exists on current source?
→ proven by code/schema/tests?
→ externally/provider proven when applicable?
→ solves a MedicsPro problem?
→ canonical authority identified?
→ conflicts with clinical/security boundaries?
→ can extract pattern without importing unnecessary runtime debt?
→ REUSE / EXTEND / ADAPT / REBUILD / REJECT
```

## Níveis de prova

A decisão de adoção é separada do nível de prova da referência.

```text
DOC_ONLY
CODE_PRESENT
UNIT_PROVEN
DB_INVARIANT_PROVEN
INTEGRATION_PROVEN
E2E_LOCAL_PROVEN
SABOTAGE_PROVEN
PROVIDER_SANDBOX_PROVEN
PROVIDER_REAL_PROVEN
RUNTIME_REHEARSED
PRODUCTION_OBSERVED
```

Uma capability pode merecer `ADAPT` mesmo com prova baixa, mas nenhuma slice MedicsPro pode herdar automaticamente o nível de prova externo.

Revisões detalhadas:
- `docs/slices/MED-DOC-001/NORMATIVE-REVIEW.md`
- `docs/slices/MED-DOC-001/SPEC-ARCH-PROOF-REVIEW.md`
- `docs/slices/MED-DOC-001/TESTING-OPERATIONS-REVIEW.md`
- `docs/slices/MED-DOC-001/CROSS-CUTTING-LESSONS.md`
- `docs/slices/MED-DOC-001/FINAL-ABSORPTION-SYNTHESIS.md`

## Proof upgrades de alto valor

| Capability | Prova observada no snapshot | Limitação explícita | Target MedicsPro |
| --- | --- | --- | --- |
| Event log / workers | CODE + DB_INVARIANT; retry/reaper/dead/visibility | implementação exata não deve ser copiada sem reuse gate | Event Core |
| Lead stage parity humano/IA | CODE + UNIT; mesmo `lead.stage_changed` | MedicsPro ainda precisa provar sua própria domain boundary | MED-CRM-001 / Event Core |
| MCP/domain tools | CODE + UNIT; handler↔catalog, auth/scope/audit | Spec 11 antiga não é inventário atual | AI/MCP |
| Channel seam | CODE + UNIT/DB invariants + lint | providers externos continuam com provas separadas | Channel Platform |
| Pre-go-live | DB_INVARIANT + E2E_LOCAL | não é prova de conversa real com aparelho/provider | Channel rollout |
| Social native | CODE + UNIT + DB_INVARIANT + local integration | provider-real delivery separado | Social/Inbox futura |
| RAG search | CODE + UNIT + telemetry behavior | clínica exige boundary Nexus própria | AI/RAG |
| Human cases | CODE + DB_INVARIANT parcial | `runAgentTurn` é mockado no case-reply invariant | Inbox/Handoff futura |
| Follow-up engine | CODE + DB_INVARIANT | delivery externo varia por caminho | Automation |
| Ads attribution | CODE + UNIT/DB/E2E local | conta de anúncios real é prova separada | Acquisition |
| Architecture maps | structural UNIT gate | coerência interna != correspondência com código | Engineering discipline |
| Runbooks | rehearsal + production observations em casos específicos | não generalizar um ensaio para todo ambiente | Ops |

## Matriz

| Capability | Evidência Deskcomm auditada | Estado | Decisão MedicsPro | Observação / destino |
| --- | --- | --- | --- | --- |
| Contact + Lead separados | domínio CRM com contato canônico e oportunidade comercial | APPROVED | ADAPT | base de `MED-CRM-001`; Patient continua clínico |
| Pipelines/stages configuráveis | `crm_pipelines`, `crm_stages`, movimentação e timeline | ANALYZED | ADAPT | não hardcodar especialidade; preservar authorization MedicsPro |
| Lead activities/links | timeline comercial e links polimórficos | ANALYZED | ADAPT | separar timeline comercial da clínica |
| Motivos de perda | razão/categoria, filtros e métricas | ANALYZED | ADAPT | útil após foundation do Lead |
| Lead → Patient | Deskcomm não possui o domínio clínico MedicsPro | APPROVED | BUILD IN MEDICSPRO | conversão explícita; nunca criar Patient por simples mensagem/clique |
| Event log / workers | claim/ack/nack/backoff/reaper; `FOR UPDATE SKIP LOCKED` | ANALYZED | ADAPT | futura slice própria; não criar segundo motor se foundation atual resolver |
| Paridade de eventos humano/IA | stage movement por IA passou a emitir o mesmo evento do humano | ANALYZED | ADAPT AS INVARIANT | toda origem deve usar a mesma domain boundary |
| Channel adapter seam | adapters + capability matrix fail-closed | ANALYZED | ADAPT | Evolution permanece provider inicial do MedicsPro |
| WAHA como provider | provider Deskcomm | ANALYZED | REJECT AS DEFAULT | não substituir Evolution apenas para igualar Deskcomm |
| Instagram DM | implementação via `zernio_social`, webhook/ingest/inbox | ANALYZED | ADAPT PATTERN / FUTURE | provider real deve ser revalidado antes de produção |
| Facebook Messenger | mesma foundation social | ANALYZED | ADAPT PATTERN / FUTURE | usar conversation model comum |
| Social publicação/comments | explicitamente fora da entrega nativa auditada | ANALYZED | DEFER | não declarar existente |
| Unified Inbox | conversation/message + humano/IA + canais | ANALYZED | ADAPT | futura slice após channel seam |
| Meta Ads attribution | origem/campanha/conversões | ANALYZED | ADAPT | conectar lead → agenda → patient → revenue |
| Google attribution | `gclid`, `gbraid`, `wbraid`, offline conversion | ANALYZED | ADAPT | forte oportunidade de ROI clínico/comercial |
| Website click-ref tracking | token curto e associação posterior à conversa | ANALYZED | ADAPT | preservar minimização/idempotência |
| Native prospecting | Apify + businesses + enrichment + agent campaign | ANALYZED | ADAPT LATER | começar B2B/parcerias; não cold outreach sensível a pacientes |
| Follow-up graph | versões imutáveis, trigger/wait/condition/AI/action/end | ANALYZED | ADAPT | após event + inbox + agent foundation |
| Agents | separação converser/operator + tools | ANALYZED | ADAPT | evitar agente geral com autoridade total |
| RAG | knowledge sources por agent version + telemetry | ANALYZED | ADAPT | conhecimento administrativo/comercial separado de dado clínico |
| Organizational memory | memória governada separada de knowledge | ANALYZED | ADAPT | nunca converter prontuário em memória reutilizável automática |
| MCP | tools de domínio + bearer/scopes/audit | ANALYZED | ADAPT | sem SQL arbitrário; mesmas domain services de UI/IA |
| Handoff humano | cases/agent inbox + pause/review | ANALYZED | ADAPT | necessário antes de autonomia ampla |
| Before-send guardrails | veto determinístico + checks semânticos | ANALYZED | ADAPT | policies sensíveis não podem viver apenas no prompt |
| AI cost governance | `llm_calls`, budget, pricing central | ANALYZED | ADAPT | por clinic/tenant |
| Shadow mode | observer antes de decision authority | ANALYZED | ADAPT | padrão recomendado para troca de modelo/decision layer |
| LGPD/audit/retention | requests, anonymization, audit, retention | ANALYZED | ADAPT PATTERNS | política clínica MedicsPro continua própria e mais restritiva |
| Observability/recovery | ledgers, traces, health, notices, reapers | ANALYZED | ADAPT WITH ENGINE | fila/motor só entra com operação e recuperação |
| Invariant-oriented testing | CI, DB invariants, RLS isolation, e2e | ANALYZED | ADAPT | criar invariantes MedicsPro por boundary |
| Organizations tenancy | tenancy própria do Deskcomm | ANALYZED | REJECT | `clinic_id` MedicsPro continua autoridade |
| Deskcomm auth/RBAC | auth própria | ANALYZED | REJECT | preservar Supabase/RLS/RBAC/capabilities MedicsPro |
| Next.js runtime | detalhe do produto Deskcomm | ANALYZED | REJECT AS REQUIREMENT | MedicsPro continua React/Vite/Supabase |
| Nuvemshop/e-commerce | domínio não clínico | ANALYZED | REJECT | fora do produto MedicsPro |

## Regra para código copiado

Deskcomm é MIT, mas qualquer trecho substancial copiado deve preservar os avisos exigidos pela licença.

Preferir, nesta ordem:

1. absorver invariante/contrato;
2. redesenhar na arquitetura MedicsPro;
3. reutilizar código somente quando reduzir risco e dívida;
4. nunca importar tenancy/auth/provider coupling desnecessário.

## Regra para evidência externa

Quando a capability depende de Meta, Google, Zernio, Apify ou outro provider:

- implementação interna + testes != prova de provider real;
- registrar separadamente sandbox, provider real, webhook real e produção;
- não promover status de uma slice MedicsPro com base apenas em claims/documentação do projeto de referência.
