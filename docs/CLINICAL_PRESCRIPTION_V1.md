# MedicsPro — Clinical Prescription V1 (D2-B)

> **Estado:** D2-B e D2-B.1 estão **VALIDADOS EM PRODUÇÃO** em 2026-09-12. D2-B entrou pela PR #429; D2-B.1 Live Preview pela PR #430. A evolução atual é D2-B.2A (PR #431), backend de administração segura de templates.

## Objetivo

Entregar a primeira superfície de prescrição medicamentosa do Clinical Encounter sem criar um Prescription Engine paralelo e sem reabrir o lifecycle D2-A.

Fluxo validado:

```text
Encounter ativo do profissional
→ Prescrição
→ template publicado elegível
→ draft
→ medicamentos estruturados
→ visualização ao vivo do rascunho
→ salvar rascunho
→ sair/retornar e retomar draft
→ revisão humana explícita
→ emissão D2-A
→ snapshot imutável
→ read-only / histórico
→ impressão do documento emitido
```

## Arquitetura

D2-B é consumidor frontend/application da D2-A.

Não criou:

- migration;
- novo `document_type`;
- RLS própria;
- RPC própria;
- regra de autorização paralela;
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

```text
profession relevance != authorization
```

Esconder ou mostrar a aba nunca concede o ato documental.

## Payload V1

Cada medicamento é estruturado como:

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

Rascunhos podem permanecer incompletos. A emissão exige pelo menos um item e `medication_name` não vazio em todos os itens, conforme o boundary D2-A.

D2-B não infere dose, via, duração, frequência, diagnóstico ou conduta.

## Persistência / resume

Não existe autosave genérico.

```text
rascunho criado
→ alterações locais
→ Salvar rascunho
→ rascunho salvo
→ Revisar e emitir
```

`Salvar rascunho` nunca emite. `Confirmar e emitir` é ação humana separada.

Ao abrir o mesmo Encounter, D2-B procura o rascunho `medication_prescription` do próprio emissor e do mesmo `appointment_id` e o retoma. Rascunhos de outro profissional/appointment não são usados como documento editável atual.

O smoke de produção confirmou salvar, sair da tela, retornar e retomar o rascunho corretamente.

## D2-B.1 — Live document preview

PR #430 recuperou a boa ergonomia de `Visualização` do MedicsPro histórico sem transformar HTML/UI em fonte clínica.

Desktop largo:

```text
Editor estruturado | Folha de receita ao vivo
```

Viewport menor: superfícies empilhadas.

A prévia usa somente estado já disponível no frontend:

- usuário autenticado: nome e registro;
- paciente: nome e data de nascimento;
- data da visualização;
- `payload.items` local;
- `payload.observations` local.

Ela é marcada como:

```text
Rascunho · não emitida
Sem validade até a emissão
Pré-visualização de rascunho · documento não emitido
```

A prévia:

- não chama RPC;
- não persiste;
- não concede autorização;
- não é imprimível;
- não gera document identifier;
- não substitui a revisão humana;
- não altera o lifecycle D2-A.

```text
live preview = apresentação do estado local
issued document = snapshot clínico imutável
```

O smoke de produção confirmou a visualização ao vivo dentro do fluxo real de prescrição.

## Pós-emissão

Documento `issued` não volta ao editor.

Histórico e impressão usam `payload_snapshot`/`context_snapshot` preservados na D2-A. Nenhum template atual é recalculado para alterar uma receita histórica.

Cancelamento continua auditável na foundation; D2-B V1 não adicionou sua UI.

## Impressão

V1 usa impressão nativa do navegador sobre uma visão derivada do snapshot emitido. O smoke confirmou a abertura da impressão do documento emitido.

A saída é funcional e clinicamente vinculada ao snapshot, porém o teste visual mostrou que o layout atual ainda é simples para o padrão de documento profissional desejado. Isso é uma **lacuna de apresentação**, não de lifecycle ou persistência.

Direção aprovada:

```text
D2-B.2A → backend seguro de Template Admin
D2-B.2B → Configurações / biblioteca e preview de templates
D2-B.2C → renderer/presets profissionais versionados
```

Não resolver a aparência com HTML/CSS/JS arbitrário como fonte clínica.

Não é PDF assinado e não deve ser descrito como assinatura digital ou receita eletrônica certificada.

## D2-B.2A — Template Management

PR #431 cria o boundary administrativo separado:

```text
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
```

Owner/admin poderão administrar modelos da própria clínica sem que isso lhes conceda autoridade para emitir prescrição. O médico continua submetido integralmente à eligibility D2-A.

Documento: `docs/CLINICAL_DOCUMENT_TEMPLATE_ADMIN.md`.

## Nexus

D2-B/D2-B.1 não consomem Nexus.

```text
Nexus = conhecimento / cálculo / apoio à decisão
Clinical Documents = ato documental explícito do profissional
```

Catálogo, equivalências, função renal, interações ou switching podem ser integrados posteriormente somente como assistência, nunca como autor automático da prescrição.

## Referência histórica

`OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83` continua útil como referência de produto para:

- medicamentos estruturados;
- templates;
- observações;
- preview;
- impressão;
- histórico.

Preservar a ideia de experiência; rejeitar Vue/Pinia/Mongo/Express, autorização frontend, edição/apagamento de emitidos, HTML arbitrário como verdade clínica e autosave que confunda salvar com emitir.

## Arquivos principais D2-B/D2-B.1

```text
src/lib/clinicalPrescription.ts
src/components/ClinicalPrescriptionWorkspace.tsx
src/components/PrescriptionDocumentPreview.tsx
src/components/ClinicalEncounterWorkspaceV4.tsx
src/lib/clinicalPrescription.test.ts
src/lib/clinicalPrescriptionBoundary.test.js
```

## Evidência de rollout

```text
D2-A   VALIDADO EM PRODUÇÃO
D2-B   VALIDADO EM PRODUÇÃO
D2-B.1 VALIDADO EM PRODUÇÃO
```

Em 2026-09-12 o usuário confirmou no ambiente implantado:

- draft salvo;
- saída/retorno com resume correto;
- live preview funcionando;
- emissão concluída;
- documento pós-emissão em histórico/read-only;
- impressão aberta a partir do documento emitido.

A próxima validação de produção pertence à D2-B.2A somente depois de merge autorizado + migration/verifier controlados.
