# MedicsPro — Platform Admin + Clinic Configuration + Legacy Gap Audit

> **Data:** 2026-09-11  
> **Etapa:** S1 — inventário profundo / docs-only  
> **Runtime canônico:** `OARANHA/crmfisio@90ca2482d7c6d35f91f9b3907be59523ba18bcae`  
> **Referência histórica:** `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`  
> **Regra institucional:** **NÃO PORTAR O MEDICSPRO ANTIGO. ABSORVER O QUE ELE ENTENDIA BEM SOBRE A OPERAÇÃO DA CLÍNICA.**

---

## 1. Executive summary

A auditoria confirma que o MedicsPro atual já possui uma fundação de SaaS e clínica **arquiteturalmente superior** ao histórico: multi-tenant explícito, Platform Admin separado, provisioning server-side, lifecycle de clínica, entitlements auditáveis, capabilities clínicas, boundaries por RPC/Edge Function, Encounter centrado em `appointment_id`, LGPD/auditoria e Nexus fail-closed.

O principal gap não é “falta de telas”. É que o produto atual ainda tem uma diferença de maturidade entre:

- **fundação segura e consistente**, já bastante avançada; e
- **modelo operacional/comercial configurável**, onde o legado tinha mais conceitos visíveis e workflows maduros.

O legado tinha como objetos de produto concretos `Plan`, `Feature` e `Subscription`, fluxo de criação de clínica com owner + plano + trial + features, administração de WhatsApp, API keys, pesquisas/NPS, convites, equipe administrativa e uma configuração de clínica mais extensa. No atendimento, tratava a consulta como um workspace dedicado com contexto persistente do paciente e ferramentas clínicas próximas.

Essas ideias devem ser absorvidas **sem** trazer de volta:

- Vue/Pinia/Mongo/Express;
- autorização baseada em frontend/roles antigas;
- tenant escolhido pelo browser como autoridade;
- auto-start de atendimento por navegação;
- autosave genérico com semântica ambígua;
- checkout acoplado à finalização clínica;
- Stripe ou qualquer provider como contrato de domínio;
- hardcodes de planos/limites do legado;
- `platform_admin` como bypass de dados clínicos.

### Conclusão 80/20

A próxima implementação não deveria começar por um redesign do Platform Admin nem por copiar telas do legado. A alavanca de maior valor é fechar o **contrato comercial que alimenta o entitlement**:

```text
PLATFORM DEFAULT
      ↓
PLAN / PACKAGE VERSION
      ↓
CLINIC SUBSCRIPTION / TRIAL
      ↓
EXPLICIT OVERRIDE
      ↓
EFFECTIVE ENTITLEMENT + LIMIT
      ↓
CLINIC CONFIGURATION
      ↓
USER AUTHORIZATION / CAPABILITY
      ↓
RESOURCE / ENCOUNTER CONTEXT
```

Hoje o runtime já conhece `source = plan|trial|manual|migration` nos entitlements, mas não há no control plane atual um catálogo canônico de planos/versões/limites equivalente à maturidade conceitual que o legado tinha. Ao mesmo tempo, `PlatformRevenuePage` é deliberadamente honesta: billing SaaS, provider, ledger e métricas reais ainda estão “em preparação”.

**Recomendação:** a próxima slice deve ser **Plan Catalog + Clinic Plan Assignment V1**, sem integrar gateway de pagamento ainda. Ela transforma o entitlement atual em produto vendável sem misturar cobrança SaaS, financeiro da clínica ou autorização clínica.

---

## 2. Método e evidência

A leitura foi feita na ordem canônica exigida:

1. `AGENTS.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`
4. `TODO.md`
5. `PRODUCT_ROADMAP.md`
6. `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`
7. código real nos dois repositórios/ref fixados acima.

A auditoria não considerou uma tela como feature entregue apenas porque ela existe. Sempre que relevante, foi seguido o fluxo:

```text
UI
→ lib/context/repository
→ RPC / Edge Function / backend service
→ schema/model
→ authorization / tenant boundary
```

### Evidência atual principal

- `src/App.tsx`
- `src/components/PlatformAdminShell.tsx`
- `src/pages/PlatformAdminHomePage.tsx`
- `src/pages/PlatformAdminPage.tsx`
- `src/pages/PlatformClinicModulesPage.tsx`
- `src/components/PlatformClinicEntitlementsPanel.tsx`
- `src/pages/PlatformClinicProvisioningPage.tsx`
- `src/pages/PlatformCommercialPage.tsx`
- `src/pages/PlatformRevenuePage.tsx`
- `src/lib/platformAdmin.ts`
- `src/pages/Config.tsx`
- `src/components/ClinicalEncounterWorkspaceV4.tsx`
- `supabase/functions/provision-clinic/index.ts`
- `supabase/functions/admin-team/index.ts`
- `supabase/functions/medicspro-automation/index.ts`
- migrations e documentação canônica relacionadas ao control plane, autorização e Encounter.

### Evidência histórica direta principal

Admin:

- `crm-clinic-admin/src/router/index.js`
- `DashboardView.vue`
- `ClinicsListView.vue`
- `ClinicDetailView.vue`
- `CreateClinicView.vue`
- `PlansManagerView.vue`
- `FeaturesManagerView.vue`
- `SubscriptionsView.vue`
- `WhatsappView.vue`
- `ApiKeysView.vue`
- `SurveysView.vue`
- `AdminNotificationsView.vue`
- `InvitationsView.vue`
- `UsersListView.vue`
- `AdminManagementView.vue`

Backend/contratos históricos:

- `api-agendadoutor/src/controllers/clinicsController.js`
- `api-agendadoutor/src/models/Plan.js`
- `api-agendadoutor/src/models/Feature.js`
- `api-agendadoutor/src/models/Subscription.js`
- controllers/models clínicos consultados quando a UI não era suficiente.

Atendimento/configuração:

- `app-agendadoutor/src/views/pages/atendimentos/InProgressAppointmentView.vue`
- árvore real de `app-agendadoutor/src/views/pages/configuracoes/*`
- fluxos de anamnese, prescrição, consentimentos e demais ferramentas presentes no workspace histórico.

---

## 3. Arquitetura que deve permanecer inviolável

```text
PLATFORM ENTITLEMENT
        ↓
CLINIC CONFIGURATION
        ↓
USER AUTHORIZATION / CAPABILITY
        ↓
RESOURCE / ENCOUNTER CONTEXT
```

E:

