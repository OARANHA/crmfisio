# MedicsPro — Product Roadmap / TODO

> Documento vivo. O estado operacional consolidado está em `docs/BETA_READINESS.md`; decisões estratégicas em `PRODUCT_ROADMAP.md`; critérios financeiros em `docs/FINANCIAL_PILOT_ACCEPTANCE.md`.

## Estado validado em 2026-09-05

### Fundação
- [x] Supabase real como fonte de verdade do núcleo.
- [x] Multi-tenant por `clinic_id` com RLS/RBAC.
- [x] `platform_admin` separado dos papéis internos das clínicas.
- [x] Provisionamento idempotente/auditável de clínica + primeiro owner.
- [x] Entitlements persistidos e RPCs de consulta/alteração.
- [x] Unidades e salas reais.
- [x] Backups e verificadores para gates críticos.

### Financeiro core
- [x] Atendimento avulso finalizado gera no máximo um recebível.
- [x] Idempotência do recebível por atendimento.
- [x] Venda de pacote.
- [x] Saldo de sessões.
- [x] Consumo automático unitário ao finalizar sessão.
- [x] Pacote esgotado/vencido bloqueia consumo.
- [x] Baixa por PIX com `paid_at` e histórico.
- [x] Lançamento pago imutável.
- [x] Recepção cria contas a receber.
- [x] Recepção não cria contas a pagar.
- [x] Automação `pendente -> atrasado`.
- [x] Totais da UI conferidos contra `payments`.
- [x] `VERIFY_20260904_FINANCIAL_PILOT_READINESS.sql` limpo.
- [x] Smoke operacional de baixa pela interface.

### Pendências financeiras P1
- [ ] Fluxo auditável para cancelamento após pagamento antecipado: estorno, crédito, retenção ou transferência para reagendamento.
- [ ] Expor na UI cobrança antecipada vinculada ao atendimento.
- [ ] Pagamento parcial e múltiplos meios.
- [ ] Desconto/acréscimo auditável.
- [ ] Recibo/comprovante.
- [ ] Caixa: abertura/fechamento, entradas/saídas, sangria e conferência.
- [ ] Conciliação.
- [ ] Repasse/comissão por profissional/procedimento.
- [ ] NFS-e e documento não fiscal/recibo conforme configuração.

## P0 — Próximo gate: Configurações / Entitlements

Objetivo: Platform Admin controla o que cada clínica pode usar; clínica configura apenas dentro do que foi liberado; RBAC/RLS/RPC continuam sendo a autorização final.

- [ ] Auditar todos os consumidores de `platform_clinic_entitlements`.
- [ ] Garantir enforcement server-side para operações sensíveis.
- [ ] Ocultar/desabilitar navegação de módulos sem entitlement quando apropriado.
- [ ] Validar `finance.access` e `reports.access` na clínica piloto.
- [ ] Validar comportamento de módulo não configurado / explicitamente desabilitado.
- [ ] Garantir que alteração de entitlement não apague histórico.
- [ ] Revisar UX do console Platform Admin para liberação por clínica.
- [ ] Corrigir autofill indevido no formulário de provisionamento.
- [ ] Documentar matriz entitlement × configuração × role.
- [ ] Não habilitar `nexus.access` até o gate médico-only estar concluído.

## P1 — Atendimento clínico em andamento

- [ ] Tela dedicada iniciada a partir do agendamento.
- [ ] Cabeçalho com paciente, profissional, unidade, sala, horário e plano/pacote.
- [ ] Resumo clínico e última evolução.
- [ ] Queixa, objetivos, procedimentos/intervenções e medidas.
- [ ] Evolução clínica da sessão.
- [ ] Orientações e plano/próxima conduta.
- [ ] Próxima sessão sugerida/agendada.
- [ ] Finalização com validações obrigatórias.
- [ ] Autoria e timestamp final imutáveis.
- [ ] Correção/adendo sem sobrescrever histórico.
- [ ] Eventos de finalização conectados a financeiro, jornada e comunicação.

