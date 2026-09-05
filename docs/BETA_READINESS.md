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
| Provisionamento de clínicas | 🟢 | Fluxo idempotente e auditável validado com clínica piloto. |
| Platform Admin | 🟢 | Console e governança disponíveis sem acesso clínico implícito. |
| Entitlements | 🟡 | Fundação e RPCs existem; próximo gate é garantir enforcement consistente UI + servidor em todos os módulos. |
| Financeiro core | 🟢 | Gate SQL limpo, 10 cenários canônicos aprovados e smoke real da UI concluído. |
| Agenda core | 🟢 | Transições protegidas; cancelamento/remarcação e vínculo profissional validados no núcleo. |
| Pacotes | 🟢 | Venda, saldo, consumo unitário, validade/esgotamento e bloqueio validados. |
| Atendimento clínico | 🟡 | Fundação existe; falta consolidar experiência dedicada de atendimento em andamento e autoria final. |
| Assessment Engine | 🟡 | Direção definida para avaliações padrão, minhas avaliações e componentes estruturados. |
| Nexus Clinical Engine | 🟡 | Deve permanecer médico-only e exigir `professional_type='medico'`, contexto CRM e entitlement efetivo. |
| WhatsApp / Evolution | 🟡 | Outbox/webhook e automações existem; ainda precisa fechamento operacional completo e observabilidade. |
| Relatórios | 🟡 | Entitlement existe; precisa validação completa por clínica e consistência de indicadores. |
| UX / design system | 🟡 | Modernização em andamento; dark/light e padrões premium devem ser consolidados sem quebrar fluxos core. |

## Financeiro — pendências P1 não bloqueantes para piloto controlado

1. Cancelamento após pagamento antecipado precisa de fluxo auditável de estorno, crédito, retenção ou transferência para reagendamento.
2. Pagamento antecipado vinculado a atendimento precisa de fluxo próprio na UI.
3. Financeiro avançado ainda deve evoluir para pagamento parcial, múltiplos meios, caixa, conciliação, repasses e documentos fiscais/recibos.

## Próximo gate obrigatório

### Configurações / Entitlements / governança por clínica

Objetivo: provar que a plataforma consegue liberar ou bloquear funcionalidades por clínica sem depender apenas da navegação frontend.

Aceite mínimo:

- Platform Admin consegue visualizar e alterar entitlements da clínica de forma auditável;
- módulos sem entitlement não aparecem como disponíveis na navegação quando aplicável;
- operações sensíveis também falham server-side quando o módulo estiver indisponível;
- owner/admin da clínica só configura recursos dentro do que a plataforma liberou;
- alteração de entitlement não apaga dados históricos;
- clínica piloto mantém `finance.access` e `reports.access` efetivos;
- `nexus.access` não deve ser habilitado até o enforcement médico-only estar provado.

## Regra de implantação

A branch `main` deve ser tratada como potencialmente produtiva. O ambiente Portainer atual acompanha o GitHub em ciclos curtos (aproximadamente cinco minutos), portanto:

- nunca usar `main` como área de experimentação;
- PRs precisam estar deploy-safe antes do merge;
- alterações de schema devem ser compatíveis com a versão da aplicação em produção;
- preferir migrations versionadas, idempotentes e verificáveis;
- mudanças que dependem de migration devem declarar ordem de aplicação e rollback/mitigação;
- documentação pode ser entregue isoladamente, mas ainda pode provocar rebuild/redeploy do stack dependendo da configuração do Portainer.

## Sequência recomendada

1. Configurações / Entitlements.
2. Atendimento clínico em andamento.
3. Assessment Engine e body map.
4. Nexus médico-only.
5. Agenda premium e comunicação.
6. Financeiro avançado.
7. CRM/reativação.
8. Relatórios e ROI.
