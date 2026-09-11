# MedicsPro — Platform Control Plane, Clinic Configuration e Catálogos

> Documento canônico de direção de produto para o domínio SaaS/administrativo.  
> **Data:** 2026-09-11  
> **Runtime canônico auditado:** `OARANHA/crmfisio` em `main@52c6bfa49cbdbf50e57220a712ca9d38654ab347`  
> **Referência histórica auditada:** `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`

Este documento existe para que qualquer agente, inclusive em outra sessão, entenda a arquitetura de produto desejada para:

- Platform Admin;
- configurações da clínica;
- planos, módulos, entitlements, limites e overrides;
- WhatsApp e demais provedores;
- templates, catálogos e modelos reutilizáveis;
- assinaturas/receita da plataforma;
- equipe da plataforma e suporte;
- relação entre o SaaS e o domínio clínico.

Ele **não autoriza copiar a arquitetura do MedicsPro histórico**. `OARANHA/crmfisio` continua sendo o único runtime canônico. O histórico é fonte obrigatória de aprendizado de produto/UX/workflow quando existir equivalente maduro.

---

## 1. Leitura obrigatória e ordem de autoridade

Para qualquer trabalho relevante neste eixo, ler nesta ordem:

1. `AGENTS.md`;
2. `docs/CURRENT_STATE.md`;
3. este documento;
4. `TODO.md`;
5. `PRODUCT_ROADMAP.md`;
6. `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` quando houver equivalente histórico;
7. código/schema/runtime real relacionado à tarefa.

A autoridade permanece:

```text
runtime/schema/testes atuais
        >
decisões canônicas documentadas
        >
referência histórica
        >
mockups/ideias isoladas
```

Se documento e runtime divergirem, não escolher silenciosamente. Identificar o drift e reconciliar antes de ampliar a implementação.

---

## 2. Modelo mental definitivo: três níveis, três responsabilidades

MedicsPro deve tratar a operação como três domínios separados:

```text
PLATFORM ADMIN
    ↓ define o produto SaaS disponível para a clínica

ADMINISTRAÇÃO DA CLÍNICA
    ↓ configura como a clínica usa o que contratou

USUÁRIO / PROFISSIONAL
    ↓ usa somente o que sua identidade, role, capability e contexto permitem
```

### 2.1 Platform Admin

Administra **o SaaS MedicsPro**, não o prontuário do paciente.

Responsabilidades típicas:

- lifecycle da clínica;
- onboarding/provisionamento;
- planos;
- módulos/entitlements;
- limites de uso;
- overrides comerciais/operacionais;
- assinaturas e receita da plataforma;
- provedores globais;
- saúde de integrações;
- catálogos globais MedicsPro;
- rollout/feature flags;
- governança, auditoria e suporte;
- equipe administrativa da própria plataforma.

### 2.2 Admin da clínica

Administra **o tenant/clínica** dentro do que a plataforma permite.

Responsabilidades típicas:

- identidade da clínica;
- unidades, salas, equipamentos e horários;
- equipe e acessos internos;
- procedimentos/serviços;
- configuração financeira da clínica;
- conexão/configuração do WhatsApp da própria clínica;
- templates/modelos próprios;
- consentimentos/documentos configuráveis;
- avaliações customizadas;
- protocolos e disponibilidade institucional;
- integrações próprias quando o produto permitir BYOC/credenciais por clínica.

### 2.3 Profissional/usuário operacional

Usa o produto no contexto permitido por:

```text
entitlement da clínica
+ configuração da clínica
+ role operacional
+ identidade profissional
+ capability
+ autoria/relação assistencial
+ contexto do recurso/Encounter
```

Nenhum nível substitui silenciosamente outro.

---

## 3. Regra canônica de acesso ao produto

O modelo desejado é:

```text
PLATFORM ENTITLEMENT
        ↓
CLINIC CONFIGURATION
        ↓
USER AUTHORIZATION / CAPABILITY
        ↓
RESOURCE / ENCOUNTER CONTEXT
```

Exemplos:

- a plataforma pode liberar WhatsApp para a clínica;
- a clínica ainda precisa conectar/configurar sua instância/número;
- um usuário ainda precisa ter autoridade operacional para enviar mensagem;
- a mensagem ainda precisa respeitar opt-in, template, paciente/appointment e regras de auditoria.

Outro exemplo:

- a plataforma pode liberar `assessments.custom`;
- a clínica pode habilitar e criar seus modelos;
- o profissional ainda precisa de autorização clínica apropriada;
- o histórico finalizado continua imutável/versionado.

**Entitlement nunca é autorização de dados.**

---

## 4. Precedência de produto: default → plano → override → configuração

O MedicsPro histórico já possuía uma ideia útil de `default`, `plan` e `override`. No runtime atual isso deve evoluir para um contrato explícito e auditável.

Direção canônica:

```text
DEFAULT DA PLATAFORMA
        ↓
PLANO / PACOTE COMERCIAL
        ↓
OVERRIDE EXPLÍCITO DA CLÍNICA
        ↓
ENTITLEMENT EFETIVO
        ↓
CONFIGURAÇÃO INTERNA DA CLÍNICA
        ↓
AUTORIZAÇÃO DO USUÁRIO
```

Regras:

- default não deve se transformar em hardcode espalhado pelo frontend;
- plano define produto contratado e limites-base;
- override deve ser explícito, auditável e reversível;
- retornar de override para herdado deve preservar histórico;
- alteração de entitlement não deve apagar dados históricos;
- Nexus continua com comportamento conservador/fail-closed onde já definido;
- browser nunca deve ser autoridade final para entitlement sensível.

O `PlatformClinicEntitlementsPanel` atual já contém a base conceitual correta para `nexus.access`, `finance.access`, `crm.access`, `reports.access`, `assessments.custom` e `whatsapp.access`. Evoluir esta fundação, não criar um segundo sistema paralelo.

---

## 5. O que o Platform Admin deve controlar

### 5.1 Visão geral

Painel de saúde do negócio e da plataforma:

- clínicas ativas/suspensas/pendentes;
- solicitações de acesso;
- onboarding pendente;
- assinaturas por status;
- MRR/ARR quando a cobrança da plataforma estiver canônica;
- consumo por módulo;
- saúde de provedores;
- falhas operacionais agregadas;
- rollout/adoção de módulos.

Não transformar esta visão em acesso implícito ao prontuário.

### 5.2 Comercial

- solicitações de clínica;
- leads e origem quando o portal comercial estiver integrado;
- aprovação/rejeição;
- plano proposto;
- trial/demonstração;
- conversão;
- motivo de cancelamento/churn da assinatura SaaS.

Este CRM da plataforma é diferente do CRM de pacientes da clínica.

### 5.3 Clínicas e lifecycle

Por clínica:

- status de lifecycle;
- owner;
- plano;
- assinatura;
- entitlements;
- limites;
- overrides;
- consumo agregado;
- módulos configurados;
- integrações conectadas/saúde;
- datas de criação/ativação/suspensão;
- trilha de auditoria de decisões da plataforma.

### 5.4 Produto / Features

Retomar a boa ideia histórica de um catálogo administrável de features, mas com arquitetura atual.

Uma feature de plataforma pode possuir conceitualmente:

- `key` estável;
- nome;
- descrição;
- categoria;
- tipo (`boolean`, `limit`, `usage` quando fizer sentido);
- valor/default;
- limite/default;
- self-service ou não;
- rollout state;
- requisitos/dependências;
- metadata de UI/comercial;
- histórico/auditoria.

Categorias úteis inspiradas no histórico e atualizadas:

- comunicação;
- automação;
- analytics/relatórios;
- financeiro;
- armazenamento;
- integrações;
- IA/Nexus;
- clínico;
- limites;
- segurança/governança;
- outros.

**Não implementar feature registry genérico apenas porque está documentado.** Antes, verificar se os entitlements atuais resolvem a necessidade com menor risco.

### 5.5 Planos

Plano comercial deve compor:

- preço;
- ciclo de cobrança;
- módulos incluídos;
- limites incluídos;
- add-ons quando existirem;
- trial;
- regras de upgrade/downgrade;
- política de excesso quando aplicável;
- versionamento comercial suficiente para não reinterpretar contratos históricos.

O histórico já mostrava módulos e limites por plano. Aproveitar o conceito, não hardcodes antigos de `doctors`, `photos`, `uploadSizeMB` ou Stripe específico sem validar a arquitetura atual.

### 5.6 Receita e assinaturas

Área da plataforma, separada do Financeiro da clínica:

- plano contratado;
- cobrança SaaS;
- status da assinatura;
- inadimplência da assinatura;
- trial;
- faturas/pagamentos do MedicsPro;
- upgrade/downgrade;
- cancelamento;
- créditos/cupom quando houver contrato;
- consumo faturável quando aplicável.

Não confundir:

```text
receita MedicsPro ← clínica paga o SaaS

financeiro da clínica ← paciente paga a clínica
```

### 5.7 Integrações e provedores

Platform Admin deve administrar a infraestrutura/provedor global quando este for operado pelo MedicsPro:

- Evolution/WhatsApp;
- provedor de e-mail;
- pagamentos do próprio SaaS;
- armazenamento;
- webhooks;
- provedores de IA;
- NFS-e agregadores, se futuramente MedicsPro operar a integração;
- health/checks e quotas.

Credenciais da plataforma permanecem server-side.

Quando a clínica trouxer sua própria credencial, separar:

```text
provider capability da plataforma
        ≠
credential/configuração daquela clínica
```

### 5.8 Governança e suporte

- Platform Admins;
- roles/capabilities internas da equipe MedicsPro;
- auditoria;
- suporte;
- sessões de suporte temporárias/auditadas se futuramente aprovadas;
- incidentes operacionais;
- segurança;
- abuse/rate limits.

Support access é deny-by-default e não herda acesso clínico.

---

## 6. O que o Platform Admin pode enxergar — e o que não pode

Pode enxergar dados operacionais/agregados necessários à operação do SaaS, por exemplo:

- clínica e owner;
- plano/assinatura;
- usuários ativos em contagem;
- armazenamento agregado;
- mensagens/consumo agregado;
- módulo habilitado;
- integração conectada ou falhando;
- número agregado de atendimentos, quando necessário para uso/planos;
- métricas técnicas e comerciais.

Não deve receber automaticamente:

- texto de evolução;
- HDA;
- respostas de avaliação;
- PHQ-9/GAD-7 de paciente;
- prescrições;
- anexos clínicos;
- conteúdo de laudos;
- conversas clínicas;
- dados financeiros de pacientes sem finalidade de suporte explicitamente autorizada.

Se um futuro fluxo de suporte precisar acessar dado tenant-sensitive, desenhar boundary separado, temporário, justificado e auditado. Nunca usar `platform_admin` como bypass universal.

---

## 7. Configurações da clínica — arquitetura desejada

A área Configurações do tenant deve ser organizada por domínio, não como uma lista crescente de formulários.

Direção:

```text
Configurações
│
├── Geral
│   ├── Identidade da clínica
│   ├── Unidades
│   ├── Horários
│   ├── Salas/equipamentos
│   └── Dados fiscais
│
├── Equipe e acesso
│   ├── Usuários
│   ├── Profissionais
│   ├── Roles
│   └── Capabilities/configurações permitidas
│
├── Agenda e atendimento
│   ├── Serviços/procedimentos
│   ├── duração
│   ├── disponibilidade
│   ├── regras operacionais
│   └── recursos
│
├── Clínico
│   ├── Avaliações padrão
│   ├── Minhas avaliações
│   ├── Instrumentos disponíveis
│   ├── Documentos/modelos
│   ├── Consentimentos
│   └── protocolos
│
├── Comunicação
│   ├── WhatsApp
│   ├── templates de mensagens
│   ├── automações
│   ├── opt-in
│   └── NPS
│
├── Financeiro
│   ├── categorias
│   ├── meios de pagamento
│   ├── parceiros/repasse
│   └── configurações permitidas pelo plano
│
├── Integrações
│   ├── pagamentos
│   ├── fiscal
│   ├── WhatsApp/provider
│   └── outras APIs
│
└── Governança
    ├── LGPD
    ├── auditoria visível ao tenant
    ├── exportação
    └── retenção/configurações permitidas
```