```text
Platform Admin
→ administra o SaaS

Clinic Owner/Admin
→ configura o tenant dentro do contratado/liberado

Usuário/Profissional
→ executa somente ações autorizadas no contexto adequado
```

`platform_admin` **não** recebe acesso clínico implícito aos tenants.

Para instrumentos clínicos:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

Para billing:

```text
RECEITA MEDICSPRO
clínica → assinatura SaaS → MedicsPro

!=

FINANCEIRO DA CLÍNICA
paciente → consulta/procedimento/pacote → clínica
```

---

# PARTE A — MAPA ATUAL

## 4. Platform Admin atual

### 4.1 Shell e rotas

`PlatformAdminShell` é um shell separado da aplicação tenant e organiza:

- Visão geral;
- Comercial;
- Clientes & Plataforma;
- Receita & Assinaturas;
- Onboarding;
- Governança.

O próprio shell explicita a regra de “domínio SaaS / governança separada” e não fornece acesso implícito a prontuários.

**Classificação:** **PRESERVAR**.

### 4.2 Autorização

O frontend valida Platform Admin por boundary próprio (`is_platform_admin` / camada de acesso dedicada). Operações sensíveis usam RPCs e Edge Functions específicas em vez de fazer mutações cross-tenant genéricas do browser.

Isso é mais forte que a arquitetura histórica e deve continuar sendo a autoridade.

### 4.3 Lifecycle de clínica

O runtime atual possui listagem platform-scoped e ações explícitas de suspensão/reativação, com lifecycle independente de role clínica. A clínica inativa também é respeitada por boundaries operacionais, como `admin-team`.

**PRESERVAR e EVOLUIR** com motivos, histórico e suporte operacional — não reabrir o modelo de lifecycle.

### 4.4 Onboarding/provisioning

`provision-clinic` implementa um fluxo server-authoritative com:

- sessão autenticada;
- verificação explícita em `platform_admins`;
- request de acesso opcional;
- `idempotency_key`;
- criação controlada do usuário owner;
- RPC `complete_clinic_provisioning`;
- compensação do usuário Auth em falha;
- `clinic_provisioning_requests`;
- `platform_audit_log`;
- reconciliação de `clinic_access_requests`.

O legado tinha UX de criação mais rica (owner + plano + trial + features), mas boundary mais fraca e acoplada ao backend antigo.

**Contrato recomendado:** manter o provisioning atual e, no futuro, alimentar plano/trial por um contrato comercial canônico — não copiar `POST /clinics` antigo.

### 4.5 Entitlements, source e overrides

O runtime atual expõe explicitamente:

- `nexus.access`
- `finance.access`
- `crm.access`
- `reports.access`
- `assessments.custom`
- `whatsapp.access`

Com:

- `configured`;
- `enabled`;
- `source = manual|plan|trial|migration`;
- `starts_at`;
- `expires_at`;
- reset para voltar à herança.

É uma fundação conceitualmente correta para default/plan/override/effective entitlement.

**PRESERVAR.** O gap é a camada comercial canônica que produz `plan/trial`, e não um novo sistema de entitlement.

### 4.6 Automação e governança operacional

`medicspro-automation` já possui switches de plataforma para:

- automation global;
- overdue financeiro;
- core tick;
- waitlist recovery;
- reactivation;
- worker;
- Nexus self-assessment processor.

Também registra `automation_runs` com volumes processados/enviados/falhos.

Isso é uma boa base de **health operacional**, mas não equivale ainda a health por provider/instância/tenant suficientemente rico para suporte.

### 4.7 Comercial

A página Comercial atual é deliberadamente uma **estrutura preparada**, não um CRM entregue. Ela afirma que:

- site é uma entrada;
- n8n é fundação de orquestração;
- CRM/read model não está conectado;
- métricas factuais aguardam fonte real;
- lead não deve virar tenant automaticamente.

**PRESERVAR a boundary.** Não preencher cards com inferência ou dados sintéticos.

### 4.8 Receita & Assinaturas MedicsPro

A página atual também é corretamente explícita:

- Billing SaaS: preparado;
- Asaas: integração pendente;
- ledger interno: a modelar;
- métricas reais: não disponíveis;
- dados fictícios: bloqueados.

O desenho separa corretamente financeiro da clínica de receita do MedicsPro.

**PRESERVAR a separação; EVOLUIR a fonte canônica.**

### 4.9 O que não está maduro no Platform Admin atual

Não encontrei, como contratos de produto completos no runtime auditado:

- catálogo versionado de planos;
- catálogo genérico de features/limits como fonte comercial;
- subscription ledger SaaS canônico;
- usage/limits reconciliados por tenant;
- equipe/delegação do Platform Admin com capability model próprio;
- support session/break-glass auditado;
- gestão moderna de API keys por tenant/integração;
- provider health detalhado por tenant/instância;
- catálogo global MedicsPro versionado com ativação/cópia pela clínica.

Alguns desses conceitos aparecem na documentação como direção; não devem ser marcados como runtime entregue.

---

## 5. Admin da Clínica atual

A área `Config.tsx` atual é forte em **governança**, não em configuração operacional completa. Ela oferece principalmente:

- matriz RBAC visível;
- usuários;
- unidades em leitura;
- LGPD/portabilidade/anonimização;
- audit trail.

`admin-team` é uma boundary server-side importante:

- deriva clinic do usuário autenticado;
- exige clínica ativa;
- restringe owner/admin;
- impede alteração indevida do owner;
- administra roles permitidas;
- sincroniza capabilities clínicas conhecidas;
- trata criação Auth + profile com compensação em erro.

Isso deve ser **PRESERVADO**.

O gap está na experiência/configuração de tenant. Comparado ao legado e à direção canônica, ainda falta uma taxonomia de configuração operacional consolidada para:

- identidade;
- horários;
- salas/recursos;
- serviços/procedimentos;
- modelos clínicos;
- catálogos;
- comunicação;
- integrações;
- preferências financeiras permitidas.

Não se recomenda transformar `Config.tsx` em uma página monolítica crescente. O correto é um **configuration shell por domínios**, cada um com boundary própria.

---

## 6. Paciente / Agenda / Encounter atual

O runtime atual é superior ao legado em invariantes:

- `appointment_id` é o centro do Encounter;
- lifecycle é protegido server-side;
- Encounter Record possui contrato próprio;
- Evolution canônica e finalização têm ordem controlada;
- capabilities clínicas são independentes de role administrativa;
- instrumentos/Nexus possuem boundaries próprias;
- apresentação não substitui authorization.

