# MedicsPro Platform Admin — Redesign V2

Data: 2026-09-06

## Escopo e repositório

Este documento pertence ao produto principal MedicsPro, repositório `OARANHA/crmfisio`.

O repositório `OARANHA/medicspro-site` continua responsável pelo site comercial/marketing. O Platform Admin, o controle de clínicas/tenants, planos, módulos, provisioning, visibilidade comercial e futuramente receita/assinaturas pertencem ao `crmfisio`.

## Prioridade atual

O foco imediato é o redesign do MedicsPro Platform Admin. Integrações comerciais e de billing ficam preparadas na arquitetura, mas não são o foco visual/funcional desta etapa.

Sequência atual:

```text
Fechamento dos P0/P1 restantes do Nexus
  -> Redesign do Platform Admin
  -> UX, design system e cockpit executivo
  -> Fluxos de clínicas / provisioning / entitlements
  -> depois CRM + Evolution + Asaas
```

Não construir agora CRM completo nem motor próprio de cobrança.

## Referência visual

Usar como referência de linguagem visual dashboards SaaS executivos modernos, com:

- fundo muito claro / off-white;
- cards brancos com bordas suaves;
- cantos arredondados maiores;
- sombras discretas;
- hierarquia visual forte;
- números e indicadores em primeiro plano;
- pequenos ícones em áreas circulares;
- gráficos simples e legíveis;
- bastante respiro e menos densidade visual;
- sensação premium e contemporânea;
- navegação lateral limpa;
- suporte futuro a tema claro/escuro com os mesmos tokens.

Identidade MedicsPro:

- verde de referência próximo a `#00b56e`;
- azul profundo próximo a `#021043`;
- acentos verdes/lima somente para destaque;
- evitar aparência genérica de template e evitar copiar literalmente qualquer referência externa.

## Quatro áreas de negócio do Platform Admin

### 1. Visão Geral

Cockpit executivo do SaaS.

Mostrar apenas dados factuais já disponíveis, por exemplo:

- clínicas ativas;
- clínicas em implantação;
- solicitações pendentes;
- profissionais/usuários;
- alertas operacionais;
- atividade recente;
- ações que exigem atenção.

### 2. Comercial

Visão compacta da operação comercial sem duplicar um CRM.

Preparar espaço para:

- leads novos;
- qualificados;
- demonstrações/negociações;
- oportunidades ganhas;
- prontos para onboarding;
- origem/campanha;
- link externo para CRM;
- conversão lead -> clínica.

Integração futura:

```text
MedicsPro Site
  -> n8n
  -> commercial_leads / eventos canônicos
  -> CRM externo / Evolution
  -> oportunidade ganha
  -> Platform Admin
```

O lead nunca cria tenant automaticamente. O estado decisivo é algo equivalente a `ready_for_provisioning`.

### 3. Clientes & Plataforma

Núcleo de governança SaaS.

Inclui:

- clínicas/tenants;
- status da clínica;
- planos;
- módulos;
- entitlements;
- usuários/owners;
- provisioning;
- suspensão/reativação;
- auditoria;
- configurações de plataforma.

O Platform Admin continua separado dos papéis internos das clínicas.

### 4. Receita & Assinaturas

Área de billing do MedicsPro como empresa, separada do financeiro interno das clínicas.

Preparar visualmente para:

- clientes pagantes;
- MRR;
- receita recebida;
- a receber;
- inadimplência;
- assinaturas;
- cobranças/faturas;
- pagamentos;
- upgrades/downgrades;
- cancelamentos;
- próxima cobrança.

Regra importante:

```text
Financeiro da clínica
pacientes -> sessões/pacotes -> recebimentos

!=

Financeiro da plataforma
cliente MedicsPro -> assinatura -> cobrança -> pagamento
```

## Billing futuro

Asaas é a direção inicial Brazil-first para cobrança/assinaturas, mas o MedicsPro deve manter contrato interno neutro de provedor.

Arquitetura alvo:

```text
Platform Admin
  -> BillingProvider
      -> AsaasAdapter
      -> futuro StripeAdapter
      -> futuro MercadoPagoAdapter
      -> futuro PagarmeAdapter
  -> webhooks
  -> n8n normaliza eventos
  -> estado interno de billing
  -> Platform Admin
```

Entidades sugeridas para fase futura:

- `platform_customers`;
- `platform_subscriptions`;
- `platform_invoices`;
- `platform_payments`;
- `platform_payment_events`.

Nunca reduzir histórico financeiro a um simples `paid=true` mutável.

## Dashboard inicial desejado

Estrutura visual aproximada:

```text
[ Hero / saudação / resumo executivo ] [ Saúde / insights ]

[ Clínicas ] [ Leads ] [ Receita ] [ Pendências ]

[ Evolução / crescimento factual ] [ Distribuição / status ]

[ Atividade recente ] [ Ações que exigem atenção ]
```

Enquanto uma fonte real não existir, não inventar métricas para preencher o layout.

Exemplo correto antes da integração financeira:

```text
Receita & Assinaturas
Integração financeira em preparação
```

ou ocultar o KPI até existir dado confiável.

## Princípios de UX

1. Mostrar prioridade e estado, não apenas entidades.
2. Evitar telas excessivamente técnicas para tarefas comerciais/operacionais.
3. Ações principais devem ser óbvias e próximas do contexto.
4. Loading, empty state e error state devem fazer parte do redesign.
5. Não mostrar indicadores falsos ou placeholders que pareçam dados reais.
6. Reutilizar componentes e tokens visuais entre as quatro áreas.
7. Preservar boundaries de autorização e multi-tenant durante o redesign.
8. Não misturar Platform Admin com papéis `owner/admin/fisio/recep/financeiro` de uma clínica.

## Fluxo de negócio completo alvo

```text
CAPTAR
  -> VENDER
  -> PROVISIONAR
  -> COBRAR
  -> RECEBER
  -> RENOVAR
  -> RETER
```

O Platform Admin deve evoluir de painel técnico para backoffice/cockpit operacional do SaaS MedicsPro, sem se tornar um monólito que replique CRM ou gateway de pagamento.

## Próximos passos imediatos

1. concluir alinhamentos finais do Nexus que sejam P0/P1;
2. auditar o Platform Admin atual e mapear páginas/componentes reutilizáveis;
3. definir tokens/layout do redesign V2;
4. redesenhar primeiro a home/Visão Geral;
5. reorganizar a navegação nas quatro áreas de negócio;
6. redesenhar Clientes & Plataforma e os fluxos de provisioning;
7. criar estados visuais preparados para Comercial e Receita & Assinaturas sem inventar dados;
8. somente depois conectar CRM/Evolution e Asaas.
