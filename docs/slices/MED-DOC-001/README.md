# MED-DOC-001 — Deskcomm Documentation & Architecture Mining

**Status:** PROVED  
**Capability:** documentation / architecture mining / reuse governance  
**Product code:** unchanged  
**Runtime/VPS:** not required  
**Created:** 2026-09-26

## Objective

Auditar sistematicamente a documentação do `melgarafael/DeskcommCRM` para extrair conhecimento transferível ao MedicsPro sem copiar arquitetura, estado histórico ou decisões específicas de outro produto.

A saída deve melhorar:

- `docs/DESKCOMM_ADOPTION_MATRIX.md`;
- a doutrina MedicsPro;
- o método de slices;
- ADRs/specs futuros;
- invariantes/gates mecânicos;
- o futuro manual de engenharia/produto do MedicsPro.

## Source snapshot

Auditoria ancorada inicialmente em:

`melgarafael/DeskcommCRM@8e26e2fa763dc04a565742d52c36c8172bcab3a3`

Medido nessa árvore:

- **284** arquivos sob `docs/`;
- **222** arquivos Markdown;
- áreas principais: `superpowers`, `specs`, `research`, `design-system`, `doctrine`, `handoffs`, `stories`, `runbooks`, `prd`, `adr`, `testing`, `audits`, `business-rules`.

Qualquer conclusão de estado mutável deve ser revalidada contra a fonte atual antes de reutilização.

## Audit question

Para cada padrão/documento relevante responder:

1. qual problema real ele tenta resolver?
2. é princípio, decisão, intenção, contrato, prova, operação ou histórico?
3. o documento afirma estado atual ou snapshot?
4. onde está o enforcement real?
5. que código/teste/CI/evidência o sustenta?
6. o que pode ter apodrecido?
7. qual domínio é autoridade no MedicsPro?
8. saúde/LGPD/autorização clínica mudam a conclusão?
9. decisão MedicsPro: `ABSORB | ADAPT | INSPIRE | DEFER | REJECT`;
10. qual slice futura recebe o aprendizado?

## Taxonomy discovered

O Deskcomm usa, na prática, tipos distintos de conhecimento:

```text
DOCTRINE
  princípios estáveis / critérios de aceite

ADR
  contexto medido + decisão + recusas + consequências + quando reconsiderar

BUSINESS RULE
  regra observável + origem + enforcement + exceção

PRD
  intenção / problema / resultado desejado

SPEC
  contrato técnico

ARCHITECTURE
  relações, responsabilidades e não-ligações deliberadas

RESEARCH
  investigação; separa CONFIRMADO / INFERIDO / PROPOSTO

EVIDENCE
  prova concreta/visual

TEST / USER JOURNEY
  prova repetível da experiência

RUNBOOK
  operação, diagnóstico, recuperação

CURRENT STATE / AUDIT
  fotografia datada

HANDOFF
  continuidade de execução

RECONCILIATION
  resolve divergência entre contratos/fontes
```

### Provisional MedicsPro lesson

Um único documento não deve tentar ser simultaneamente lei, plano, estado, evidência e handoff.

## First proven findings

### F1 — Measure, don't remember

O próprio `docs/index.md` do Deskcomm carrega contagens históricas que já divergiram da árvore atual.

O projeto respondeu ao problema com uma regra mais forte: quando um fato pode ser medido, preferir registrar **a régua/comando** em vez de eternizar um número mutável.

**MedicsPro decision:** `ABSORB`.

Aplicação candidata:

- fatos mutáveis carregam `audited_against`, data e limitação;
- números derivados do repo devem, quando útil, apontar para a forma de re-medição;
- snapshot nunca deve ser promovido a lei.

### F2 — Authority document != snapshot document

A auditoria de documentação Deskcomm separa:

- autoridade, que deve ser corrigida;
- retrato datado, que deve permanecer honestamente datado;
- registro histórico;
- planejamento.

**MedicsPro decision:** `ABSORB`.

Isso reforça a separação existente entre `AGENTS.md`, `docs/doctrine/`, `docs/CURRENT_STATE.md`, slices, TODO e roadmap.

### F3 — Drift control deserves a first-class mechanism

`docs/specs/RECONCILIATION-LOG.md` registra conflitos entre specs, decide a forma canônica e exige correção cruzada.

