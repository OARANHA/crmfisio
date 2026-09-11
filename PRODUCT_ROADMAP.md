# MedicsPro — Product Roadmap

**Estado em 2026-09-11**

## North Star

**Receita protegida/recuperada + eficiência operacional + qualidade clínica por clínica/mês.**

MedicsPro deve provar valor financeiro e operacional sem abrir mão de segurança clínica, multi-tenant, auditabilidade e excelente UX.

O produto é um SaaS multiprofissional para clínicas: **ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente**.

Fluxo central:

**Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação**

O núcleo clínico é compartilhado. Profissão, especialidade, identidade e capabilities compõem ferramentas; role operacional não define profissão.

O produto possui dois trilhos de evolução que se conectam por contratos explícitos:

```text
TRILHO CLÍNICO / TENANT
Paciente → Agenda → Encounter → Prontuário → Documentos → Financeiro → Comunicação

TRILHO SAAS / CONTROL PLANE
Platform Admin → Clínica → Plano/Entitlements → Configuração → Provedores → Receita/Governança
```

Nenhum trilho deve obter poder implícito sobre o outro.

Para instrumentos clínicos, preservar:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

Para o SaaS, preservar:

```text
PLATFORM ENTITLEMENT
        ↓
CLINIC CONFIGURATION
        ↓
USER AUTHORIZATION / CAPABILITY
        ↓
RESOURCE / ENCOUNTER CONTEXT
```

Para exposição multiprofissional, preservar:

```text
Nexus engine registry membership != multiprofessional clinical exposure
```

Referência canônica adicional para o trilho SaaS:

[`docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`](docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md)

---

## FOUNDATION DONE

Estas foundations não devem ser reabertas sem evidência concreta de regressão ou novo requisito incompatível.

### Identidade, tenant e autorização

- multi-tenant por clínica com Auth/RLS/RBAC;
- papéis canônicos `owner`, `admin`, `professional`, `recep`, `financeiro`;
- `platform_admin` separado do domínio interno da clínica;
- `professional_id` como referência clínica canônica, com `fisio_id` apenas como compatibilidade residual;
- entitlement da plataforma, configuração da clínica e autorização do usuário tratados como conceitos distintos;
- identidade/capability/autoria/relação assistencial como boundary de atos clínicos.

### Platform Admin foundation

- shell de Platform Admin separado do shell da clínica;
- onboarding/provisionamento de clínica existente como domínio próprio;
- audit log da plataforma;
- entitlements por clínica já existentes para `nexus.access`, `finance.access`, `crm.access`, `reports.access`, `assessments.custom`, `whatsapp.access`;
- Nexus com default conservador quando não configurado;
- separação explícita entre entitlement e autorização clínica.

Isso **não** significa Control Plane completo. Planos, limites, overrides, assinaturas, provedores, catálogos e delegação de equipe de plataforma ainda possuem evolução futura descrita neste roadmap.

### Nexus C-01–C-06

- Nexus integrado ao runtime MedicsPro, com `OARANHA/nexus` apenas como upstream/lab;
- o **Nexus médico avançado** mantém os boundaries C-01–C-06 atuais e `nexus.*` fail-closed;
- entitlement + capability + identidade médica válida + relação assistencial + autorização server-side continuam sendo exigências onde o boundary Nexus atual as define;
- especialidade informa relevância, não concede autorização;
- o fato de PHQ-9/GAD-7 reutilizarem implementação/scoring do subsistema Nexus não transforma esses instrumentos em atos universalmente médico-only;
- não flexibilizar C-06 nem alterar o significado atual de `nexus.eem` para resolver multiprofissionalidade.

### Fluxo clínico #390–#396

- #390 — Clinician Daily Home;
- #391 — Agenda Role-Aware V4;
- #392 — Clinical Encounter UX V4;
- #393 — Legacy Clinical Reconciliation V4.1;
- #394 — Encounter Clinical Record Foundation;
- #395 — production-safe verifier read-only do #394;
- #396 — Consultório / Gestão Privacy Shell.

