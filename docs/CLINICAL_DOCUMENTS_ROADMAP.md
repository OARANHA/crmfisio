# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Base canônica desta slice:** `main@279dfb33af5cf6e2117d3fbd823175aa75ed6006`  
**Estado:** D1 CONCLUÍDO / D2-A PROD / D2-B PROD / D2-B.1 PROD / D2-B.2A PROD / D2-B.2B PROD / D2-B.2C PROD / D2-C PROD / D2-C.1 PROD / D2-D0 IMPLEMENTADO — NÃO PROD

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

## Document types canônicos

Produção antes da D2-D0 contém:

- `medication_prescription`
- `therapeutic_guidance`

D2-D0 adiciona, após merge + migration controlada:

- `exam_order`

Candidatos posteriores, cada um com contrato próprio:

- `referral`
- `attendance_declaration`
- `medical_certificate`
- `clinical_report`

Não apresentar atestado, referral ou relatório como template funcional antes de existir `document_type` canônico correspondente.

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

**VALIDADO EM PRODUÇÃO.**

PR #435 → `33da15230cd35179681406b212e87305618a4976`.

A implementação reutiliza integralmente D2-A; não cria engine paralelo, RLS, grant ou capability novos.

Fluxo validado:

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

Regras preservadas:

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

**VALIDADO EM PRODUÇÃO.**

PR #436 → `af53bf2d7229c238335ab201f3438f44543f7f89`.

Layout:

```text
clinical-document/therapeutic-guidance-v1
```

Versões platform publicadas:

```text
Orientação terapêutica geral
v1 plain-text-v1 → v2 therapeutic-guidance-v1

Orientações pós-atendimento
v1 plain-text-v1 → v2 therapeutic-guidance-v1
```

Contrato validado:

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

Produção confirmou:

- título humano;
- clínica/endereço/telefone;
- paciente/nascimento;
- profissional/tipo/conselho/UF/registro/especialidade;
- data e assinatura visual;
- orientações, instruções e observações estruturadas;
- renderer seguro compartilhado;
- conteúdo dinâmico escapado;
- legacy `plain-text-v1` preservado como fallback histórico;
- retomada de draft vinculada à versão exata de template/render_definition;
- nenhuma expansão de authorization, RLS, capability ou autoria;
- ausência de editor HTML/CSS/JS;
- ausência de `therapeutic_guidance` como texto técnico na saída para paciente.

Evidência de rollout:

```text
backup
→ /root/medicspro_before_d2c1_20260912_194049.dump

migration pinada a af53bf2d7229c238335ab201f3438f44543f7f89
→ COMMIT
→ MIGRATION_EXIT=0

verifier
→ CLINICAL THERAPEUTIC GUIDANCE RENDERER V1 VERIFY PASSED
→ VERIFIER_EXIT=0

frontend
→ redeploy concluído

smoke
→ live preview A4 + emissão/histórico/impressão profissional confirmados
```

D2-C.1 não substitui o RPC genérico de emissão apenas para alterar o campo `renderer_version`. A versão visual efetiva continua o layout congelado em:

```text
template_definition_snapshot.render_definition.layout
```

Documento: `docs/CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.md`.

---

# D2-D0 — Exam Order Canonical Foundation

**IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO.**

Base: `main@279dfb33af5cf6e2117d3fbd823175aa75ed6006`.

Decisão:

```text
Pedido de Exames != template de Orientação
Pedido de Exames = exam_order canônico próprio
```

Esta micro-slice é backend-only. Ela estende a Clinical Documents Foundation com:

- `exam_order` no conjunto fechado de `document_type`;
- template platform `Pedido de exames` com versão publicada imutável;
- payload estruturado com `items[].exam_name` e campos opcionais de código/categoria/instruções/urgência;
- indicação clínica, impressão/hipótese, prioridade e observações como campos estruturados opcionais;
- validação server-side na emissão;
- lifecycle/snapshots/eventos/histórico/cancelamento herdados da D2-A;
- verifier production-safe + comportamento PostgreSQL 16;
- regressão explícita dos renderers de Prescrição e Orientação.

V1 é conservadora: `exam_order` usa o mesmo requisito de identidade médica ativa + CRM/UF/registro já aplicado a `medication_prescription`, além de identidade clínica válida, `clinical.documents` e próprio Encounter ativo. Não existe auto-grant por especialidade nem bypass owner/admin.

Esse recorte não afirma que somente médicos podem solicitar exames em todo contexto regulatório. Qualquer expansão para outras profissões deve nascer em slice própria, com regra de autorização explícita, em vez de transformar profissão/especialidade em ACL implícita.

Fora desta micro-slice:

- aba/workspace `Exames` no Encounter;
- renderer A4 profissional;
- admin de templates de exam order;
- catálogo/autocomplete;
- laboratórios/integrações;
- fulfillment/status/resultados/laudos;
- Nexus emitindo pedido automaticamente.

Documento: `docs/CLINICAL_EXAM_ORDER_FOUNDATION.md`.

Próxima slice funcional após merge + rollout/verifier de D2-D0: **D2-D1 — Exam Order Encounter UX V1**.

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
11. Prescrição e Orientações estão fechadas no escopo atual; a próxima evolução documental deve nascer de um novo gap canônico, não de polimento sem blocker reproduzido.
12. Não acoplar `exam_order` documental a futuro domínio de fulfillment/resultados sem contrato explícito.