`ClinicalEncounterWorkspaceV4` ainda se comporta mais como um prontuário longo/section-based do que o cockpit histórico, mas **isso é um gap de UX/composição, não de arquitetura clínica**.

A direção correta é evoluir para um cockpit em que as ferramentas são views do mesmo Encounter:

```text
Encounter
├── Registro
├── Avaliações
├── Instrumentos
├── Prescrição
├── Exames
├── Documentos
├── Imagens
└── Nexus
```

Nunca voltar a “cada aba = módulo clínico independente”.

---

# PARTE B — O QUE O LEGADO ENTENDIA BEM

## 7. Platform Admin histórico

A navegação histórica tinha superfícies explícitas para:

- dashboard;
- clínicas;
- criação/detalhe de clínica;
- planos;
- features;
- subscriptions;
- WhatsApp;
- API keys;
- surveys;
- notificações administrativas;
- convites;
- usuários;
- administração da equipe da plataforma.

### 7.1 Plan / Feature / Subscription eram objetos reais

A auditoria de backend confirma que não eram apenas mocks:

- `Plan.js`: nome, slug, valor, features, limites, default/public, trial, provider IDs e lifecycle;
- `Feature.js`: `key`, categoria, `boolean|limit|usage`, defaults, self-service e dependências;
- `Subscription.js`: clínica, status, plano, trial, período, valor/currency/interval e IDs externos;
- `clinicsController.js`: criação de clínica, owner, plano/default, trial, feature overrides, subscription e audit log.

O que reaproveitar:

- plano como composição de produto;
- feature key estável;
- limits/usage como tipos distintos;
- trial como estado comercial;
- overrides explícitos;
- criação de clínica orientada ao resultado operacional.

O que rejeitar:

- enum de planos hardcoded;
- `doctors/photos/uploadSizeMB` como limites universais;
- Stripe IDs dentro do contrato central;
- Mongo documents como modelo atual;
- autorização antiga;
- mutações amplas expostas ao frontend.

### 7.2 Create Clinic era operacionalmente bom

A UX reunia numa mesma decisão:

```text
clínica
+ owner
+ plano
+ trial
+ features/overrides
```

Isso reduz passos administrativos e deve inspirar o onboarding futuro.

Mas o runtime atual deve manter:

```text
request
→ aprovação
→ provisioning idempotente
→ tenant/owner
→ assignment comercial
→ audit
```

### 7.3 WhatsApp antigo

A tela antiga centralizava status/instância/QR/conexão/teste. É boa referência de operação, mas misturava preocupações que no runtime atual precisam ser separadas em três camadas.

### 7.4 API Keys

O legado reconhecia API keys como objeto administrativo explícito. A ideia é relevante para integrações/BYOC/webhooks, mas qualquer retorno desse domínio deve ter:

- hash/secret-once;
- scopes;
- tenant/platform owner explícito;
- expiry/revocation;
- audit;
- rate limits;
- nunca exibir secret persistido em claro.

### 7.5 Surveys, notifications, invitations e platform team

O legado tratava esses workflows como superfícies próprias. Isso é maturidade operacional aproveitável, mas não prova que a segurança antiga seja aceitável.

---

## 8. Clínica histórica

A configuração antiga era mais próxima de “como uma clínica realmente opera”:

- dados gerais;
- horários;
- equipe;
- integrações;
- modelos de anamnese;
- modelos de prescrição;
- consentimentos;
- configurações relacionadas à comunicação e atendimento.

A principal lição é **reuso configurável**:

> uma clínica não quer reescrever o mesmo termo, avaliação, mensagem ou prescrição a cada atendimento.

Esse conceito deve voltar como catálogo/modelo versionado, não como blobs mutáveis sem provenance.

---

## 9. Encounter histórico

`InProgressAppointmentView.vue` oferece a principal referência de ergonomia:

- atendimento claramente dedicado;
- paciente persistente;
- status/data/tipo visíveis;
- timer;
- feedback de persistência;
- histórico acessível;
- ferramentas próximas em tabs;
- anamnese;
- prescrição;
- exames;
- laudos;
- atestados;
- imagens;
- videochamada.

A ideia de cockpit é **EVOLUIR**.

Devem ser **REJEITADOS**:

- auto-start por abrir a tela;
- autorização do frontend;
- autosave genérico em que “salvo” não prova persistência canônica;
- editor genérico como prontuário universal;
- checkout como condição acoplada à finalização clínica;
- storage/API antigos.

---

# PARTE C — MATRIZ DIFERENCIAL

Legenda:

- **V/E/P:** valor comercial / esforço / prioridade.
- **PRESERVAR:** contrato atual já é a direção correta.
- **EVOLUIR:** fundação atual é correta e precisa ganhar produto/UX.
- **REDESENHAR:** conceito precisa de um novo contrato sobre a arquitetura atual.
- **REJEITAR:** padrão legado ou atalho não deve retornar.

## 10. Platform

