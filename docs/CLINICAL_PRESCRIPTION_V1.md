# MedicsPro — Clinical Prescription V1 (D2-B)

> **Estado:** D2-B, D2-B.1, D2-B.2A e D2-B.2B estão **VALIDADOS EM PRODUÇÃO** em 2026-09-12. A evolução atual é D2-B.2C (PR #433), renderer profissional seguro/versionado.

## Objetivo

Entregar prescrição medicamentosa dentro do Clinical Encounter sem criar Prescription Engine paralelo e sem reabrir o lifecycle D2-A.

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

## Authorization / relevance

A apresentação da aba pode usar profissão/especialidade apenas como relevância. A autorização efetiva continua server-side e exige o contrato D2-A: sessão/profile/tenant ativos, identity clínica, `clinical.documents`, identidade médica válida, CRM/UF/registro e próprio Encounter ativo.

```text
profession relevance != authorization
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
```

## Payload V1

Cada medicamento:

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

Rascunhos podem permanecer incompletos. A emissão exige pelo menos um item e `medication_name` não vazio em todos os itens. D2-B não infere dose, via, duração, frequência, diagnóstico ou conduta.

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

O smoke confirmou salvar, sair, retornar e retomar o rascunho do mesmo emissor/Encounter.

## D2-B.1 — Live Preview

**VALIDADO EM PRODUÇÃO.** PR #430 → `db046f0f8b88864b18a5181b320ae346c59a4419`.

A prévia é explicitamente marcada como rascunho sem validade. Antes da D2-B.2C ela usava uma composição visual frontend própria; a evolução em curso converge preview e print para um renderer único versionado.

```text
live preview = apresentação do estado local
issued document = snapshot clínico imutável
```

## D2-B.2A — Template Management backend

**VALIDADO EM PRODUÇÃO.** PR #431 → `af7b87725a62985c0f6a38dc753b737de40b48af`.

Owner/admin administram modelos da própria clínica por RPC sem receber autoridade para prescrever. Platform templates são read-only; versões publicadas são imutáveis; clone/publicação são tenant-scoped.

Documento: `docs/CLINICAL_DOCUMENT_TEMPLATE_ADMIN.md`.

## D2-B.2B — Admin UI / Template Library

**VALIDADO EM PRODUÇÃO.** PR #432 → `8247f91ec5c35c6cf409b7356ed1c1601b961623`.

Smoke real confirmou:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
→ Visualizar
```

A biblioteca administrativa funciona. O teste visual confirmou que a próxima evolução deve aproximar a experiência do MedicsPro histórico: edição visual com preview fiel e documento profissional, sem copiar seu HTML livre.

## D2-B.2C — Professional Print Layout / Safe Presets

**PR #433 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Documento específico: `docs/CLINICAL_PRESCRIPTION_RENDERER_V2.md`.

Contrato visual:

```text
clinical-document/prescription-v2
```

Presets fechados:

- `classic`;
- `institutional`;
- `compact`.

Acentos fechados:

- `monochrome`;
- `navy`;
- `emerald`.

Medicamentos:

- `numbered`;
- `cards`.

Arquitetura:

```text
Admin preview
      ↓
render_definition publicado
      ↓
Draft live preview
      ↓
issue
      ↓
template_definition_snapshot
      ↓
Issued print
```

O mesmo `src/lib/prescriptionPrintRenderer.ts` compõe as três superfícies. Todo texto dinâmico é escapado. O admin configura presets/blocos tipados; não fornece HTML, CSS ou JavaScript.

Novas emissões congelam no `context_snapshot` os dados necessários à apresentação: paciente, clínica e identidade profissional. O `template_definition_snapshot` congela a `render_definition` usada na emissão.

Documento histórico nunca consulta o template corrente para reconstruir aparência.

## Impressão e histórico

Documento `issued` não volta ao editor.

Na D2-B.2C, a impressão passa a consumir:

- `payload_snapshot`;
- `context_snapshot`;
- `template_definition_snapshot.render_definition`;
- `document_identifier`.

Versões antigas `plain-text-v1` permanecem válidas e recebem fallback visual seguro no frontend; `rendered_snapshot` textual segue preservado para auditoria/compatibilidade.

Não é PDF assinado e não deve ser descrito como assinatura digital ou receita eletrônica certificada.

## Nexus

Prescrição não consome Nexus para decidir ou emitir automaticamente.

```text
Nexus = conhecimento / cálculo / apoio à decisão
Clinical Documents = ato documental explícito do profissional
```

Integrações futuras de farmacologia podem assistir o médico, nunca se tornar autor automático da prescrição.

## Referência histórica

`OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83` foi revisado para D2-B.2C.

Reaproveitar UX madura:

- modelos;
- clínica/profissional/paciente no documento;
- medicamentos estruturados;
- observações;
- preview;
- impressão;
- assinatura visual.

Rejeitar:

- `v-html` como renderer;
- substituição livre de `{{variáveis}}` em HTML;
- autorização frontend;
- edição/apagamento de emitidos;
- template atual alterando documento histórico.

## Evidência de rollout já concluída

```text
D2-A    VALIDADO EM PRODUÇÃO
D2-B    VALIDADO EM PRODUÇÃO
D2-B.1  VALIDADO EM PRODUÇÃO
D2-B.2A VALIDADO EM PRODUÇÃO
D2-B.2B VALIDADO EM PRODUÇÃO
D2-B.2C EM ANDAMENTO / NÃO PRODUÇÃO
```

A D2-B.2C só muda para `VALIDADO EM PRODUÇÃO` depois de merge autorizado, migrations/verifier controlados, redeploy frontend e smoke real de admin + médico + impressão.