O menu exato pode evoluir; a separação de domínios não deve regredir.

---

## 8. WhatsApp — separação Platform × Clínica × Usuário

O MedicsPro histórico possuía uma tela de WhatsApp no admin da plataforma com status, QR Code, conectar/desconectar e envio de teste. A intenção é útil, mas a arquitetura atual deve separar responsabilidades.

### 8.1 Platform Admin — serviço

Controla/observa:

- provider global;
- saúde da Evolution/Meta/outro provider;
- instâncias;
- filas;
- consumo por tenant;
- limites/plano;
- falhas e reconciliação;
- retries/backoff;
- webhooks;
- SLA/observabilidade.

### 8.2 Admin da clínica — conexão e comportamento

Controla:

- conectar seu número/instância quando esse for o modelo adotado;
- QR Code quando aplicável;
- status;
- número/remetente;
- templates permitidos;
- opt-in;
- automações;
- preferências de confirmação/remarcação/NPS;
- credenciais próprias quando o provider for BYOC.

### 8.3 Usuário operacional

Pode executar apenas ações autorizadas:

- enviar mensagem manual permitida;
- confirmar consulta;
- remarcação;
- termo/consentimento;
- avaliação/instrumento remoto quando o boundary existir;
- NPS;
- reativação/follow-up.

O motor atual de fila, idempotência/reconciliação e regras server-side prevalece sobre qualquer simplicidade do histórico.

---

## 9. Templates, catálogos e modelos — não existe um único “template”

Tratar como famílias distintas:

```text
CATÁLOGO MEDICSPRO
│
├── Avaliações estruturadas
├── Instrumentos clínicos validados
├── Documentos clínicos
│   ├── prescrição
│   ├── pedido de exame
│   ├── atestado/declaração
│   └── relatório/laudo
├── Consentimentos/termos
└── Comunicação
    ├── confirmação
    ├── lembrete
    ├── NPS
    └── reativação
```

### 9.1 Hierarquia desejada

Quando o domínio permitir customização:

```text
MODELO GLOBAL MEDICSPRO
        ↓
CLÍNICA ADOTA / CLONA / ATIVA
        ↓
CLÍNICA PERSONALIZA
        ↓
VERSÃO PUBLICADA
        ↓
USO NO PACIENTE/ENCOUNTER
        ↓
SNAPSHOT / HISTÓRICO IMUTÁVEL
```

Regras:

- editar template amanhã não pode alterar documento/avaliação histórica de ontem;
- conteúdo finalizado precisa carregar identidade/versionamento suficiente;
- template global e template da clínica não são o mesmo registro lógico quando a clínica faz customização material;
- não usar HTML livre como atalho universal para documentos clínicos sensíveis;
- autoria, assinatura e regras específicas continuam pertencendo a cada domínio documental.

### 9.2 Avaliações padrão × Minhas avaliações

UX desejada:

```text
Avaliações
│
├── Biblioteca MedicsPro
│   └── modelos curados/versionados
│
└── Minhas avaliações
    └── modelos criados/customizados pela clínica
```

O Assessment Engine canônico continua sendo a base para avaliações estruturadas.

Body Map pode ser componente de uma avaliação, preservando dados estruturados e utilidade longitudinal.

### 9.3 PHQ-9/GAD-7 não viram “template comum”

PHQ-9/GAD-7 continuam usando a engine/versionamento/scoring canônicos do eixo Clinical Instruments/Nexus.

Não duplicar esses instrumentos dentro de “Minhas avaliações” para contornar autorização.

Preservar:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

---

## 10. Equipe da plataforma

O MedicsPro histórico já diferenciava equipe do admin da plataforma (`super admin`, `admin`, `suporte`). A direção é válida, mas os nomes/ACL antigos não são canônicos.

Modelo futuro recomendado, sujeito a slice própria:

```text
Platform Owner
  produto + negócio + governança completa

Platform Operations
  clínicas + onboarding + lifecycle + suporte operacional

Platform Finance
  planos + assinaturas + cobrança SaaS

Platform Support
  diagnóstico operacional
  sem acesso clínico implícito
```

Não criar essas roles em `public.profiles.role`.

Uma pessoa pode ter identidade de plataforma e, separadamente, membership explícita em uma clínica. Os dois contextos não se misturam automaticamente.

---

## 11. Evidência direta do MedicsPro histórico que deve continuar sendo consultada

A auditoria de 2026-09-11 confirmou diretamente no repositório histórico:

### Platform Admin antigo

- `crm-clinic-admin/src/router/index.js`
  - Dashboard;
  - Convites;
  - Equipe Admin;
  - Usuários;
  - Clínicas;
  - Assinaturas;
  - WhatsApp;
  - Planos;
  - Features;
  - API Keys;
  - Nova Clínica;
  - Avaliações;
  - Notificações.

- `crm-clinic-admin/src/views/FeaturesManagerView.vue`
  - catálogo de features;
  - categorias;
  - tipos boolean/limit/usage;
  - valor/limite padrão;
  - `selfService`.

- `crm-clinic-admin/src/views/PlansManagerView.vue`
  - preço;
  - limites;
  - módulos;
  - exemplo histórico de WhatsApp/Financeiro/Workflows/IA por plano.

- `crm-clinic-admin/src/views/ClinicDetailView.vue`
  - plano/status da assinatura;
  - owner/staff;
  - horário;
  - features por clínica;
  - origem `override | plan | default`;
  - overrides de módulos/limites.

- `crm-clinic-admin/src/views/WhatsappView.vue`
  - status;
  - QR Code;
  - conectar/desconectar;
  - mensagem de teste.

- `crm-clinic-admin/src/views/AdminManagementView.vue`
  - equipe da plataforma separada;
  - convites;
  - papéis históricos `super admin`, `admin`, `suporte`.

### Experiência clínica/templates históricos

Continuar usando também `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` como índice para:

- anamnese/templates;
- prescrição;
- pedidos de exames;
- atestados;
- termos;
- ficha do paciente;
- galeria/anexos;
- atendimento contextual.

### Regra obrigatória para futuras slices

Antes de redesenhar uma área com equivalente histórico:

1. abrir diretamente os arquivos históricos relevantes;
2. abrir diretamente o runtime atual equivalente;
3. produzir comparação curta:
   - **preservar**;
   - **evoluir**;
   - **redesenhar**;
   - **rejeitar**;
4. implementar somente sobre contratos canônicos atuais.

Não confiar apenas na memória ou em prints quando o código histórico pode esclarecer o comportamento.

---

## 12. O que rejeitar do histórico

Não portar:

- Vue/Pinia/Mongo/Express como arquitetura para o runtime atual;
- tenancy antiga;
- autorização antiga;
- `super admin` como bypass clínico;
- hardcodes de plano espalhados;
- Stripe/checkout acoplado apenas porque estava presente;
- autosave que anuncia “salvo” antes de confirmação real;
- checkout como requisito para finalizar ato clínico;
- templates/documentos sem versionamento/histórico adequado;
- acesso amplo a dados tenant-sensitive pela equipe da plataforma.

Regra institucional permanece:

> **não portar o velho MedicsPro; absorver o que ele entendia bem sobre o profissional e sobre a operação do SaaS.**

---

## 13. Programa de implementação — etapas canônicas

Este programa é um **mapa de execução**, não ordem para interromper P0s em andamento. Fechar gates de produção já abertos antes de iniciar grandes foundations novas.

### ETAPA 0 — Reconciliar documentação e estado operacional

Objetivo: garantir que todo agente parte da mesma realidade.

- manter `CURRENT_STATE`, `TODO` e roadmap sincronizados;
- registrar rollout real de #399/#400;
- registrar repair #400;
- fechar P0s curtos já conhecidos;
- não iniciar nova arquitetura a partir de documentação stale.

**Saída:** base operacional confiável.