O Encounter Record é a unidade editável do novo atendimento. O profissional registra motivo/demandas, HDA/história atual, achados/exame, avaliação clínica/problemas, plano/conduta e observações uma única vez. Após confirmação humana, o registro gera determinísticamente a Evolution oficial e o appointment é finalizado.

### Clinical Instrument Authorization Foundation (#399)

Implementada e efetiva no stack verificado.

A foundation entrega:

- `clinical.instrument.apply` como capability neutra explícita e sem auto-grant;
- `clinical_instrument_catalog` como allowlist multiprofissional controlada, inicialmente somente `phq9` e `gad7`;
- referência técnica dos itens do catálogo aos contratos versionados da engine Nexus, sem duplicar perguntas, validação ou scoring;
- `clinic_clinical_instrument_settings` com default conservador `false`;
- `can_apply_clinical_instrument_in_encounter(...)` como primeiro boundary contextual;
- owner/admin sujeitos às mesmas boundaries clínicas, sem bypass;
- helper base não executável pelo browser.

Uma futura escala presente em `nexus_result_contracts` não é automaticamente exposta no catálogo clínico neutro.

A #399 **não** implementa administração assistida, persistência multiprofissional nova, UI PHQ/GAD nem entrega remota.

### Encounter Temporal Start Boundary (#400)

Implementada, mergeada e verificada em produção.

- appointment futuro não pode iniciar normalmente `em_atendimento`;
- data operacional é centralizada pelo helper canônico atual;
- guard de INSERT/UPDATE protege o início;
- trusted maintenance permanece separado do fluxo browser;
- #399 recebeu defesa em profundidade temporal;
- regression efetivo da #399 foi reexecutado após #400;
- verifier histórico não congela implementação de timezone.

O appointment histórico conhecido que havia ficado em `em_atendimento` no futuro foi reparado de forma controlada para `agendado`, com audit trail e draft de assessment vazio preservado.

Timezone por clínica é evolução futura antes de expansão geográfica que a exija; não reabrir #400 agora.

### Assessment Engine

A foundation de Assessment permanece multiprofissional e reutilizável para avaliações estruturadas. Ela serve como referência arquitetural de templates/versionamento/autoria/lifecycle, mas **não deve receber uma segunda implementação de PHQ-9/GAD-7 apenas para contornar o boundary Nexus atual**.

Preservar definição/versão/scoring validados existentes de PHQ-9/GAD-7 na engine canônica.

### Finalização clínica × financeiro

Após #388, falhas esperadas de cobertura não devem apagar uma finalização clínica válida. `package_exhausted`, `package_expired` e `package_not_eligible` geram `appointment_financial_exception`, sem consumo gratuito silencioso.

#389 adiciona resolução explícita:

- owner/admin: `CHARGE` ou `WAIVE`;
- financeiro: `CHARGE`;
- recep/professional: sem resolução.

Parceiro/repasse não é autorização.

---

## PILOT HARDENING — PRIORIDADE IMEDIATA

Fundação técnica pronta não equivale a UX validada por profissionais externos.

### 0. Fechar smoke e observabilidade pendentes

Antes de ampliar o piloto ou abrir várias foundations novas:

- registrar a comprovação read-only pós-finalização do smoke real #394, se não houver evidência posterior no repositório;
- registrar smoke real de `CHARGE` e `WAIVE` do #389, se ainda pendente;
- atualizar/versionar o verifier antigo #388 cuja assertion sobre ausência da RPC #389 ficou obsoleta;
- fazer smoke visual/uso real do Consultório/Gestão #396;
- garantir observabilidade suficiente para distinguir erro clínico, financeiro, entitlement e UX.

Não há rollout pendente de #399/#400 neste snapshot.

### Validação UX

- medir tempo/cliques do fluxo agenda → atendimento → registro → conclusão;
- testar owner/admin clínico, professional clinical-only, recepção e financeiro com dados realistas;
- validar desktop/mobile e light/dark nos fluxos principais;
- tratar loading/empty/error/success como parte do produto;
- registrar fricções observadas, não apenas preferências subjetivas.