**MedicsPro decision:** `ADAPT`.

Não criar ainda um reconciliation log global por reflexo. Primeiro definir quando um conflito merece ADR, correção in-place ou registro de reconciliação.

### F4 — Business rules catalog is useful but not proof

No snapshot auditado o catálogo tem **62 regras**:

- tenancy: 8;
- LGPD: 10;
- WhatsApp: 12;
- pipeline/lead: 8;
- atendimento: 8;
- IA: 11;
- billing/uso: 5.

Todas declaram origem, tipo e enforcement. Porém, na própria prosa do catálogo, apenas **3** regras citam teste diretamente e apenas **5** citam caminho de código diretamente.

Conclusão: excelente como índice semântico; insuficiente como prova de implementação.

**MedicsPro decision:** `ADAPT`.

Se criarmos catálogo de regras, cada regra deve ter ponte verificável para enforcement/teste quando a propriedade for mecânica.

### F5 — Doctrine is strongest when part of a gate

O valor da doutrina Deskcomm não é só o texto. Há exemplos de enforcement mecânico:

- tela sem porta → teste de completude de navegação;
- mapas de arquitetura → teste de coerência;
- provider vazando fora da seam → lint;
- packaging → testes do artefato e do dono do projeto;
- extensão não controla destino livre → teste de propriedade;
- ação destrutiva → testes do call-site.

**MedicsPro decision:** `ABSORB`.

Regra: propriedade enumerável e estável deve ser candidata a teste/lint; julgamento permanece em review/JEV/humano.

### F6 — ADR records the rejected paths and reconsideration trigger

ADRs Deskcomm registram contexto medido, escolha, alternativas rejeitadas, consequências e quando reconsiderar.

**MedicsPro decision:** `ABSORB`.

ADR MedicsPro não deve ser "escolhemos X" apenas; deve guardar a razão e o gatilho que faria a decisão ser reaberta.

### F7 — Architecture source != render; plan != implemented reality

O Deskcomm explicita que JSON pode ser fonte e HTML derivado, e que alguns mapas são planta futura, não fotografia.

**MedicsPro decision:** `ADAPT`.

Mapas futuros do MedicsPro devem declarar sem ambiguidade `AS-IS | TO-BE | TRANSITION`.

### F8 — Research needs epistemic labels

Pesquisas Deskcomm usam a separação `CONFIRMADO | INFERIDO | PROPOSTO`.

**MedicsPro decision:** `ABSORB`.

Isso é especialmente importante ao minerar Deskcomm e Nexus.

### F9 — Journey QA connects product promise to proof

`docs/testing/user-journey-map.md` transforma jornadas em casos P0/P1/P2 com expectativa e evidência observável.

**MedicsPro decision:** `ADAPT`.

Candidatos futuros:

- Professional Journey;
- Patient Journey;
- Reception Journey;
- Owner/Admin Journey;
- Finance Journey.

### F10 — Runbook closes the operational loop

Runbooks deixam explícito que health interno não prova disponibilidade externa e documentam verificação pós-ação.

**MedicsPro decision:** `ABSORB PRINCIPLE`.

Deploy, worker, migration ou integração crítica não fecham no comando de mutação; fecham no readback independente.

## Doctrine mining — initial transfer decisions

| Deskcomm principle | MedicsPro decision | Rationale |
| --- | --- | --- |
| system is relationships, not isolated features | ABSORB | já alinhado ao Living System Gate |
| AI↔human continuity | ABSORB | especialmente importante em atendimento e clínica |
| visible operational log | ADAPT | separar timeline comercial, operacional e clínica |
| no open demand without next step | ADAPT | comercial/operacional sim; clínica exige cuidado com automação |
| information must change decision/action | ABSORB | minimização + UX |
| configurable behavior needs a surface | ABSORB | evita backend operável só por DBA |
| every automation needs feedback | ADAPT | feedback pode terminar em revisão humana |
| observe fast, act at appropriate human/domain time | ABSORB | saúde amplia esse princípio |
| interruptibility scales with irreversibility | ABSORB | financeiro, comunicação e clínica |
| closed/enumerable action space for AI | ABSORB | domain tools estreitas |
| provider capability != business/domain authority | ABSORB | encaixa no Evolution/channel seam |
| destructive effect requires explicit target/consequence | ABSORB | ampliar para clinical history/data migrations |
| version meaning should be operator-centric | INSPIRE | MedicsPro precisa avaliar seu próprio release model |
| self-host packaging doctrine | DEFER/PARTIAL | absorver operação/readback, não copiar distribuição Deskcomm |
| extension marketplace doctrine | DEFER | só quando existir necessidade real de extension platform |
| agency/retainer operating doctrine | REJECT AS PRODUCT AUTHORITY | contexto comercial Deskcomm; não define MedicsPro |

