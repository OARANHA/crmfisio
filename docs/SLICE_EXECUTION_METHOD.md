# MedicsPro — Canonical Slice Execution Method

> Processo operacional para executar mudanças sem depender da memória de um chat, agente ou sessão.
>
> `AGENTS.md` continua sendo a autoridade operacional principal. Este documento detalha **como uma slice é conduzida e transferida**. Ele não substitui `docs/CURRENT_STATE.md`, `TODO.md`, `PRODUCT_ROADMAP.md` nem os documentos canônicos de domínio.

## Objetivo

Toda mudança significativa deve deixar evidência suficiente no repositório para que outro chat/agente consiga:

1. reconstruir o estado real sem depender de conversa anterior;
2. saber o que foi provado e o que ainda é hipótese;
3. entender qual componente/repositório tem autoridade sobre a capability;
4. saber por que uma decisão foi tomada;
5. continuar do próximo passo exato sem recriar foundation já existente.

O ciclo canônico é:

```text
REAL NOW
→ PROVEN EVIDENCE
→ GAPS
→ CAPABILITY AUTHORITY / REUSE GATE
→ DECISION
→ SECOND ADVERSARIAL REVIEW
→ EXECUTION
→ VALIDATION
→ DOCUMENTATION
```

## Hierarquia de autoridade

Antes de aplicar o método, preservar a hierarquia definida em `AGENTS.md`.

- `OARANHA/crmfisio` = produto/runtime canônico e único destino de implementação.
- `docs/CURRENT_STATE.md` = snapshot operacional global mutável; não copiar esse papel para slices.
- `TODO.md` = trabalho aberto.
- `PRODUCT_ROADMAP.md` = direção/prioridade de produto; não prova implementação.
- documentos de domínio = contratos especializados.
- código/schema/migrations/RPC/RLS/Edge Functions/tests = prova do comportamento canônico.
- runtime observado = autoridade para dizer o que está realmente implantado.
- chats, memória, prompts antigos e handoffs = contexto; nunca superam evidência atual.

## 1. REAL NOW

Responder: **qual é o estado real agora?**

Obrigatório para uma slice significativa:

- resolver a `origin/main` atual;
- ler `AGENTS.md`;
- ler `docs/CURRENT_STATE.md`;
- localizar o documento canônico do domínio;
- inspecionar consumidores reais;
- inspecionar schema/migrations/RPC/RLS/Edge Functions/testes quando aplicável;
- distinguir claramente `implementado`, `mergeado`, `deployado` e `validado em produção`.

Não iniciar implementação a partir de um SHA, snippet ou estado copiado de chat.

## 2. PROVEN EVIDENCE

Registrar apenas evidência reproduzível.

Ordem de força típica:

1. runtime/produção observado com verifier ou smoke apropriado;
2. schema/migration/RPC/RLS executável atual;
3. código canônico atual;
4. testes/invariantes/CI;
5. documentação atual coerente com o código;
6. documentação histórica/roadmap;
7. conversa/memória.

Uma afirmação deve carregar sua limitação. Exemplos:

- “migration existe” != “migration está aplicada em produção”;
- “teste passa” != “provider externo foi validado”;
- “UI mostra” != “servidor autoriza”;
- “documentado” != “implementado”.

## 3. GAPS

Comparar o objetivo da slice com o REAL NOW e classificar lacunas:

- missing capability;
- incomplete foundation;
- stale documentation;
- duplicated authority;
- missing authorization/security boundary;
- missing observability/recovery;
- missing provider/runtime proof;
- UX/product gap;
- migration/compatibility gap.

Não transformar automaticamente todo gap em feature nova.

## 4. CAPABILITY AUTHORITY / REUSE GATE

Antes de criar qualquer foundation, responder:

1. **quem é autoridade canônica sobre esta capability?**
2. ela já existe parcialmente no MedicsPro?
3. existe implementação histórica/referência externa útil?
4. devemos `REUSE`, `EXTEND`, `ADAPT`, `REBUILD` ou `REJECT`?
5. qual parte é domínio e qual parte é detalhe de provider?
6. importar essa solução duplicaria tenancy, auth, schema, runtime ou provider?
7. qual é o custo de manutenção da nova abstraction?

### Autoridades conhecidas

- clínica/tenant, RLS, RBAC, entitlements e capabilities → MedicsPro canônico;
- Patient/Encounter/EHR/clinical documents/Agenda/Finance → MedicsPro canônico;
- Nexus avançado → engine Nexus integrada ao MedicsPro, com `OARANHA/nexus` apenas como upstream/lab;
- WhatsApp atual → Evolution API através das boundaries MedicsPro existentes;
- Deskcomm → referência para padrões comerciais/conversacionais/agent platform; nunca autoridade de tenancy, auth ou runtime MedicsPro.