---

# ROADMAP DO TRILHO CLÍNICO

## 1. Encounter UX / clinical-professional ergonomics

Aprimorar o ambiente de atendimento com evidência de profissionais reais, sem trocar o lifecycle já fechado.

Prioridades:

- menos navegação e contexto persistente do paciente/appointment;
- leitura longitudinal eficiente;
- correção/adendo auditável de Encounter Record finalizado;
- linguagem e ergonomia adequadas a diferentes profissionais;
- autoentrada em Consultório apenas quando houver callback canônico único pós-início/continuação do Encounter.

## 2. Cobertura deste atendimento

Adicionar informação financeira **contextual ao Encounter**, não o Financeiro global.

Mostrar somente o necessário ao atendimento atual, como particular/pacote e estado de cobertura permitido. Preservar #388/#389 e o privacy shell: saldo global, faturamento, lucro, repasse de outros profissionais e caixa da clínica continuam fora do Consultório.

## 3. Clinical Instruments — PHQ-9 / GAD-7

Instrumentos como PHQ-9/GAD-7 são potencialmente multiprofissionais conforme finalidade clínica, protocolo/configuração e contexto. Exemplos de contextos relevantes incluem Psiquiatria, Medicina de Família/APS, Clínica Médica, equipes de saúde mental, Enfermagem em APS/Saúde da Família e outros profissionais quando houver indicação/protocolo apropriado.

Esses exemplos orientam relevância; **não são ACL e não fazem auto-grant**. Enfermagem ainda não foi adicionada à identidade profissional suportada pelo runtime nesta slice.

Estado canônico:

```text
[x] Clinical Instrument Authorization Foundation (#399)
[ ] Clinician-Assisted Administration
[ ] Encounter Instrument UX
[ ] Consultório V5 integration/polish
```

### 3.1 Clinician-Assisted Administration

Próxima slice deste eixo: permitir a administração presencial do mesmo instrumento durante o atendimento, sem depender de celular/WhatsApp.

Contrato esperado:

- respostas pertencem ao paciente;
- profissional administra/registra as respostas;
- `appointment_id` quando houver Encounter;
- instrumento e versão explícitos;
- mesmo scoring validado do self-assessment;
- provenance diferenciada, conceitualmente `patient_self` ou `clinician_assisted`;
- autoria do ato profissional preservada;
- resultado não equivale a diagnóstico automático;
- nenhuma flexibilização da persistência doctor-only Nexus apenas para obter multiprofissionalidade; se necessário, persistência clínica neutra será slice própria.

### 3.2 Encounter Instrument UX

Depois da operação canônica existir, expor no atendimento:

```text
PHQ-9
[Aplicar agora] [Enviar ao paciente]

GAD-7
[Aplicar agora] [Enviar ao paciente]
```

`Enviar ao paciente` ainda requer boundary próprio e não deve herdar automaticamente o requisito de appointment ativo do Apply in Encounter.

O modo de aplicação não muda identidade, versão nem scoring do instrumento. A UI deve diferenciar autorização de relevância.

Requisito de segurança do PHQ-9: resposta positiva ao item 9 deve permanecer visível e gerar destaque para avaliação clínica, sem equivaler isoladamente a diagnóstico e sem gerar conduta/prescrição automática.

### 3.3 Consultório V5 integration/polish

Direção de UX futura:

```text
um Encounter
├─ Registro
├─ Avaliações
├─ Instrumentos
├─ Prescrição
├─ Exames
├─ Documentos
└─ Nexus
```

Absorver ergonomia do MedicsPro histórico sem portar Vue/Pinia/Mongo, autorização antiga, autosave antigo, checkout ou outros contratos legados.

## 4. Prescription V1

Implementar a primeira fatia de prescrição com contrato canônico, autoria, emitente, lifecycle/histórico e regras server-side adequadas. UX histórica pode inspirar ergonomia; arquitetura e autorização atuais prevalecem.

## 5. Demais documentos conforme piloto