| Domínio | Atual + contrato técnico | Legado + vantagem operacional | Atual é melhor em | Gap / duplicação | Risco + dependências | V/E/P | Classe | Próxima slice mínima |
|---|---|---|---|---|---|---|---|---|
| Lifecycle de clínica | RPCs platform-scoped; `active/suspended`; boundaries respeitam clínica ativa | status de clínica/subscription mais visível no detalhe | isolamento SaaS/tenant e fail-closed | falta visão consolidada motivo/histórico/SLA | evitar lifecycle duplicado em subscription | alto/S/P1 | PRESERVAR/EVOLUIR | read model de lifecycle + histórico |
| Onboarding/provisioning | Edge `provision-clinic`, idempotência, request, owner, compensação, audit | criação em fluxo único com owner+plan+trial+features | segurança/idempotência | assignment comercial ainda não canônico | depende de Plan Catalog | muito alto/M/P0 | EVOLUIR | anexar plan assignment ao provisioning depois do catálogo |
| Planos | não há catálogo runtime maduro no control plane; entitlement aceita `source=plan` | `Plan` real com composição/features/trial | arquitetura atual não está acoplada a Stripe | elo comercial faltante | versionamento + historical contract | muito alto/M/P0 | REDESENHAR | **Plan Catalog V1** |
| Features | entitlements explícitos e pequenos são canônicos | `Feature` tinha key/type/category/default/dependencies | menos abstração prematura e melhor boundary | sem catálogo de produto/limit/usage | não duplicar entitlement registry | alto/M/P1 | EVOLUIR | catálogo somente quando Plan V1 provar necessidade |
| Entitlements | 6 chaves atuais, effective/configured/source/datas + RPCs | feature plan/override era intuitivo | auditabilidade, reset/herança e server authority | cobertura ainda limitada | plano/usage | muito alto/S/P0 | PRESERVAR | consumir por Plan V1, não substituir |
| Limits/usage | ainda não há contrato geral reconciliado | feature `limit/usage` e limites por plano | evita hardcodes ruins do legado | falta medição/limit source | precisa metering factual | alto/L/P1 | REDESENHAR | um único primeiro limit após Plan V1 |
| Overrides/herança | manual/plan/trial/migration + reset | featureOverrides explícitos | herança e effective state mais limpos | reason/expiry UX pode evoluir | audit + plan assignment | alto/S/P1 | PRESERVAR/EVOLUIR | reason/expiry/history em detalhe de clínica |
| Subscriptions/Billing MedicsPro | página preparada, sem ledger/provider real | `Subscription` era objeto real com trial/status/período | separação correta de clinic finance e neutralidade desejada | source-of-truth SaaS ausente | Plan V1 antes de gateway | muito alto/L/P1 | REDESENHAR | Subscription Ledger V1 depois de Plan V1 |
| Platform Admin team/delegação | `platform_admins` existe como autoridade; UI/team model não maduro | AdminManagement/Users/Invitations | deny-by-default | sem capabilities internas/delegação refinada | suporte/break-glass/audit | alto/M/P1 | EVOLUIR | Platform Team V1 |
| Suporte | não há bypass clínico implícito; correto | legado tinha operação administrativa mais direta | privacidade e tenant isolation | falta support workflow formal | acesso temporário/auditado | alto/L/P1 | REDESENHAR | support session somente quando houver necessidade real |
| Auditoria | `platform_audit_log` + RPC/read model | AuditLog geral | separação platform/tenant | busca/filtros/retention podem evoluir | volume e export | alto/S/P1 | PRESERVAR/EVOLUIR | filtros e correlation IDs |
| API keys | sem surface canônica madura encontrada | API Keys era domínio explícito | não herdou armazenamento/escopo inseguro | integração externa futura sem credencial model | scopes, hash, revoke, rate limit | médio/M/P2 | REDESENHAR | API Credentials V1 quando integração exigir |
| Integrations/providers | automations/Workers/Edge existem; provider config é server-side | telas explícitas de WhatsApp/API | secrets e tenant boundaries | falta registry/health unificado | provider-specific adapters | alto/M/P1 | EVOLUIR | Provider Health Read Model V1 |
| Health por tenant | automation runs dão volumes e falhas agregadas | dashboard antigo mais operacional em algumas áreas | dados factuais | falta health por tenant/instância/fila/retry/webhook | correlation/read model | alto/M/P1 | EVOLUIR | WhatsApp/Automation Health V1 |
| CRM/comercial plataforma | UI preparada; CRM/read model não conectado | legado tinha administração mais direta; não um CRM moderno completo | boundary lead ≠ tenant | fonte comercial factual ausente | site/n8n/CRM | médio/M/P2 | EVOLUIR | bridge read-only quando CRM escolhido |

## 11. Clinic Configuration

| Domínio | Atual + contrato técnico | Legado + vantagem operacional | Atual é melhor em | Gap / duplicação | Risco + dependências | V/E/P | Classe | Próxima slice mínima |
|---|---|---|---|---|---|---|---|---|
| Identidade/unidades/horários | unidades existem; Config exibe; identidade/horários não formam experiência consolidada | settings específicos e horários de clínica | multi-tenant atual | config dispersa/incompleta | não permitir config fora do tenant | muito alto/M/P0 | EVOLUIR | Clinic Operational Config V1 |
| Equipe e acesso | `admin-team`, roles, unidade, identidade profissional, capabilities clínicas | telas de users/admin eram mais explícitas | server-authoritative, compensação, active clinic | UX pode ganhar organização; Nexus separado | não colapsar role/capability | muito alto/S/P0 | PRESERVAR/EVOLUIR | só compor no novo config shell |
| Serviços/procedimentos | entidades operacionais existem em partes da Agenda/financeiro, sem config hub canônico | clínica antiga tratava operação como configurável | lifecycle/finance atual mais seguro | catálogo de serviço/procedimento disperso | agenda + preço + duração + reporting | alto/M/P1 | EVOLUIR | Service Catalog V1 depois do config core |
| Avaliações padrão | engine/instrumentos canônicos existem em fundações recentes | legado reforça ideia de modelo reutilizável | engine/versionamento/autorização atuais | falta UX catálogo “padrão” | `ENGINE != AUTHORIZATION != RELEVANCE` | alto/M/P1 | EVOLUIR | Catalog Activation V1 |
| Minhas avaliações | custom assessments têm entitlement/fundação; UX completa não é config madura | legado tinha templates/configs próprios | isolamento/capability | falta copy/fork/version lifecycle | snapshot histórico | alto/M/P1 | EVOLUIR | Clinic Catalog Copy/Customize |
| Instrumentos clínicos | autorização instrumental e Nexus separados | legado não tinha boundary tão robusta | separação engine/auth/relevance | falta catálogo institucional coerente | clinical capability + config | alto/M/P1 | PRESERVAR/EVOLUIR | integrar ao catalog model, sem duplicar PHQ/GAD |
| Modelos clínicos | Encounter Record canônico; modelos tenant ainda não consolidados | anamnesis templates eram first-class | persistência final atual é mais confiável | falta template/version/snapshot | schema/versioning | alto/M/P1 | REDESENHAR | Clinical Template Catalog V1 |
| Prescrição | nenhuma implementação canônica equivalente foi encontrada na busca atual | medicamento+dose+frequência+duração, templates, preview/histórico | futuro pode usar auth/Encounter atuais | domínio ausente | assinatura/autoria/versioning | alto/L/P1 | REDESENHAR | Prescription V1 após cockpit/catalog foundation |
| Exames | nenhum workspace canônico equivalente encontrado | pedido de exame no cockpit | Encounter atual oferece boundary forte | ausente | documentos/autoria | médio/M/P2 | REDESENHAR | Exam Order V1 |
| Laudos | nenhum domínio canônico equivalente encontrado | ferramenta dedicada no legado | — | ausente | documento versionado/assinatura | médio/M/P2 | REDESENHAR | Document type sobre document engine |
| Atestados | nenhum domínio canônico equivalente encontrado | ferramenta dedicada | — | ausente | requisitos profissionais/assinatura | alto/M/P2 | REDESENHAR | Clinical Document type, não CRUD isolado |
| Termos | consentimento/versionamento já existe no runtime clínico | templates de consentimento configuráveis | hash/version/audit atuais | falta catalog/config UX madura | não reescrever consentimento assinado | alto/M/P1 | EVOLUIR | Consent Template Catalog |
| Comunicação | engine de mensagens/automação existe | configuração mais visível no legado | idempotência/server workers | configuração tenant ainda parcial | entitlement+opt-in | muito alto/M/P1 | EVOLUIR | Communication Config V1 |
| WhatsApp | entitlement e pipeline/automation existem | conexão/status/QR/teste explícitos | separar provider/tenant/user | falta clinic connection UX canônica | provider health + secrets | muito alto/M/P1 | EVOLUIR | Clinic WhatsApp Connection V1 após health contract |
| Templates de mensagem | envio/automação existe; catálogo editável/versionado não está consolidado | reutilização operacional era mais aparente | current workers/reconciliation | falta conteúdo versionado + ownership | aprovação/provider + snapshot | alto/M/P1 | REDESENHAR | Message Template Catalog V1 |
| Automações | scheduler e governance existem | legado expunha operação mais diretamente | audit/run/retry base atual | falta configuração tenant comprehensível | messaging templates + entitlement | alto/M/P1 | EVOLUIR | Automation Preferences V1 |
| NPS | core tick já enfileira NPS; UX de configuração não é domínio maduro | SurveysView tratava pesquisa como first-class | pipeline atual mais seguro | config/analytics de survey parcial | consent/communication | médio/S/P2 | EVOLUIR | NPS Config/Read Model |
| Financeiro/configurações | financeiro tenant é domínio próprio e robustecido | legado tinha mais settings visíveis | integridade atual muito superior | configuration UX ainda dispersa | não misturar SaaS billing | alto/M/P1 | EVOLUIR | finance settings separadas no config shell |
| Integrações | infrastructure/provider boundaries existem por caso | integrations eram área de settings | secrets atuais podem ficar server-side | falta registry/config hub | BYOC vs platform-owned | alto/M/P1 | REDESENHAR | Integration Registry só quando houver 2+ providers reais |
| LGPD/auditoria | forte: export/anonymize/audit visível | legado tinha audit mas arquitetura inferior | melhor contrato atual | UX/retention pode evoluir | legal/retention policy | alto/S/P1 | PRESERVAR | apenas melhorar busca/explicação |

