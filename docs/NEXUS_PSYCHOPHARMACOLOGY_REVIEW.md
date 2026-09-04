# Nexus — Psicofarmacologia / revisão clínica

Este documento registra pontos da migração de Psicofarmacologia que não podem ser resolvidos silenciosamente por engenharia.

## 1. Moclobemida — ramo incompleto no motor de troca

Na implementação atual de `OARANHA/nexus/src/utils/antidepressantSwitching.ts`, Moclobemida está cadastrada como IMAO reversível (RIMA), com meia-vida, CYP, risco serotoninérgico e alerta de washout de 24–48h.

Porém o bloco executável de `calculateAntidepressantTransition()` entra no ramo geral de IMAO e só constrói cronograma explicitamente para:

- Fluoxetina -> Tranilcipromina;
- outro não-IMAO -> Tranilcipromina;
- Tranilcipromina -> outro antidepressivo.

Pares envolvendo Moclobemida podem, portanto, sair do ramo IMAO sem `timelineSteps` específicos.

### Comportamento MedicsPro

- o banco farmacológico e a prévia permanecem disponíveis para inspeção;
- finalização/persistência de um plano envolvendo Moclobemida fica bloqueada;
- nenhuma regra de 24–48h foi inventada pela engenharia;
- revisão clínica explícita deve definir os pares, janela, titulação e monitoramento antes de criar nova `ruleVersion`.

## 2. Regra de governança

Qualquer alteração de equivalência, dose inicial/alvo, estratégia de troca, washout, cross-taper, risco serotoninérgico, interação CYP ou cronograma exige:

1. decisão clínica documentada;
2. nova `ruleVersion`;
3. golden cases;
4. atualização das evidências/proveniência;
5. preservação integral dos resultados históricos na versão anterior.
