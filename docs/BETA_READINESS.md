# MedicsPro — Beta Readiness

Documento vivo para acompanhar a preparação do MedicsPro para uso por profissionais reais.

## Legenda

- 🟢 GREEN — gate validado e apto para piloto controlado.
- 🟡 YELLOW — fundação existe, mas ainda há riscos/pendências antes de ampliação.
- 🔴 RED — bloqueia piloto.

## Estado em 2026-09-05

| Gate | Status | Evidência / próxima ação |
|---|---|---|
| Multi-tenant / RLS | 🟢 | Isolamento por `clinic_id`, hardening e verificações aplicadas. |
| Papéis e identidade | 🟢 | `platform_admin` separado de papéis internos; usuários de clínica usam Auth + `profiles`. |
| Provisionamento de clínicas | 🟢 | Fluxo idempotente e auditável validado com clínica piloto real. |
| Platform Admin | 🟢 | Sessão isolada do login das clínicas, seleção de clínica persistida e governança funcional validada. |
| Entitlements — UI/rotas | 🟢 | Rotas protegidas e módulos explicitamente bloqueados podem ser ocultados da navegação. |
| Entitlements — Financeiro | 🟢 | `finance.access` com enforcement server-side em pagamentos, histórico e operações de pacotes. |
| Entitlements — CRM | 🟢 | `crm.access` bloqueia server-side mutação de `patients.funil_stage`; teste autenticado negativo retornou 403. |
| Entitlements — WhatsApp | 🟢 | `whatsapp.access` protege outbox, templates, revisão humana e Evolution worker; teste autenticado negativo retornou 403. |
| Entitlements — Avaliações customizadas | 🟢 | `assessments.custom` protege criação/duplicação/edição/versionamento/publicação/arquivamento de templates próprios sem bloquear avaliações padrão. Testes bloqueado/liberado aprovados. |
| Relatórios | 🟢 | `reports.access` é gate do módulo oficial; tabelas base compartilhadas não são bloqueadas para não quebrar Agenda/Pacientes/Financeiro/CRM. |
| Nexus Clinical Engine | 🟢 | Fail-closed, exige entitlement explícito + identidade médica válida + CRM. Testes: médico sem entitlement bloqueado, médico autorizado permitido, owner não médico bloqueado. |
| Financeiro core | 🟢 | Gate SQL limpo, cenários canônicos e smoke real concluídos; cancelamento pré-pago com resolução financeira explícita também validado em produção. |
| Agenda core | 🟢 | Transições protegidas; cancelamento/remarcação e vínculo profissional validados no núcleo. |
| Pacotes | 🟢 | Venda, saldo, consumo unitário, validade/esgotamento e bloqueio validados. |
| Atendimento clínico | 🟡 | Fundação existe; falta consolidar experiência dedicada de atendimento em andamento e autoria final. |
| Assessment Engine | 🟢 | Arquitetura de avaliações padrão + minhas avaliações definida e customização agora possui boundary server-side. |
| WhatsApp / Evolution operacional | 🟡 | Boundary de entitlement fechado; ainda falta acabamento operacional, observabilidade e UX de operação. |
| UX / design system | 🟡 | Modernização em andamento; dark/light e padrões premium devem ser consolidados sem quebrar fluxos core. |
| Ajuda/manual dentro do painel | 🟡 | Planejamento iniciado em `docs/IN_APP_HELP_PLAN.md`; ainda não implementado na UI. |

## Entitlements — semântica atual

Durante o rollout controlado, módulos comuns permanecem backward-compatible quando não existe linha física de entitlement. Uma linha explícita `enabled=false` bloqueia o recurso. Nexus é exceção: `nexus.access` é fail-closed e exige liberação explícita.

Chaves atuais:

- `finance.access`
- `crm.access`
- `whatsapp.access`
- `reports.access`
- `assessments.custom`
- `nexus.access`

## Nexus — boundary validado

A autorização do Nexus não depende apenas de papel interno. Para `nexus.access`/`nexus.evidence` o usuário precisa:

1. estar ativo e vinculado à clínica;
2. ter identidade profissional médica válida;
3. possuir `professional_type` médico;
4. possuir contexto de conselho `CRM`, UF e número de registro;
5. pertencer a clínica com `nexus.access` explicitamente efetivo.

Ser `owner`, `admin` ou possuir temporariamente `role='fisio'` não é suficiente.

## Financeiro — estado do piloto

O PR #151 já foi mergeado e validado em produção. O cancelamento de atendimento com pagamento liquidado agora exige resolução financeira explícita e auditável (`refund_due`, `credit_due` ou `retained`), preservando o pagamento histórico e impedindo resolução duplicada.

O verifier `VERIFY_20260905_PREPAID_CANCELLATION_FINANCIAL_RESOLUTION.sql` passou integralmente em produção.

Pendências financeiras restantes são evoluções de produto/UX, não bloqueadores do núcleo para piloto controlado:

1. UX própria para cobrança antecipada e resolução financeira de exceções;
2. pagamento parcial e múltiplos meios;
3. caixa, conciliação, repasses e documentos fiscais/recibos.

## Próximo foco recomendado

1. Fechar Configurações / Entitlements / governança por clínica de ponta a ponta.
2. Consolidar Atendimento clínico em andamento.
3. Evoluir a UI do Assessment Engine: Avaliações padrão, Minhas avaliações e body map.
4. Implantar ajuda contextual/manual dentro do painel usando a estrutura de `docs/IN_APP_HELP_PLAN.md`.
5. Validar relatórios e indicadores com dados reais de piloto.
6. Polir WhatsApp operacional e observabilidade.
7. Tratar evoluções financeiras avançadas conforme necessidade real do piloto.

## Regra de implantação

A branch `main` deve ser tratada como potencialmente produtiva. O ambiente Portainer acompanha o GitHub em ciclos curtos, portanto:

- nunca usar `main` como área de experimentação;
- PRs precisam estar deploy-safe antes do merge;
- alterações de schema devem ser compatíveis com a versão da aplicação em produção;
- preferir migrations versionadas, idempotentes e verificáveis;
- migrations de produção devem ser aplicadas a partir de commit de merge conhecido;
- validar com verifier canônico após aplicação;
- mudanças de segurança devem ter teste funcional negativo e, quando possível, positivo;
- mudanças que exigem ação no servidor devem ser explicitamente destacadas antes da execução em produção.