## 12. Patient / Encounter

| Domínio | Atual + contrato técnico | Legado + vantagem operacional | Atual é melhor em | Gap / duplicação | Risco + dependências | V/E/P | Classe | Próxima slice mínima |
|---|---|---|---|---|---|---|---|---|
| Patient Hub | contexto/paciente já é parte do runtime atual | acesso ao histórico muito próximo da consulta | tenant/auth atuais | hub ainda pode consolidar melhor o longitudinal | timeline/capabilities | muito alto/M/P1 | EVOLUIR | Patient Hub composition |
| Agenda → drawer | Agenda atual tem lifecycle/role-aware hardening | legado tinha fluxo direto para atendimento | temporal/lifecycle boundaries atuais | drawer pode expor melhor próxima ação | Encounter handoff | alto/S/P1 | EVOLUIR | polish, não nova arquitetura |
| Consultório/Encounter | V4 + Encounter Record + presentation context | cockpit dedicado era mais fluido | invariantes/autorização atuais | UX longa/section-based | manter appointment como centro | muito alto/M/P1 | EVOLUIR | Consultório V5 como composição frontend |
| Histórico | timeline/records atuais | histórico sempre perto no cockpit | access control | navegação pode ser mais imediata | patient hub | alto/S/P1 | EVOLUIR | side rail longitudinal |
| Avaliações | engine estruturada + custom foundation | modelos reutilizáveis eram intuitivos | version/auth | catálogo/UX | catalog foundation | alto/M/P1 | EVOLUIR | tab Avaliações sobre mesma engine |
| Instrumentos | authorization foundation + Nexus separado | menor sofisticação antiga | safety e separação atuais | Apply Now/UX ainda evoluem | engine/auth/relevance | alto/M/P1 | PRESERVAR/EVOLUIR | consumir boundary existente |
| Prescrição | não encontrada implementação canônica atual | ferramenta madura no cockpit antigo | — | ausente | autoria/legal/catalog | alto/L/P1 | REDESENHAR | Prescription V1 |
| Exames/resultados | sem workspace equivalente identificado | pedidos/fluxo visível | — | ausente | document storage/result linkage | alto/M/P2 | REDESENHAR | Exam Order/Result contract |
| Documentos | clinical documents capability/foundation existe em partes; não cobre todo legado | laudo/atestado/termos próximos | auth atual | taxonomia/document engine incompleta | assinatura/version | alto/L/P1 | EVOLUIR | document engine + types |
| Imagens | sem ferramenta Encounter canônica equivalente identificada | imagens no workspace | — | ausente | storage, PHI, retention | médio/M/P2 | REDESENHAR | attachment contract seguro |
| Videochamada | sem feature canônica equivalente identificada | tab dedicada | — | ausente | provider/privacy/consent | médio/L/P2 | REDESENHAR | somente após demanda comprovada |
| Nexus | C-01…C-06, entitlement+capability+identity+context, fail-closed | legado não tinha equivalente arquitetural | muito superior | UX/catalog relevance pode evoluir | nunca broadening por convenience | alto/M/P1 | PRESERVAR | compor no cockpit sem mexer no C-06 |

---

# ATENÇÃO ESPECIAL

## 13. WhatsApp — três camadas, três contratos

### 13.1 Platform Admin

Responsável por **serviço e infraestrutura**:

- provider;
- instâncias;
- health;
- filas;
- retries/backoff;
- reconciliação;
- consumo/limites;
- falhas;
- webhooks;
- SLA/correlation.

O atual `medicspro-automation` e seus `automation_runs` já fornecem parte da observabilidade, mas não devem virar configuração da clínica.

### 13.2 Clinic Admin

Responsável pela **conexão e política daquele tenant**:

- conectar/configurar número/instância;
- QR quando aplicável;
- sender/status;
- opt-in policy;
- templates;
- preferências de automação;
- confirmação/remarcação/NPS;
- credencial BYOC quando o modelo permitir.

### 13.3 Usuário

Responsável por **ação autorizada no contexto**:

- enviar uma mensagem permitida;
- confirmar/remarcar;
- compartilhar documento/termo/instrumento quando autorizado;
- interagir no contexto do paciente/appointment.

O usuário não administra provider, secret, webhook ou fila.

### 13.4 O que copiar do legado

Copiar **a clareza operacional** de status, conexão, QR e teste.

Não copiar a mistura de responsabilidades.

---

## 14. Templates e catálogos — arquitetura recomendada

A auditoria sustenta a seguinte direção:

```text
CATÁLOGO MEDICSPRO
conteúdo padrão + key estável + versão
        ↓
CLÍNICA
ativa / copia / personaliza quando permitido
        ↓
USO CLÍNICO
snapshot/version reference imutável no fato histórico
```

### Categorias diferentes, não uma tabela universal sem semântica

1. **Avaliações padrão**
   - publicadas pelo MedicsPro;
   - versão canônica;
   - ativação institucional;
   - não editáveis “in place” pela clínica.

2. **Minhas avaliações**
   - cópia/fork ou modelo próprio da clínica;
   - ownership tenant;
   - versionamento;
   - publicação/arquivamento.

3. **Instrumentos clínicos canônicos**
   - engine própria quando necessário;
   - PHQ-9/GAD-7 não são duplicados no Assessment Engine;
   - autorização e relevância permanecem independentes.

4. **Documentos/consentimentos**
   - template de conteúdo;
   - versão;
   - snapshot/hash no documento assinado/finalizado.

5. **Templates de comunicação**
   - conteúdo + canal + provider/template external ID quando necessário;
   - versão;
   - aprovação do provider separada da edição interna;
   - snapshot suficiente para auditoria do que foi enviado.

6. **Modelos de prescrição**
   - são atalhos/configuração do profissional/clínica;
   - nunca substituem a autoria e revisão do documento clínico final.

### Regra

Não criar uma abstração genérica `templates` que apague diferenças legais/clinicas entre consentimento, comunicação, avaliação e prescrição. Compartilhar infraestrutura de versionamento onde fizer sentido; preservar contratos de domínio.

---

## 15. Billing — dois domínios independentes

### 15.1 Receita MedicsPro

```text
clinic account
→ plan assignment
→ subscription
→ charge/invoice
→ payment
→ renewal
```

Pertence ao Platform Admin.

### 15.2 Financeiro da clínica

```text
patient
→ appointment/procedure/package
→ receivable/payment
→ settlement/reporting
```

Pertence ao tenant.

### Regras

- gateway pode ser compartilhado como tecnologia, nunca como domínio;
- tabela/ledger do SaaS não deve reutilizar `payments` da clínica;
- inadimplência SaaS pode afetar lifecycle/entitlement por política explícita, não por trigger improvisado;
- pagamento do paciente nunca determina status da assinatura MedicsPro;
- Platform Admin não precisa ler transações detalhadas de pacientes para calcular MRR.

---

# GAPS E PRIORIDADE

## 16. P0

### P0-1 — Plan Catalog + Clinic Plan Assignment

Sem ele, `source=plan` existe conceitualmente, mas o produto comercial pode degradar para overrides manuais clinic-by-clinic.

### P0-2 — Clinic Configuration Core

A Config atual é forte em segurança/LGPD, mas ainda não é o cockpit administrativo da operação da clínica. Identidade, unidades/horários e configuração operacional precisam de um shell/domínios próprios.

### P0-3 — Preservar boundaries existentes durante a expansão

Qualquer nova configuração precisa continuar obedecendo:

```text
entitlement != clinic config != user capability != resource context
```

Não é uma “feature”; é um gate arquitetural para todas as próximas slices.

## 17. P1

- Subscription Ledger SaaS e provider-neutral billing;
- limits/usage metering;
- Platform Team/delegation;
- Provider/WhatsApp health por tenant;
- Clinic WhatsApp connection;
- Clinical/Communication Catalog Foundation;
- Services/Procedures catalog;
- Consent/template management;
- Consultório V5 como composição sobre Encounter existente;
- Prescription V1;
- Platform audit/search/correlation melhorados.

## 18. P2

- CRM executivo com fonte externa real;
- API Keys/Integration Credentials quando houver consumidor real;
- surveys/NPS analytics avançados;
- videochamada;
- feature registry genérico além do que os entitlements atuais exigem;
- dashboards avançados de usage/adoption.

---

## 19. Oportunidades 80/20

1. **Transformar entitlement em oferta comercial versionada.** Um plano atribuído à clínica resolve onboarding, trial, módulos-base, futuros limites e billing sem mudar autorização clínica.
2. **Criar um configuration shell por domínio em vez de aumentar `Config.tsx`.** Permite evoluir a clínica sem regressão arquitetural.
3. **Usar catálogo/versionamento como multiplicador.** Avaliações, consentimentos e mensagens deixam de ser conteúdo reescrito manualmente.
4. **Expor health já existente antes de construir nova infraestrutura.** `automation_runs` e logs atuais podem alimentar uma primeira visão operacional factual.
5. **Reaproveitar o cockpit histórico apenas como ergonomia.** O Encounter atual já é a autoridade; tabs podem ser navegação, não novos sistemas.

---

## 20. Dependências técnicas

### Para Plan Catalog

- manter `PlatformClinicEntitlementKey` e effective entitlement atuais;
- modelar plan/version/assignment sem reinterpretar contratos históricos;
- decidir primeiro conjunto de módulos e limites realmente vendáveis;
- nenhum gateway obrigatório na primeira slice.

### Para Clinic Configuration

- mapear tabelas atuais de clinic/unit/room/service antes de criar schema;
- não duplicar `admin-team`;
- configurar apenas o que entitlement permite;
- preservar LGPD/audit atuais.

### Para Catalogs

- stable key;
- ownership (`platform|clinic`);
- version;
- active/published/archived;
- fork/copy lineage quando aplicável;
- snapshot/reference histórico;
- autorização específica por domínio.

### Para WhatsApp Health

- correlacionar clinic → instance/provider → queue/log/run/webhook;
- ocultar secrets;
- diferenciar skipped de failed;
- não permitir Platform Admin editar opt-in/template clínico por acidente.

---

## 21. Riscos

### R1 — transformar override em plano

Se cada clínica for configurada manualmente por entitlement, suporte e billing ficam snowflake. Mitigação: Plan Assignment V1 antes de ampliar o catálogo comercial.

### R2 — “feature registry” abstrato cedo demais

O legado tinha um modelo genérico poderoso, mas também carregava limites/hardcodes históricos. Mitigação: começar com plano compondo entitlements já existentes; adicionar limit/usage apenas quando houver caso real.

