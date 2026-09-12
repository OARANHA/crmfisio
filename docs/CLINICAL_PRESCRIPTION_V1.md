# MedicsPro — Clinical Prescription V1 (D2-B)

> Estado deste documento: D2-B foi mergeada na `main` em `15692b47fc5bca577948a03de2a686f58d5c7dd9`, mas ainda não há evidência registrada de smoke real em produção. A micro-slice D2-B.1 (PR #430) adiciona a visualização ao vivo do rascunho e também permanece não validada em produção.

## Objetivo

Entregar a primeira superfície de prescrição medicamentosa do Clinical Encounter sem criar um Prescription Engine paralelo e sem reabrir o schema D2-A.

Fluxo:

```text
Encounter ativo do profissional
→ Prescrição
→ template publicado elegível
→ draft
→ medicamentos estruturados
→ visualização ao vivo do rascunho
→ salvar rascunho
→ revisão humana explícita
→ emissão D2-A
→ snapshot imutável
→ impressão / histórico
```

## Arquitetura

D2-B é um consumidor frontend/application da D2-A.

Não cria:

- migration;
- novo `document_type`;
- RLS nova;
- RPC nova;
- regra de autorização própria;
- catálogo farmacológico;
- recomendação automática;
- PDF/assinatura digital;
- engine Nexus paralela.

RPCs canônicos reutilizados:

```text
current_user_can_issue_clinical_document('medication_prescription')
create_clinical_document_draft(...)
save_clinical_document_draft(...)
issue_clinical_document(...)
cancel_clinical_document(...)
```

A UI nunca grava diretamente `clinical_documents`.

## Authorization / relevance

O workspace `Prescrição` é apresentado no Encounter quando a identidade de apresentação é médica. Isso é somente **relevância de UI**.

A autorização efetiva continua server-side e exige o contrato D2-A, incluindo:

- usuário autenticado e profile ativo;
- tenant correto;
- identidade clínica válida;
- `clinical.documents`;
- identidade médica válida para `medication_prescription`;
- CRM/UF/registro;
- próprio Encounter ativo.

Logo:

```text
profession relevance != authorization
```

Esconder ou mostrar a aba nunca concede o ato documental.

## Payload V1

O contrato persistido continua JSONB D2-A. A UI estrutura cada medicamento como:

```text
medication_name   obrigatório para emissão
dose              opcional
route             opcional
frequency         opcional
duration          opcional
instructions      opcional
```

Documento:

```text
items[]
observations
```

Rascunhos podem permanecer incompletos. A emissão exige pelo menos um item e `medication_name` não vazio em todos os itens, exatamente como o verifier D2-A já prova.

D2-B não infere dose, via, duração, frequência, diagnóstico ou conduta.

## Persistência

Não existe autosave genérico.

Estados visuais:

```text
rascunho criado
→ alterações locais
→ Salvar rascunho
→ rascunho salvo
→ Revisar e emitir
```

`Salvar rascunho` nunca emite.

`Confirmar e emitir` é ação humana separada. Se houver alterações locais no momento da confirmação, elas são persistidas antes do RPC de emissão.

## Resume

Ao abrir o mesmo Encounter, D2-B procura o rascunho `medication_prescription` do próprio emissor e do mesmo `appointment_id` e o retoma.

Rascunhos de outro profissional ou de outro appointment não são usados como documento editável atual.

RLS e care relationship continuam limitando o que pode ser lido.

## D2-B.1 — Live document preview

PR #430 recupera a boa ergonomia de `Visualização` do MedicsPro histórico sem transformar HTML/UI em fonte clínica.

Em desktop largo:

```text
Editor estruturado | Folha de receita ao vivo
```

Em viewport menor, as duas superfícies são empilhadas.

A prévia lê somente estado já disponível no frontend:

- usuário autenticado: nome e registro;
- paciente em contexto: nome e data de nascimento;
- data de visualização;
- `payload.items` local do rascunho;
- `payload.observations` local.

Ela é deliberadamente marcada como:

```text
Rascunho · não emitida
Sem validade até a emissão
Pré-visualização de rascunho · documento não emitido
```

A prévia:

- não chama RPC;
- não persiste nada;
- não concede autorização;
- não tem botão de imprimir;
- não gera documento identifier;
- não substitui a revisão humana;
- não altera o lifecycle D2-A.

Portanto:

```text
live preview = apresentação do estado local
issued document = snapshot clínico imutável
```

## Pós-emissão

Documento `issued` não volta ao editor.

A visualização histórica usa `payload_snapshot`; a impressão também é construída exclusivamente a partir do snapshot emitido e do `context_snapshot` preservado na D2-A.

Nenhum template atual é recalculado para imprimir uma receita histórica.

Histórico mostra documentos emitidos/cancelados acessíveis pelo boundary clínico canônico.

Cancelamento continua disponível na foundation e permanece auditável, mas D2-B V1 não adiciona fluxo de cancelamento à UI.

## Impressão

V1 usa impressão nativa do navegador sobre uma visão criada a partir do snapshot emitido.

A pré-visualização D2-B.1 não é imprimível; isso evita confusão entre rascunho e documento emitido.

Não é PDF assinado e não deve ser descrito como assinatura digital ou receita eletrônica certificada.

Uma camada de PDF/assinatura, caso necessária, é fase posterior e precisa de contrato próprio.

## Nexus

D2-B/D2-B.1 não consomem Nexus.

Direção futura:

```text
Nexus = conhecimento / cálculo / apoio à decisão
Clinical Documents = ato documental explícito do profissional
```

Catálogo, equivalências, função renal, interações ou switching podem ser integrados depois somente como assistência, sem transformar Nexus em autor da prescrição.

## Referência histórica

A revisão histórica `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83` continua útil para ergonomia:

- medicamentos estruturados;
- templates;
- observações;
- preview;
- impressão;
- histórico.

D2-B.1 reutiliza especificamente o conceito de uma área `Visualização`, mas não a arquitetura histórica.

Não reaproveitar:

- Vue/Pinia/Mongo/Express;
- autorização de frontend;
- edição/apagamento de receita histórica emitida;
- HTML arbitrário como fonte clínica;
- autosave genérico que pode sugerir persistência sem confirmação.

## Arquivos principais

```text
src/lib/clinicalPrescription.ts
src/components/ClinicalPrescriptionWorkspace.tsx
src/components/PrescriptionDocumentPreview.tsx
src/components/ClinicalEncounterWorkspaceV4.tsx
src/lib/clinicalPrescription.test.ts
src/lib/clinicalPrescriptionBoundary.test.js
```

## Estado de rollout

Estado editorial atual:

```text
D2-A   VALIDADO EM PRODUÇÃO
D2-B   MERGEADO / NÃO VALIDADO EM PRODUÇÃO
D2-B.1 IMPLEMENTADO NA PR #430 / NÃO VALIDADO EM PRODUÇÃO
```

Somente após deploy real e smoke controlado o estado da Prescrição V1 pode ser promovido para `VALIDADO EM PRODUÇÃO`.
