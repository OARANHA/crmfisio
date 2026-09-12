# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Main canônica:** `33da15230cd35179681406b212e87305618a4976`  
**Estado:** D1 CONCLUÍDO / D2-A PROD / D2-B PROD / D2-B.1 PROD / D2-B.2A PROD / D2-B.2B PROD / D2-B.2C PROD / D2-C MERGEADO NÃO VALIDADO / D2-C.1 PR #436 EM ANDAMENTO

---

## Princípios

```text
ENGINE != AUTHORIZATION != RELEVANCE
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
PREVIEW == PRINT CONTRACT
ISSUED DOCUMENT != CURRENT TEMPLATE
```

`clinical.documents` é gate-base clínico. Não concede automaticamente prescrição ou outro ato documental específico.

Especialidade pode influenciar relevância/ordenação, nunca autorização. Administração de templates pertence ao tenant; emissão continua sendo ato clínico com identity + capability + autoria/contexto assistencial.

---

## Document types canônicos atuais

D2-A contém somente:

- `medication_prescription`
- `therapeutic_guidance`

Candidatos posteriores, cada um com contrato próprio:

- `exam_order`
- `referral`
- `attendance_declaration`
- `medical_certificate`
- `clinical_report`

Não apresentar Pedido de Exames, atestado ou relatório como template funcional antes de existir `document_type` canônico correspondente.

---

## Lifecycle canônico

```text
published template version
→ draft
→ structured payload
→ explicit human review
→ issue
→ immutable snapshots
→ history
→ optional audited cancellation
```

Documento emitido é historicamente imutável. Evolução posterior do template não altera documento histórico. Impressão histórica deve usar snapshots emitidos, nunca o template corrente.

---

# D1 — inventário e decisão arquitetural

**CONCLUÍDO.**

Decisão:

```text
Clinical Documents Foundation pequena
+
contratos tipados por document_type
```

Do MedicsPro histórico reaproveitar conceitos de produto — templates, conteúdo estruturado, observações, preview, impressão e histórico — nunca sua arquitetura/ACL antiga nem HTML livre como fonte documental.

---

# D2-A — Clinical Documents Foundation

**VALIDADO EM PRODUÇÃO.**

PR #425 → `0459e5908c942ac63c0dec87d517aa2131936204`.

D2-A permanece autoridade de eligibility, lifecycle, persistência, versions/snapshots, histórico e cancelamento.

`medication_prescription` exige médico elegível + CRM/UF/registro + `clinical.documents` + próprio Encounter ativo no boundary canônico.

`therapeutic_guidance` reutiliza o mesmo boundary-base clínico, sem o requisito adicional médico/CRM da prescrição medicamentosa.

---

# D2-B — Prescription family

**VALIDADO EM PRODUÇÃO.**

Marcos:

```text
#429 Prescription V1
#430 Live Preview
#431 Template Admin backend
#432 Admin UI / Template Library
#433 Professional Print / Safe Presets
```

D2-B.2C merge: `db364e17a158b2f1f13229ca595f6e7b24cfcab8`.

Contrato visual validado:

```text
clinical-document/prescription-v2
```

Presets seguros:

- `classic`
- `institutional`
- `compact`

Runtime:

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

Produção confirmou edição segura, nova versão publicada, emissão/impressão profissional, imutabilidade do layout histórico e compatibilidade `plain-text-v1`.

Documento: `docs/CLINICAL_PRESCRIPTION_RENDERER_V2.md`.

**Prescrição D2-B está fechada no escopo atual.** Polimento adicional só reabre a família com evidência concreta de problema de produto, segurança ou integridade.

---

# D2-C — Therapeutic Guidance V1

**MERGEADO / NÃO VALIDADO EM PRODUÇÃO.**

PR #435 → `33da15230cd35179681406b212e87305618a4976`.

A implementação reutiliza integralmente D2-A; não cria engine paralelo, RLS, grant ou capability novos.

Fluxo:

```text
Encounter próprio ativo
→ Orientações
→ template therapeutic_guidance publicado
→ draft estruturado
→ save / resume
→ revisão humana explícita
→ issue D2-A
→ snapshots imutáveis
→ histórico / impressão
```

Payload:

```text
items[].guidance
patient_instructions
observations
```

Regras:

- draft pode permanecer incompleto;
- emissão exige `items` não vazio e cada `guidance` não vazio;
- `patient_instructions` e `observations` são opcionais;
- UI não inventa conteúdo clínico;
- servidor mantém eligibility e autoria;
- não há hardcode médico/CRM para guidance;
- especialidade não concede autoria;
- Nexus não emite orientação automaticamente.

Documento: `docs/CLINICAL_THERAPEUTIC_GUIDANCE_V1.md`.

---

# D2-C.1 — Therapeutic Guidance Professional Print Renderer V1

**PR #436 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Objetivo: fechar a apresentação documental sem redesenhar o engine D2-A.

Layout:

```text
clinical-document/therapeutic-guidance-v1
```

Novas versões platform:

```text
Orientação terapêutica geral
v1 plain-text-v1 → v2 therapeutic-guidance-v1

Orientações pós-atendimento
v1 plain-text-v1 → v2 therapeutic-guidance-v1
```

Contrato:

```text
render_definition publicado
        ↓
draft live preview A4
        ↓
issue D2-A
        ↓
payload_snapshot
context_snapshot
template_definition_snapshot
        ↓
issued print pelo mesmo renderer
```

Escopo:

- título humano;
- clínica/endereço/telefone;
- paciente/nascimento;
- profissional/tipo/conselho/UF/registro/especialidade;
- data e assinatura visual;
- orientações, instruções e observações estruturadas;
- renderer seguro compartilhado;
- conteúdo dinâmico escapado;
- legacy `plain-text-v1` impresso por fallback do snapshot congelado;
- retomada de draft usa a versão exata de template/render_definition;
- nenhuma expansão de authorization, RLS, capability ou autoria;
- sem editor HTML/CSS/JS.

D2-C.1 não substitui o RPC genérico de emissão apenas para alterar o campo `renderer_version`. A versão visual efetiva é o layout congelado em:

```text
template_definition_snapshot.render_definition.layout
```

Documento: `docs/CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.md`.

Rollout após merge:

```text
backup
→ migration pinada ao merge SHA
→ verifier D2-C.1
→ redeploy frontend
→ smoke draft/save/resume/review/issue/print
→ smoke legacy plain-text-v1
→ somente então PROD VALIDADO
```

---

## Regras de continuidade

1. D2-A não deve ser redesenhada sem blocker reproduzido.
2. Não criar Prescription/Clinical Documents Engine paralelo.
3. Não tornar especialidade uma ACL.
4. Não transformar template admin em autorização clínica.
5. Não expor HTML/CSS/JS arbitrário como fonte de documento clínico.
6. Preview e impressão devem obedecer ao mesmo contrato versionado quando aplicável.
7. Produção só vira `VALIDADO EM PRODUÇÃO` com evidência real.
8. Após cada slice, revisar `docs/CURRENT_STATE.md`, documento de domínio e `docs/MANUAL_SOURCE_MAP.md` quando houver mudança visível.
9. Migrations de produção são controladas; merge não significa aplicação.
10. Consultar `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` e `docs/CLINICAL_TOOLING_REUSE_PLAN.md` antes de reinventar ferramenta clínica existente.
