# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Base canônica desta slice:** `main@49cee461f970a3630c4fd98ab93a1ac476798e74`  
**Estado:** D1 CONCLUÍDO / D2-A PROD / D2-B PROD / D2-B.1 PROD / D2-B.2A PROD / D2-B.2B PROD / D2-B.2C PROD / D2-C PROD / D2-C.1 PROD / D2-D0 PROD / D2-D1 PROD / D2-D2 PR #440 — NÃO PROD

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

Produção contém:

- `medication_prescription`
- `therapeutic_guidance`
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

`exam_order` reutiliza a mesma fundação e, no V1, adota requisito médico/CRM conservador equivalente ao de `medication_prescription`.

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
- orientações, instruções e observações estruturados;
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

**VALIDADO EM PRODUÇÃO.**

Merge: `main@2f4fea83dbb1085c7bea2309ccd4dd1b8bc846db`.

Decisão:

```text
Pedido de Exames != template de Orientação
Pedido de Exames = exam_order canônico próprio
```

Foundation entregue:

- `exam_order` no conjunto fechado de `document_type`;
- template platform `Pedido de exames` com versão publicada imutável;
- payload estruturado com `items[].exam_name` e campos opcionais de código/categoria/instruções/urgência;
- indicação clínica, impressão/hipótese, prioridade e observações como campos estruturados opcionais;
- validação server-side na emissão;
- lifecycle/snapshots/eventos/histórico/cancelamento herdados da D2-A;
- verifier production-safe + comportamento PostgreSQL 16;
- regressão explícita dos renderers de Prescrição e Orientação.

V1 é conservadora: `exam_order` usa identidade médica ativa + CRM/UF/registro, além de identidade clínica válida, `clinical.documents` e próprio Encounter ativo. Não existe auto-grant por especialidade nem bypass owner/admin.

Esse recorte não afirma que somente médicos podem solicitar exames em todo contexto regulatório. Qualquer expansão para outras profissões deve nascer em slice própria, com regra de autorização explícita, em vez de transformar profissão/especialidade em ACL implícita.

Rollout validado em 2026-09-12:

```text
backup
→ /root/medicspro_before_d2d0_20260912_213628.dump

migration
→ COMMIT

verifier
→ CLINICAL EXAM ORDER FOUNDATION VERIFY PASSED
→ VERIFIER_EXIT=0
```

Documento: `docs/CLINICAL_EXAM_ORDER_FOUNDATION.md`.

---

# D2-D1 — Exam Order Encounter UX V1

**VALIDADO EM PRODUÇÃO.**

PR #439 → `49cee461f970a3630c4fd98ab93a1ac476798e74`.

Fluxo:

```text
Encounter próprio ativo
→ Exames
→ template exam_order publicado
→ draft estruturado
→ múltiplos exames
→ prioridade / indicação / impressão / observações
→ save / resume
→ revisão humana explícita
→ issue D2-A
→ snapshots imutáveis
→ histórico
```

UX entregue:

- aba `Exames` no mesmo Clinical Cockpit;
- múltiplos itens por pedido;
- categoria/código/instruções opcionais;
- atalhos de categoria;
- urgência por item;
- prioridade global `routine|high|urgent` apresentada como `Rotina|Alta|Urgente`;
- indicação clínica;
- hipótese/impressão;
- observações;
- revisão humana explícita;
- histórico do Encounter e histórico anterior.

A UI usa eligibility server-side `current_user_can_issue_clinical_document('exam_order')`; capability/relevância no frontend não substituem o servidor.

D2-D1 não criou migration, não alterou RLS/RPC/grants e não adicionou engine documental paralelo. O frontend foi redeployado e o smoke em produção confirmou a aba `Exames`, emissão real e histórico por snapshot. A ausência de impressão profissional observada nesse smoke era escopo reservado à D2-D2.

Documento: `docs/CLINICAL_EXAM_ORDER_ENCOUNTER_V1.md`.

---

# D2-D2 — Exam Order Professional Print Renderer V1

**PR #440 — IMPLEMENTADO / NÃO PRODUÇÃO.**

Base: `main@49cee461f970a3630c4fd98ab93a1ac476798e74`.

Contrato visual novo:

```text
clinical-document/exam-order-v1
```

Entrega da slice:

- nova versão publicada e imutável do template platform `Pedido de exames`;
- versão histórica v1 `clinical-document/plain-text-v1` preservada;
- preview A4 real no workspace;
- mesma composição segura no draft e no print emitido;
- clínica/paciente/profissional/conselho/UF/registro/especialidade/data;
- prioridade e lista estruturada de exames;
- categoria/código/instruções/urgência por item;
- indicação clínica, hipótese/impressão e observações;
- espaço explícito para assinatura do profissional solicitante;
- botão `Imprimir` no histórico emitido;
- impressão baseada em `payload_snapshot + context_snapshot + template_definition_snapshot`;
- fallback seguro que mantém pedidos históricos no snapshot/layout original;
- contrato de renderer fechado, code-owned, sem HTML/CSS/JS arbitrário;
- todo conteúdo dinâmico escapado;
- verifier e comportamento PostgreSQL 16 próprios.

D2-D2 não altera eligibility, autoria, RLS, RPCs, grants, roles, capability, lifecycle ou o recorte médico/CRM conservador estabelecido por D2-D0.

A slice também mantém separados `Exam Order` documental e qualquer futuro domínio de fulfillment/resultados/laboratório/imagem.

Documento: `docs/CLINICAL_EXAM_ORDER_RENDERER_V1.md`.

Rollout de produção somente após merge e gates verdes:

```text
backup controlado
→ migration pinada ao SHA mergeado
→ VERIFY_20260912_CLINICAL_EXAM_ORDER_RENDERER_V1.sql
→ redeploy frontend
→ smoke A4 / emissão / histórico / Imprimir / assinatura
→ regressão visual de pedido histórico plain-text-v1
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
11. Prescrição e Orientações estão fechadas no escopo atual; a próxima evolução documental deve nascer de um novo gap canônico, não de polimento sem blocker reproduzido.
12. Não acoplar `exam_order` documental a futuro domínio de fulfillment/resultados sem contrato explícito.
