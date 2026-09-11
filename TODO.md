# MedicsPro — TODO canônico

> Estado em **2026-09-11**. Este arquivo lista trabalho realmente aberto. Fundação já entregue não deve voltar para a fila sem evidência de regressão.

Referências:

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)
- [`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md)
- [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md)
- [`docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`](docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md)
- [`docs/MEDICSPRO_LEGACY_REUSE_MAP.md`](docs/MEDICSPRO_LEGACY_REUSE_MAP.md)

## Regra de continuidade

Antes de abrir trabalho novo:

1. ler `AGENTS.md`;
2. ler `docs/CURRENT_STATE.md`;
3. identificar se a tarefa pertence ao trilho clínico, ao trilho SaaS/Platform Admin ou aos dois;
4. se houver equivalente maduro no MedicsPro histórico, abrir diretamente os arquivos antigos relevantes e comparar com o runtime atual;
5. classificar `preservar | evoluir | redesenhar | rejeitar` antes de implementar.

Não iniciar uma tela isolada quando a decisão depende de entitlement, configuração, authorization, provider ou lifecycle.

---

## Fundação já entregue

- [x] Supabase/Auth/RLS multi-tenant com papéis canônicos `owner`, `admin`, `professional`, `recep`, `financeiro`.
- [x] `platform_admin` separado dos papéis internos da clínica.
- [x] Base multiprofissional: role separada de profissão e `professional_id` como referência clínica canônica.
- [x] Entitlements da plataforma separados de configuração/autorização do usuário.
- [x] Platform Admin shell com separação de domínio SaaS.
- [x] Entitlements atuais para `nexus.access`, `finance.access`, `crm.access`, `reports.access`, `assessments.custom`, `whatsapp.access`.
- [x] Clinician Daily Home (#390).
- [x] Agenda Role-Aware V4 (#391).
- [x] Clinical Encounter UX V4 (#392).
- [x] Legacy Clinical Reconciliation V4.1 (#393).
- [x] Encounter Clinical Record Foundation (#394).
- [x] Production-safe verifier para #394 (#395).
- [x] Consultório / Gestão Privacy Shell (#396).
- [x] Clinical Instrument Authorization Foundation (#399), efetiva no stack verificado.
- [x] Encounter Temporal Start Boundary (#400), aplicada/verificada em produção.
- [x] Repair controlado do appointment histórico futuro incorreto decorrente da #400, com audit trail preservado.
- [x] Assessment foundation com modelos estruturados, drafts/versionamento e integração ao atendimento.
- [x] Nexus C-01–C-06 hardening integrado ao runtime MedicsPro.
- [x] Finalização clínica separada de falhas esperadas de cobertura (#388).
- [x] Exceções financeiras explícitas com CHARGE/WAIVE conforme autorização (#389).

---

## P0 — Pendências operacionais curtas antes de ampliar piloto

- [ ] Registrar prova read-only pós-finalização do smoke real do #394, caso ainda não exista evidência posterior no repositório: Encounter Record finalizado + Evolution oficial + appointment finalizado + efeitos financeiros esperados.
- [ ] Executar/documentar smoke real das ações `CHARGE` e `WAIVE` do #389, se ainda não houver evidência posterior.
- [ ] Atualizar/versionar o verifier antigo #388 que ainda possui assertion obsoleta sobre ausência da RPC criada posteriormente pelo #389. Não usar essa assertion contra o schema atual.
- [ ] Fazer smoke visual e uso real suficiente do Consultório / Gestão (#396), especialmente owner/admin elegível, professional clinical-only, mobile e URL administrativa protegida.
- [ ] Consolidar observabilidade mínima dos fluxos de beta antes de ampliar o número de clínicas.

**Não há rollout pendente de #399/#400 neste snapshot. Não reaplicar migrations nem repetir o repair apenas por documentação antiga.**

---

# TRILHO CLÍNICO

## P1 — Encounter e ergonomia profissional

- [ ] Refinar ergonomia do Encounter com profissionais reais, reduzindo cliques e fricção sem alterar o lifecycle canônico.
- [ ] Validar linguagem e ordem clínica com médico e demais profissionais do piloto.
- [ ] Implementar correção/adendo auditável para Encounter Record finalizado; nunca sobrescrever silenciosamente histórico.
- [ ] Melhorar leitura longitudinal e comparação de registros sem tornar histórico editável.
- [ ] Implementar autoentrada no Modo Consultório somente quando existir um ponto canônico único após iniciar/continuar o próprio Encounter; não inferir por rota/query ou mera existência de appointment ativo.

## P1 — Instrumentos clínicos multiprofissionais

Decisão canônica:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

Também:

```text
Nexus engine registry membership != multiprofessional clinical exposure
```

PHQ-9/GAD-7 e instrumentos semelhantes podem ser multiprofissionais conforme finalidade clínica, protocolo/configuração e contexto. Profissão/especialidade podem informar relevância, ordenação e sugestão; nunca fazem auto-grant. `nexus.*` continua fail-closed e não deve ser concedido apenas para permitir aplicação de instrumento.

Sequência canônica:

1. [x] **Clinical Instrument Authorization Foundation (#399)** — efetiva no stack verificado; catálogo neutro expõe explicitamente apenas `phq9`/`gad7`, reutilizando a engine Nexus por referência técnica.
2. [ ] **Clinician-Assisted Administration** — suportar administração presencial/assistida do mesmo instrumento/versionamento/scoring usado no self-assessment, com provenance explícita e `appointment_id` quando houver Encounter.
3. [ ] **Encounter Instrument UX** — oferecer **Aplicar agora** e, somente quando houver boundary próprio, **Enviar ao paciente** dentro do atendimento, com estados de autorização/relevância distintos e sem criar segunda implementação de PHQ-9/GAD-7 no Assessment Engine.
4. [ ] **Consultório V5 integration/polish** — integrar Instrumentos ao futuro Clinical Cockpit e absorver ergonomia do MedicsPro histórico sem portar arquitetura/autorização/autosave/checkout legados.

Requisitos associados:

- [ ] Implementar a operação Clinician-Assisted Administration; #399 apenas autoriza o ato em Encounter, não coleta respostas nem calcula/persiste novo resultado multiprofissional.
- [ ] Resolver disponibilidade/relevância de instrumento separadamente da autorização efetiva.
- [ ] Preservar definição/versão/scoring validados de PHQ-9/GAD-7 na engine Nexus; não duplicar instrumento.
- [ ] Diferenciar provenance pelo menos entre `patient_self` e `clinician_assisted`.
- [ ] Desenhar `Enviar ao paciente` como boundary contextual separado.
- [ ] Garantir que resposta positiva ao item 9 do PHQ-9 permaneça visível e gere destaque para avaliação clínica, sem equivaler isoladamente a diagnóstico e sem gerar conduta/prescrição automática.

## P1 — Documentos clínicos

- [ ] Prescription V1 com contrato server-side, autoria, versão, assinatura/emitente e histórico compatíveis com o piloto.
- [ ] Priorizar demais documentos médicos somente conforme evidência de uso do piloto: atestado/declaração, solicitação de exame, relatório/laudo e outros documentos permitidos.
- [ ] Evoluir anexos/documentos clínicos sem criar botões fictícios antes do contrato canônico existir.

## P1 — Cobertura deste atendimento

- [ ] Criar componente contextual de cobertura do Encounter sem expor o Financeiro global no Consultório.
- [ ] Exibir somente informação necessária ao atendimento atual: particular/pacote e estado de cobertura/pagamento autorizado.
- [ ] Preservar a regra: falha esperada de cobertura (`package_exhausted`, `package_expired`, `package_not_eligible`) **não apaga uma finalização clínica válida**; registrar `appointment_financial_exception`.
- [ ] Nunca consumir sessão gratuitamente/silenciosamente.
- [ ] Manter resolução explícita de exceção: owner/admin `CHARGE|WAIVE`, financeiro `CHARGE`, recep/professional sem resolução.

---

# TRILHO SAAS / PLATFORM ADMIN / CONFIGURAÇÕES

## Princípio obrigatório

Nunca colapsar:

```text
PLATFORM ENTITLEMENT
        ↓
CLINIC CONFIGURATION
        ↓
USER AUTHORIZATION / CAPABILITY
        ↓
RESOURCE / ENCOUNTER CONTEXT
```

E preservar a separação de atores:

```text
Platform Admin → administra o SaaS
Clinic Admin   → configura o tenant
User/Professional → executa ações autorizadas
```

`platform_admin` não recebe acesso implícito ao prontuário.

### P1 — ETAPA 1: inventário Platform Admin atual × MedicsPro histórico

Antes de novas foundations neste eixo:

- [ ] Auditar `PlatformAdminShell`, páginas atuais, `platformAdmin` lib, entitlement RPCs/tabelas, provisioning, audit log e receita/assinaturas existentes.
- [ ] Abrir diretamente no `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83` os equivalentes de:
  - Clinics/lifecycle;
  - Plans;
  - Features;
  - Limits/usage;
  - Subscriptions;
  - WhatsApp;
  - API Keys/integrations;
  - Surveys/templates;
  - Notifications;
  - Platform team/support.
- [ ] Para cada domínio registrar: estado atual, contrato atual, legado útil, risco, lacuna, prioridade 80/20 e próxima slice mínima.
- [ ] Classificar `preservar | evoluir | redesenhar | rejeitar`.

**Não começar por uma nova tela antes deste inventário.**

### P1 — ETAPA 2: Control Plane mínimo

Prioridade 80/20:

- [ ] lifecycle da clínica;
- [ ] owner/onboarding;
- [ ] plano;
- [ ] entitlements;
- [ ] limites;
- [ ] overrides explícitos/herança;
- [ ] auditoria de mutações da plataforma;
- [ ] consumo/health básico por tenant.

Antes de criar um feature registry genérico, provar que os entitlements atuais não resolvem a necessidade de forma simples e segura.

### P1 — ETAPA 3: arquitetura de Configurações da Clínica

Organizar por domínio:

- [ ] Geral: clínica, unidades, horários, dados fiscais.
- [ ] Equipe e acesso.
- [ ] Agenda e atendimento: serviços/procedimentos, duração, recursos.
- [ ] Clínico: Avaliações padrão, Minhas avaliações, instrumentos, documentos, consentimentos, protocolos.
- [ ] Comunicação: WhatsApp, templates, automações, opt-in, NPS.
- [ ] Financeiro: categorias, meios, parceiros/repasse e configurações permitidas.
- [ ] Integrações.
- [ ] Governança/LGPD/auditoria tenant-side.

Nenhum toggle sensível deve existir apenas na UI sem contrato/enforcement real.

### P1 — ETAPA 4: WhatsApp como capability SaaS configurável

Separar responsabilidades:

**Platform Admin**
- [ ] provider/health global;
- [ ] instâncias;
- [ ] consumo/limites;
- [ ] filas/retries/reconciliação;
- [ ] falhas/webhooks.

**Admin da clínica**
- [ ] conectar/configurar número/instância;
- [ ] QR quando aplicável;
- [ ] templates;
- [ ] opt-in;
- [ ] automações/preferências;
- [ ] credenciais BYOC quando esse modelo existir.

**Usuário operacional**
- [ ] ações autorizadas no contexto do paciente/appointment.

Preservar fila/idempotência/reconciliação atuais; não portar a simplicidade do histórico como arquitetura.

### P1/P2 — ETAPA 5: catálogos e templates

- [ ] Implementar UX `Biblioteca MedicsPro` × `Minhas avaliações` sobre Assessment Engine existente.
- [ ] Preservar versionamento e snapshot histórico.
- [ ] Permitir Body Map como componente estruturado quando fizer sentido.
- [ ] Criar templates de comunicação com lifecycle/variáveis/preview e auditoria adequados.
- [ ] Evoluir consentimentos/modelos sobre a foundation atual, sem segunda engine.
- [ ] Documentos clínicos só entram quando o domínio possuir autoria/versionamento/assinatura/correção apropriados.
- [ ] **Nunca** duplicar PHQ-9/GAD-7 como templates genéricos para contornar authorization.

### P2 — ETAPA 6: Receita & Assinaturas da plataforma

Separar de paciente→clínica:

- [ ] planos versionados;
- [ ] assinatura SaaS;
- [ ] trial;
- [ ] cobrança/inadimplência;
- [ ] upgrade/downgrade;
- [ ] cancelamento;
- [ ] consumo faturável quando existir;
- [ ] integração de pagamento da plataforma conforme contrato escolhido.

### P2 — ETAPA 7: delegação e suporte de plataforma

- [ ] Definir capabilities internas para equipe MedicsPro sem usar `public.profiles.role`.
- [ ] Separar conceitualmente Platform Owner, Operations, Finance e Support.
- [ ] Support access deny-by-default.
- [ ] Se suporte futuro precisar dado tenant-sensitive, usar boundary temporário, explícito e auditado.
- [ ] Não criar membership clínica fictícia como bypass universal.

### P2 — ETAPA 8: inteligência operacional

Somente depois das foundations anteriores:

- [ ] onboarding incompleto;
- [ ] consumo próximo do limite;
- [ ] health de integração;
- [ ] churn risk da assinatura SaaS;
- [ ] recomendação de upgrade;
- [ ] incidentes recorrentes por tenant/provider.

---

## P1 — Configuração financeira e parceria da clínica

- [ ] Modelar configuração solo/equipe sem transformar relacionamento econômico em role.
- [ ] Categorias financeiras configuráveis com histórico apropriado.
- [ ] Parceiro/repasse por percentual ou valor fixo, com effective dates/histórico auditável.
- [ ] Definir contrato de remuneração por profissional/procedimento sem assumir comissão fixa global.
- [ ] Pagamento parcial e múltiplos meios, quando o piloto justificar.
- [ ] Desconto/acréscimo auditável, recibo/comprovante, caixa e conciliação conforme evidência operacional.
- [ ] NFS-e e documento não fiscal/recibo como slices próprias, não como requisito para a fundação clínica.

## P1 — Authorization/config residual

- [ ] Limpar consumidores residuais de `fisio_id`/nomenclaturas legadas onde houver alternativa segura; `professional_id` continua canônico.
- [ ] Resolver o issue tri-state capability/configuration onde estado desconhecido possa ser confundido com desabilitado/habilitado.
- [ ] Continuar auditando entitlement × clinic configuration × user authorization sem colapsar os três conceitos.
- [ ] Não liberar Nexus por role, especialidade isolada, PresentationContext ou simples relevância de instrumento.

## P1 — UX pilot / onboarding

- [ ] Executar piloto assistido com profissionais reais e registrar fricções por tarefa, não por preferência estética isolada.
- [ ] Validar desktop/mobile, light/dark, loading/empty/error/success e acessibilidade básica nos fluxos de alta frequência.
- [ ] Reduzir onboarding e time-to-value para clínica nova.
- [ ] Validar operação real de recepção e financeiro sem exposição clínica desnecessária.

## P2 — Agenda e comunicação

- [x] Agenda role-aware, comandos protegidos, conflitos/capacidade e vínculo exato ao Encounter.
- [x] Boundary temporal impede início normal de appointment futuro (#400).
- [ ] Evoluir data operacional para timezone por clínica antes de necessidade geográfica fora da premissa atual; não reabrir #400 prematuramente.
- [ ] Bloqueios/jornada/feriados e exceções por profissional/unidade quando necessários ao piloto.
- [ ] Busca/encaixe de próximo horário com risco de conflito claro.
- [ ] Revisar retry/backoff, observabilidade e falhas do WhatsApp/Evolution ponta a ponta.
- [ ] Evoluir confirmação/remarcação por mensagem somente através dos contratos canônicos e auditáveis.

## P2 — CRM, retenção e relatórios

- [ ] Manter funil comercial da clínica separado do prontuário clínico e do CRM comercial da própria plataforma MedicsPro.
- [ ] Timeline integrada somente com eventos que cada ator pode ver.
- [ ] Follow-ups, origem/campanha, reativação e churn risk conforme sinais de uso real.
- [ ] Evoluir relatórios de ocupação, receita, inadimplência e retenção sem expor informação incompatível com role/contexto.

---

## Engenharia / qualidade contínua

- [x] CI com `npm test`, typecheck, lint, build e dependency audit.
- [x] Verificadores PostgreSQL dedicados para invariantes clínicos/financeiros críticos.
- [x] Production-safe verifier read-only do Encounter Record.
- [x] Regression efetivo da #399 revalidado após #400.
- [ ] Expandir E2E do ciclo paciente → agenda → atendimento → prontuário → financeiro → comunicação.
- [ ] Melhorar observabilidade frontend/Edge Functions/workers e logs estruturados sem payload clínico desnecessário.
- [ ] Revisar periodicamente RLS, grants, `SECURITY DEFINER`, índices e contratos de migrations.
- [ ] Manter runbooks de backup/restore e rollout coerentes com o schema real.
- [ ] Para novas mutations de Platform Admin, incluir audit trail, cross-tenant negative tests e browser-direct access tests quando aplicável.

---

## Fora do contrato atual

Não tratar como TODO implícito sem evidência de necessidade:

- transformar `parceiro`/`sócio` em role;
- criar um segundo runtime Nexus;
- reintroduzir segunda Evolution universal no novo Encounter;
- backfill fictício de Encounter Records históricos;
- usar PresentationContext como autorização;
- religar checkout à conclusão clínica;
- abrir foundations fechadas apenas para “refatorar”;
- criar `platform_admin` em `public.profiles.role`;
- conceder acesso clínico universal ao suporte da plataforma;
- criar feature registry paralelo sem antes avaliar os entitlements atuais;
- copiar Plan/Feature/WhatsApp do legado como arquitetura;
- misturar assinatura do SaaS com contas a receber de pacientes;
- criar templates genéricos de PHQ-9/GAD-7.

Explicitamente **não tratar como entregue**:

- administração assistida de PHQ-9/GAD-7;
- persistência multiprofissional nova de respostas/resultados;
- UI PHQ/GAD no Encounter;
- `Enviar ao paciente` ou qualquer boundary de entrega remota;
- Enfermagem como identidade profissional suportada;
- relaxamento de C-01…C-06 ou grant de `nexus.*` para resolver instrumentos multiprofissionais;
- Control Plane completo descrito no documento de plataforma;
- Configurações da Clínica reorganizadas conforme a arquitetura futura;
- biblioteca global completa de templates;
- delegated Platform Support com acesso tenant-sensitive.

---

## Regra de release

`main` é potencialmente deployável. Merge de código deve estar deploy-safe; migrations/Edge Functions seguem ordem explícita de rollout e verifier. Documentação nunca deve afirmar que smoke, produção ou piloto foram validados sem evidência observada.

Para docs/arquitetura, diferenciar sempre:

```text
CANÔNICO IMPLEMENTADO
CANÔNICO DOCUMENTADO/FUTURO
LEGADO ÚTIL
IDEIA NÃO APROVADA
```
