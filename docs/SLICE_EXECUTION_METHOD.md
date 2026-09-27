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

Antes do ciclo, toda slice significativa deve reconstruir o **ESTADO ATUAL COMPROVADO** usando evidência reproduzível. Isso é uma pré-condição factual, não uma etapa de decisão.

A disciplina operacional canônica é:

```text
GAPS
→ CAPABILITY AUTHORITY / REUSE GATE
→ DECISION
→ SECOND ADVERSARIAL REVIEW
→ EXECUTION
→ VALIDATION
→ DOCUMENTATION
```

Nenhuma capability nova deve avançar para EXECUTION sem atravessar explicitamente GAPS, CAPABILITY AUTHORITY / REUSE GATE, DECISION e SECOND ADVERSARIAL REVIEW.

## Hierarquia de autoridade

Antes de aplicar o método, preservar a hierarquia definida em `AGENTS.md`.

- `OARANHA/crmfisio` = produto/runtime canônico e único destino de implementação.
- `docs/CANONICAL_INDEX.md` = roteador estável; não contém estado mutável.
- branch/PR ativa = trabalho vivo da slice ainda não integrado; verificar HEAD, base, diff, checks e merge state.
- `origin/main` = estado integrado no repositório; não representa automaticamente trabalho ainda aberto em PR.
- `docs/CURRENT_STATE.md` = snapshot operacional global mutável; não copiar esse papel para slices.
- `TODO.md` = trabalho aberto.
- `PRODUCT_ROADMAP.md` = direção/prioridade de produto; não prova implementação.
- `docs/doctrine/` = princípios estáveis de design/aceitação; não carrega estado mutável.
- documentos de domínio = contratos especializados.
- código/schema/migrations/RPC/RLS/Edge Functions/tests = prova do comportamento canônico.
- runtime observado = autoridade para dizer o que está realmente implantado.
- chats, memória, prompts antigos e handoffs = contexto; nunca superam evidência atual.

## 0. ESTADO ATUAL COMPROVADO — pré-condição factual

Responder: **qual é o estado comprovado do sistema antes de analisar os gaps?**

Isto não é uma etapa extra da disciplina. É a base factual necessária para que GAPS não seja inferido de memória, roadmap ou conversa.

Obrigatório para uma slice significativa:

- ler `AGENTS.md`;
- ler `docs/CANONICAL_INDEX.md`;
- resolver a `origin/main` atual;
- ler `docs/CURRENT_STATE.md`;
- identificar a slice em `docs/SLICE_LEDGER.md`;
- ler README + `HANDOFF.md` da slice;
- se houver branch/PR ativa, verificar PR, HEAD, base, diff, checks e merge state;
- localizar o documento canônico do domínio;
- inspecionar consumidores reais;
- inspecionar schema/migrations/RPC/RLS/Edge Functions/testes quando aplicável;
- consultar runtime somente quando a pergunta depender do que está realmente implantado;
- distinguir claramente `implementado`, `mergeado`, `deployado` e `validado em produção`.

Não iniciar implementação a partir de um SHA, snippet ou estado copiado de chat.

### Evidência comprovada

O ESTADO ATUAL COMPROVADO deve registrar apenas evidência reproduzível.

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

## 1. GAPS

Comparar o objetivo da slice com o ESTADO ATUAL COMPROVADO e classificar lacunas:

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

## 2. CAPABILITY AUTHORITY / REUSE GATE

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

## 3. DECISION

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

## 4. SECOND ADVERSARIAL REVIEW

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

### MEDICSPRO DOCTRINE GATE

Antes de mover uma decisão significativa para execução:

1. ler `docs/doctrine/README.md`;
2. aplicar `docs/doctrine/sistema-vivo.md`;
3. aplicar as doutrinas especializadas relevantes:
   - autoridade/tenant/dados → `autoridade-e-fronteiras.md`;
   - IA/tool/handoff → `ia-humano-operacao.md`;
   - mensageria/provider/webhook → `canais-e-acoes-externas.md`;
   - delete/anonymize/destructive migration → `mudancas-destrutivas.md`;
4. registrar respostas concretas na própria slice.

O Doctrine Gate não é um segundo workflow. Ele é uma régua de aceitação dentro de DECISION, SECOND ADVERSARIAL REVIEW e VALIDATION.

Quando uma propriedade é enumerável de forma confiável no repositório, avaliar se ela deve virar gate mecânico/teste em vez de depender para sempre de checklist humano.

## 5. EXECUTION

Executar em branch dedicada e em mudanças pequenas.

Regras:

- não misturar outra missão;
- não abrir foundation paralela sem provar a necessidade;
- preferir vertical slice;
- preservar compatibilidade quando necessário;
- migrations precisam de estratégia de rollout/verifier;
- actions de IA/API/UI/automação devem convergir para a mesma boundary de domínio;
- não alterar produção apenas para “testar” arquitetura.

## 6. VALIDATION

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
- production-safe smoke/readback;
- Doctrine Gate respondido com artefatos concretos;
- gates mecânicos adicionados quando a propriedade for estável, enumerável e valer o custo.

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

## 7. DOCUMENTATION

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
- **ANALYZED** — estado atual comprovado, evidência e gaps compreendidos.
- **APPROVED** — decisão de produto/arquitetura aprovada; execução ainda pode não existir.
- **DESIGNED** — contrato/schema/boundaries/validação definidos.
- **IMPLEMENTING** — código/migration/artefatos em execução.
- **PROVED** — implementação passou a validação aplicável em ambiente não produtivo ou com evidência suficiente definida pela slice.
- **RELEASED** — rollout produtivo observado e documentado quando a slice exigir produção.

`RELEASED` não é obrigatório para slices puramente documentais.

## Handoff entre chats/agentes

Cada slice ativa deve possuir um `HANDOFF.md` curto e autocontido.

Quando o usuário pedir **“gere o próximo texto para chat”**, o agente deve primeiro atualizar esse HANDOFF com evidência fresca e o próximo passo exato. O prompt do próximo chat deve apontar para a memória canônica do repositório, não tentar substituir essa memória por um resumo de conversa.

A forma preferida de retomada é:

> **Retome o projeto MEDICSPRO pelo estado canônico do repositório `OARANHA/crmfisio`.**

Um novo chat deve:

1. ler `AGENTS.md`;
2. ler `docs/CANONICAL_INDEX.md`;
3. resolver a `origin/main` atual;
4. ler `docs/CURRENT_STATE.md`;
5. ler `docs/WORK_CONTEXT.md`;
6. ler `docs/doctrine/README.md` e as doutrinas relevantes;
7. ler este método;
8. ler `docs/SLICE_LEDGER.md`;
9. ler o `README.md` e `HANDOFF.md` da slice;
10. revalidar branch/PR ativa, HEAD, base, diff, checks e merge state;
11. reconstruir o ESTADO ATUAL COMPROVADO antes de decidir ou executar.

O handoff nunca autoriza confiar em fatos mutáveis sem revalidação.

## Regra final

> A memória do projeto vive no repositório e na evidência reproduzível. O chat é apenas uma sessão de trabalho.
