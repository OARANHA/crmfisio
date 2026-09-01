# MedicsPro — Product Roadmap / TODO

> Documento vivo para orientar produto, arquitetura e implementação. A ordem abaixo prioriza fechar ciclos operacionais antes de ampliar módulos.

## Princípios

- Produto multi-tenant por clínica, com isolamento no banco e RLS.
- Permissões por papel: owner/admin, recepção, fisioterapeuta/médico e futuras funções.
- Conteúdo clínico protegido de perfis administrativos/operacionais quando não necessário.
- Auditoria para ações relevantes e transições de estado.
- Evitar páginas/componentes monolíticos: alvo de até ~500 linhas por arquivo; extrair componentes, hooks e serviços quando necessário.
- Banco como fonte de verdade para regras críticas (tenant, conflitos, transições e integridade).
- Integrações externas desacopladas por filas/outbox, sem acoplar UI diretamente ao provedor.
- UX orientada ao trabalho real da clínica, não apenas CRUD.

## P0 — Fechar comunicação operacional

### Evolution / WhatsApp
- [x] Persistir outbox de mensagens.
- [x] Persistir templates por clínica.
- [x] Preparar confirmação de consultas sem duplicidade.
- [x] Permitir oferta de vaga da lista de espera via outbox.
- [ ] Implementar worker para consumir a outbox e enviar pela Evolution API.
- [ ] Configuração da instância Evolution por clínica sem expor credenciais no frontend.
- [ ] Retry com backoff e limite de tentativas.
- [ ] Idempotência de envio.
- [ ] Webhook de status: enviado, entregue, lido e falhou.
- [ ] Webhook de mensagens recebidas.
- [ ] Correlacionar resposta do paciente ao agendamento/oferta original.
- [ ] Confirmação automática de consulta por resposta válida.
- [ ] Fluxo de cancelamento/remarcação originado pelo WhatsApp com validação operacional.
- [ ] Opt-in/opt-out e trilha de consentimento de comunicação.
- [ ] Painel operacional de falhas e mensagens pendentes.

### Lista de espera / recuperação de vaga
- [x] Cadastro de preferências.
- [x] Identificação de oportunidade compatível.
- [x] Ação manual de oferta.
- [ ] Reservar temporariamente uma vaga durante uma oferta para evitar corrida entre pacientes.
- [ ] Expiração automática da oferta.
- [ ] Aceite da oferta converte em agendamento de forma transacional.
- [ ] Recusa/expiração chama o próximo paciente elegível.
- [ ] Histórico de ofertas por paciente e por vaga.

## P1 — Atendimento em andamento

Criar uma experiência dedicada ao profissional durante a sessão, sem transformar o perfil do paciente em uma tela monolítica.

- [ ] Tela `Atendimento em andamento` iniciada a partir do agendamento.
- [ ] Cabeçalho com paciente, profissional, unidade, sala, horário e sessão/plano.
- [ ] Resumo clínico relevante e última evolução.
- [ ] Queixa/diagnóstico funcional e objetivos terapêuticos.
- [ ] Procedimentos/intervenções realizados na sessão.
- [ ] Escalas e medidas pertinentes (ex.: dor/EVA quando aplicável).
- [ ] Evolução clínica da sessão.
- [ ] Orientações ao paciente.
- [ ] Plano/próxima conduta.
- [ ] Próxima sessão sugerida/agendada.
- [ ] Finalização do atendimento com validações obrigatórias.
- [ ] Assinatura/autoria e timestamp imutáveis na versão final.
- [ ] Correção/adendo posterior sem apagar histórico clínico.
- [ ] Ao finalizar, disparar eventos para financeiro, jornada e comunicação.

## P1 — Agenda premium

- [x] Status e histórico de transições.
- [x] Remarcação/cancelamento com regras de domínio.
- [x] Unidades e salas reais.
- [x] Lista de espera.
- [ ] Visões dia/semana com foco por profissional e sala.
- [ ] Bloqueios de agenda: almoço, reunião, férias, indisponibilidade e manutenção de sala.
- [ ] Jornada/grade recorrente do profissional.
- [ ] Feriados e exceções por unidade.
- [ ] Duração por procedimento/tipo de atendimento.
- [ ] Encaixe com indicação visual de conflito/risco.
- [ ] Busca rápida de próximo horário disponível.
- [ ] Side drawer/stepper para agendamentos complexos quando necessário.

