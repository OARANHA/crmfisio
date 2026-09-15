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

## Cobertura deste atendimento — PROD #479

A #479 implementa uma projeção read-only estritamente vinculada ao próprio Encounter `em_atendimento`. A RPC exige identidade clínica válida + `clinical.attend` + profissional atribuído ao appointment e não exige `finance.access`.

O Consultório pode exibir:

- particular/pacote;
- estado contextual de cobertura/pagamento daquele appointment;
- nome do pacote quando aplicável;
- sinal neutro de atenção administrativa.

Ela não retorna valor, ID de pagamento, histórico de recebíveis, fila financeira ou ação de resolução. Não mostra caixa, faturamento mensal, lucro, repasses globais ou informação de outros profissionais. A conclusão clínica permanece separada do acerto administrativo.

## Smoke / evidência

### Evidência técnica existente

- #388 possui gate de separação clinical/financial e cobertura esperada;
- #389 possui gate de resolução explícita;
- #394 behavior harness prova `package_exhausted` preservando finalização clínica + exceção financeira;
- o gate Financial Clinical Finalization cobre a taxonomia esperada incluindo `package_expired` e `package_not_eligible`;
- Financial Exception Resolution #389 passou no ambiente verificado em 2026-09-10.

### Verifier #388 × #389 — reconciliado

A dívida histórica foi encerrada. O verifier #388 é composition-aware: valida a fundação sem #389 e, quando `resolve_appointment_financial_exception(uuid,text,text)` existe, exige a resolução auditada e mantém a fila diretamente imutável.

Em 2026-09-15, `scripts/test-financial-exception-resolution.sh` passou integralmente em PostgreSQL 16, incluindo #388 pré-#389, #388 pós-#389, verifier #389, concorrência/idempotência e controles negativos. Depois, `CHARGE` e `WAIVE` também foram exercidos no runtime de produção dentro de transações revertidas, com autenticação real, idempotência e pós-check sem resíduos.

### Runtime de resolução observado em produção

A prova de 2026-09-15 confirmou transitoriamente `CHARGE` e `WAIVE` no banco vivo, incluindo materialização esperada, idempotência e conflito bloqueado, seguida de `ROLLBACK` e pós-check sem resíduos. Essa evidência fecha o runtime técnico.

Ela **não** autoriza escolher `CHARGE` ou `WAIVE` para a exceção real `package_exhausted`: essa disposição permanece uma decisão econômica da clínica.

## Próximas evoluções de produto

Conforme o piloto demonstrar necessidade:

- observar **Cobertura deste atendimento** (#479) em uso real e ajustar somente por evidência;
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
