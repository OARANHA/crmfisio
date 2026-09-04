# MedicsPro — critérios de aceite financeiro para piloto

O financeiro só deve ser considerado pronto para profissionais reais quando o ciclo completo sobreviver a dados reais e erros operacionais comuns.

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

## Critério de piloto

Somente liberar o financeiro para clínica piloto quando o gate SQL estiver limpo e os dez cenários passarem sem intervenção manual no banco.