Priorizar atestado/declaração, solicitação de exames, relatório/laudo e outros documentos somente conforme demanda observada e requisitos aplicáveis. Evitar vários módulos superficiais ao mesmo tempo.

## 6. Finance Configuration da clínica

Evoluir configuração financeira sem transformar relação econômica em role:

- operação solo/equipe;
- categorias;
- parceiro/repasse em percentual ou valor fixo;
- histórico e effective dates;
- regras por profissional/procedimento quando justificadas.

Não assumir comissão fixa canônica.

## 7. Onboarding e pilot friction

Reduzir tempo de setup e suporte para a primeira clínica/profissional. Tratar as maiores fricções encontradas no piloto antes de ampliar integrações secundárias.

## 8. Financeiro avançado e integrações por evidência

Somente depois do núcleo acima e com demanda do piloto:

- pagamento parcial/múltiplos meios;
- caixa/conciliação;
- recibos/NFS-e;
- integrações de pagamento paciente→clínica;
- automações e relatórios avançados.

---

# ROADMAP DO TRILHO SAAS / PLATFORM ADMIN

Este programa organiza o futuro do control plane. Ele **não manda iniciar todas as etapas agora**. Fechar P0s ativos e escolher uma vertical slice por vez.

A referência detalhada é `docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`.

## S0. Estado e continuidade — agora

Objetivo: nenhum agente trabalhar sobre snapshot obsoleto.

- #399/#400 reconhecidas como efetivas;
- repair pós-#400 registrado;
- documentação alinhada;
- P0s curtos permanecem prioritários antes de grandes foundations.

## S1. Inventário Platform Admin atual × histórico

Primeira etapa obrigatória quando o programa for retomado.

Comparar diretamente:

```text
DOMÍNIO                RUNTIME ATUAL           MEDICSPRO HISTÓRICO
Clinics/lifecycle      implementação real      ClinicDetail/List/Create
Plans                  implementação real      PlansManager
Features/entitlements  entitlements atuais     FeaturesManager + overrides
Limits/usage           contratos atuais        plan limits
Subscriptions          receita atual            SubscriptionsView
WhatsApp               Evolution/runtime       WhatsappView
API/integrations       providers atuais        ApiKeysView
Surveys/templates      Assessment Engine       Surveys/anamnese/templates
Notifications          comunicação atual       AdminNotificationsView
Platform team/support  platform identity       AdminManagementView
```

Para cada domínio registrar:

- estado atual;
- contrato atual;
- legado útil;
- risco;
- gap;
- prioridade 80/20;
- próxima slice mínima;
- classificação `preservar | evoluir | redesenhar | rejeitar`.

## S2. Control Plane mínimo

Objetivo: Platform Admin operar o produto SaaS sem ganhar acesso clínico implícito.

Ordem 80/20:

1. clínicas/lifecycle;
2. owner/onboarding;
3. plano;
4. entitlements;
5. limites;
6. overrides/herança;
7. auditoria;
8. consumo/health básico.

Modelo conceitual:

```text
DEFAULT DA PLATAFORMA
        ↓
PLANO
        ↓
OVERRIDE EXPLÍCITO
        ↓
ENTITLEMENT EFETIVO
```

Antes de criar feature registry genérico, provar que os entitlements atuais não bastam.

## S3. Configurações da Clínica

Transformar Configurações em Information Architecture coerente:

```text
Geral
Equipe e acesso
Agenda e atendimento
Clínico
Comunicação
Financeiro
Integrações
Governança
```

Separar o que a plataforma permite do que a clínica escolhe e do que o usuário pode executar.

## S4. WhatsApp como capability SaaS

### Platform Admin

- provider global;
- health;
- instâncias;
- filas;
- consumo/limite;
- falhas/reconciliação;
- webhooks/observabilidade.

### Admin da clínica

- conexão/número;
- QR quando aplicável;
- templates;
- opt-in;
- automações/preferências;
- credenciais BYOC quando permitido.

### Usuário operacional

- envio/ações somente dentro da autorização e contexto.

Preservar motor atual de idempotência, retry/reconciliação e server authority.

