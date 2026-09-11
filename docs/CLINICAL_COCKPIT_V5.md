# Clinical Cockpit V5 — contrato de UX e continuidade

**Estado:** implementado no runtime canônico em #410, com correção responsiva #411.

**Base funcional de referência:** `main@18eac7291d81952f82c23118ed7c8115780b7782`.

Este documento registra o contrato atual do atendimento ativo após a evolução do Consultório V4 para o Clinical Cockpit V5. Ele não substitui `AGENTS.md`, `docs/CURRENT_STATE.md`, os contratos de Encounter Record, Assessment Engine, capabilities, Nexus, RLS/RPC ou schema.

## Objetivo do V5

O Consultório V5 reduz a experiência de “página infinita” e organiza o atendimento como um cockpit clínico contextual.

A meta é manter o profissional no contexto do paciente/appointment enquanto alterna entre superfícies clínicas reais, sem duplicar prontuário, sem inventar tabs sem contrato e sem relaxar autorização.

## Workspaces atuais

No estado atual, o atendimento ativo expõe somente:

```text
[ Registro ] [ Anamneses & Avaliações ] [ Nexus ]
```

Regras:

- `Registro` é o workspace inicial;
- apenas um workspace principal aparece por vez;
- `Registro` usa o Encounter Record canônico;
- `Anamneses & Avaliações` usa o Assessment Engine canônico;
- `Nexus` reutiliza os componentes/boundaries Nexus existentes;
- Prescrição, Exames, Documentos e Instrumentos não devem aparecer como tabs vazias antes de existir workflow funcional correspondente.

## Layout responsivo canônico

### Desktop XL

```text
┌──────────────────────────────────────────────────────────┐
│ Encounter header + workspace tabs                        │
├──────────────┬───────────────────────────────────────────┤
│ Context rail │ Workspace principal                       │
│ ~250 px      │ flexível                                  │
│              │                                           │
│ estado       │ Registro / Anamnese / Nexus               │
│ paciente     │                                           │
│ CID/consent. │                                           │
└──────────────┴───────────────────────────────────────────┘
```

A correção #411 torna a ordem explícita:

- `aside`: `order-2 xl:order-1`;
- `main`: `order-1 xl:order-2`.

Isso garante que a rail de contexto ocupe a coluna estreita e o workspace clínico use a largura principal.

### Mobile / tablet

O workspace vem primeiro e o contexto do paciente depois.

Não comprimir o editor clínico para manter rail lateral artificial em telas pequenas.

## Registro

O V5 **não altera** o lifecycle do Encounter Record.

Preservar:

- `ClinicalEncounterRecordEditor`;
- autoria e capability existentes;
- draft/revisão/finalização;
- materialização determinística da Evolution oficial;
- finalização do appointment;
- compatibilidade de appointments legados que já possuem Evolution canônica;
- refresh de agenda/financeiro/pacotes após finalização.

Não adicionar segunda Evolution universal.

## Anamneses & Avaliações

O Assessment Runner V2 é a experiência canônica no atendimento ativo.

### Seleção

Quando não existe draft apropriado, o runner usa os modelos publicados permitidos e preserva ranking contextual por profissão/especialidade apenas como relevância, nunca como autorização.

### Preenchimento por seções

Um template pode possuir muitas seções e perguntas, mas a UI mostra apenas a seção ativa.

Características:

- chips/navegação de seções;
- `Anterior` / `Próxima`;
- progresso de respostas;
- indicação de seções com required pendente;
- `heading` e `info` não contam como resposta;
- Body Map permanece componente estruturado dentro da seção do template;
- finalização com required pendente navega para a primeira seção inválida.

Required é gate de finalização da avaliação, não regra automática para bloquear o encerramento global do Encounter quando tal dependência não fizer parte do contrato clínico.

## Autosave seguro

O autosave do Runner V2 foi hardenizado antes do merge da #410.

O coordenador de autosave carrega identidade imutável suficiente:

```text
contextKey
+ draftId
+ snapshot de answers
```

Contrato:

- debounce aproximado de 900 ms;
- snapshot imutável para job agendado;
- gate **antes** da mutation;
- nenhuma mutation de contexto A pode usar answers do contexto B;
- troca de contexto cancela timer/fila obsoletos;
- save A in-flight pode terminar sem alterar UI de B;
- B permanece independente e apto a salvar;
- no mesmo contexto, saves são serializados;
- erro real mostra estado `Não salvo`;
- finalização faz flush do snapshot final antes de finalizar.

Feedback visual:

```text
Alterações não salvas
→ Salvando…
→ Salvo ✓
```

Não mostrar toast a cada autosave bem-sucedido.

## Context switch safety

Trocar paciente/profissional/appointment deve ocultar imediatamente o editor do contexto anterior enquanto o novo resolve.

Nunca permitir:

- flash de respostas do paciente anterior;
- completion de request antigo restaurando estado visual novo;
- mutation de draft anterior com snapshot do novo contexto;
- save in-flight antigo bloqueando permanentemente o novo contexto.

## Nexus

Nexus é um workspace do cockpit, mas sua inclusão é apenas composição de UX.

Preservar:

- C-01–C-06;
- `nexus.*` fail-closed;
- entitlement/capability/identidade/relação assistencial conforme contratos atuais;
- diferença entre relevance e authorization.

Não usar specialty como autorização.

## Instrumentos clínicos

O shell V5 já existe, mas **Instrumentos ainda não são um workspace funcional desta etapa**.

A sequência continua:

```text
[x] Clinical Instrument Authorization Foundation (#399)
[ ] Clinician-Assisted Administration
[ ] Encounter Instrument UX
[ ] Integração no Clinical Cockpit V5
```

PHQ-9/GAD-7 devem continuar reutilizando definição/versionamento/scoring da engine canônica Nexus. Não duplicar no Assessment Engine.

## Prescrição e documentos

O V5 não autoriza criar tabs cenográficas.

Prescrição, solicitação de exames, atestados/declarações, relatórios/laudos e demais documentos devem entrar apenas quando houver contrato real de:

- autoria;
- identidade/registro do emitente quando aplicável;
- template/versionamento;
- snapshot histórico imutável do documento emitido;
- correção/cancelamento apropriados;
- PDF/print;
- autorização server-side.

A UX do MedicsPro histórico pode inspirar ergonomia; a arquitetura antiga não deve ser portada.

## Relação com MedicsPro histórico

Classificação atual:

### PRESERVAR

- paciente/contexto persistente durante a consulta;
- seleção de anamnese/modelo contextual;
- formulário estruturado;
- navegação clínica dedicada ao atendimento;
- feedback explícito de estado de persistência quando verdadeiro.

### EVOLUIR

- anamnese histórica → Assessment Engine versionado;
- navegação por tabs → workspaces reais com authority atual;
- autosave → coordenador context-aware e fail-safe;
- patient context → rail compacta e responsiva.

### REDESENHAR

- formulários extensos → runner por seções;
- documentos clínicos → Document Engine moderno antes da UI;
- futuros Instrumentos → boundary neutro e operação canônica antes da tab.

### REJEITAR

- Vue/Pinia/Mongo/Express antigos;
- checkout como bloqueio clínico;
- tabs mortas por paridade;
- mutação silenciosa de histórico;
- autosave sem proteção de contexto/ordenação;
- autorização por especialidade ou role administrativa.

## Validação pós-#411

Após redeploy do frontend, o smoke visual mínimo deve confirmar:

1. Registro usa a área larga do workspace;
2. Anamneses & Avaliações usa a área larga e mostra uma seção por vez;
3. Nexus usa a área larga;
4. rail de contexto permanece na esquerda em desktop XL;
5. mobile/tablet priorizam workspace;
6. autosave apresenta estado coerente;
7. required pendente leva à seção correta;
8. não há 401/403/409/500 inesperado, React error, loop ou overflow relevante.

Se isso passar, considerar o V5 fechado para esta etapa e registrar somente fricções reais do piloto como follow-up.
