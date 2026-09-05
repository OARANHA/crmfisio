# MedicsPro — Estado consolidado do projeto — 2026-09-05

Este documento é o ponto de retomada operacional do MedicsPro. Ele registra o que já foi entregue, validado em produção, o que permanece aberto e quais cuidados devem ser preservados nas próximas mudanças.

## Estado da main

Base consolidada considerada neste documento: merge do PR #151.

A `main` é tratada como potencialmente produtiva e acompanha deploys via Portainer. Não usar `main` para experimentação.

## Fundação SaaS já fechada

### Multi-tenant / identidade

- isolamento por `clinic_id` e RLS endurecido;
- `platform_admin` separado dos papéis de clínica;
- clínica usa Auth + `profiles`;
- usuários inativos não devem manter acesso;
- control-plane e sessão de clínica usam clientes Supabase separados.

### Provisionamento

- fluxo de provisionamento de clínica idempotente;
- primeiro owner criado no processo;
- auditoria de plataforma compatível com o contrato atual;
- fluxo validado com clínica piloto.

### Platform Admin

- painel de governança funcional;
- sessão isolada do login da clínica;
- clínica selecionada persistida;
- entitlements alteráveis de forma centralizada.

## Entitlements

Chaves canônicas atuais:

| Chave | Estado do boundary |
|---|---|
| `finance.access` | server-side validado |
| `crm.access` | server-side validado |
| `whatsapp.access` | server-side validado |
| `reports.access` | gate de módulo, sem bloquear tabelas base compartilhadas |
| `assessments.custom` | server-side validado |
| `nexus.access` | server-side fail-closed + médico-only validado |

Regra geral do rollout: ausência de linha física continua backward-compatible para módulos comuns; linha explícita `false` bloqueia. Nexus é exceção e exige linha explícita efetiva.

## Validações funcionais importantes já realizadas

### CRM

Com `crm.access=false`, alteração autenticada de `patients.funil_stage` foi bloqueada com HTTP 403 / SQLSTATE 42501.

### WhatsApp

Com `whatsapp.access=false`, chamada autenticada ao `evolution-worker` foi bloqueada com HTTP 403. Outbox, templates e revisão humana também possuem guards server-side.

### Avaliações customizadas

`assessments.custom` protege templates próprios da clínica sem bloquear Avaliações padrão do MedicsPro. Estado bloqueado e liberado foram testados.

### Nexus

O boundary foi provado com três cenários:

- médico válido + clínica sem entitlement => bloqueado;
- médico válido + `nexus.access=true` => permitido;
- owner não médico + `nexus.access=true` => bloqueado.

O Nexus também exige identidade médica ativa e CRM válido; papel interno isolado nunca é suficiente.

## Assessment Engine

Arquitetura vigente:

- **Avaliações padrão**: templates curados pelo MedicsPro;
- **Minhas avaliações**: templates próprios da clínica/profissional;
- duplicar padrão cria cópia independente da clínica;
- lifecycle customizado inclui criação, edição, versão, publicação e arquivamento;
- histórico e respostas clínicas não devem ser bloqueados por `assessments.custom`;
- body map é parte da direção de UX clínica.

## Financeiro

### Núcleo já validado

- atendimento avulso finalizado gera recebível idempotente;
- atendimento com pacote consome sessão e não gera cobrança avulsa;
- pacote sem saldo/validade bloqueia finalização;
- baixa exige método e registra `paid_at`/histórico;
- lançamento pago é imutável no fluxo normal;
- recepção pode criar conta a receber, mas não conta a pagar;
- valores monetários seguem centavos inteiros;
- financeiro possui entitlement server-side;
- cancelamento de atendimento pré-pago exige resolução financeira explícita e auditável;
- pagamento histórico liquidado é preservado;
- resolução duplicada é rejeitada.

### PR #151 — concluído em produção

O PR #151 — `Require explicit financial resolution for prepaid cancellations` — foi mergeado na `main` e sua migration foi aplicada em produção.

O verifier `VERIFY_20260905_PREPAID_CANCELLATION_FINANCIAL_RESOLUTION.sql` passou com todos os checks positivos.

As disposições financeiras canônicas do cancelamento pré-pago são:

- `refund_due`;
- `credit_due`;
- `retained`.

`retained` é restrito a owner/admin. Reembolso e crédito permanecem obrigações explícitas para posterior operação; isso é acabamento operacional, não falha estrutural do financeiro core.

### Evoluções posteriores

- UX própria para cobrança antecipada e resolução financeira;
- pagamento parcial e múltiplos meios;
- caixa/conciliação;
- documentos fiscais/recibos;
- demais evoluções guiadas pelo piloto real.

## Regras de segurança e governança para continuar

- production migrations devem vir de commit de merge conhecido;
- executar verifier após migration;
- segurança server-side é autoridade; UI não substitui RLS/triggers/RPC authorization;
- não bloquear tabelas compartilhadas por entitlement quando isso quebrar módulos legítimos;
- não liberar Nexus por papel genérico;
- não apagar/regravar histórico financeiro liquidado para "corrigir" exceções;
- preservar histórico clínico e dados de comunicação mesmo quando módulos comerciais forem desabilitados;
- mudanças que exigem ação no servidor devem ser explicitamente destacadas para execução controlada em produção.

## Ordem recomendada de retomada

1. consolidar Configurações / Entitlements / governança por clínica de ponta a ponta;
2. consolidar Atendimento em andamento;
3. polir Assessment Engine + body map;
4. introduzir ajuda contextual e manual no painel;
5. validar relatórios com base real do piloto;
6. polir WhatsApp/observabilidade;
7. continuar design system premium dark/light;
8. evoluir financeiro avançado conforme sinais reais do piloto.

## Definition of Done para novas slices

Uma slice sensível só é considerada fechada quando houver, conforme aplicável:

- código em branch dedicada;
- CI verde;
- PR revisável;
- migration aplicada de forma pinada ao merge commit;
- verifier verde;
- teste funcional negativo;
- teste positivo seguro;
- documentação atualizada.