## S5. Catálogos e templates

Separar famílias:

```text
Avaliações estruturadas
Instrumentos clínicos validados
Documentos clínicos
Consentimentos/termos
Comunicação
```

Direção para conteúdo customizável:

```text
Biblioteca MedicsPro
→ clínica adota/clona
→ clínica personaliza
→ versão publicada
→ uso
→ snapshot histórico
```

Primeira prioridade de produto neste eixo: **Avaliações padrão × Minhas avaliações** sobre o Assessment Engine já existente.

PHQ-9/GAD-7 não entram como templates genéricos.

## S6. Receita & Assinaturas da plataforma

Fechar lifecycle comercial do SaaS:

- planos versionados;
- trial;
- assinatura;
- cobrança;
- inadimplência;
- upgrade/downgrade;
- cancelamento;
- uso faturável quando aplicável;
- integração de pagamentos da própria plataforma.

Regra:

```text
receita MedicsPro ← clínica paga o SaaS
financeiro tenant ← paciente paga a clínica
```

Não misturar os dois ledgers/domínios.

## S7. Delegação e suporte

Criar capabilities internas da plataforma quando houver necessidade real:

- Platform Owner;
- Operations;
- Finance;
- Support.

Esses nomes são direção de produto, não roles já implementadas.

Support permanece deny-by-default e sem prontuário universal.

## S8. Inteligência operacional

Depois das foundations:

- onboarding incompleto;
- consumo próximo do limite;
- falhas de integração;
- health score operacional;
- churn risk da assinatura SaaS;
- recomendação de upgrade;
- incidentes recorrentes.

---

## Princípios de priorização

Cada entrega deve melhorar materialmente pelo menos um destes eixos:

- receita protegida/recuperada;
- ocupação da agenda;
- retenção e continuidade;
- qualidade/segurança clínica;
- eficiência de profissional/recepção/gestão;
- eficiência da operação MedicsPro;
- onboarding/time-to-value;
- privacidade e auditabilidade;
- percepção de produto moderno e confiável.

Não usar feature count como objetivo. Preferir poucas jornadas de alta frequência claramente melhores.

### Regra 80/20 para Platform Admin

Antes de abrir uma grande “Central Administrativa”, priorizar:

```text
clínica
+ lifecycle
+ plano
+ entitlement
+ limite
+ override
+ auditoria
```

Esse conjunto destrava operação comercial real mais cedo do que dezenas de telas administrativas superficiais.

---

## Uso obrigatório do MedicsPro histórico

`OARANHA/medicspro` é uma referência obrigatória quando houver equivalente maduro.

Para futuras slices de:

- Platform Admin;
- Configurações;
- WhatsApp;
- avaliações/templates;
- prescrição/documentos;
- onboarding;
- paciente/atendimento;

não confiar apenas em memória, prints ou neste roadmap. Abrir diretamente o código histórico relevante e comparar com o runtime atual.

A decisão deve ser classificada como:

```text
PRESERVAR
EVOLUIR
REDESENHAR
REJEITAR
```

O runtime/schema/autorização atuais sempre vencem.

---

## Regra de continuidade

Código/schema atuais prevalecem sobre documentação envelhecida.

Use:

- [`AGENTS.md`](AGENTS.md) como autoridade operacional;
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) como snapshot;
- [`TODO.md`](TODO.md) para trabalho aberto;
- [`docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`](docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md) para arquitetura do control plane/configuração;
- [`docs/MEDICSPRO_LEGACY_REUSE_MAP.md`](docs/MEDICSPRO_LEGACY_REUSE_MAP.md) para reaproveitamento histórico seletivo.

`main` é potencialmente deployável. Mudanças de banco exigem rollout/verifier explícitos; nenhum documento deve converter plano, smoke parcial ou ausência de blocker em validação que não foi observada.

Relatórios futuros devem sempre distinguir:

```text
CANÔNICO IMPLEMENTADO
CANÔNICO DOCUMENTADO/FUTURO
LEGADO ÚTIL
IDEIA NÃO APROVADA
```