## P1 — Financeiro operacional

Estrutura-alvo:

1. Visão geral
2. Contas a receber
3. Contas a pagar
4. Caixa
5. Pacotes
6. Repasses
7. Conciliação

### Ciclo receita
- [ ] Sessão realizada pode gerar cobrança automaticamente conforme regra da clínica.
- [ ] Vincular cobrança a paciente, atendimento, profissional, unidade e pacote quando aplicável.
- [ ] Formas de pagamento configuráveis.
- [ ] PIX, cartão, dinheiro e boleto preparados como meios distintos.
- [ ] Pagamento parcial e múltiplos meios.
- [ ] Desconto, acréscimo e estorno com permissão/auditoria.
- [ ] Recibo/comprovante.
- [ ] Inadimplência e aging.

### Caixa
- [ ] Abertura e fechamento de caixa.
- [ ] Entradas/saídas e sangrias.
- [ ] Conferência por forma de pagamento.
- [ ] Divergências auditáveis.

### Pacotes
- [ ] Venda de pacote de sessões/procedimentos.
- [ ] Saldo de sessões.
- [ ] Consumo automático ao finalizar sessão.
- [ ] Validade, cancelamento e estorno.

### Repasses
- [ ] Regra de repasse por profissional/procedimento.
- [ ] Competência, previsão e pagamento.
- [ ] Relatório de repasses.

## P2 — UX e design system operacional

Adotar como referência conceitual padrões observados em produtos maduros, sem copiar implementação de terceiros.

- [ ] Documentar padrão Side Drawer + Stepper.
- [ ] Aplicar stepper em cadastros longos (profissional, cobrança/pacote, consentimento e outros quando fizer sentido).
- [ ] Validação por etapa e erro junto ao campo.
- [ ] Padronizar estados loading/empty/error/success.
- [ ] Padronizar confirmação de ações destrutivas.
- [ ] Padronizar badges de status e timelines.
- [ ] Revisar responsividade da recepção e do atendimento clínico.
- [ ] Garantir acessibilidade básica de teclado, foco e contraste.

## P2 — Administração da clínica

- [x] Unidades/sedes.
- [x] Salas.
- [ ] Cadastro e edição completa de profissionais.
- [ ] Cadastro de recepcionistas e demais funções administrativas.
- [ ] Registro profissional (CREFITO/CRM/outros) por categoria.
- [ ] Vínculo profissional ↔ unidades.
- [ ] Horários de trabalho e exceções.
- [ ] Convites, ativação/desativação e redefinição de acesso.
- [ ] Matriz de permissões configurável dentro dos limites seguros do produto.
- [ ] Configurações de agenda por clínica.
- [ ] Configurações financeiras.
- [ ] Configurações de comunicação/Evolution.
- [ ] Identidade da clínica para documentos e mensagens.

## P2 — Documentos e consentimentos

- [x] Templates de consentimento.
- [x] Versionamento/registro de aceite.
- [x] Autofill de dados do paciente/profissional.
- [ ] Visualização do documento assinado em layout final.
- [ ] Geração/download de PDF.
- [ ] Hash/identificador do documento final para integridade.
- [ ] Assinatura eletrônica mais robusta quando necessária.
- [ ] Modelos adicionais: contratos, orientações, declarações e recibos.
- [ ] Histórico documental no prontuário.

## P2 — CRM e relacionamento

- [ ] Timeline única paciente: agendamentos, mensagens, ofertas, documentos e eventos administrativos permitidos.
- [ ] Funil de leads separado do prontuário clínico.
- [ ] Origem do lead/campanha.
- [ ] Follow-ups e tarefas.
- [ ] Conversão lead → paciente sem duplicar cadastro.
- [ ] Campanhas segmentadas respeitando consentimento.
- [ ] Reativação de pacientes inativos.
- [ ] NPS/satisfação pós-atendimento.