### R3 — Clinic Config virar bypass de produto

Admin da clínica não pode ligar `nexus.access` ou `whatsapp.access` se a plataforma não entregou o produto. Mitigação: effective entitlement sempre acima da configuração.

### R4 — Platform support virar acesso clínico universal

Mitigação: `platform_admin` continua sem perfil tenant implícito. Se suporte clínico for necessário no futuro, criar grant temporário, justificado e auditado.

### R5 — catálogo mutável reinterpretar histórico

Mitigação: versões e snapshots/references imutáveis no fato clínico/documental.

### R6 — misturar SaaS billing com clinic payments

Mitigação: ledgers, entidades e eventos separados mesmo que usem o mesmo provider externo.

### R7 — copiar UX do legado junto com autorização legada

Mitigação: UI histórica é referência de operação; runtime atual é autoridade de segurança.

---

## 22. O que NÃO deve ser portado

**REJEITAR explicitamente:**

- Vue/Pinia como arquitetura alvo;
- Mongo/Mongoose como source-of-truth do runtime atual;
- Express controllers antigos como autorização;
- enum fixo `basic|professional|enterprise|trial` como verdade eterna;
- Stripe IDs como domínio de plano/subscription;
- limites históricos `doctors/photos/uploadSizeMB/...` sem caso atual;
- role `dono|medico|recepcionista` como substituto da matriz atual;
- frontend passando `clinic_id` como autoridade sensível;
- plan/feature override sem audit/reason/version;
- API key armazenada/exibida sem secret handling moderno;
- autosave genérico do prontuário;
- “Salvo” baseado só em estado local;
- auto-start de atendimento ao abrir página;
- finalização clínica acoplada a checkout;
- `platform_admin` acessando prontuário por padrão;
- uma tabela universal de templates que apague diferenças de domínio;
- duplicação de PHQ-9/GAD-7 no Assessment Engine.

---

# RECOMENDAÇÃO DE ARQUITETURA

## 23. Control plane desejado

```text
                    MEDICSPRO PLATFORM
┌─────────────────────────────────────────────────────────┐
│ Commercial / Account                                    │
│ Plan Catalog → Plan Version → Subscription/Trial         │
│                         ↓                               │
│ Effective Entitlement + Limits                          │
│                         ↓                               │
│ Clinic Lifecycle / Provisioning / Audit                 │
│                         ↓                               │
│ Provider Health / Usage                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          │ product boundary
                          ▼
┌─────────────────────────────────────────────────────────┐
│ CLINIC CONFIGURATION                                    │
│ General · Team · Agenda · Clinical · Communication      │
│ Finance Settings · Integrations · Governance            │
│                                                         │
│ Catalog activation/copy/customization                   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ authorization boundary
                          ▼
┌─────────────────────────────────────────────────────────┐
│ USER / PROFESSIONAL                                     │
│ role + clinical identity + capabilities + active status │
└─────────────────────────────────────────────────────────┘
                          │
                          │ resource boundary
                          ▼
┌─────────────────────────────────────────────────────────┐
│ PATIENT / APPOINTMENT / ENCOUNTER                       │
│ authorship + care relationship + lifecycle + snapshots  │
└─────────────────────────────────────────────────────────┘
```

---

## 24. Ordem recomendada das próximas slices

1. **Plan Catalog + Clinic Plan Assignment V1**
2. **Clinic Configuration Core V1**
3. **Catalog Foundation V1 — platform standard → clinic activation/copy → historical version**
4. Provider/WhatsApp Health V1
5. Clinic WhatsApp Connection/Communication Preferences V1
6. Subscription Ledger SaaS V1
7. Platform Team / Delegation V1
8. Consultório V5 (frontend/composition)
9. Prescription V1
10. APIs/credentials, CRM bridge e usage sofisticado conforme demanda real.

A mudança em relação a uma sequência orientada por UI é intencional: **primeiro estabilizar o que é produto contratado; depois o que a clínica configura; depois o conteúdo reutilizável e a UX.**

---

# AS 3 PRÓXIMAS SLICES DE MAIOR VALOR

## 25. Slice 1 — Plan Catalog + Clinic Plan Assignment V1 — **FAZER PRIMEIRO**

### Objetivo

Criar o menor source-of-truth versionado para “qual oferta comercial esta clínica possui” e derivar a baseline dos entitlements atuais sem substituir o sistema de entitlements.

### Valor usuário/negócio

- onboarding reproduzível;
- menos configuração manual;
- trial/plano compreensíveis;
- base para billing SaaS;
- base para limites futuros;
- reduz erro operacional e snowflake de clientes.

### Escopo

- catálogo de planos ativos/inativos;
- versão/imutabilidade suficiente para contratos históricos;
- composição apenas dos **entitlements atuais realmente suportados**;
- assignment plano/trial → clínica;
- effective entitlement mantém overrides atuais por cima do baseline;
- audit de assignment/change;
- UI Platform Admin mínima para visualizar/atribuir.

### Fora de escopo

- gateway Asaas;
- invoice/payment ledger;
- cupom;
- proration sofisticada;
- usage billing;
- dezenas de limites genéricos;
- self-service upgrade;
- financeiro de paciente.

### Componentes reutilizados

- `PlatformAdminShell`;
- `platformAdmin.ts`;
- `PlatformClinicEntitlementsPanel`;
- lifecycle/provisioning atual;
- `platform_audit_log`;
- chaves de entitlement atuais.

### DB migration

**Sim.** Esperada para plan/version/assignment e contrato de baseline, se a auditoria da slice não encontrar estrutura equivalente já presente.

### Edge Function

**Não obrigatória** na primeira versão. Preferir RPCs platform-scoped. `provision-clinic` só deve ser tocada se o assignment entrar no mesmo commit transacional sem aumentar risco.

### Risco

**Médio.** Maior risco é criar um segundo sistema de feature flags ou mudar significado do entitlement atual.

### Testes necessários

- Platform Admin only;
- tenant user denied;
- assignment não concede acesso clínico;
- plan baseline produz effective entitlement esperado;
- manual override vence baseline;
- reset volta ao baseline;
- troca de plano preserva histórico;
- clinic A não afeta B;
- suspensão/lifecycle permanece independente;
- replay/idempotência da migration;
- regressões de entitlement/Nexus.

---

## 26. Slice 2 — Clinic Configuration Core V1

### Objetivo