### ETAPA 1 — Inventário Platform Admin atual × histórico

Objetivo: saber o que já existe antes de construir.

Auditar:

- `PlatformAdminShell`;
- entitlements atuais;
- onboarding/provisionamento;
- receita/assinaturas atuais;
- auditoria;
- lifecycle de clínica;
- telas históricas listadas na seção 11.

Classificar cada capability:

```text
já canônica
parcial
legacy útil
não implementar agora
```

**Não criar tabelas nesta etapa se a necessidade ainda puder ser resolvida pela foundation existente.**

### ETAPA 2 — Control Plane mínimo de produto

Objetivo: tornar o Platform Admin realmente capaz de operar o SaaS.

Prioridade 80/20:

1. clínicas/lifecycle;
2. plano;
3. entitlements;
4. limites;
5. overrides;
6. auditoria;
7. consumo/saúde básica.

Só depois considerar feature registry genérico mais sofisticado.

**Saída:** Platform Admin controla produto contratado sem tocar autorização clínica.

### ETAPA 3 — Arquitetura de Configurações da Clínica

Objetivo: organizar o tenant em domínios coerentes.

- definir Information Architecture da tela Configurações;
- mapear dados/contratos existentes por domínio;
- eliminar duplicação entre configuração, entitlement e ACL;
- não inventar toggle frontend sem enforcement/contrato real quando ele for sensível.

**Saída:** shell/configuração consistente e extensível.

### ETAPA 4 — WhatsApp como produto configurável

Objetivo: separar provider da plataforma, configuração tenant e ação do usuário.

- health/instância/provider no Platform Admin;
- conexão/configuração no Admin da clínica;
- envio/automação autorizada no domínio operacional;
- consumo/limite conectado ao entitlement/plano;
- observabilidade/reconciliação preservadas.

**Saída:** WhatsApp deixa de ser uma integração solta e vira capability SaaS operável.

### ETAPA 5 — Catálogos e templates

Objetivo: criar uma biblioteca MedicsPro reaproveitável sem quebrar versionamento clínico.

Sequência recomendada:

1. Avaliações padrão × Minhas avaliações sobre Assessment Engine existente;
2. templates de comunicação;
3. consentimentos/modelos onde a foundation atual permitir;
4. documentos clínicos somente com contrato próprio de autoria/versionamento;
5. instrumentos validados continuam fora do construtor genérico.

**Saída:** conteúdo MedicsPro distribuível + personalização de clínica + histórico preservado.

### ETAPA 6 — Receita & Assinaturas da plataforma

Objetivo: fechar lifecycle comercial do SaaS.

- planos versionados;
- assinatura;
- trial;
- cobrança;
- inadimplência;
- upgrade/downgrade;
- cancelamento;
- uso faturável quando existir;
- integração PagBank/checkout da plataforma conforme contrato escolhido.

Não confundir com pagamentos paciente→clínica.

### ETAPA 7 — Delegação e suporte de plataforma

Objetivo: permitir equipe MedicsPro sem conceder poder excessivo.

- definir capabilities internas da plataforma;
- separar operações, financeiro e suporte;
- suporte deny-by-default;
- acesso excepcional temporário/auditável somente se necessário;
- nunca usar membership clínica fictícia para suporte universal.

### ETAPA 8 — Inteligência operacional

Somente depois das foundations anteriores:

- alertas de uso;
- churn risk da assinatura SaaS;
- recomendação de upgrade;
- falha recorrente de integração;
- clínicas com onboarding incompleto;
- consumo próximo do limite;
- health score operacional.

---

## 14. Dependências com o roadmap clínico

Este programa não substitui o roadmap clínico.

Dois trilhos coexistem:

```text
TRILHO CLÍNICO
Paciente → Agenda → Encounter → Prontuário → Documentos → Financeiro → Comunicação

TRILHO SaaS
Platform Admin → Clínica → Plano/Entitlements → Configuração → Provedores → Receita/Governança
```

Eles se conectam por contratos explícitos, não por acoplamento de UI.

Exemplo:

