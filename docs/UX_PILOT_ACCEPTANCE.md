# MedicsPro — UX Pilot Acceptance

Roteiro curto para validar as superfícies de maior frequência antes de marcar `UX / design system` como GREEN no piloto.

## Objetivo

Validar uso real, hierarquia visual, privacidade de apresentação e responsividade sem reabrir foundations já estabilizadas.

O teste deve priorizar fricção operacional, clareza e segurança, não gosto estético isolado.

## Telas prioritárias

1. Meu dia / Dashboard clínico (`/dashboard` em Consultório)
2. Agenda (`/agenda`)
3. Pacientes (`/pacientes`)
4. Atendimento / Encounter (`/pacientes/:id` com appointment em andamento)
5. Gestão/Financeiro para atores autorizados (`/financeiro` em Gestão)

## Evidência mínima

Registrar uso/screenshot real das superfícies principais no frontend efetivamente implantado.

Repetir os pontos críticos em:

- tema claro e escuro;
- largura mobile (~390 px) para Agenda/Encounter e privacy shell;
- loading/empty/error/success;
- drawer/modal principal quando aplicável.

Não marcar UX como validada se a evidência for apenas de componente isolado ou CI.

## Critérios transversais

- ação principal evidente sem competir com ações secundárias;
- contexto de paciente/appointment/profissional claro durante atendimento;
- nenhum texto essencial truncado sem alternativa;
- sem overflow horizontal que impeça operação;
- áreas de clique confortáveis;
- loading, vazio, erro, conflito e sucesso distinguíveis;
- dark/light preservam hierarquia;
- conteúdo clínico não aparece em superfície operacional para preencher espaço;
- informação financeira não é apresentada como caixa/receita quando representa pipeline ou valor nominal;
- ação proibida por role/capability não aparece como convite enganoso;
- PresentationContext nunca substitui autorização real.

## 1. Meu dia / Consultório

### Cenário

Entrar como professional e como owner/admin clinicamente elegível.

### Aceitação

- professional entra no contexto clínico disponível e não recebe ação para Gestão;
- owner/admin elegível consegue identificar e alternar Consultório/Gestão conscientemente;
- owner/admin não clínico não recebe opção Consultório;
- recep/financeiro não recebem controle clínico;
- Meu dia destaca agenda/atendimento/pendências clínicas sem Financeiro global;
- resolução de elegibilidade não pisca dashboard/chrome administrativo antes de confirmar o contexto;
- autoentrada automática após iniciar atendimento **não é expectativa atual**.

## 2. Agenda

### Cenário

Abrir período com appointments em estados diferentes e, quando permitido, iniciar/continuar o próprio atendimento.

### Aceitação

- criação/agendamento tem ação primária clara para o ator autorizado;
- alternância de período e filtros são compreensíveis;
- appointment mostra horário, paciente e contexto sem poluição excessiva;
- outro profissional não recebe comando clínico indevido sobre sessão alheia;
- appointment `em_atendimento` conduz naturalmente ao Encounter;
- resumo de agenda não é confundido com caixa financeiro;
- mobile continua operável sem esconder a ação principal.

## 3. Pacientes

### Cenário

Abrir diretório com múltiplos pacientes e usar busca.

### Aceitação

- busca operacional é clara;
- diretório não vira vazamento de prontuário: identificação/contato/jornada podem aparecer conforme autorização, mas conteúdo clínico detalhado fica no contexto apropriado;
- `Novo paciente` possui hierarquia adequada para quem pode cadastrar;
- clique/ação deixa claro que abre o paciente correto;
- tabela/lista funciona em notebook/mobile conforme o desenho previsto;
- estado sem resultados orienta sem inventar dados.

## 4. Atendimento / Encounter

### Cenário

Abrir um paciente com relação assistencial e appointment próprio `em_atendimento`.

### Aceitação

- paciente, appointment, horário e profissional aparecem antes do registro clínico;
- Encounter Record é percebido como o único registro editável principal da consulta;
- seções motivo/demandas, HDA, achados/exame, avaliação/problemas, plano/conduta e observações são compreensíveis sem parecer wizard rígido;
- draft salvo mostra estado real de persistência/revision;
- refresh/navegação não perde conteúdo já confirmado;
- Assessment estruturada aparece como opcional, não como segundo prontuário;
- o profissional não é obrigado a preencher uma segunda Evolution universal;
- `Revisar e concluir` deixa claro o efeito definitivo;
- após confirmação humana, o comportamento esperado é Encounter Record finalizado + Evolution oficial determinística + appointment finalizado;
- correção/addendum de finalizado não deve aparecer como edição silenciosa enquanto essa feature não existir;
- conteúdo histórico permanece read-only;
- actor sem relação/autorização não recebe conteúdo clínico parcial enganoso.

## 5. Financeiro e privacy boundary

### Cenário A — Gestão autorizada

Abrir Financeiro como owner/admin/financeiro que realmente possua autorização/entitlement.

### Aceitação

- recebido, a receber, a pagar e saldo são visualmente distinguíveis;
- `Baixar` comunica liquidação real;
- lançamento pago não sugere edição silenciosa;
- pacotes/exceções possuem contexto e status claros;
- resolução #389 respeita autorização: owner/admin `CHARGE|WAIVE`, financeiro `CHARGE`.

### Cenário B — Consultório

Com Consultório ativo, tentar `/financeiro`, `/crm`, `/relatorios` e `/config` conforme o ator.

### Aceitação

- superfícies administrativas não aparecem silenciosamente dentro do contexto clínico;
- guards reais continuam decidindo autorização;
- owner/admin elegível já autorizado recebe privacy boundary e opção explícita de sair do Consultório;
- professional clinical-only nunca recebe botão de Gestão;
- finance cards zerados não aparecem como falso estado por causa do privacy shell.

## Semântica financeira a observar

Não esperar “pacote esgotado/vencido bloqueia finalização clínica”.

Após #388, `package_exhausted`, `package_expired` e `package_not_eligible` devem gerar exceção financeira explícita sem apagar uma finalização clínica válida e sem consumo gratuito silencioso.

## Severidade de achados

### P0 visual/operacional

Bloqueia piloto ou pode causar operação errada:

- ação principal invisível/ambígua;
- botão que convida ação proibida;
- conteúdo sensível em superfície errada;
- modal/drawer impossível de operar;
- overflow que impede tarefa;
- estado financeiro/clínico apresentado com significado incorreto;
- PresentationContext aparentando conceder autorização.

### P1

Atrito frequente sem quebra estrutural:

- hierarquia ruim;
- densidade excessiva;
- contexto clínico fácil de perder;
- filtros difíceis;
- texto pouco legível;
- loading/empty sem orientação;
- mobile desconfortável;
- troca Consultório/Gestão pouco clara para owner/admin elegível.

### P2

Polimento:

- microcopy;
- espaçamento fino;
- animação;
- iconografia.

## Regra de fechamento

`UX / design system` só vira GREEN quando:

1. não houver P0 visual/operacional aberto nas jornadas prioritárias;
2. principais P1 observados tiverem correção ou aceite explícito;
3. dark/light não apresentarem regressão funcional;
4. Agenda e Encounter forem verificados em mobile;
5. privacy shell for observado com professional e owner/admin elegível;
6. profissional real conseguir completar Agenda → Encounter → revisão/conclusão sem depender de explicação externa para ações básicas.

Foundation técnica GREEN não substitui essa evidência de uso real.