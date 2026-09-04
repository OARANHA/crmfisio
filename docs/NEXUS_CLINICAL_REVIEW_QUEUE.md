# Nexus — Clinical Review Queue

Este documento registra divergências encontradas durante a migração do Nexus para o MedicsPro que **não devem ser corrigidas silenciosamente por engenharia**.

Princípio operacional:

> A migração preserva a regra executável vigente do Nexus. Mudanças clínicas exigem decisão explícita, nova versão da regra, casos dourados e revisão clínica.

## 1. AUDIT-C — corte por sexo

**Fonte atual Nexus**

- metadata/validationInfo: corte >= 4 em homens e >= 3 em mulheres;
- calculateResult: `totalScore >= 4` para todos os pacientes.

**Comportamento migrado**

- preservado `>= 4` universalmente para equivalência com a função executável atual;
- resultado estruturado já marca `clinicalReviewRequired: audit-c-sex-specific-cutoff-divergence`.

**Decisão clínica pendente**

Definir se a próxima versão deverá aplicar corte dependente de sexo/contexto e qual campo clínico canônico deverá alimentar a regra.

## 2. SRQ-20 — corte por sexo

**Fonte atual Nexus**

- metadata/validationInfo: Sensibilidade 83% / especificidade 80%; corte >= 7 em homens e >= 8 em mulheres;
- cutoffInfo: homens >= 7, mulheres >= 8, média geral APS >= 7;
- calculateResult: `totalScore >= 7` universalmente.

**Comportamento migrado**

- preservado `>= 7` universalmente para equivalência com a função executável atual;
- item 17 positivo continua tendo precedência de segurança e gera red flag crítica persistente.

**Decisão clínica pendente**

Definir se o cálculo deve permanecer universal, usar corte por sexo ou adotar outro critério validado. A decisão exige nova `ruleVersion` e testes de equivalência explícitos.

## 3. ASRS-18 — opção textual versus valor binário

**Fonte atual Nexus**

Cada questão apresenta cinco frequências, porém várias opções compartilham o mesmo valor numérico:

- `Nunca` e `Raramente` -> 0;
- `Às vezes`, `Frequentemente`, `Muito frequentemente` -> 1.

A função clínica trabalha com contagem binária por domínio.

**Risco de migração identificado**

Se apenas o valor numérico fosse persistido, seria impossível saber retrospectivamente qual frequência textual o profissional/paciente selecionou.

**Hardening implementado no MedicsPro**

O Scale Runtime preserva separadamente:

- `answers`: valor usado pela regra clínica;
- `selectedOptions`: índice, label original e valor da opção escolhida.

Isso não muda o score do Nexus, mas melhora a proveniência e auditabilidade da resposta bruta.

## Processo para resolver itens desta fila

1. revisão pelo responsável clínico do Nexus;
2. decisão clínica documentada;
3. criar nova `ruleVersion`;
4. manter resultados históricos na versão antiga;
5. adicionar golden cases antes/depois;
6. atualizar evidência/proveniência;
7. nunca recalcular silenciosamente resultados históricos.
