# Nexus C-04 — incorporação explícita ao prontuário

## Objetivo

C-04 fecha a fronteira entre o resultado Nexus e o prontuário oficial sem transformar processamento técnico em ato clínico automático.

Fluxo canônico:

`Nexus gera/processa -> profissional revisa -> profissional assina -> incorpora explicitamente -> prontuário oficial`

Nunca:

`resultado processado -> prontuário automático`

## Auditoria do modelo existente

O prontuário atual não é uma tabela monolítica. Ele já é composto por registros clínicos com semânticas distintas:

- `physiotherapy_evolutions`: evolução por sessão; novos registros autenticados exigem `session_id`, vínculo exato com atendimento/paciente/profissional e uma única evolução ativa por sessão;
- `physiotherapy_evaluations`: avaliação clínica legada;
- `clinical_assessments`: Assessment Engine versionado, com draft/finalized e imutabilidade após finalização;
- `nexus_clinical_results`: snapshot técnico/evidencial Nexus, congelado em `finalized`;
- `nexus_result_clinical_lifecycle`: prova separada de processamento, revisão humana e assinatura clínica C-03;
- Nexus longitudinal: projeção analítica dos resultados revisados, não prontuário oficial.

Não foi encontrado caminho que copie `interpretation`, `soap_text`, `classification`, `severity`, red flags ou `output_snapshot` para `physiotherapy_evolutions`/`clinical_assessments`. O EEM gera narrativa/`soap_text` dentro do resultado Nexus e a interface o descrevia apenas como conteúdo que poderia ser proposto ao SOAP. Portanto, antes do C-04 havia duas superfícies paralelas de leitura — prontuário e Nexus — mas não havia incorporação oficial nem prova de duplicação persistida.

Também não existe hoje caminho legítimo para uma evolução Nexus ser criada sem C-03: na verdade, não existia caminho de incorporação algum. O risco era o próximo passo ser implementado como cópia frontend ou como uso direto de resultado apenas `finalized`.

## Decisão arquitetural

Foi escolhida a combinação:

1. tabela aditiva `clinical_record_nexus_incorporations`;
2. RPC explícita `incorporate_nexus_result_into_clinical_record(uuid)`;
3. snapshot clínico derivado e imutável;
4. UI mínima dentro do `ClinicalWorkspaceV3` para incorporar e visualizar a origem.

Não foi adicionado `nexus_result_id` diretamente a `physiotherapy_evolutions` porque essa tabela representa evolução **por sessão** e o banco exige `session_id` em novos atos autenticados. PHQ-9/GAD-7 podem ser processados a partir de autoavaliação sem dever virar artificialmente uma evolução de atendimento. Forçar esse vínculo misturaria duas semânticas clínicas e criaria dados falsos de sessão.

`clinical_assessments` também não foi reutilizada: ela exige template/version e representa respostas estruturadas do Assessment Engine, enquanto C-04 precisa incorporar igualmente EEM, escalas e futuros resultados Nexus assinados.

A nova tabela não é um prontuário paralelo genérico. Ela é uma coleção restrita de **incorporações Nexus no prontuário**, exibida dentro do prontuário oficial e sem API genérica de autoria.

## Autorização da incorporação

A RPC exige cumulativamente:

- `auth.uid()` e clínica atual;
- perfil ativo;
- clínica ativa e não excluída;
- resultado existente no mesmo tenant;
- resultado `finalized` com `finalized_at`;
- autor do resultado igual ao usuário atual;
- vínculo assistencial via `can_access_patient_clinical_record(patient_id)`;
- `nexus.access`;
- capability específica do resultado (`required_capability`);
- lifecycle C-03 existente;
- `processed_at`;
- `reviewed_at` e `reviewed_by = auth.uid()`;
- `signed_at` e `signed_by = auth.uid()`.

Não há parâmetro `patient_id`, `clinic_id` ou `professional_id` na RPC. Esses valores são derivados do resultado assinado, eliminando a possibilidade de o browser selecionar outro paciente/tenant/autor durante a incorporação.

Owner/admin não recebe bypass: o role não substitui identidade médica, entitlement ou capabilities Nexus. A mesma fronteira fail-closed de C-06 continua obrigatória.

## Conteúdo incorporado

O snapshot oficial contém apenas conteúdo clínico legível/estruturado:

- síntese clínica derivada de ferramenta + escore + classificação + interpretação;
- `soap_text`, quando disponível;
- escore/max score;
- classificação;
- severidade;
- red flags selecionadas em estrutura clínica mínima;
- módulo/ferramenta;
- regra/versão;
- capability de origem;
- timestamps de finalização técnica, revisão, assinatura e incorporação;
- profissional autor;
- `nexus_result_id` de origem;
- `appointment_id` quando o resultado já possui esse contexto.

Não são copiados para o prontuário:

- `input_snapshot` bruto;
- `output_snapshot` bruto;
- `evidence_snapshot` bruto.

O resultado Nexus continua sendo a fonte de evidência detalhada. O prontuário recebe um snapshot clínico aprovado e rastreável.

## Imutabilidade e duplicação

- `nexus_result_id` é `UNIQUE`: um resultado Nexus produz no máximo uma incorporação.
- A RPC é idempotente: uma segunda chamada autorizada retorna o mesmo `id`.
- `UPDATE` e `DELETE` da incorporação são bloqueados por trigger.
- O browser tem somente `SELECT` na tabela; criação ocorre exclusivamente pela RPC.
- A incorporação não altera `nexus_clinical_results` nem o lifecycle C-03.
- O prontuário lê o snapshot persistido da incorporação; não reconstrói conteúdo dinamicamente a partir do Nexus.
- Correções futuras pertencem ao C-05/addendum, fora desta slice.

## Histórico

Não existe backfill.

Resultado histórico `finalized` sem lifecycle C-03 completo não pode ser incorporado. Resultado assinado permanece fora do prontuário até o profissional executar explicitamente “Incorporar ao prontuário”.

## UI mínima

O `ClinicalWorkspaceV3` passa a mostrar:

- resultados Nexus assinados ainda não incorporados;
- ação explícita `Incorporar ao prontuário`;
- estado `incorporado`;
- resumo/SOAP aprovado;
- regra/versão, autoria, assinatura e identificador da origem Nexus.

Não há redesign do prontuário.

## Rollout

Migration:

`supabase-migrations/20260908_nexus_c04_clinical_record_incorporation.sql`

Verifier read-only:

`supabase-migrations/20260908_verify_nexus_c04_clinical_record_incorporation.sql`

Marcador esperado:

`NEXUS_C04_VERIFIED`

Não aplicar em produção antes do merge e dos gates verdes. Não há backfill, rollback de dados ou Edge Function nesta slice.