Transformar Configurações em um shell por domínio e fechar o primeiro domínio operacional: **Geral / unidades / horários**, reutilizando entidades atuais antes de criar schema.

### Valor usuário/negócio

- owner deixa de depender de telas espalhadas;
- reduz suporte manual;
- prepara serviços/procedimentos, comunicação e integrações;
- aproxima o produto da maturidade operacional do legado sem regredir segurança.

### Escopo

- shell/taxonomia de configuração;
- identidade permitida da clínica;
- unidades existentes;
- horários operacionais;
- regras simples de agenda já suportadas pelo runtime;
- boundaries owner/admin e tenant-derived;
- entitlement-aware quando houver feature dependente.

### Fora de escopo

- custom assessment builder;
- prescriptions;
- WhatsApp connection;
- finance redesign;
- plan management;
- API keys;
- provider secrets.

### Componentes reutilizados

- `Config.tsx` como origem de governança a ser decomposta, não descartada;
- `admin-team` para equipe;
- infrastructure/unit contexts atuais;
- RBAC/LGPD/audit existentes.

### DB migration

**A determinar pela auditoria da slice.** Primeiro reutilizar `clinics`, unidades e horários existentes. Criar migration somente para dado operacional realmente ausente.

### Edge Function

**Provavelmente não.** Preferir RLS/RPC tenant-scoped; não duplicar `admin-team`.

### Risco

**Médio-baixo** se a slice ficar em composição e estruturas existentes. **Alto** se tentar resolver toda Configuração de uma vez.

### Testes necessários

- owner/admin permitido;
- professional/recep/financeiro conforme matriz atual;
- isolamento clinic A/B;
- inactive user/clinic denied;
- unidade pertence ao tenant;
- configuração não habilita entitlement;
- regressão de Config/LGPD/audit;
- frontend shell/route tests.

---

## 27. Slice 3 — Catalog Foundation V1

### Objetivo

Criar a infraestrutura mínima para:

```text
MedicsPro standard catalog
→ clinic activation/copy/customization
→ versioned historical use
```

Começar com **um único domínio de baixo risco** para provar o modelo — preferencialmente avaliações/modelos não canônicos ou consent template, conforme auditoria da slice — sem duplicar PHQ-9/GAD-7.

### Valor usuário/negócio

- base para “Avaliações padrão / Minhas avaliações”;
- reduz trabalho repetitivo;
- diferencia produto;
- prepara consentimentos, mensagens e modelos clínicos;
- permite conteúdo MedicsPro distribuído com governança.

### Escopo

- stable key;
- owner `platform|clinic`;
- version;
- publication/archive;
- activation/copy lineage;
- snapshot/reference no uso histórico;
- um domínio piloto.

### Fora de escopo

- mega-tabela genérica para todo conteúdo;
- PHQ-9/GAD-7 duplicados;
- prescription engine;
- message provider approval;
- catálogo marketplace;
- IA gerando conteúdo automaticamente.

### Componentes reutilizados

- Assessment/Instrument foundations atuais;
- entitlement `assessments.custom` quando semanticamente aplicável;
- capabilities clínicas atuais;
- audit/version concepts existentes.

### DB migration

**Sim, provável**, para catálogo/version/activation se não houver tabela canônica equivalente.

### Edge Function

**Não obrigatória.** RPC/RLS podem ser suficientes; publicação Platform pode exigir boundary platform-scoped.

### Risco

**Médio-alto** por tentação de abstração excessiva. O modelo deve ser provado com um domínio real antes de generalizar.

### Testes necessários

- clinic only sees own copies + platform published entries;
- archived version does not rewrite historical use;
- activation does not grant user capability;
- capability does not bypass clinic activation;
- platform catalog does not expose tenant data;
- copy/fork lineage;
- version/snapshot integrity;
- PHQ/GAD engine fingerprints/regressions intact.

---

## 28. Qual deve ser a próxima implementação

**Slice 1 — Plan Catalog + Clinic Plan Assignment V1.**

Justificativa:

1. o runtime já possui entitlements com `source=plan`, portanto a camada está conceitualmente prevista;
2. o legado comprova valor operacional real de Plan/Feature/Subscription;
3. a UI atual de Receita assume explicitamente que billing/source real ainda não existe;
4. onboarding já está seguro e idempotente, portanto pode posteriormente consumir um assignment canônico;
5. sem plano canônico, cada nova configuração comercial tende a virar override manual;
6. plano não exige gateway de pagamento para gerar valor imediato;
7. fecha uma fundação do SaaS antes de abrir dezenas de Configurações de clínica.

---

## 29. Ação manual no servidor

### Esta PR S1

**Nenhuma.** É docs-only. Não há migration, Edge Function, RLS/RPC, deploy ou mudança de produção.

### Próximas slices

- **Slice 1:** provavelmente exigirá migration PostgreSQL e verifier; portanto haverá rollout manual/controlado no servidor **depois de merge aprovado**, salvo mudança futura da esteira.
- **Slice 2:** pode não exigir migration se reutilizar schema atual; se criar dado operacional novo, haverá rollout PostgreSQL controlado. Edge não é esperada.
- **Slice 3:** provavelmente exigirá migration/versioning e verifier; Edge só se a operação Platform de publicação realmente precisar.

Nenhuma dessas ações deve ser antecipada nesta auditoria.

---

## 30. Divergência documental encontrada

Não foi encontrada uma divergência que justifique alterar os documentos canônicos nesta PR.

`docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md` descreve **direção desejada** e explicitamente manda validar runtime antes de implementar. O runtime auditado confirma as boundaries centrais e também confirma que várias áreas documentadas são roadmap, não estado entregue.

Esta auditoria adiciona a evidência diferencial e a priorização; não reclassifica hipótese como implementação.

---

## 31. Validação docs-only

Critérios desta S1:

- branch criada a partir de `main@90ca2482d7c6d35f91f9b3907be59523ba18bcae`;
- somente documentação deve aparecer no diff;
- nenhuma alteração em `src/`, SQL, migrations, RLS, RPC, Edge Functions, workflows ou package files;
- nenhuma ação de produção;
- PR deve permanecer sem merge automático.

---

## 32. Decisão final

O MedicsPro atual **não deve voltar ao passado para ficar mais completo**.

A direção é:

```text
produto/UX operacional aprendido no legado
                +
segurança/multi-tenant/capabilities do runtime atual
                +
control plane comercial explícito
                +
catálogos/versionamento
                +
Encounter como unidade clínica
```

Isso produz um SaaS mais forte do que qualquer uma das duas bases isoladamente.