## 5. DECISION

Toda decisão relevante deve registrar:

- problema;
- opção escolhida;
- alternativas rejeitadas;
- autoridade preservada;
- impacto de dados/security;
- compatibilidade/migração;
- rollback ou reversibilidade;
- o que explicitamente **não** faz parte da slice.

A decisão deve ser pequena o suficiente para produzir uma slice coerente e verificável.

## 6. SECOND ADVERSARIAL REVIEW

Antes de executar uma decisão relevante, realizar uma revisão hostil.

Perguntas mínimas:

- isso duplica uma capability já existente?
- cria duas fontes de verdade?
- quebra `clinic_id`, RLS, RBAC, entitlement ou capability?
- mistura domínio comercial com clínico?
- cria vazamento de dados sensíveis?
- transforma provider em arquitetura?
- depende de sucesso de rede sem idempotência/reconciliação?
- cria side effect diferente para humano, IA, API ou automação?
- adiciona fila/worker sem health, reaper, retry e observabilidade?
- está grande demais para validar com confiança?

### JEV

JEV é **segunda opinião advisory**, não autoridade.

Use quando houver trade-off relevante, risco, escolha de arquitetura, rollout ou ação operacional consequente.

Registrar na slice:

- pergunta submetida;
- evidência dada ao JEV;
- resposta/confiança;
- decisão humana/técnica final;
- qualquer divergência.

JEV nunca substitui regras determinísticas de `AGENTS.md`, autorização, policy, testes ou aprovação humana exigida.

## 7. EXECUTION

Executar em branch dedicada e em mudanças pequenas.

Regras:

- não misturar outra missão;
- não abrir foundation paralela sem provar a necessidade;
- preferir vertical slice;
- preservar compatibilidade quando necessário;
- migrations precisam de estratégia de rollout/verifier;
- actions de IA/API/UI/automação devem convergir para a mesma boundary de domínio;
- não alterar produção apenas para “testar” arquitetura.

## 8. VALIDATION

A validação depende da capability.

Baseline amplo quando aplicável:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Adicionar conforme risco:

- RLS/tenant isolation;
- role/capability/entitlement;
- migration replay/verifier;
- idempotência e duplicate delivery;
- retry/backoff/reaper/dead state;
- provider real;
- E2E;
- mobile/light/dark;
- production-safe smoke/readback.

### MCP_WANDORA_VPS

Usar somente quando a verdade necessária está no runtime/VPS:

- containers/Portainer;
- systemd;
- worker/cron;
- banco aplicado;
- logs/health;
- deploy/pós-deploy;
- configuração operacional.

Não usar MCP_WANDORA_VPS para substituir leitura do repositório, decidir arquitetura ou inferir schema que o código pode provar.

## 9. DOCUMENTATION

Depois da validação:

- atualizar o documento da slice;
- atualizar `HANDOFF.md`;
- atualizar `docs/SLICE_LEDGER.md`;
- atualizar documentação de domínio afetada;
- atualizar `docs/CURRENT_STATE.md` somente quando a mudança alterar continuidade global, rollout ou estado operacional;
- atualizar `TODO.md`/`PRODUCT_ROADMAP.md` apenas quando a realidade correspondente mudar.

Nunca documentar intenção como estado entregue.

## Status de slice

Use apenas:

```text
DISCOVERED
ANALYZED
APPROVED
DESIGNED
IMPLEMENTING
PROVED
RELEASED
```

Definições:

- **DISCOVERED** — oportunidade/gap identificado.
- **ANALYZED** — REAL NOW, evidência e gaps compreendidos.
- **APPROVED** — decisão de produto/arquitetura aprovada; execução ainda pode não existir.
- **DESIGNED** — contrato/schema/boundaries/validação definidos.
- **IMPLEMENTING** — código/migration/artefatos em execução.
- **PROVED** — implementação passou a validação aplicável em ambiente não produtivo ou com evidência suficiente definida pela slice.
- **RELEASED** — rollout produtivo observado e documentado quando a slice exigir produção.

`RELEASED` não é obrigatório para slices puramente documentais.

## Handoff entre chats/agentes

Cada slice ativa deve possuir um `HANDOFF.md` curto e autocontido.

Um novo chat deve receber somente a instrução de:

1. ler `AGENTS.md`;
2. ler `docs/SLICE_EXECUTION_METHOD.md`;
3. ler `docs/CURRENT_STATE.md`;
4. ler o `README.md` e `HANDOFF.md` da slice;
5. resolver a main atual;
6. repetir REAL NOW antes de executar.

O handoff nunca autoriza confiar em fatos mutáveis sem revalidação.

## Regra final

> A memória do projeto vive no repositório e na evidência reproduzível. O chat é apenas uma sessão de trabalho.
