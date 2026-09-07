# MedicsPro — Plano de ajuda contextual e manual no painel

Objetivo: transformar a documentação técnica e operacional em ajuda útil dentro do produto, sem poluir a interface e sem depender de um PDF separado para tarefas rotineiras.

## Estado atual

P0 concluído em 2026-09-07:

- conteúdo centralizado/versionado em `src/lib/helpContent.ts`;
- botão `?` reutilizável e drawer lateral;
- ajuda por rota e papel;
- cobertura inicial de Agenda, `/hoje`, Pacientes, Atendimento e Financeiro;
- testes de boundary para impedir instruções incompatíveis com o papel.

P1 e P2 permanecem como evolução de treinamento, descoberta e escala de suporte — não como bloqueadores do piloto controlado.

## Princípios

1. Ajuda deve aparecer no contexto da tarefa.
2. Textos devem ser curtos, acionáveis e específicos por papel.
3. O painel não deve ensinar conceitos que o usuário não precisa naquele momento.
4. A ajuda nunca pode revelar funções que o entitlement ou o papel não permite.
5. Conteúdo de ajuda deve ser versionado junto com o produto.
6. Manual completo pode existir fora da tela, mas a UI deve oferecer o caminho mais curto para concluir a tarefa.

## Camadas de ajuda

### 1. Dica curta na tela

Uso: explicar um campo, status ou ação em uma frase.

Exemplos:

- **Financeiro / Baixar** — "Use Baixar quando o valor realmente tiver sido recebido. O lançamento pago fica protegido contra edição silenciosa."
- **Pacotes** — "A sessão é consumida quando o atendimento é finalizado."
- **Avaliações padrão** — "Modelos oficiais do MedicsPro. Podem ser usados sem criar um modelo próprio."
- **Minhas avaliações** — "Crie e publique modelos próprios quando esse recurso estiver liberado para sua clínica."
- **Nexus** — "Disponível somente para médicos com CRM válido em clínicas autorizadas."

### 2. Tooltip / ícone de ajuda

Uso: explicar termos que não merecem um bloco permanente.

Exemplos:

- entitlement;
- status `atrasado`;
- sessões usadas/restantes;
- `funil_stage` do CRM em linguagem amigável;
- diferença entre avaliação padrão e avaliação personalizada.

### 3. Painel lateral "Como funciona"

Uso: fluxos de 3–7 passos.

Exemplos:

- agendar e confirmar atendimento;
- finalizar atendimento e gerar cobrança;
- vender pacote;
- baixar recebível;
- cadastrar usuário;
- liberar módulo no Platform Admin;
- criar avaliação personalizada;
- usar Nexus como médico.

### 4. Checklist de primeira utilização

Por clínica:

- cadastrar unidade e salas;
- cadastrar equipe;
- cadastrar primeiro paciente;
- configurar agenda;
- revisar módulos liberados;
- cadastrar pacotes, se usados;
- testar fluxo de atendimento;
- revisar Financeiro;
- configurar WhatsApp somente quando liberado.

Por Platform Admin:

- revisar solicitação/provisionamento;
- confirmar owner inicial;
- definir entitlements;
- verificar módulos sensíveis;
- validar auditoria e observabilidade.

### 5. Manual completo

Fonte futura: documentos em `docs/` transformados em manual por perfil.

Estrutura sugerida:

1. Primeiros passos
2. Agenda
3. Pacientes
4. Atendimento clínico
5. Avaliações padrão
6. Minhas avaliações
7. Body map
8. Pacotes
9. Financeiro
10. CRM
11. Mensagens / WhatsApp
12. Relatórios
13. Nexus para médicos
14. Configurações da clínica
15. Administração da plataforma
16. Segurança, permissões e privacidade
17. Perguntas frequentes

## Conteúdo por papel

### Owner / administrador

Priorizar gestão, equipe, configurações, financeiro, pacotes e indicadores.

### Recepção

Priorizar agenda, pacientes, confirmação, cobrança operacional e comunicação permitida.

### Profissional clínico

Priorizar agenda própria, prontuário, avaliações, body map e evolução.

### Médico Nexus

Além do clínico: explicar boundary do Nexus, critérios de acesso, evidências e red flags.

### Financeiro

Priorizar contas a receber/pagar, baixa, histórico, repasses e conciliação futura.

### Platform Admin

Priorizar provisionamento, entitlements, auditoria, observabilidade e diferença entre `Não configurado`, `Liberado` e `Bloqueado`.

## Modelo de conteúdo versionável

A implementação atual usa conteúdo estruturado por contexto em `src/lib/helpContent.ts`, evitando textos operacionais espalhados pelos componentes.

Isso facilita:

- revisão de texto;
- futuro suporte a idioma;
- uso do mesmo conteúdo em tooltip, painel lateral e manual;
- telemetria de quais ajudas são mais abertas.

## Regras de entitlement e papel

O sistema de ajuda deve respeitar exatamente o que o usuário pode usar.

- módulo bloqueado: não apresentar tutorial operacional como se a função estivesse disponível;
- módulo não configurado: usar linguagem neutra durante rollout;
- módulo liberado: mostrar tutorial operacional;
- Nexus: não sugerir liberação automática; explicar exigência de médico + CRM + autorização da clínica;
- `assessments.custom=false`: continuar documentando e permitindo Avaliações padrão, mas esconder instruções de autoria customizada;
- conteúdo por papel deve ser filtrado antes de renderizar o painel.

## Prioridade de implementação

### P0 — concluído

- [x] estrutura central de conteúdo de ajuda;
- [x] botão/ícone `?` reutilizável;
- [x] painel lateral simples;
- [x] ajuda para Agenda, Pacientes, Atendimento e Financeiro.

### P1

- [ ] ajuda para Pacotes, Avaliações, CRM e WhatsApp;
- [ ] checklist inicial por papel;
- [ ] busca no manual.

### P2

- [ ] ajuda Nexus especializada;
- [ ] vídeos curtos/GIFs internos;
- [ ] analytics de ajuda;
- [ ] sugestões contextuais baseadas na tela atual.

## Critério de qualidade

Uma dica só entra no produto se responder pelo menos uma destas perguntas:

- O que é isso?
- Quando devo usar?
- O que acontece depois?
- Por que não consigo acessar?
- Qual é o próximo passo seguro?

Evitar textos promocionais no manual operacional. A ajuda deve reduzir erro, tempo de treinamento e chamados de suporte.
