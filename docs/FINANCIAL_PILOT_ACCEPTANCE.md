# MedicsPro — Financial Pilot Acceptance

Critérios vivos para validar o financeiro sem reintroduzir acoplamento indevido entre cobertura e registro clínico.

## Estado em 2026-09-10

O núcleo financeiro possui foundation técnica suficiente para piloto controlado, mas algumas ações de resolução ainda precisam de smoke operacional real antes de serem tratadas como validadas ponta a ponta.

O contrato atual foi refinado principalmente por #388 e #389.

## Princípio central

**Finalização clínica válida não é sinônimo de sucesso da cobertura.**

Após #388, uma falha **esperada** de pacote não deve apagar a conclusão clínica correta.

Falhas esperadas:

- `package_exhausted`;
- `package_expired`;
- `package_not_eligible`.

Nesses casos, o sistema registra `appointment_financial_exception`. Não existe consumo gratuito silencioso para “fazer a sessão caber”.

Falhas financeiras inesperadas de integridade permanecem fail-closed e podem reverter atomicamente a transação clínica.

## Resolução explícita #389

A exceção financeira é resolvida por comando explícito e auditável, conforme autorização real:

| Ator | CHARGE | WAIVE |
| --- | --- | --- |
| `owner` | sim | sim |
| `admin` | sim | sim |
| `financeiro` | sim | não |
| `recep` | não | não |
| `professional` | não | não |

`parceiro`, `sócio` ou relação de repasse não são roles e não concedem resolução financeira.

## Invariantes do núcleo financeiro

- um atendimento avulso não deve gerar recebíveis duplicados;
- consumo de pacote deve ser unitário/idempotente e compatível com o ledger;
- pacote inválido não é consumido silenciosamente;
- pagamento liquidado precisa preservar método, `paid_at` e histórico;
- pagamento já liquidado não pode ser reescrito silenciosamente;
- recebível ligado ao appointment deve preservar paciente/clínica compatíveis;
- mudanças financeiras sensíveis são server-side/RLS/RPC, nunca apenas UI;
- recepção não recebe autorização para contas a pagar por conveniência de tela;
- `professional` não recebe poder financeiro global por estar no Consultório;
- valores de domínio permanecem em centavos inteiros quando aplicável.

## Aceite clínico-financeiro atual

### Atendimento avulso

Ao finalizar um atendimento sem cobertura de pacote aplicável, o fluxo financeiro deve permanecer idempotente e gerar o efeito canônico esperado sem duplicação.

### Pacote válido

Um pacote elegível/ativo pode consumir exatamente uma sessão conforme o ledger e não deve também gerar cobrança avulsa automática indevida.

### Pacote esgotado/vencido/não elegível

**Não testar mais “bloqueio da finalização clínica” como comportamento esperado.**

O teste correto é:

1. concluir o ato clínico válido;
2. confirmar que não houve consumo inválido/gratuito;
3. confirmar `appointment_financial_exception` com o motivo esperado;
4. resolver depois via autorização #389 quando o cenário exigir.

### Erro inesperado de integridade

Quando a falha não pertence à taxonomia esperada de cobertura, a transação deve continuar fail-closed conforme os invariantes PostgreSQL. Não capturar genericamente a exceção para preservar um estado financeiro inconsistente.

## Cancelamento / pagamento antecipado

O histórico de pagamento não deve ser apagado para “corrigir” um cancelamento. Resolução precisa permanecer explícita/auditável conforme os contratos já existentes para cancelamento pré-pago e suas disposições financeiras.

Crédito, reembolso, retenção ou transferência para reagendamento devem preservar rastreabilidade; não sobrescrever lançamento liquidado.

## Cobertura deste atendimento — slice futura

O Modo Consultório não deve expor Financeiro global. Uma próxima slice pode mostrar apenas contexto financeiro necessário ao Encounter atual, como:

- particular/pacote;
- cobertura aplicável;
- estado do efeito financeiro daquele atendimento;
- exceção financeira daquele appointment quando o ator puder vê-la.

Não mostrar no Consultório saldo geral de caixa, faturamento mensal, lucro, repasses globais ou informação de outros profissionais apenas porque o ator também possui acesso de gestão.

## Smoke / evidência

### Evidência técnica existente

- #388 possui gate de separação clinical/financial e cobertura esperada;
- #389 possui gate de resolução explícita;
- #394 behavior harness prova `package_exhausted` preservando finalização clínica + exceção financeira;
- o gate Financial Clinical Finalization cobre a taxonomia esperada incluindo `package_expired` e `package_not_eligible`;
- Financial Exception Resolution #389 passou no ambiente verificado em 2026-09-10.

### Dívida conhecida do verifier #388

O verifier histórico #388 contém uma assertion de que a RPC de resolução posterior não existe. Depois do #389, essa assertion ficou obsoleta para o schema atual.

Não interpretar a falha dessa assertion contra produção como regressão do contrato financeiro. Atualizar/versionar o verifier em uma slice própria, sem enfraquecer os invariantes de #388.

### Smoke real ainda não declarado

Se não houver evidência posterior registrada, manter como pendentes:

- `CHARGE` real por owner/admin e financeiro autorizado;
- `WAIVE` real por owner/admin;
- negação real para recep/professional;
- efeitos finais/auditoria associados.

Não marcar esses itens como concluídos apenas porque o verifier estrutural está verde.

## Próximas evoluções de produto

Conforme o piloto demonstrar necessidade:

- **Cobertura deste atendimento** dentro do Encounter;
- configuração solo/equipe;
- categorias financeiras;
- parceiro/repasse percentual ou fixo com effective dates/histórico;
- pagamento parcial e múltiplos meios;
- desconto/acréscimo auditável;
- recibo/comprovante;
- caixa/conciliação;
- NFS-e e integrações de pagamento.

Nenhuma dessas evoluções transforma parceiro em role ou religa checkout à finalização clínica.

## Critério de piloto

Considerar o núcleo **GREEN estruturalmente** quando os gates financeiros/clinical-finalization atuais estão verdes.

Considerar uma ação **operacionalmente validada** somente quando o smoke correspondente foi realmente executado/observado e registrado.

A documentação deve conservar essa distinção.