## P1 — Assessment Engine

### Avaliações padrão
- [ ] Templates MedicsPro por especialidade/módulo/plano.
- [ ] Versionamento de templates.
- [ ] Histórico final imutável mesmo após atualização do template.

### Minhas avaliações
- [ ] Builder reutilizável por clínica/profissional.
- [ ] Texto curto/longo, número, data, escolha simples/múltipla, checkbox, escala, medida e anexos.
- [ ] Duplicar avaliação padrão para personalização, sem alterar a canônica.

### Body map / pain map
- [ ] Frente, costas e laterais.
- [ ] Coordenadas/região anatômica estruturadas.
- [ ] Intensidade, tipo de sintoma, lateralidade e nota.
- [ ] Autor/timestamp/avaliação vinculada.
- [ ] Comparação longitudinal.

## P1 — Nexus Clinical Engine

- [ ] Nexus exclusivo para `professional_type='medico'`.
- [ ] Validar contexto CRM/registro médico apropriado.
- [ ] Exigir `nexus.access` efetivo.
- [ ] Nunca usar `role='fisio'` isoladamente como autorização para Nexus.
- [ ] Preservar lógica clínica especializada já existente.
- [ ] Permitir experiência médica comum com especializações diferentes.
- [ ] Evoluir RBAC de `fisio` legado para conceito explícito de profissional clínico sem quebrar compatibilidade.

## P1 — Agenda premium

- [x] Estados e transições protegidos.
- [x] Cancelamento/remarcação com regras de domínio.
- [x] Unidades/salas reais.
- [x] Lista de espera base.
- [ ] Visão dia/semana por profissional e sala.
- [ ] Bloqueios de agenda: almoço, reunião, férias e indisponibilidades.
- [ ] Jornada/grade recorrente do profissional.
- [ ] Feriados e exceções por unidade.
- [ ] Duração por procedimento.
- [ ] Encaixe com risco/conflito visível.
- [ ] Busca rápida de próximo horário.

## P1 — WhatsApp / Evolution

- [x] Outbox persistida.
- [x] Templates por clínica.
- [x] Worker/webhook base e correlação de eventos.
- [x] Automação/orquestração base.
- [ ] Retry/backoff e limites revisados ponta a ponta.
- [ ] Observabilidade operacional completa.
- [ ] Confirmação automática por resposta válida.
- [ ] Cancelamento/remarcação originado no WhatsApp com validação.
- [ ] Opt-in/opt-out e consentimento de comunicação.
- [ ] Painel de falhas e pendências.
- [ ] Oferta de lista de espera transacional com reserva/expiração/aceite.

## P2 — Administração da clínica

- [x] Unidades/sedes.
- [x] Salas.
- [x] Criação segura de usuários por `admin-team`.
- [x] Ativação/desativação/reset de senha no fluxo server-side.
- [ ] Cadastro/edição completa de profissionais.
- [ ] Cadastro de recepção e demais funções pela UI.
- [ ] Registro profissional por categoria (CRM/CREFITO/outros).
- [ ] Vínculo profissional ↔ unidades na UI.
- [ ] Horários de trabalho e exceções.
- [ ] Matriz de permissões configurável dentro dos limites seguros.
- [ ] Configurações de agenda.
- [ ] Configurações financeiras.
- [ ] Configurações de comunicação/Evolution.
- [ ] Identidade visual/documental da clínica.

## P2 — UX / design system

- [ ] Consolidar tokens semânticos para light/dark.
- [ ] Padronizar Side Drawer + Stepper onde reduzir fricção.
- [ ] Loading/empty/error/success consistentes.
- [ ] Confirmações destrutivas padronizadas.
- [ ] Badges/timelines consistentes.
- [ ] Responsividade de recepção e atendimento clínico.
- [ ] Acessibilidade básica de teclado, foco e contraste.
- [ ] Remover aparência de ERP legado e priorizar fluxo contextual.