## P3 — Estoque e insumos

Somente após agenda, atendimento e financeiro estarem fechando o ciclo principal.

- [ ] Produtos/insumos por clínica/unidade.
- [ ] Estoque mínimo e alertas.
- [ ] Entradas, saídas e ajustes auditados.
- [ ] Lote e validade quando aplicável.
- [ ] Consumo por procedimento/atendimento.
- [ ] Inventário.

## P3 — Galeria e anexos clínicos

- [ ] Upload seguro de anexos por paciente.
- [ ] Categorias e metadados.
- [ ] Controle de acesso clínico.
- [ ] Comparação temporal quando clinicamente útil.
- [ ] Consentimento específico para imagens quando aplicável.
- [ ] Política de retenção/exclusão conforme requisitos legais e LGPD.

## P3 — IA assistiva

A IA deve auxiliar o profissional, nunca alterar prontuário silenciosamente nem tomar decisão clínica autônoma.

- [ ] Resumo longitudinal do prontuário com fontes/eventos rastreáveis.
- [ ] Sugestão de rascunho de evolução a partir de dados fornecidos pelo profissional.
- [ ] Detecção de campos clínicos possivelmente incompletos antes da finalização.
- [ ] Resumo pré-atendimento.
- [ ] Assistência para mensagens administrativas.
- [ ] Classificação de mensagens recebidas (confirmar, cancelar, remarcar, dúvida).
- [ ] Aprovação humana para ações clínicas e ações sensíveis.
- [ ] Auditoria de prompts/saídas relevantes e controles de privacidade.

## P3 — Relatórios e gestão

- [ ] Ocupação da agenda.
- [ ] Taxa de confirmação, cancelamento, no-show e remarcação.
- [ ] Recuperação de receita pela lista de espera.
- [ ] Receita por unidade/profissional/procedimento.
- [ ] Inadimplência.
- [ ] Retenção e retorno de pacientes.
- [ ] Produtividade operacional sem expor conteúdo clínico desnecessário.

## Engenharia / qualidade contínua

- [ ] Manter CI com instalação, typecheck e build.
- [ ] Adicionar lint consistente.
- [ ] Testes unitários para regras de domínio críticas.
- [ ] Testes de integração para RLS/RPCs/transações críticas.
- [ ] Testes E2E dos fluxos: login → agenda → atendimento → cobrança → comunicação.
- [ ] Observabilidade de frontend, Edge Functions e workers.
- [ ] Logs estruturados sem dados sensíveis desnecessários.
- [ ] Backups e procedimento documentado de restauração.
- [ ] Estratégia de migrations idempotentes e versionadas.
- [ ] Revisão periódica de índices e performance PostgreSQL.
- [ ] Revisão periódica de RLS e privilégios.

## Documentação a manter no repositório

- [ ] `docs/architecture.md` — visão de componentes e fronteiras.
- [ ] `docs/rbac.md` — papéis, permissões e regras de acesso.
- [ ] `docs/clinical-workflow.md` — ciclo clínico e estados.
- [ ] `docs/agenda-rules.md` — agenda, conflitos, status e lista de espera.
- [ ] `docs/ui-patterns.md` — drawers, steppers, formulários e feedback.
- [ ] `docs/messaging-outbox.md` — fila, Evolution, retries e webhooks.
- [ ] `docs/financial-workflow.md` — atendimento até caixa/repasse.

## Referências de produto

- Agenda Doutor (`GRLtda/agenda-doutor`): benchmark de amplitude funcional e alguns padrões de UX, especialmente atendimento dedicado, separação financeira e Side Drawer + Stepper. Usar apenas como referência conceitual; não copiar código sem análise de licença, compatibilidade e qualidade.

## Próxima sequência de execução

1. Evolution worker + webhooks + retries.
2. Fechar oferta/aceite automático da lista de espera.
3. Atendimento em andamento.
4. Financeiro: visão geral + contas + caixa + pacotes + repasses.
5. Administração completa de equipe/configurações.
6. Refinar documentos/PDF.
7. CRM/relacionamento.
8. Estoque e galeria.
9. IA assistiva e relatórios avançados.
