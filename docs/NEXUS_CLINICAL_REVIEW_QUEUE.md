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
- resultado estruturado marca `clinicalReviewRequired: audit-c-sex-specific-cutoff-divergence`.

**Decisão clínica pendente**

Definir se a próxima versão deverá aplicar corte dependente de sexo/contexto e qual campo clínico canônico deverá alimentar a regra.

## 2. SRQ-20 — corte por sexo

**Fonte atual Nexus**

- metadata/validationInfo: corte >= 7 em homens e >= 8 em mulheres;
- cutoffInfo: homens >= 7, mulheres >= 8, média geral APS >= 7;
- calculateResult: `totalScore >= 7` universalmente.

**Comportamento migrado**

- preservado `>= 7` universalmente para equivalência;
- item 17 positivo continua com precedência de segurança e red flag crítica.

**Decisão clínica pendente**

Definir se o cálculo deve permanecer universal ou usar critério dependente de sexo/contexto. Exige nova `ruleVersion`.

## 3. ASRS-18 — opção textual versus valor binário

**Fonte atual Nexus**

Cada questão apresenta cinco frequências, porém várias opções compartilham o mesmo valor numérico:

- `Nunca` e `Raramente` -> 0;
- `Às vezes`, `Frequentemente`, `Muito frequentemente` -> 1.

A função clínica trabalha com contagem binária por domínio.

**Hardening implementado no MedicsPro**

O Scale Runtime preserva separadamente:

- `answers`: valor usado pela regra clínica;
- `selectedOptions`: índice, label original e valor da opção escolhida.

Isso não muda o score do Nexus, mas preserva a resposta bruta.

## 4. MDQ — simultaneidade e prejuízo funcional ausentes da função executável

**Fonte atual Nexus**

- descrição/validationInfo: 13 itens sintomáticos + simultaneidade + prejuízo funcional;
- critério descrito: >= 7 sintomas + ocorrência simultânea + prejuízo moderado/grave;
- perguntas implementadas: apenas `q1` a `q13`;
- `calculateResult`: positivo quando `totalScore >= 7`.

**Comportamento migrado**

- preservado `>= 7/13` por paridade com a função executável atual;
- resultado estruturado marca `clinicalReviewRequired: mdq-missing-concurrency-impairment-items`.

**Decisão clínica pendente**

Definir se o MDQ Nexus deve incorporar explicitamente os itens de simultaneidade e prejuízo e como estes entram na classificação. Qualquer correção exige nova versão e casos dourados.

## 5. PCL-5 — descrição do corte 31–33 versus função >= 33

**Fonte atual Nexus**

- validationInfo: ponto de corte de 31 a 33;
- cutoffInfo contém texto `31-80` e também menciona `Corte >= 33`;
- `calculateResult`: `totalScore >= 33`.

**Comportamento migrado**

- preservado `>= 33` por equivalência com a função executável;
- resultado estruturado marca `clinicalReviewRequired: pcl5-cutoff-description-31-vs-33`.

**Decisão clínica pendente**

Revisar a redação/evidência do ponto de corte e decidir se existe contexto em que 31/32 deve mudar a classificação.

## 6. SNAP-IV — título menciona TOD, implementação possui 18 itens de TDAH

**Fonte atual Nexus**

- título/target do instrumento faz referência à triagem de TDAH e TOD;
- implementação possui 18 itens correspondentes aos domínios Desatenção e Hiperatividade/Impulsividade;
- não há, na definição executável inspecionada, bloco adicional de itens de TOD.

**Comportamento migrado**

- migrados somente os 18 itens executáveis existentes;
- classificação segue os dois domínios de TDAH exatamente como a função atual.

**Decisão clínica pendente**

Revisar se o título deve deixar de citar TOD ou se existe um conjunto complementar validado que deva entrar em nova versão.

## Processo para resolver itens desta fila

1. revisão pelo responsável clínico do Nexus;
2. decisão clínica documentada;
3. criar nova `ruleVersion`;
4. manter resultados históricos na versão antiga;
5. adicionar golden cases antes/depois;
6. atualizar evidência/proveniência;
7. nunca recalcular silenciosamente resultados históricos.
