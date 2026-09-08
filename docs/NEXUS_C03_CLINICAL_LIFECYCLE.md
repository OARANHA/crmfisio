# Nexus C-03 — lifecycle técnico, revisão humana e finalização clínica

## Escopo

C-03 corrige uma ambiguidade semântica do lifecycle de `nexus_clinical_results`: o legado usa `status = 'finalized'` e `finalized_at` tanto para congelar/persistir um resultado quanto em superfícies que podem soar como conclusão clínica.

Esta slice não incorpora resultados automaticamente ao prontuário, não implementa assinatura digital/legal, não cria fluxo de corrigenda/addendum e não trata C-04/C-05.

## Evidência do problema

A baseline efetiva permite um resultado `finalized` sem qualquer revisão humana:

1. `complete_nexus_self_assessment_processing(...)`, executada somente por `service_role`, cria PHQ-9/GAD-7 como `draft`;
2. a mesma transação promove o resultado para `status = 'finalized'` e define `finalized_at`;
3. o convite passa a `status = 'processed'`;
4. não existe campo/evento que prove revisão humana;
5. o próprio processor produz `guidanceMode = 'clinician-review'`, ou seja, o resultado ainda requer leitura clínica.

A UI de autoavaliação, entretanto, rotula o objeto persistido como “Resultado finalizado”. Portanto `finalized` prova congelamento técnico no contrato legado, não revisão humana.

## Alternativas avaliadas

### A. Adicionar `processed_at/reviewed_at/reviewed_by/signed_at/signed_by` em `nexus_clinical_results`

**Vantagens:** leitura simples; nenhuma relação adicional.

**Riscos:** a linha de resultado é hoje historicamente imutável após `status='finalized'`. Para anexar revisão/assinatura seria necessário abrir exceções na guard `guard_nexus_result_immutability()`, alterando um contrato C-02 já verificado e aumentando o risco de mutação acidental da evidência congelada.

**Decisão:** rejeitada.

### B. Expandir `status` para `draft/processed/reviewed/signed`

**Vantagens:** lifecycle visualmente explícito em uma coluna.

**Riscos:** muda a semântica de `finalized`, afeta policies, filtros, longitudinal, writers e histórico; exige decidir retrospectivamente o significado de linhas antigas sem evidência.

**Decisão:** rejeitada.

### C. Tabela de eventos append-only completa

**Vantagens:** maior auditabilidade e extensibilidade futura.

**Riscos:** exige ordenação/replay de eventos, agregação de estado e desenho de corrigenda/addendum — complexidade que invade o escopo futuro.

**Decisão:** adiada.

### D. Registro 1:1 de lifecycle clínico separado do resultado

Tabela `nexus_result_clinical_lifecycle`, ligada 1:1 ao resultado, com:

- `processed_at`: processamento/congelamento técnico conhecido;
- `reviewed_at` + `reviewed_by`: revisão humana explícita;
- `signed_at` + `signed_by`: finalização clínica explícita no aplicativo.

**Vantagens:** mantém a linha clínica congelada literalmente intacta, preserva C-01/C-06/C-02, não exige backfill e separa os três significados com baixo risco de drift.

**Decisão:** escolhida.

## Lifecycle pós-C-03

O `status` legado continua existindo por compatibilidade e imutabilidade:

- `draft`: conteúdo ainda em trabalho;
- `finalized`: snapshot técnico legado congelado. **Não significa, isoladamente, revisão ou assinatura clínica.**

A verdade clínica adicional fica no registro 1:1:

1. **Draft/manual WIP** — resultado `draft`, sem lifecycle clínico obrigatório.
2. **Processed/frozen** — resultado `finalized` + `processed_at`, sem `reviewed_*`/`signed_*` obrigatórios.
3. **Clinically reviewed** — `reviewed_at` e `reviewed_by` preenchidos por ação explícita do médico autor autorizado sobre snapshot já congelado.
4. **Clinically signed/finalized** — `signed_at` e `signed_by` preenchidos somente após revisão. O resultado já está congelado e o registro de lifecycle também se torna imutável.

“Signed” neste C-03 é **atestado clínico dentro do MedicsPro**, com identidade e timestamp. Não é assinatura digital qualificada, certificado ICP-Brasil nem definição jurídica de assinatura eletrônica.

## Autorização

Revisar ou assinar exige cumulativamente:

- clínica atual ativa;
- mesmo tenant do resultado;
- `professional_id = auth.uid()` — C-03 preserva autoria e não permite coassinatura nesta slice;
- vínculo assistencial ainda válido via `can_access_patient_clinical_record(patient_id)`;
- identidade médica canônica válida;
- entitlement Nexus;
- grant explícito da capability exigida pelo contrato C-02;
- resultado já tecnicamente congelado (`status='finalized'` + `finalized_at`).

Owner/admin não médicos não recebem bypass.

## Writers

### PHQ-9/GAD-7 processor

Continua calculando e persistindo server-side. Após C-03, registra somente `processed_at`. `reviewed_*` e `signed_*` permanecem nulos até ações humanas explícitas.

### EEM

O EEM já é finalizado por uma ação humana explícita na tela. C-03 preserva esse writer específico e a mesma ação passa a registrar, de forma atômica e separada no lifecycle, processamento, revisão humana e finalização clínica pelo médico autor. Não há inferência retrospectiva para EEM históricos.

### Writer genérico

O lifecycle passa a expor operações separadas:

- completar/congelar processamento;
- revisar resultado;
- finalizar clinicamente após revisão.

`required_capability` continua sendo resolvida pelo contrato confiável C-02.

## Histórico

A migration **não cria registros de lifecycle para resultados já existentes**.

Assim, um `status='finalized'` histórico sem linha em `nexus_result_clinical_lifecycle` significa apenas: “resultado legado congelado; revisão humana não comprovada pelo C-03”. Nenhum `reviewed_by`, `reviewed_at`, `signed_by` ou `signed_at` é inferido de `professional_id`/`finalized_at`.

Se um médico revisar explicitamente um resultado histórico após C-03, essa ação nova pode iniciar o registro de lifecycle daquele snapshot sem alterar a linha clínica histórica.

## Imutabilidade

- `nexus_clinical_results`: a guard histórica permanece inalterada.
- `nexus_result_clinical_lifecycle`: depois de `signed_at`, qualquer mudança é rejeitada.
- C-03 não implementa corrigenda/addendum. Se isso for necessário, deve ser uma slice futura própria.
