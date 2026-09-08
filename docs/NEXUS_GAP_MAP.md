# Nexus — mapa diferencial de absorção seletiva

Auditoria de código em 2026-09-08. Escopo: primeira missão de `WORK_MASTER_PROMPT.md`; somente documentação, sem portar funcionalidades.

## 1. Baseline, método e limites

| Fonte | Revisão auditada |
| --- | --- |
| Produto canônico `OARANHA/crmfisio` | `8f78d3241c236b6190fd0b60dc4e14236523099b` (`main`, confirmado com `git ls-remote`) |
| Upstream privado `OARANHA/nexus` | `427174dd909f7aedae52406f2a5d0cfc0314ce22` (`main`, confirmado pela API de branches) |

Foram lidos integralmente `AGENTS.md`, `docs/WORK_CONTEXT.md` e `docs/WORK_MASTER_PROMPT.md` do produto. O inventário recursivo upstream veio sem truncamento; seus 41 arquivos TS/TSX/MD/JSON foram materializados pela conexão autenticada, fixados no commit acima. A análise percorreu definições, funções de cálculo, consumidores, navegação, backend, migrations posteriores às migrations Nexus e testes. Arquivos de imagem e lockfile upstream não constituem evidência clínica.

As referências abaixo usam **C:** para caminhos no `crmfisio` e **U:** para caminhos no `nexus`, sempre nessas revisões. Símbolos permitem localizar as evidências sem depender de números de linha. Exemplos de fontes fixadas: [contrato canônico](https://github.com/OARANHA/crmfisio/blob/8f78d3241c236b6190fd0b60dc4e14236523099b/src/lib/nexusClinical.ts), [calculadoras upstream](https://github.com/OARANHA/nexus/blob/427174dd909f7aedae52406f2a5d0cfc0314ce22/src/utils/calculators.ts), [switching upstream](https://github.com/OARANHA/nexus/blob/427174dd909f7aedae52406f2a5d0cfc0314ce22/src/utils/antidepressantSwitching.ts).

Esta é uma auditoria diferencial técnica e de produto, não certificação de validade clínica das referências citadas pelo upstream. Revisão de literatura primária, licenças dos instrumentos e aprovação clínica são gates de cada porte. Não houve acesso ao banco de produção, execução de verifiers SQL ou teste real de envio/processamento. Presença de migrations não prova implantação. “Já incorporado” significa equivalência funcional identificada no código, não cópia literal nem homologação operacional.

## 2. Diagnóstico executivo

O Nexus **já existe** no produto: resultados com contexto, versão, snapshots, autoria, imutabilidade, red flags, EEM, PHQ-9/GAD-7 por autoavaliação e visualização longitudinal. O trabalho correto é evoluir `src/lib/nexus/` e `nexusClinical.ts`.

O upstream contém **21 instrumentos no `ALL_SCALES`**, **18 antidepressivos no `ANTIDEPRESSANTS_DB`**, switching, duas famílias de equivalência, função renal, risco cardiovascular e educação contextual. Isso não representa 21 instrumentos prontos para produção. O MedicsPro executa dois desses instrumentos pelo processor; os outros **19 não têm aplicação clínica Nexus operacional localizada**. Nomes em `TOOL_TITLES`, radares, capabilities e cards não são implementação.

Antes de expandir, há uma regressão de autorização documentada abaixo: a política de leitura de 07/09 diverge do boundary médico de 05/09 e do handoff. Há também uma lacuna entre texto SOAP armazenado e sua incorporação revisada ao registro clínico. Corrigir essas fundações entrega mais valor imediato que copiar o catálogo inteiro.

Decisão recomendada: **segurança → fechamento EEM/SOAP e comparabilidade histórica → escalas selecionadas → catálogo farmacológico curado → cálculo renal/equivalências → switching somente após validação por par**. Nenhuma nova engine paralela ou prontuário separado.

## 3. Divergências e bloqueios encontrados no produto atual

### C-01 — P0: leitura Nexus perde a exigência médica/entitlement

**Evidência:** C:`supabase-migrations/20260905_nexus_doctor_entitlement_hardening.sql` exige `has_professional_capability('nexus.access')` na leitura de resultados e red flags. C:`supabase-migrations/20260907_clinical_care_relationship_read_boundary.sql`, bloco “Nexus results and red flags”, remove essas policies e cria `nexus_results_read_care_relationship` / `nexus_red_flags_read_care_relationship` com:

```text
mesma clínica AND can_access_patient_clinical_record(patient_id)
AND (owner/admin OR clinical.patient_timeline OR nexus.access)
```

O helper de vínculo assistencial concede leitura aos gestores da mesma clínica. Portanto, as alternativas administrativas permitem leitura sem passar pela capability Nexus, identidade médica ou entitlement. A policy de convites também admite `owner/admin`, expondo potencialmente `response_snapshot`. Não é evidência de vazamento entre clínicas; é bypass do boundary médico dentro do tenant. **Classificado P0 pela exposição de conteúdo sensível fora da autorização exigida**, condicionado à aplicação das migrations; não se afirma incidente em produção.

**Decisão:** redesenhar a composição em PR prioritário: vínculo assistencial **em conjunção** com o boundary Nexus, sem enfraquecer nenhum. Verificar todas as policies efetivas, inclusive policies permissivas coexistentes. Migration aditiva + verifier e testes SQL comportamentais com perfis médico autorizado, médico sem entitlement, não médico, owner/admin não médicos, perfil inativo, clínica suspensa, anônimo e outro tenant. Conferir resultados, flags e respostas de convites por API direta. Impacto alto, esforço pequeno/médio, risco de rollout médio.

### C-02 — P1: capability do resultado é fornecida pelo chamador

**Evidência:** C:`nexusClinical.ts`, `createNexusResultDraft`; C:`20260903_nexus_wave0_foundation.sql`, policies de insert/update; C:`20260906_nexus_appointment_authorship_boundary.sql`, `validate_nexus_result_context`. O registro recebe `module_key`, `tool_key`, `rule_key`, versão e `required_capability`; o banco verifica a capability indicada, cuja FK aponta ao catálogo geral. Não foi localizado vínculo fechado ferramenta→regra→capability, nem requisito independente `nexus.access` nessas escritas genéricas.

**Risco:** tentar inserir draft Nexus com uma capability clínica genérica concedida ao ator. Não foi executada prova em PostgreSQL; INSERT sem RETURNING e SELECT/UPDATE precisam ser testados separadamente porque RLS de leitura pode alterar o resultado. A RPC específica EEM fixa `nexus.eem` e não tem esse mesmo contrato aberto.

**Decisão:** antes de novos writers, exigir boundary Nexus independente e contrato permitido por ferramenta/versão. Não copiar escrita genérica para medicamentos. Migration + verifier se confirmado/restringido no banco; testes negativos de capability trocada, tool desconhecida e autoria/contexto forjados. Impacto alto, esforço médio, risco médio.

### C-03 — P1: resultado finalizado não equivale a revisão humana

**Evidência:** C:`20260906_nexus_clinic_lifecycle_boundary.sql`, `complete_nexus_self_assessment_processing`, assume o contexto do profissional do convite, insere resultado e o finaliza automaticamente. O processor informa `guidanceMode: 'clinician-review'`, mas isso não é um estado persistido de revisão. Reconhecer uma red flag também não comprova revisão de todo o resultado.

**Decisão:** preservar a imutabilidade do cálculo e diferenciar processamento de revisão/autoria clínica. Se houver necessidade de registrar revisão, acrescentar ato de revisão auditável com resultado de origem, autor e data, sem sobrescrever o snapshot. Contrato exato deve ser definido em PR próprio; migration provavelmente necessária. Testar que autoavaliação processada não apareça como decisão médica já assinada. Impacto alto, esforço médio, risco médio.

### C-04 — P1: EEM/SOAP ainda não fecha o ciclo assistencial

**Evidência:** C:`eemPersistence.ts` armazena narrativa, `soapTarget: 'objective'` e versão. C:`NexusEemPanel.tsx` oferece prévia/finalização, mas o histórico mostra data/classificação, sem reapresentar o snapshot completo. A busca de consumidores de `soapText`/`soap_text` encontrou persistência/mapeamento, sem ação de incorporação revisada no C:`ClinicalWorkspace.tsx` / `ClinicalWorkspaceV3.tsx`. A mensagem “poderá ser proposto ao Objetivo” expressa intenção, não fluxo pronto.

**Decisão:** mostrar o resultado histórico real, permitir seleção e revisão humana para incorporar ao registro existente, com referência de origem e prevenção de duplicação. Não criar `SoapView` paralelo. Avaliar os campos canônicos do registro antes de definir migration; display não exige migration, vínculo persistido de origem pode exigir. Impacto alto, esforço médio, risco médio.

### C-05 — P1: comparabilidade longitudinal e estado de paciente

**Evidência:** C:`longitudinal.ts` filtra `toolKey`, mas não separa `ruleVersion`; `radarComparison` preenche itens ausentes com zero. `numericAnswers` converte/filtra valores, podendo perder alinhamento por item. C:`NexusLongitudinalPanel.tsx` mantém resultados anteriores em erro de carregamento e seleciona `current || primeiraFerramenta`; C:`NexusEemPanel.tsx` não reinicia o formulário em seu efeito de mudança de paciente. Dependência de remount na navegação exige teste de componente.

**Decisão:** política explícita de compatibilidade entre versões, alinhamento por ID de item e ausência como ausência; limpar/bloquear estado na troca de paciente e exibir erro distinto de vazio. Não afirmar vazamento reproduzido sem testar a navegação. Testes: versões incompatíveis, respostas faltantes, zero basal, ordem temporal, erro após sucesso, troca A→B e resposta tardia. Não exige migration para a correção de visualização. Impacto alto, esforço médio, risco baixo/médio.

### C-06 — P2: governança e compatibilidade documental

`AGENTS.md` ainda lista `fisio`, enquanto `WORK_CONTEXT.md`, tipos e migrations de compatibilidade/cutover de 07/09 direcionam a `professional`. `has_professional_capability` do hardening Nexus mantém fallback literal `v_role = 'fisio'`; o resolver clínico genérico `current_user_has_clinical_capability` foi evoluído separadamente. Não inferir que o cutover atualizou automaticamente o resolver Nexus. Médico com grants explícitos e médico dependente de fallback precisam de testes distintos.

O helper de vínculo assistencial de 07/09 também contém referência literal a `fisio`; avaliar sua definição efetiva após rollout do cutover. Não introduzir novos consumidores legados nem flexibilizar o Nexus para remediar acesso. Atualizar documentação e compatibilidade numa slice dedicada, com verifier quando houver SQL. Impacto médio/alto, esforço médio, risco médio.

## 4. Matriz diferencial por domínio

Os IDs G01–G16 referenciam o plano de execução. “Portar” sempre significa extrair e adaptar com testes e curadoria; nunca copiar diretamente para produção.

| ID / domínio | Estado e caminho atual (C) | Fonte equivalente (U) | Gap real e decisão |
| --- | --- | --- | --- |
| G01 Saúde Mental: PHQ-9/GAD-7 | **Já incorporado** no fluxo de autoavaliação: `publicSelfAssessmentCatalog.ts`, processor e status; não há aplicador profissional genérico operacional | `scalesData.ts`: `PHQ9_SCALE`, `GAD7_SCALE`; `ScalesView.tsx` | Preservar cálculo server-side e linguagem de rastreio. **Redesenhar** aplicador profissional compartilhando regra, sem questionário zerado por padrão |
| G02 Demais escalas | **Ainda não incorporado**: `scaleRuntime.ts` oferece tipos/validação, não catálogo executável dos outros instrumentos | `scalesData.ts`, `additionalScalesData.ts`, inventário abaixo | **Portar seletivamente** após revisão por instrumento; priorizar conjunto demandado pelo piloto |
| G03 EEM | **Já incorporado** no núcleo: `eem.ts`, `eemPersistence.ts`, `NexusEemPanel.tsx`, RPC atômica | `eemData.ts`, `EemView.tsx` | **Redesenhar** gaps C-04 e revisão dos defaults normais; preservar 13 domínios estruturados, exclusões e duas flags atuais |
| G04 Longitudinal | **Parcialmente incorporado**: séries reais, variação matemática e radar, versões exibidas | `EvolutionChartsView.tsx`, `radarDomainsData.ts` | **Redesenhar** comparabilidade C-05. Portar metadados de domínios curados; **descartar** preenchimento demo e inferência genérica de remissão |
| G05 Autoavaliação | **Já incorporado**, com arquitetura superior: token, RPC, processor, outbox | `PatientSelfFillModal.tsx`, `WhatsappShareModal.tsx`, navegação por query string | **Preservar** infraestrutura atual; ampliar whitelist apenas junto de regra/versão/processor. **Descartar** resultado do navegador como fonte clínica |
| G06 Psicofarmacologia | **Ainda não incorporado** funcionalmente; card e `nexus.psychopharmacology` são fundação | `antidepressantSwitching.ts`, `CalculatorsView.tsx` | **Redesenhar** dentro de `Nexus -> psychopharmacology`, catálogo antes de recomendação; prescrição continua ato do MedicsPro |
| G07 Antidepressant switching | **Ainda não incorporado** | `calculateAntidepressantTransition`, `AntidepressantSwitchCalculator.tsx` | **Adiar porte executável / redesenhar** matriz de pares, contraindicações, contexto e ausência de dados; bloqueios reproduzidos na seção 6 |
| G08 Catálogo de medicamentos | **Ainda não incorporado** ao Nexus | `ANTIDEPRESSANTS_DB` (18), `EQUIVALENCE_REFERENCE_TABLE` (17 linhas) | **Portar curado** IDs, classes e proveniência; não é cadastro completo de medicamentos/apresentações. A tabela visual omite trazodona presente no DB |
| G09 Equivalências | **Ainda não incorporado** | `calculateAntidepressantEquivalence`, `calculateAntipsychoticEquivalence`, relação Hayasaka no switching | **Redesenhar** uma fonte por método. Função antiga de antidepressivos tem 8 entradas e não é o caminho importado por `CalculatorsView`; não duplicá-la |
| G10 Monitoramento / segurança medicamentosa | **Parcialmente incorporado apenas em infraestrutura**: ledger de flags; sem motor medicamentoso | `specialAlerts`, `cypInteractions`, `clinicalRisks`, `metabolicMonitoringPlan` | **Portar curadoria / redesenhar regras**. Textos CYP não formam detector completo de interações; não há agenda longitudinal de exames no upstream |
| G11 Cognição | **Ainda não incorporado** operacionalmente; `meem` em rótulo não aplica exame | `MEEM_SCALE`, perfil radar `meem` | **Redesenhar** entrada assistida por profissional, escolaridade/contexto e licença. Não transformar exame observacional em autoavaliação pública |
| G12 Função renal | **Ainda não incorporado** | `calculateEgfr`, aba `egfr` | **Portar fórmula após validar** unidades/domínio e evidência. Separar estimativa renal de regra de ajuste medicamentoso; não copiar condutas automáticas |
| G13 Risco cardiovascular | **Ainda não incorporado** | `calculateCardiovascularRisk`, aba `cv` | **Adiar / redesenhar** modelos lipídico/IMC, classificação direta e recomendações separadas; remover defaults silenciosos e percentual artificial |
| G14 Outras calculadoras | **Ainda não incorporado** como coleção; não há outras funções matemáticas independentes comprovadas no upstream além das quatro listadas e switching | `calculators.ts`, `navigation.ts`, `CalculatorsView.tsx` | **Descartar expansão imaginada**. IMC é auxiliar do cálculo cardiovascular; QTc, ajuste de lítio e monitoramento são menções, não calculadoras autônomas |
| G15 Educação e evidências | **Parcialmente incorporado** para evidências; educação **ainda não incorporada**: snapshots e `nexus_evidence_sources` já existem | `healthEducationEngine.ts`, `educationData.ts`, `ContextualEducationModal.tsx`, `evidenceData.ts` | **Portar conteúdo curado / redesenhar seleção** por achados estruturados e flags; usar fontes versionadas existentes, sem banco estático duplicado |
| G16 SOAP/IA e regras/red flags | **Parcialmente incorporado**: texto determinístico, versões e ledger; sem fluxo generativo equivalente localizado | `SoapView.tsx`, `server.ts`, cálculos das escalas, educação | **Portar conceito** de prévia editável; **adiar IA**, **descartar mocks clínicos** e backend Express. C-02/C-03/C-04 precedem novas regras |

## 5. Inventário completo de instrumentos upstream

Fonte executável: U:`ALL_SCALES` contém 11 definições de `scalesData.ts` e 10 de `additionalScalesData.ts`. Fonte C de execução de escalas: `PROCESSORS = [PHQ9, GAD7]`. Catálogo público usa IDs `phq9`/`gad7`, enquanto upstream usa `phq-9`/`gad-7`; preservar IDs históricos e usar aliases explícitos, nunca renomear linhas silenciosamente.

| Instrumento upstream | Classificação em C | Decisão / validação específica antes de expansão |
| --- | --- | --- |
| PHQ-9 | Já incorporado por autoavaliação | Evoluir aplicação profissional; limites 4/5, 9/10, 14/15, 19/20; item 9 independente do total |
| GAD-7 | Já incorporado por autoavaliação | Mesma regra compartilhada; limites 4/5, 9/10, 14/15; todas as respostas obrigatórias |
| HCL-32 | Ainda não incorporado | Adiar até revisão de versão brasileira, corte e composição das subescalas; rastreio não é diagnóstico |
| AUDIT | Ainda não incorporado | Candidato P1 conforme piloto; validar pesos diferenciados dos itens e limites das faixas |
| ASRS-18 | Ainda não incorporado | Redesenhar: algoritmo binariza/conta por dois grupos de nove; validar forma exata e interpretação contra instrumento autorizado |
| SNAP-IV | Ainda não incorporado | Adiar: identificar respondente, contexto e versão; não misturar pais/professores longitudinalmente |
| Y-BOCS | Ainda não incorporado | Adiar: aplicação profissional, subescalas e limites; revisar licença e versão |
| C-SSRS | Ainda não incorporado | Redesenhar prioritariamente se piloto demandar; respostas ausentes hoje viram zero no upstream; definir versão, ramificações e janela temporal |
| MEEM | Ainda não incorporado | G11: aplicação assistida, escolaridade, acessibilidade e direitos de uso |
| EUROHIS-QOL | Ainda não incorporado | Adiar: itens 1–5 não aceitam zero; direção de melhora e cálculo próprios |
| WHOQOL-SRPB | Ainda não incorporado | Adiar: comprovar versão/itens e escopo; não inferir equivalência com instrumento completo pelo nome |
| AUDIT-C | Ainda não incorporado | Candidato P1 junto do AUDIT; contexto e limiares por população explicitados |
| CAGE | Ainda não incorporado | Adiar se AUDIT/AUDIT-C atender piloto, evitando redundância de interface |
| MDQ | Ainda não incorporado | Redesenhar: upstream usa somente soma ≥7 dos 13 itens; não coleta simultaneidade/prejuízo na definição lida |
| PCL-5 | Ainda não incorporado | Adiar: evento/tempo, clusters e corte da versão escolhida |
| PC-PTSD-5 | Ainda não incorporado | Adiar: contexto de trauma e interpretação de rastreio |
| EPDS | Ainda não incorporado | Candidato conforme população piloto; inversões, item 10 e contexto perinatal |
| SRQ-20 | Ainda não incorporado | Adiar: população/corte e flag do item de segurança |
| HAM-A | Ainda não incorporado | Adiar: instrumento profissional, faixa e ancoragem dos itens |
| ISI | Ainda não incorporado | Candidato de baixa complexidade relativa; validar faixas e período |
| PHQ-15 | Ainda não incorporado | Adiar: contexto somático e interpretação sem inferência diagnóstica |

Essas decisões são prioridades de produto condicionadas ao piloto, não recomendações clínicas ao paciente. Ter texto bibliográfico junto de uma função não comprova fidelidade à versão validada.

## 6. Bloqueios upstream reproduzidos e inspeção adversarial

As cinco primeiras observações foram reproduzidas com funções upstream transpiladas via esbuild, executadas em Node sem alterar o repositório de origem. Os demais achados decorrem da leitura dos símbolos citados.

| ID | Evidência / entrada | Resultado observado | Consequência para o porte |
| --- | --- | --- | --- |
| U-01 | `calculateAntidepressantTransition('moclobemida', 300, 'sertralina')` | `strategyType='washout'`, `timelineSteps.length=0` | Matriz IMAO tem ramo sem cronograma; par não suportado deve bloquear explicitamente |
| U-02 | `calculateAntidepressantTransition('UNKNOWN', 50, 'UNKNOWN')` | Origem vira fluoxetina; destino tem fallback sertralina no código | ID desconhecido deve ser erro, nunca substituição clínica |
| U-03 | `calculateEgfr(0, 50, 'male')` | Valor não finito (`Infinity`; JSON serializa como `null`) | Validar entrada antes da fórmula e saída finita antes de persistir |
| U-04 | `CSSRS_SCALE.calculateResult({})` | Retorna classificação de ausência de ideação | Não respondido não pode ser negativo; bloqueio de completude é obrigatório |
| U-05 | `generateHealthEducationSuggestions([], { pensamentoConteudo: ['conteudo_ideacao_suicida'] })` | `hasHighRiskWarning=false` | Consumir flags e estado estruturado de segurança, não procurar somente texto de pergunta nas escalas |
| U-06 | `calculateAntidepressantTransition`, ramo `source.id === 'fluoxetina'` | Estratégia direta generalizada aos destinos fora do ramo IMAO | Exigir revisão clínica por par antes de expor; não endossar a orientação de troca genérica |
| U-07 | `calculators.ts`, equivalências; DB e tabela de switching | Métodos/tabelas diferentes, fallbacks 20/100; arredondamento à dose comercial no switching | Uma fonte por método, rastreabilidade e diferença explícita entre equivalência estimada e dose prescrita |
| U-08 | `calculateCardiovascularRisk` | Defaults para dados faltantes; clamp idade/PAS/lípides; risco direto impõe piso 20/25% | Não apresentar número artificial como probabilidade medida; separar elegibilidade, escore e reclassificação |
| U-09 | `ScalesView.tsx`, inicialização e `handleSelectOption` | Preenche zero, pode reutilizar resposta anterior e salva a cada seleção | Exigir respostas explícitas e separar draft de aplicação finalizada |
| U-10 | `EvolutionChartsView.tsx` | Usa histórico demo se ausente, inventa pontos intermediários e regra geral de resposta/remissão | Não vale incorporar esses comportamentos; preservar histórico real do produto |
| U-11 | `server.ts`, modo mock e catch SOAP | Produz achados/condutas não informados, inclusive ausência de sinais de alarme; endpoint não tem autenticação tenant no arquivo | Descartar mocks/fallback clínico e servidor; falha deve ser visível e não produzir fatos |
| U-12 | `PatientSelfFillModal.tsx`, `navigation.ts`, `WhatsappShareModal.tsx` | Nome na URL e resultados/respostas em texto de compartilhamento | Preservar convite opaco e outbox canônicos; não importar canal paralelo |

Catálogo não equivale a segurança completa: switching recebe apenas medicamento/dose/destino, sem contexto estruturado de idade, gravidez, comedicações, alergias, função renal/hepática ou formulação. `maxRecommendedDose` e alertas textuais não substituem regras contextuais e bloqueios. `cypInteractions` é texto livre; o gerador usa busca por “Potente”/“Moderado”, sem uma matriz completa de substratos/inibidores por par. O upstream não contém suite de testes clínica localizada no inventário, e `package.json` não oferece script `test`.

## 7. Contratos de dados, dependências e testes por slice

Base comum obrigatória: usar `NexusClinicalResult` com clínica/paciente/profissional/atendimento, `moduleKey`, `toolKey`, `ruleKey`, `ruleVersion`, capability, entrada, saída, evidências e autoria. Resultados históricos devem renderizar seus snapshots; mudanças de conteúdo não recalculam registros antigos. Regras determinísticas devem continuar determinísticas. IA nunca é a autoridade clínica.

| Slice / gaps | Valor e prioridade 80/20 | Dados, dependências e evidência | Testes obrigatórios | Migration / Edge Function |
| --- | --- | --- | --- | --- |
| Segurança C-01/C-02 | P0/P1; impacto alto, esforço médio, risco médio | Boundaries atuais + vínculo assistencial + contrato permitido de ferramenta | Matriz de atores/tenant e tentativas por acesso direto; verificar policies após todas as migrations | Sim para policies/constraints/RPC; verifier obrigatório; sem necessidade inerente de Edge nova |
| Revisão e ciclo EEM G03/G16 | P1; alto/médio/médio | C-03/C-04; origem do resultado e revisão no prontuário existente | Não assinar automaticamente; importação duplicada; adendo; snapshot histórico; paciente/atendimento errado; retry da RPC sem duplicar ato | Display: não. Revisão/origem/idempotência: provável adição de contrato, a definir; não inventar schema nesta auditoria |
| Longitudinal G04 | P1; alto/médio/baixo | Compatibilidade de regra e definição de itens; não juntar aliases sem mapeamento | Versões, itens ausentes, direção da escala, zero basal, remount/erro/troca de paciente | Não para correção de frontend |
| Aplicador G01 e escalas G02 | P1; alto/médio/médio-alto | Evoluir `NexusScaleDefinition`; extrair regra compartilhável com processor; fontes/licença por instrumento | Completude, opções inválidas, NaN, limites, pesos, flags, snapshots e equivalência entre cliente/servidor | Resultado cabe no contrato atual, mas finalização/registry pode exigir RPC; autoavaliação exige atualizar whitelist, catálogo e processor juntos |
| Catálogo G06/G08 | P1; alto/médio/médio | Dentro de `nexus/psychopharmacology` como destino proposto; IDs estáveis, método, formulação/unidade, versão de dataset, revisão e fonte por entrada | Integridade IDs/aliases, duplicação, proveniência obrigatória, aposentadoria de versão; nenhum fallback de droga | Não para dataset curado versionado no código; tabela administrativa só se houver necessidade comprovada |
| Renal G12 | P1; alto/pequeno-médio/alto clínico | Regra pura + referência primária; unidade/contexto/população; data de coleta e inputs efetivamente usados | Casos de referência, valores zero/negativos/não finitos, unidades, idade fora do domínio, arredondamento e output persistido | Em princípio não para snapshots; usar contrato autorizado de calculadoras; não criar modelo de exames sem necessidade |
| Equivalências G09 | P1/P2; alto/médio/alto | Dataset anterior; distinguir método, estimativa e dose comercial; sem prescrição automática | Valores por método, par não suportado, dose inválida, formulação, arredondamento e limites | Em princípio não; depende de writer autorizado existente/estendido |
| Segurança medicamentosa G10 | P1; alto/grande/alto | Contexto confiável e atualizado de medicamentos/exames; regras versionadas e flags existentes | Dados desconhecidos/antigos, interações suportadas e não suportadas, severidade, acknowledgement preservando conteúdo | Flags atuais reutilizáveis; monitoramento longitudinal persistente pode exigir modelo próprio, ainda não especificado |
| Switching G07 | P2 após gates; alto/grande/alto | Catálogo, segurança, revisão clínica por par e exclusões; cronograma estruturado e proveniência | Matriz completa dos pares suportados; IMAO, fluoxetina, mesma droga, dose/formulação inválida; cobertura sem ramo vazio; decisão humana | Sem migration inerente ao cálculo; gravação/ato de aprovação depende das slices anteriores |
| Cognição G11 | P2; médio/médio/alto | Template assistido, versão licenciada, escolaridade e limitações documentadas | Tarefas não realizadas, contexto educacional, pontuação parcial, alinhamento de domínios e comparação histórica | Em princípio snapshots bastam; não inventar coluna de escolaridade sem analisar perfil canônico |
| Cardiovascular G13 | P2; médio/grande/alto | Definir modelo e versão com referência; separar cálculo, critério direto e conduta | Casos de referência por sexo/modelo, dados faltantes, extremos, modo direto sem percentual inventado | Em princípio não; regras/registry e evidências precisam governança |
| Educação G15 | P2; médio/médio/médio | Cinco materiais upstream e regras contextuais; adaptar linguagem APS à clínica; consumir flags; versão do conteúdo e revisão | Ideação só no EEM, escala incompleta, fonte ausente, prioridade de segurança, seleção/editabilidade e confirmação | Não para consulta; registro de material entregue pode exigir persistência de ato, diferente de sugestão |
| Evidências G15 | P1 transversal; alto/médio/médio | `nexus_evidence_sources` existente; snapshot atual protege histórico, mas catálogo tem `evidence_key UNIQUE` e upsert substitui metadados | Resultado antigo invariável após atualização; fonte removida; regra sem evidência; mesma versão não mudar sem rastreabilidade | Seeds aditivos curados podem bastar; revisões imutáveis do catálogo exigiriam migration própria |
| IA G16 | Adiar; médio/grande/alto | Primeiro fechar SOAP determinístico; depois contrato autenticado server-side, minimização e revisão, versão de prompt/modelo | Falha do provedor, fatos não informados, payload inválido, outro tenant, prompt injection e ausência de gravação automática | Apenas em missão futura; nenhuma Edge IA proposta para esta entrega |

Evidências devem distinguir fonte da fórmula, fonte da interpretação, versão da tradução/instrumento e revisão do conteúdo. Não usar o booleano `isRctEvidence` como certificação automática de toda a estratégia de troca.

## 8. Ordem recomendada de PRs

| Ordem | PR proposto | Critério de saída |
| --- | --- | --- |
| 0 | Este mapa diferencial | Documentação revisável, bases fixadas e limites explícitos; sem código funcional |
| 1 | Restaurar boundary médico em leituras Nexus (C-01) | SQL comportamental + verifier; composição com vínculo preservada; aprovação de rollout |
| 2 | Fechar contrato de escrita e compatibilidade profissional (C-02/C-06) | Ferramenta não escolhe sua autorização; médicos com grants/fallback testados; sem regressão no cutover |
| 3 | Revisão de resultado, histórico EEM e proposta ao prontuário (C-03/C-04) | Usuário revisa fonte antes de incorporar; sem sobrescrita de finalizado; origem rastreável |
| 4 | Longitudinal por versão/item e isolamento de estado (C-05) | Comparações válidas; ausência não vira zero; erro/troca de paciente seguros |
| 5 | PHQ-9/GAD-7 profissional com regra compartilhada | Reutiliza processor/contrato atual; regressão clínica e banco verificadas |
| 6 | Uma escala adicional por PR, escolhida pelo piloto | AUDIT/ISI como candidatos; C-SSRS só com protocolo/versão revistos; sem lote de 19 instrumentos |
| 7 | Catálogo farmacológico curado + proveniência | Consulta contextual sem dose sugerida automaticamente; uma fonte para IDs/métodos |
| 8 | Função renal isolada e validada | Inputs explícitos, domínio/unidade corretos e resultado finito; sem ajuste de dose automático |
| 9 | Um método de equivalência + alertas por PR | Casos de referência e rejeição de casos não suportados |
| 10 | Educação contextual integrada às flags | Segurança precede sugestão; conteúdo revisado e incorporação confirmada |
| 11 | Cognição ou cardiovascular conforme demanda | Definição clínica/licença e testes completos; não executar ambos por volume |
| 12 | Switching por conjunto pequeno de pares validados | Zero fallback silencioso; cronograma completo; contexto e revisão humana |

Governança de evidências acompanha cada PR desde o primeiro porte; não fica para o fim. Essa ordem é proposta, não autorização de absorção em massa. Prescrição, emissão de documentos, novas automações e ampliação do boundary para outras profissões ficam fora desta missão.

## 9. Validação executada e ações operacionais

- `npm ci --no-audit --no-fund`: concluído, 279 pacotes. Flags apenas desativam consulta de auditoria/funding nessa instalação; não se afirma auditoria de dependências local.
- `npm test`: **39 arquivos, 166 testes aprovados**.
- `npm run typecheck`, `npm run lint`, `npm run build`: aprovados. Build emitiu aviso de tamanho de chunk; não foi tratado como escopo da auditoria.
- Inspeção de testes Nexus: `eem.test.ts` (5), `longitudinal.test.ts` (4), `publicSelfAssessmentCatalog.test.ts` (3), `nexusSelfAssessmentUi.test.ts` (3). Esses testes não equivalem a validar scoring do processor, RLS real ou medicamentos.
- Probes U-01–U-05 executados em scratch, usando esbuild do produto para bundle ESM das funções upstream e Node para chamadas diretas. Nenhum teste clínico foi adicionado ao produto nesta entrega documental.
- Verifiers Nexus lidos como evidência de intenção estrutural; não executados. O verifier EEM inspeciona definição/privileges, o que não substitui teste transacional de rollback/duplicidade.
- A revisão do mapa deve checar caminhos e inventário, `git diff --check`, e que o único arquivo entregue seja este documento. O CI do PR é reportado separadamente do resultado local.

**Esta entrega não exige migration, Edge Function, redeploy ou comando no servidor.** O primeiro próximo trabalho de maior impacto é confirmar o estado das policies efetivas em ambiente controlado e preparar o PR C-01. Se a migration divergente estiver aplicada em produção, priorizar sua correção antes de liberar mais acesso ao Nexus. Não executar mudanças de produção com base apenas neste mapa.