## Important domain-specific adaptations

### Demand entity

O manual Sistema Vivo propõe `demanda` como unidade de propósito, distinta de pessoa e conversa.

Isto é conceitualmente forte, mas **não será copiado automaticamente**.

No MedicsPro já existem unidades diferentes:

- Lead/commercial opportunity;
- Conversation;
- Appointment;
- Encounter;
- financial exception;
- human case/task futuros.

**Decision:** `INSPIRE / DEEP REVIEW`.

Antes de criar uma entidade universal `demand`, provar uma necessidade transversal que não seja bem representada pelos agregados de domínio existentes.

### Contact × Lead × Patient

A auditoria reforça a necessidade de separar identidade, oportunidade e domínio clínico.

**Decision:** `ADAPT` em `MED-CRM-001`.

### AI speaking × operating

O defeito medido no Deskcomm mostrou vazamento de vocabulário/tool data quando falar e operar convivem no mesmo contexto.

**Decision:** `ADAPT STRONGLY`.

Para MedicsPro:

```text
Converser / Front Desk
!= Operator
!= Clinical Intelligence
!= Human Professional
```

Tool output também precisa de projeção apropriada; esconder apenas o nome da tool não resolve vazamento de payload interno.

## Normative phase status

A primeira passagem profunda de Doctrine + ADR + Business Rules foi concluída em [`NORMATIVE-REVIEW.md`](NORMATIVE-REVIEW.md).

Ela distingue explicitamente `PROVEN | PARTIAL | NOT VERIFIED | HISTORICAL / PROVIDER-SPECIFIC` e registra divergências entre catálogo e enforcement atual.

## Deep-audit status

Concluído nesta primeira auditoria profunda:

- Doctrine + ADR + Business Rules → [`NORMATIVE-REVIEW.md`](NORMATIVE-REVIEW.md)
- Specs + Architecture + selected proof tracks → [`SPEC-ARCH-PROOF-REVIEW.md`](SPEC-ARCH-PROOF-REVIEW.md)
- Testing + Evidence + Runbooks/operations → [`TESTING-OPERATIONS-REVIEW.md`](TESTING-OPERATIONS-REVIEW.md)
- Recurring lessons from research/handoffs/plans → [`CROSS-CUTTING-LESSONS.md`](CROSS-CUTTING-LESSONS.md)
- Final capability/slice mapping → [`FINAL-ABSORPTION-SYNTHESIS.md`](FINAL-ABSORPTION-SYNTHESIS.md)

### O que `PROVED` significa aqui

`PROVED` significa que a **auditoria documental/research** foi fechada contra o snapshot declarado, com taxonomia, provas selecionadas, limitações, decisões de absorção e síntese por slice registradas no repositório.

Não significa que qualquer capability Deskcomm foi implementada no MedicsPro. Cada slice de produto continua obrigada a repetir REAL NOW e provar sua própria adaptação.

### Limitação explícita

A auditoria não resume individualmente os 284 arquivos. Ela foi sistemática por taxonomia, documentos de controle, inventários normativos, inventário completo de specs/mapas e rastreamento aprofundado das capabilities de maior valor para o MedicsPro.

Design-system, growth, presentation e documentos históricos adicionais permanecem disponíveis para deep dive quando uma necessidade concreta exigir.

## Next exact step

Usar esta auditoria como referência, não como backlog automático.

O próximo trabalho de produto recomendado é retomar `MED-CRM-001` em modo design-only:

1. repetir REAL NOW na `main` atual;
2. mapear todos os consumidores do CRM patient-centric atual;
3. aplicar os achados de Contact/Lead/Patient, mutation parity e proof levels;
4. responder o MEDICSPRO DOCTRINE GATE;
5. executar SECOND ADVERSARIAL REVIEW/JEV;
6. só então considerar migration/código.
