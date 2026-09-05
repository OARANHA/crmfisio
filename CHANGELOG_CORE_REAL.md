# Core Real — release notes

## 2026-09-05 — Beta foundation / financial pilot gate

- Consolida separação entre `platform_admin` e papéis internos das clínicas.
- Valida provisionamento seguro e auditável de clínica + primeiro `owner`.
- Consolida entitlements por clínica com leitura efetiva em runtime.
- Valida a clínica piloto VidaNova com owner, recepção, profissional médico de teste, unidade e paciente.
- Financeiro passa pelo gate técnico `VERIFY_20260904_FINANCIAL_PILOT_READINESS.sql` com zero inconsistências.
- Valida manualmente os cenários canônicos de aceite financeiro:
  - recebível único para atendimento avulso finalizado;
  - idempotência;
  - consumo unitário de pacote sem cobrança avulsa;
  - bloqueio de pacote esgotado;
  - baixa por PIX com `paid_at` e histórico;
  - imutabilidade de lançamento pago;
  - recepção autorizada a criar contas a receber;
  - recepção bloqueada para contas a pagar;
  - automação `pendente -> atrasado`;
  - totais da UI conferidos contra o banco.
- Confirma funcionamento do smoke operacional de baixa pela interface.
- Registra P1 financeiro para cancelamento após pagamento antecipado: estorno/crédito/retenção/reagendamento ainda não possuem fluxo canônico.
- Registra P1 de produto para expor na UI o vínculo entre cobrança antecipada e atendimento.
- Define o próximo gate como Configurações / Entitlements / governança por clínica.

## Core real inicial

- Remove seeds do núcleo operacional como fonte de verdade.
- Carrega pacientes, agenda, financeiro, perfis, evoluções, consentimentos, NPS e pacotes do Supabase.
- Persiste cadastro de pacientes, agendamentos, status de atendimento, financeiro, evolução, consentimento e NPS.
- Adiciona isolamento multi-tenant e RBAC via RLS sem recursão em `profiles`.
- Adiciona painel Revenue Recovery no Dashboard.
