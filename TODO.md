# MedicsPro — TODO canônico

> Estado em **2026-09-10**. Este arquivo lista trabalho realmente aberto. Fundação já entregue não deve voltar para a fila sem evidência de regressão.

Referências: [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md), [`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md), [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md).

## Fundação já entregue

- [x] Supabase/Auth/RLS multi-tenant com papéis canônicos `owner`, `admin`, `professional`, `recep`, `financeiro`.
- [x] `platform_admin` separado dos papéis internos da clínica.
- [x] Base multiprofissional: role separada de profissão e `professional_id` como referência clínica canônica.
- [x] Entitlements da plataforma separados de configuração/autorização do usuário.
- [x] Clinician Daily Home (#390).
- [x] Agenda Role-Aware V4 (#391).
- [x] Clinical Encounter UX V4 (#392).
- [x] Legacy Clinical Reconciliation V4.1 (#393).
- [x] Encounter Clinical Record Foundation (#394).
- [x] Production-safe verifier para #394 (#395).
- [x] Consultório / Gestão Privacy Shell (#396).
- [x] Clinical Instrument Authorization Foundation (#399) implementada no repositório: `clinical.instrument.apply`, catálogo neutro, configuração institucional e boundary Apply in Encounter. **Migration ainda não aplicada em produção.**
- [x] Assessment foundation com modelos estruturados, drafts/versionamento e integração ao atendimento.
- [x] Nexus C-01–C-06 hardening integrado ao runtime MedicsPro.
- [x] Finalização clínica separada de falhas esperadas de cobertura (#388).
- [x] Exceções financeiras explícitas com CHARGE/WAIVE conforme autorização (#389).

## P0 — Pendências operacionais curtas antes de ampliar piloto

- [ ] Registrar prova read-only pós-finalização do smoke real do #394, caso ainda não exista evidência posterior no repositório: Encounter Record finalizado + Evolution oficial + appointment finalizado + efeitos financeiros esperados.
- [ ] Executar/documentar smoke real das ações `CHARGE` e `WAIVE` do #389, se ainda não houver evidência posterior.
- [ ] Atualizar/versionar o verifier antigo #388 que ainda possui assertion obsoleta sobre ausência da RPC criada posteriormente pelo #389. Não usar essa assertion contra o schema atual.
- [ ] Fazer smoke visual e uso real suficiente do Consultório / Gestão (#396), especialmente owner/admin elegível, professional clinical-only, mobile e URL administrativa protegida.
- [ ] Aplicar a migration #399 em produção somente após aprovação/merge explícitos e seguir verifier/rollout; enquanto isso, repository state ≠ production state para essa foundation.
- [ ] Consolidar observabilidade mínima dos fluxos de beta antes de ampliar o número de clínicas.

## P1 — Encounter e ergonomia profissional

- [ ] Refinar ergonomia do Encounter com profissionais reais, reduzindo cliques e fricção sem alterar o lifecycle canônico.
- [ ] Validar linguagem e ordem clínica com médico e demais profissionais do piloto.
- [ ] Implementar correção/adendo auditável para Encounter Record finalizado; nunca sobrescrever silenciosamente histórico.
- [ ] Melhorar leitura longitudinal e comparação de registros sem tornar histórico editável.
- [ ] Implementar autoentrada no Modo Consultório somente quando existir um ponto canônico único após iniciar/continuar o próprio Encounter; não inferir por rota/query ou mera existência de appointment ativo.

## P1 — Instrumentos clínicos multiprofissionais

Decisão canônica para este eixo:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

E também:

```text
Nexus engine registry membership != multiprofessional clinical exposure
```

PHQ-9/GAD-7 e instrumentos semelhantes podem ser multiprofissionais conforme finalidade clínica, protocolo/configuração e contexto. Profissão/especialidade podem informar relevância, ordenação e sugestão; nunca fazem auto-grant. `nexus.*` continua fail-closed e não deve ser concedido apenas para permitir aplicação de instrumento.

Sequência canônica após a #399:

1. [x] **Clinical Instrument Authorization Foundation (#399)** — código/migration entregues no repositório; catálogo neutro expõe explicitamente apenas `phq9`/`gad7`, reutilizando a engine Nexus por referência técnica; rollout de produção ainda pendente.
2. [ ] **Clinician-Assisted Administration** — suportar administração presencial/assistida do mesmo instrumento/versionamento/scoring usado no self-assessment, com provenance explícita e `appointment_id` quando houver Encounter.
3. [ ] **Encounter Instrument UX** — oferecer **Aplicar agora** e, somente quando houver boundary próprio, **Enviar ao paciente** dentro do atendimento, com estados de autorização/relevância distintos e sem criar segunda implementação de PHQ-9/GAD-7 no Assessment Engine.
4. [ ] **Consultório V5 integration/polish** — integrar Instrumentos ao futuro Clinical Cockpit e absorver ergonomia do MedicsPro histórico sem portar arquitetura/autorização/autosave/checkout legados.

Requisitos associados ainda futuros:

- [ ] Implementar a operação Clinician-Assisted Administration; a #399 apenas autoriza o ato em Encounter, não coleta respostas nem calcula/persiste novo resultado multiprofissional.
- [ ] Resolver disponibilidade/relevância de instrumento separadamente da autorização efetiva, considerando profissão, especialidade, protocolo/configuração da clínica e contexto do Encounter.
- [ ] Preservar definição/versão/scoring validados existentes de PHQ-9/GAD-7 na engine Nexus; o catálogo neutro #399 referencia essa engine e não duplica instrumento.
- [ ] Diferenciar provenance de administração pelo menos entre `patient_self` e `clinician_assisted`, sem representar falsamente o profissional como respondente quando apenas administrou/registrou respostas do paciente.
- [ ] Desenhar `Enviar ao paciente` como boundary contextual separado; não transformar appointment ativo em requisito universal de futura entrega remota.
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

## P1 — Configuração financeira e parceria

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
- [ ] Bloqueios/jornada/feriados e exceções por profissional/unidade quando necessários ao piloto.
- [ ] Busca/encaixe de próximo horário com risco de conflito claro.
- [ ] Revisar retry/backoff, observabilidade e falhas do WhatsApp/Evolution ponta a ponta.
- [ ] Evoluir confirmação/remarcação por mensagem somente através dos contratos canônicos e auditáveis.

## P2 — CRM, retenção e relatórios

- [ ] Manter funil comercial separado do prontuário clínico.
- [ ] Timeline integrada somente com eventos que cada ator pode ver.
- [ ] Follow-ups, origem/campanha, reativação e churn risk conforme sinais de uso real.
- [ ] Evoluir relatórios de ocupação, receita, inadimplência e retenção sem expor informação incompatível com role/contexto.

## Engenharia / qualidade contínua

- [x] CI com `npm test`, typecheck, lint, build e dependency audit.
- [x] Verificadores PostgreSQL dedicados para invariantes clínicos/financeiros críticos.
- [x] Production-safe verifier read-only do Encounter Record.
- [ ] Expandir E2E do ciclo paciente → agenda → atendimento → prontuário → financeiro → comunicação.
- [ ] Melhorar observabilidade frontend/Edge Functions/workers e logs estruturados sem payload clínico desnecessário.
- [ ] Revisar periodicamente RLS, grants, `SECURITY DEFINER`, índices e contratos de migrations.
- [ ] Manter runbooks de backup/restore e rollout coerentes com o schema real.

## Fora do contrato atual

Não tratar como TODO implícito sem evidência de necessidade:

- transformar `parceiro`/`sócio` em role;
- criar um segundo runtime Nexus;
- reintroduzir segunda Evolution universal no novo Encounter;
- backfill fictício de Encounter Records históricos;
- usar PresentationContext como autorização;
- religar checkout à conclusão clínica;
- abrir novas foundations já fechadas apenas para “refatorar”.

Após a #399, explicitamente **não tratar como entregue**:

- administração assistida de PHQ-9/GAD-7;
- persistência multiprofissional nova de respostas/resultados;
- UI PHQ/GAD no Encounter;
- `Enviar ao paciente` ou qualquer boundary de entrega remota;
- Enfermagem como identidade profissional suportada;
- relaxamento de C-01…C-06 ou grant de `nexus.*` para resolver instrumentos multiprofissionais.

## Regra de release

`main` é potencialmente deployável. Merge de código deve estar deploy-safe; migrations/Edge Functions seguem ordem explícita de rollout e verifier. Documentação nunca deve afirmar que smoke, produção ou piloto foram validados sem evidência observada.