## P2 — Documentos e consentimentos

- [x] Templates de consentimento.
- [x] Versionamento/registro de aceite.
- [x] Autofill de dados do paciente/profissional.
- [ ] Visualização final do documento assinado.
- [ ] PDF.
- [ ] Hash/identificador de integridade.
- [ ] Assinatura eletrônica robusta quando necessária.
- [ ] Contratos, orientações, declarações e recibos.
- [ ] Histórico documental no prontuário.

## P2 — CRM e relacionamento

- [ ] Timeline única de eventos permitidos do paciente.
- [ ] Funil de leads separado do prontuário clínico.
- [ ] Origem/campanha.
- [ ] Follow-ups e tarefas.
- [ ] Conversão lead → paciente sem duplicação.
- [ ] Campanhas segmentadas com consentimento.
- [ ] Reativação 30/60/90.
- [ ] NPS/satisfação pós-atendimento.
- [ ] Churn risk separado do status operacional do paciente.

## P3 — Relatórios e gestão

- [ ] Ocupação da agenda.
- [ ] Confirmação/cancelamento/no-show/remarcação.
- [ ] Receita recuperada.
- [ ] Receita por unidade/profissional/procedimento.
- [ ] Inadimplência/aging.
- [ ] Retenção e retorno.
- [ ] Produtividade operacional sem exposição clínica desnecessária.
- [ ] ROI mensal do MedicsPro.

## P3 — Estoque e anexos

### Estoque
- [ ] Produtos/insumos por clínica/unidade.
- [ ] Estoque mínimo e alertas.
- [ ] Entradas, saídas e ajustes auditáveis.
- [ ] Lote/validade quando aplicável.
- [ ] Consumo por procedimento.

### Anexos clínicos
- [ ] Upload seguro por paciente.
- [ ] Categorias e metadados.
- [ ] Controle de acesso clínico.
- [ ] Comparação temporal.
- [ ] Consentimento para imagens quando necessário.
- [ ] Retenção/exclusão conforme LGPD.

## P3 — IA assistiva

- [ ] Resumo longitudinal com fontes rastreáveis.
- [ ] Rascunho de evolução a partir de dados fornecidos pelo profissional.
- [ ] Detecção de campos possivelmente incompletos.
- [ ] Resumo pré-atendimento.
- [ ] Assistência administrativa para mensagens.
- [ ] Classificação de mensagens recebidas.
- [ ] Aprovação humana para ações sensíveis.
- [ ] Auditoria de prompts/saídas relevantes e controles de privacidade.

## Engenharia / qualidade contínua

- [x] CI com testes/typecheck/build para PRs em `main`.
- [x] Migrations versionadas para hardenings recentes.
- [x] Verificadores SQL para gates críticos.
- [ ] Adicionar lint consistente.
- [ ] Expandir testes unitários de regras de domínio.
- [ ] Expandir testes de integração para RLS/RPCs/transações.
- [ ] E2E: login → agenda → atendimento → cobrança → comunicação.
- [ ] Observabilidade frontend/Edge Functions/workers.
- [ ] Logs estruturados sem dados sensíveis desnecessários.
- [ ] Procedimento documentado de restauração de backup.
- [ ] Revisão periódica de índices, RLS e privilégios.

## Documentação

- [x] `docs/FINANCIAL_PILOT_ACCEPTANCE.md`.
- [x] `docs/BETA_READINESS.md`.
- [ ] `docs/architecture.md`.
- [ ] `docs/rbac.md`.
- [ ] `docs/clinical-workflow.md`.
- [ ] `docs/agenda-rules.md`.
- [ ] `docs/ui-patterns.md`.
- [ ] `docs/messaging-outbox.md`.
- [ ] `docs/financial-workflow.md`.

## Regra de release

`main` é branch potencialmente deployável. O Portainer atual acompanha o GitHub em ciclos curtos; portanto, todo merge precisa estar deploy-safe e migrations/Edge Functions devem respeitar a ordem de rollout.