```text
Platform Admin libera whatsapp.access
        ↓
Clínica conecta/configura WhatsApp
        ↓
Role/capability permite ação operacional
        ↓
Paciente/appointment/opt-in determinam contexto da mensagem
```

Outro exemplo:

```text
Platform Admin libera assessments.custom
        ↓
Clínica cria/publica modelo
        ↓
Profissional autorizado usa no Encounter
        ↓
Resposta finalizada preserva versão histórica
```

---

## 15. Gates para qualquer PR futuro deste eixo

Antes de implementar:

- [ ] leu `AGENTS.md` e `CURRENT_STATE`;
- [ ] leu este documento;
- [ ] inspecionou o runtime atual;
- [ ] verificou se já existe entitlement/config/provider canônico;
- [ ] consultou diretamente o MedicsPro histórico quando houver equivalente maduro;
- [ ] classificou preserve/evolve/redesign/reject;
- [ ] separou Platform Admin × Clinic Admin × User Authorization;
- [ ] identificou dados tenant-sensitive que não podem vazar para plataforma;
- [ ] evitou hardcode de plano/feature no frontend;
- [ ] definiu auditoria para mutação de plataforma;
- [ ] preservou histórico ao alterar entitlement/template/plano;
- [ ] testou tenant isolation e browser-direct access quando aplicável;
- [ ] atualizou documentação se a decisão canônica mudou.

Para mudança sensível de segurança/entitlement:

- outro tenant;
- usuário sem entitlement;
- usuário sem capability;
- clínica suspensa;
- perfil inativo;
- anônimo;
- acesso direto a RPC/tabela/Edge Function;
- retorno seguro ao remover override;
- histórico não destruído.

---

## 16. Invariantes que futuros agentes não devem rediscutir sem evidência

1. `platform_admin` é domínio separado de `public.profiles.role`.
2. Platform Admin administra o SaaS, não recebe prontuário universal.
3. Entitlement ≠ clinic configuration ≠ user authorization.
4. Plano e override não podem substituir RLS/RPC/capability.
5. WhatsApp tem camada de provider, camada tenant e camada de uso operacional.
6. Templates clínicos/documentais precisam de versionamento/snapshot adequado ao domínio.
7. PHQ-9/GAD-7 não devem ser duplicados em Assessment Engine apenas para ampliar exposição.
8. Biblioteca MedicsPro e “Minhas avaliações” devem convergir no engine canônico de avaliações quando se tratar de assessment estruturado.
9. Receita/assinatura do MedicsPro é separada do Financeiro paciente→clínica.
10. Equipe da plataforma não é equipe da clínica.
11. Suporte é deny-by-default.
12. O MedicsPro histórico deve ser consultado diretamente quando houver equivalente maduro, mas nunca dita arquitetura atual.
13. Foundations existentes devem ser evoluídas antes de criar sistemas paralelos.
14. Feature count não é objetivo; priorizar operação SaaS e jornadas de alta frequência.

---

## 17. Próximo passo recomendado quando este programa for retomado

Não começar por uma tela isolada.

O próximo agente deve primeiro produzir um **inventário comparativo Platform Admin atual × MedicsPro histórico**, cobrindo no mínimo:

- Clinics/lifecycle;
- Plans;
- Features/entitlements;
- Limits/usage;
- Subscriptions;
- WhatsApp;
- API/integrations;
- Surveys/templates;
- Notifications;
- Platform team/support.

Para cada linha:

```text
estado atual
contrato atual
legado útil
risco
lacuna
prioridade 80/20
próxima slice mínima
```

Depois escolher **uma única vertical slice** com benefício operacional claro, sem abrir várias foundations simultaneamente.

---

## 18. Nota de continuidade

Este documento captura uma decisão de produto de longo prazo. Ele não significa que todos os itens estejam implementados.

Sempre diferenciar explicitamente:

```text
CANÔNICO IMPLEMENTADO
CANÔNICO DOCUMENTADO/FUTURO
LEGADO ÚTIL
IDEIA NÃO APROVADA
```

Essa distinção é obrigatória em relatórios de agentes, PRs e handoffs futuros.