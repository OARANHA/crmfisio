# MedicsPro — TODO canônico

> Estado em **2026-09-11**. Este arquivo lista trabalho realmente aberto. Fundação já entregue não deve voltar para a fila sem evidência de regressão.

Referências:

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)
- [`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md)
- [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md)
- [`docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`](docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md)
- [`docs/MEDICSPRO_LEGACY_REUSE_MAP.md`](docs/MEDICSPRO_LEGACY_REUSE_MAP.md)
- [`docs/CLINICAL_COCKPIT_V5.md`](docs/CLINICAL_COCKPIT_V5.md)

## Regra de continuidade

Antes de abrir trabalho novo:

1. ler `AGENTS.md`;
2. ler `docs/CURRENT_STATE.md`;
3. identificar se a tarefa pertence ao trilho clínico, ao trilho SaaS/Platform Admin ou aos dois;
4. se houver equivalente maduro no MedicsPro histórico, abrir diretamente os arquivos antigos relevantes e comparar com o runtime atual;
5. classificar `PRESERVAR | EVOLUIR | REDESENHAR | REJEITAR` antes de implementar.

Não iniciar uma tela isolada quando a decisão depende de entitlement, configuração, authorization, provider ou lifecycle.

---

## Fundação já entregue

- [x] Supabase/Auth/RLS multi-tenant com papéis canônicos `owner`, `admin`, `professional`, `recep`, `financeiro`.
- [x] `platform_admin` separado dos papéis internos da clínica.
- [x] Base multiprofissional: role separada de profissão e `professional_id` como referência clínica canônica.
- [x] Entitlements da plataforma separados de configuração da clínica e autorização do usuário.
- [x] Clinician Daily Home (#390).
- [x] Agenda Role-Aware V4 (#391).
- [x] Clinical Encounter UX V4 (#392).
- [x] Legacy Clinical Reconciliation V4.1 (#393).
- [x] Encounter Clinical Record Foundation (#394).
- [x] Production-safe verifier do #394 (#395).
- [x] Consultório / Gestão Privacy Shell (#396).
- [x] Clinical Instrument Authorization Foundation (#399).
- [x] Encounter Temporal Start Boundary (#400), aplicada/verificada em produção.
- [x] Repair controlado do appointment histórico inválido pós-#400 (#402).
- [x] Sincronização documental pós-repair (#404).
- [x] Inventário profundo Platform Admin × histórico (#405).
- [x] Clinic Configuration Core V1 (#406) + verifier/ACL hardening (#407).
- [x] Config UX V1.1 + Assessment Template Library V1 (#409), migration aplicada/verificada em produção.
- [x] Clinical Cockpit V5 + Assessment Runner V2 (#410).
- [x] Correção responsiva do Clinical Cockpit V5 (#411).
- [x] Nexus C-01–C-06 hardening integrado ao runtime MedicsPro.
- [x] Finalização clínica separada de falhas esperadas de cobertura (#388).
- [x] Exceções financeiras explícitas com CHARGE/WAIVE conforme autorização (#389).

---

## AGORA — fechamento imediato do #411

- [ ] Redeploy somente do frontend com a `main` pós-#411.
- [ ] Repetir smoke visual em produção de `Registro`, `Anamneses & Avaliações` e `Nexus`.
- [ ] Confirmar no desktop XL: rail de contexto em 250px à esquerda e workspace principal na coluna flexível à direita.
- [ ] Confirmar mobile/tablet: workspace antes do contexto do paciente.
- [ ] Validar um template com múltiplas seções no Runner V2: seção única, Anterior/Próxima, progresso, required e autosave visual.
- [ ] Se o smoke passar, encerrar V5 visualmente e não continuar polindo sem evidência real de fricção.

**#410/#411 não possuem migration, RPC, RLS ou Edge Function para aplicar.**

---

## P0 — pendências operacionais curtas antes de ampliar piloto

- [ ] Registrar prova read-only pós-finalização do smoke real do #394, se ainda não existir evidência posterior no repositório: Encounter Record finalizado + Evolution oficial + appointment finalizado + efeitos financeiros esperados.
- [ ] Executar/documentar smoke real das ações `CHARGE` e `WAIVE` do #389, se ainda não houver evidência posterior.
- [ ] Atualizar/versionar o verifier antigo #388 que ainda possui assertion obsoleta sobre ausência da RPC criada pelo #389.
- [ ] Consolidar observabilidade mínima dos fluxos de beta antes de ampliar o número de clínicas.
- [ ] Manter smoke de roles/privacy shell em uso real: owner/admin elegível, professional clinical-only, recep/financeiro management-only.

Não reaplicar migrations antigas nem repetir repair por documentação obsoleta.

---

# TRILHO CLÍNICO

## P1 — Clinical Cockpit / Encounter

- [ ] Validar ergonomia do V5 com profissionais reais após o smoke pós-#411.
- [ ] Refinar apenas fricções comprovadas; não reabrir lifecycle, Encounter Record ou boundaries clínicos sem defeito real.
- [ ] Implementar correção/adendo auditável para Encounter Record finalizado; nunca sobrescrever silenciosamente histórico.
- [ ] Melhorar leitura longitudinal/comparação sem tornar histórico editável.
- [ ] Implementar autoentrada no Modo Consultório somente quando existir callback canônico único após iniciar/continuar o próprio Encounter.

## P1 — Anamneses & Avaliações

Estado atual:

- [x] Biblioteca MedicsPro.
- [x] Modelos da clínica.
- [x] criar/editar em drawer.
- [x] draft/version/publish/archive.
- [x] runner por seções no Encounter.
- [x] autosave context-aware.

Ainda aberto:

- [ ] Decidir e implementar `Meus Modelos`/ownership profissional em slice própria, com capability e governança corretas.
- [ ] Curadoria de modelos por profissão/especialidade conforme evidência real do piloto.
- [ ] Busca/filtros/favoritos persistentes somente quando o volume justificar.

## P1 — Instrumentos clínicos multiprofissionais

Preservar:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

Sequência canônica:

1. [x] **Clinical Instrument Authorization Foundation (#399)**.
2. [ ] **Clinician-Assisted Administration** — administração presencial/assistida do mesmo instrumento/versionamento/scoring canônico, com provenance explícita e `appointment_id` quando houver Encounter.
3. [ ] **Encounter Instrument UX** — `Aplicar agora`; `Enviar ao paciente` somente com boundary remoto próprio.
4. [ ] **Integração ao Clinical Cockpit V5** — o cockpit já existe; integrar Instrumentos somente depois que a operação canônica existir.

Requisitos:

- [ ] Preservar PHQ-9/GAD-7 na engine/versionamento/scoring Nexus; não duplicar no Assessment Engine.
- [ ] Diferenciar provenance pelo menos entre `patient_self` e `clinician_assisted`.
- [ ] Garantir que resposta positiva ao item 9 do PHQ-9 permaneça visível e destaque necessidade de avaliação clínica, sem diagnóstico/conduta automática.
- [ ] Resolver relevância/disponibilidade separadamente da autorização efetiva.

## P1 — Documentos clínicos

- [ ] **Prescription / Document Engine V1** com contrato server-side, autoria, emitente/registro profissional, versão/modelo, histórico imutável e PDF/print.
- [ ] Templates de prescrição só depois do contrato do documento emitido existir.
- [ ] Priorizar depois, conforme piloto: solicitação de exame, atestado/declaração, relatório/laudo.
- [ ] Não expor tabs/botões fictícios antes do workflow real.

## P1 — Cobertura deste atendimento

- [ ] Criar componente contextual de cobertura do Encounter sem expor Financeiro global no Consultório.
- [ ] Mostrar somente informação necessária ao atendimento atual: particular/pacote e estado de cobertura/pagamento autorizado.
- [ ] Preservar #388/#389: falha esperada de cobertura não apaga finalização clínica válida.
- [ ] Nunca consumir sessão gratuitamente/silenciosamente.

---

# TRILHO SAAS / PLATFORM ADMIN / CONFIGURAÇÕES

## Princípio obrigatório

```text
PLATFORM ENTITLEMENT
        ↓
CLINIC CONFIGURATION
        ↓
USER AUTHORIZATION / CAPABILITY
        ↓
RESOURCE / ENCOUNTER CONTEXT
```

### S1 — inventário Platform Admin × histórico

- [x] Concluído em #405.
- [x] Gap audit documentado em `docs/PLATFORM_AND_LEGACY_GAP_AUDIT_20260911.md`.

Não repetir S1.

### S2 — Control Plane mínimo

- [ ] lifecycle da clínica;
- [ ] owner/onboarding;
- [ ] plano;
- [ ] entitlements;
- [ ] limites;
- [ ] overrides explícitos/herança;
- [ ] auditoria de mutações da plataforma;
- [ ] consumo/health básico por tenant.

Antes de criar feature registry paralelo, provar que os entitlements atuais não resolvem de forma simples e segura.

### S3 — Configuração da clínica

Entregue:

- [x] identidade da clínica;
- [x] timezone;
- [x] horários de funcionamento;
- [x] units/rooms reutilizados;
- [x] IA visual de Configuração;
- [x] Equipe & Acessos existente;
- [x] Anamneses & Avaliações / Biblioteca MedicsPro / Modelos da clínica;
- [x] Termos/Governança preservados como áreas reais.

Ainda aberto:

- [ ] serviços/procedimentos/duração/recursos quando contrato atual exigir;
- [ ] instrumentos/protocolos tenant-side;
- [ ] comunicação/WhatsApp/templates/automação;
- [ ] financeiro/configuração econômica;
- [ ] integrações/BYOC;
- [ ] governança/LGPD adicional conforme piloto.

### S4 — WhatsApp

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
- [ ] credenciais BYOC quando aplicável.

Preservar fila/idempotência/reconciliação atuais.

### S5 — Catálogos/templates

- [x] Assessment Template Library V1 (#409).
- [ ] `Meus Modelos` profissional, se aprovado com ownership/capability próprio.
- [ ] templates de comunicação com lifecycle/preview/auditoria.
- [ ] templates de documentos clínicos somente depois do Document Engine correspondente.
- [ ] nunca duplicar PHQ-9/GAD-7 como templates genéricos.

### S6 — Receita & Assinaturas da plataforma

- [ ] planos versionados;
- [ ] assinatura SaaS;
- [ ] trial;
- [ ] cobrança/inadimplência;
- [ ] upgrade/downgrade;
- [ ] cancelamento;
- [ ] consumo faturável quando existir;
- [ ] integração de pagamento da plataforma conforme contrato escolhido.

Não misturar receita MedicsPro→clínica com pagamentos paciente→clínica.

### S7 — Delegação e suporte de plataforma

- [ ] Definir capabilities internas para equipe MedicsPro sem usar `public.profiles.role`.
- [ ] Separar Platform Owner / Operations / Finance / Support.
- [ ] Support access deny-by-default, temporário e auditado quando tenant-sensitive.

### S8 — Inteligência operacional

Somente depois das foundations anteriores:

- [ ] onboarding incompleto;
- [ ] consumo próximo do limite;
- [ ] health de integração;
- [ ] churn risk da assinatura SaaS;
- [ ] recomendação de upgrade;
- [ ] incidentes recorrentes por tenant/provider.

---

## P1 — autorização/configuração residual

- [ ] Limpar consumidores residuais de `fisio_id`/nomenclaturas legadas onde houver alternativa segura; `professional_id` continua canônico.
- [ ] Resolver tri-state capability/configuration onde estado desconhecido possa ser confundido com disabled/enabled.
- [ ] Continuar auditando entitlement × clinic configuration × user authorization sem colapsar conceitos.
- [ ] Não liberar Nexus por role, especialidade, PresentationContext ou simples relevância.

## P1 — UX piloto / onboarding

- [ ] Executar piloto assistido com profissionais reais e registrar fricções por tarefa.
- [ ] Medir tempo/cliques de Agenda → Atendimento → Registro → Finalização.
- [ ] Validar desktop/mobile/light/dark nos fluxos principais.
- [ ] Reduzir time-to-value de clínica nova sem criar bypass de provisionamento.

---

## Próxima decisão após o smoke #411

Se o Clinical Cockpit V5 estiver visualmente aprovado, escolher **uma** próxima vertical slice, sem abrir várias foundations ao mesmo tempo.

Candidatas atuais:

1. `Prescription / Document Engine V1`;
2. `Clinician-Assisted Administration` de instrumentos;
3. `Control Plane` mínimo de planos/entitlements/limites.

A decisão deve ser guiada por impacto no piloto e dependências reais, não por paridade com o sistema histórico.
