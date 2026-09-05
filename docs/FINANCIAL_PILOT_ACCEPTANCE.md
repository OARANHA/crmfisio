# MedicsPro — critérios de aceite financeiro para piloto

O financeiro só deve ser considerado pronto para profissionais reais quando o ciclo completo sobreviver a dados reais e erros operacionais comuns.

## Estado atual

**Gate financeiro: GREEN para piloto controlado em 2026-09-05.**

Validação concluída em clínica piloto com:

- nove consultas do `VERIFY_20260904_FINANCIAL_PILOT_READINESS.sql` retornando zero inconsistências;
- dez cenários manuais canônicos aprovados;
- conferência dos totais da interface contra `public.payments`;
- smoke operacional de baixa realizado pela própria interface.

O status GREEN cobre o núcleo financeiro validado abaixo. Ele não significa que todo o roadmap financeiro avançado esteja concluído.

## Ciclo mínimo obrigatório

Atendimento finalizado → consumo de pacote **ou** geração de contas a receber → vencimento/atraso → baixa → histórico → relatórios.

## Invariantes de liberação

- um atendimento avulso finalizado gera no máximo um recebível;
- um atendimento com pacote não gera cobrança avulsa automática;
- um atendimento não consome mais de uma sessão do mesmo ledger;
- `sessoes_usadas` deve bater com `package_session_usage`;
- lançamento pago exige método e `paid_at`;
- lançamento pago não pode ser reescrito silenciosamente;
- recebível ligado a atendimento deve manter paciente e clínica compatíveis;
- pendentes vencidos devem migrar para `atrasado` pelo ciclo de automação;
- alterações de status financeiro devem possuir histórico;
- recepção não pode criar contas a pagar nem apagar lançamentos;
- fisioterapeuta permanece somente leitura no financeiro;
- valores permanecem em centavos inteiros em todo o domínio.

## Gate técnico

Executar `VERIFY_20260904_FINANCIAL_PILOT_READINESS.sql`. As nove consultas de inconsistência devem retornar zero linhas.

Depois, validar manualmente pelo menos estes cenários:

1. finalizar atendimento avulso com valor positivo e confirmar criação de um único recebível;
2. repetir operação/recarregar tela e confirmar idempotência;
3. finalizar atendimento com pacote ativo e confirmar consumo unitário sem cobrança avulsa;
4. tentar finalizar com pacote vencido/esgotado e confirmar bloqueio;
5. baixar recebível com PIX e confirmar `pago`, método, `paid_at` e histórico;
6. tentar alterar valor/status de lançamento já pago e confirmar bloqueio;
7. criar lançamento a receber como recepção e confirmar sucesso;
8. tentar criar conta a pagar como recepção e confirmar negação;
9. executar automação após vencimento e confirmar `pendente → atrasado`;
10. conferir totais da UI contra a soma direta de `payments`.

## Resultado de 2026-09-05

- [x] Cenário 1 — recebível único para atendimento avulso finalizado.
- [x] Cenário 2 — idempotência sem duplicidade.
- [x] Cenário 3 — pacote ativo consome exatamente uma sessão e não cria recebível avulso.
- [x] Cenário 4 — pacote esgotado bloqueia a finalização com `Pacote sem saldo ou fora da validade`.
- [x] Cenário 5 — baixa por PIX registra `pago`, `metodo`, `paid_at` e histórico.
- [x] Cenário 6 — lançamento pago é imutável e rejeita reescrita silenciosa.
- [x] Cenário 7 — recepção cria conta a receber.
- [x] Cenário 8 — recepção é bloqueada por RLS ao tentar criar conta a pagar.
- [x] Cenário 9 — automação altera `pendente → atrasado` e registra histórico.
- [x] Cenário 10 — cards/lista da UI conferidos contra os totais do banco.

## Pendências financeiras que não invalidam este gate

### P1 — cancelamento após pagamento antecipado

Foi comprovado que um atendimento já pago pode ser cancelado e o lançamento financeiro permanece `pago`. O comportamento atual preserva a integridade do lançamento, mas ainda não existe fluxo canônico para resolver a obrigação financeira.

A solução futura deve ser explícita e auditável, contemplando conforme política da clínica:

- estorno/reembolso;
- crédito do paciente;
- retenção parcial/total;
- transferência para reagendamento.

Nunca corrigir esse caso apagando ou reescrevendo silenciosamente um pagamento liquidado.

### P1 — pagamento antecipado vinculado ao atendimento na UI

O banco já suporta `payments.appointment_id` e preserva idempotência na finalização quando o recebível já existe. A UI/domínio ainda precisa expor esse vínculo por um fluxo seguro e canônico.

## Critério de piloto

Liberar o financeiro para clínica piloto somente quando:

1. o gate SQL estiver limpo;
2. os dez cenários estiverem aprovados;
3. a interface principal sobreviver a um smoke operacional real.

Esse critério foi atendido em 2026-09-05 para o núcleo financeiro da clínica piloto validada.
