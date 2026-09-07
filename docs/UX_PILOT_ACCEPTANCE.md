# MedicsPro — UX Pilot Acceptance

Roteiro curto para validar as superfícies de maior frequência antes de marcar `UX / design system` como GREEN no piloto.

## Objetivo

Validar uso real, hierarquia visual e responsividade sem reabrir regras core já estabilizadas.

O teste deve priorizar fricção operacional, não gosto estético isolado.

## Telas prioritárias

1. Agenda (`/agenda`)
2. Pacientes (`/pacientes`)
3. Atendimento / prontuário (`/pacientes/:id`, preferencialmente com sessão em andamento)
4. Financeiro (`/financeiro`)

## Evidência mínima

Para a primeira passagem, registrar screenshots reais das quatro telas em desktop após o deploy atual.

Se não houver bloqueador visual importante, repetir os pontos críticos em:

- tema claro;
- largura mobile (~390 px);
- modal/drawer principal de cada fluxo quando aplicável.

## Critérios transversais

Cada tela deve passar nos itens abaixo:

- ação principal evidente sem competir com ações secundárias;
- título, contexto e estado atual legíveis em menos de alguns segundos;
- nenhum texto essencial truncado sem alternativa de acesso;
- nenhum overflow horizontal da página inteira; tabelas podem ter scroll próprio quando necessário;
- botões e controles com área de clique confortável;
- loading, vazio, erro e sucesso distinguíveis;
- dark/light preservam a mesma hierarquia;
- conteúdo clínico não aparece em superfície operacional só para preencher espaço;
- informação financeira não é apresentada como receita/caixa quando representa apenas valor nominal ou pipeline;
- ações proibidas pelo papel não aparecem como convite clicável para depois falhar no backend.

## 1. Agenda

### Cenário

Abrir semana atual com pelo menos algumas sessões em estados diferentes.

### Aceitação

- `Nova sessão` é a ação primária mais clara;
- alternância dia/semana/mês e navegação de período são compreensíveis;
- filtros não dominam a tela quando fechados;
- sessão mostra horário, paciente e sala sem poluição excessiva;
- status/WhatsApp não tornam o card ilegível;
- drag-and-drop não parece disponível para papéis que não podem operar;
- fisioterapeuta não recebe ação clínica sobre sessão de colega;
- sessão em atendimento direciona para continuação no prontuário;
- resumo do período não é confundido com caixa financeiro.

## 2. Pacientes

### Cenário

Abrir diretório com múltiplos pacientes e usar busca.

### Aceitação

- busca por nome/telefone/e-mail/CPF é clara;
- diretório permanece operacional: identificação, contato, convênio, jornada, última visita e status;
- queixa principal/CID não aparecem como colunas clinic-wide;
- `Novo paciente` tem hierarquia adequada;
- clique na linha deixa claro que abre o paciente;
- tabela permanece utilizável em notebook e não causa overflow da página;
- estado sem resultados orienta ajuste de filtros/busca.

## 3. Atendimento / prontuário

### Cenário

Abrir um paciente com relação assistencial e, idealmente, sessão `em_atendimento`.

### Aceitação

- identidade do paciente e contexto da sessão aparecem antes dos formulários;
- tabs têm hierarquia clara e não parecem uma segunda navegação global;
- sessão em andamento leva naturalmente para Evoluções;
- avaliação, evolução, sessões e documentos são distinguíveis;
- ação de finalizar só aparece/funciona no contexto correto;
- falta de evolução explica por que a finalização está bloqueada;
- leitura por owner/admin não sugere autoria clínica;
- conteúdo bloqueado por relação assistencial não aparece parcialmente de modo confuso.

## 4. Financeiro

### Cenário

Abrir contas a receber e Pacotes com dados reais ou representativos.

### Aceitação

- recebido, a receber, a pagar e saldo são visualmente distinguíveis;
- usuário read-only entende que está consultando e não operando caixa;
- `Baixar` deixa claro que significa liquidação real;
- lançamento pago não sugere edição silenciosa;
- Pacotes parecem um fluxo próprio, não um lançamento financeiro genérico;
- renovação/risco de pacote não é confundido com churn clínico;
- exceções pré-pagas não ficam escondidas atrás de ação genérica de cancelar;
- valores, status e método permanecem legíveis sem excesso de monospace.

## Severidade de achados

### P0 visual/operacional

Bloqueia piloto ou pode causar operação errada:

- ação principal invisível/ambígua;
- botão que convida ação proibida;
- conteúdo sensível em superfície errada;
- modal impossível de usar;
- overflow que impede operação;
- status financeiro/clínico apresentado com significado errado.

### P1

Não bloqueia, mas gera atrito frequente:

- hierarquia ruim;
- densidade excessiva;
- filtros difíceis de encontrar;
- texto pouco legível;
- estado vazio sem orientação;
- mobile desconfortável.

### P2

Polimento:

- microcopy;
- espaçamento fino;
- animação;
- detalhes de iconografia.

## Regra de fechamento

`UX / design system` só deve virar GREEN quando:

1. nenhuma das quatro telas tiver P0 visual/operacional aberto;
2. os principais P1 encontrados na passagem real tiverem correção ou decisão explícita de aceite;
3. dark/light não apresentarem regressão funcional;
4. pelo menos Agenda e Atendimento forem verificadas em mobile;
5. o piloto real conseguir completar o fluxo diário sem depender de explicação externa para ações básicas.
