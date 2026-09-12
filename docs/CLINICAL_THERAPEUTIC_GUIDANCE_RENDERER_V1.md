# MedicsPro — Therapeutic Guidance Professional Print Renderer V1 (D2-C.1)

> Evolução visual versionada de `therapeutic_guidance` sobre a D2-A/D2-C. Não altera autoria, eligibility, RLS ou lifecycle clínico.

**Estado:** VALIDADO EM PRODUÇÃO  
**PR:** #436  
**Merge canônico:** `af53bf2d7229c238335ab201f3438f44543f7f89`

## Objetivo

Substituir a prévia de conteúdo e a impressão plain-text das novas orientações por uma folha A4 profissional, mantendo o documento emitido historicamente imutável.

Contrato:

```text
PREVIEW == PRINT CONTRACT
ISSUED DOCUMENT != CURRENT TEMPLATE
ENGINE != AUTHORIZATION != RELEVANCE
```

Fluxo:

```text
template published version
        ↓
render_definition fechado
        ↓
draft live preview
        ↓
revisão humana
        ↓
issue D2-A
        ↓
payload_snapshot
context_snapshot
template_definition_snapshot
        ↓
issued print
```

## Layout fechado

Layout canônico:

```text
clinical-document/therapeutic-guidance-v1
```

A definição visual contém somente propriedades controladas pelo MedicsPro:

```json
{
  "layout": "clinical-document/therapeutic-guidance-v1",
  "title": "Orientações terapêuticas",
  "show_clinic_address": true,
  "show_clinic_phone": true,
  "show_patient_birth_date": true,
  "show_specialty": true
}
```

Não existe HTML, CSS ou JavaScript administrável. Conteúdo de paciente, clínica, profissional e orientação é escapado antes de entrar no HTML de apresentação.

## Conteúdo da folha

A composição A4 pode apresentar:

- nome da clínica;
- endereço e telefone, quando habilitados;
- nome e identidade profissional do emissor;
- conselho, UF e registro quando existentes;
- especialidade, quando habilitada;
- paciente e nascimento;
- data;
- título humano do documento;
- `items[].guidance` numerados;
- `patient_instructions`;
- `observations`;
- área de assinatura visual;
- identificador do documento emitido.

O termo interno `therapeutic_guidance` não é título de documento para o usuário.

## Templates platform

A migration D2-C.1 publicou novas versões imutáveis para os dois templates D2-A já existentes:

```text
Orientação terapêutica geral
v1 plain-text-v1 → v2 therapeutic-guidance-v1

Orientações pós-atendimento
v1 plain-text-v1 → v2 therapeutic-guidance-v1
```

As versões V1 permanecem publicadas e imutáveis. Nenhuma versão histórica foi atualizada em lugar.

## Preview e impressão

O frontend usa o mesmo renderer seguro para:

```text
rascunho ao vivo
+
documento emitido
```

A prévia roda em `iframe srcDoc` sandboxed, sem script e marcada como `Rascunho · não emitida` / `sem validade`.

Na impressão do emitido, o frontend lê exclusivamente:

- `payload_snapshot`;
- `context_snapshot`;
- `template_definition_snapshot.render_definition`;
- `document_identifier`;
- `issued_at`.

Portanto o template corrente não pode alterar uma orientação já emitida.

## Compatibilidade histórica

Documentos emitidos antes da D2-C.1 podem ter:

```text
render_definition.layout = clinical-document/plain-text-v1
```

Eles não são reinterpretados como o layout novo. A impressão usa fallback seguro baseado no `rendered_snapshot` congelado, com markup escapado.

Consequência:

```text
orientação antiga → continua histórica/plain-text
orientação nova → renderer visual V1
```

## Renderer version e snapshot

O campo legado `clinical_documents.renderer_version` continua sob o contrato genérico D2-A existente. A identidade visual desta slice é determinada pela definição imutável congelada em:

```text
template_definition_snapshot.render_definition.layout
```

D2-C.1 não substitui `issue_clinical_document()` apenas para alterar metadado de renderer. O objetivo é reduzir superfície de risco e preservar o boundary D2-A/B.2C já validado.

## Autorização preservada

Nenhuma permissão nova foi criada.

A autoridade continua sendo:

```text
current_user_can_issue_clinical_document('therapeutic_guidance')
+
assert_clinical_document_actor(...)
```

D2-C.1 não:

- transforma owner/admin em autor clínico;
- transforma especialidade em ACL;
- concede autoria via template;
- altera `clinical.documents`;
- cria bypass platform admin;
- usa Nexus para emitir orientação automaticamente.

## Artefatos de banco

Migration aditiva:

```text
supabase-migrations/20260912_clinical_therapeutic_guidance_renderer_v1.sql
```

Verifier production-safe:

```text
supabase-verifiers/VERIFY_20260912_CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.sql
```

O verifier roda em transação própria e termina com `ROLLBACK`. Esse rollback remove somente os probes do verifier; não desfaz uma migration previamente aplicada e commitada em outra execução.

## Gates

No head final da #436 ficaram verdes:

- unit tests do renderer;
- boundary tests D2-C.1;
- `npm test`;
- typecheck;
- lint;
- build;
- PostgreSQL 16 D2-C.1;
- regressão D2-B.2C;
- regressão de autorização clínica;
- Clinical Foundation/Encounter/Instrument Authorization;
- Nexus C-01/C-02/C-03/C-04/C-06.

## Produção — evidência de 2026-09-12

Backup antes da migration:

```text
/root/medicspro_before_d2c1_20260912_194049.dump
```

Migration pinada ao merge `af53bf2d7229c238335ab201f3438f44543f7f89`:

```text
BEGIN
SET
SET
INSERT 0 2
DO
UPDATE 2
COMMIT
MIGRATION_EXIT=0
```

Verifier oficial:

```text
CLINICAL THERAPEUTIC GUIDANCE RENDERER V1 VERIFY PASSED
ROLLBACK
VERIFIER_EXIT=0
```

Após redeploy do frontend, o smoke real confirmou a folha A4 ao vivo e a impressão do documento emitido com:

- clínica e dados de cabeçalho;
- profissional e conselho/registro;
- título humano `ORIENTAÇÕES TERAPÊUTICAS`;
- paciente e data;
- orientações estruturadas;
- instruções ao paciente;
- bloco de assinatura;
- identificador do documento;
- ausência de `therapeutic_guidance` como rótulo visível ao paciente.

O usuário confirmou o fluxo final como funcional.

```text
D2-C.1 — VALIDADO EM PRODUÇÃO
```
