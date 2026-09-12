# MedicsPro — Current State

> Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução. Código, schema e runtime reais prevalecem se este arquivo envelhecer; detalhes históricos ficam nos documentos de domínio.

**Data do snapshot:** 2026-09-12  
**Main canônica:** `af53bf2d7229c238335ab201f3438f44543f7f89`  
**Clinical Documents D2-A:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B / D2-B.1 / D2-B.2A / D2-B.2B / D2-B.2C:** VALIDADO EM PRODUÇÃO  
**Therapeutic Guidance D2-C / D2-C.1 Professional Print:** VALIDADO EM PRODUÇÃO  
**Clinical Encounter visual:** VALIDADO EM PRODUÇÃO

---

## Leitura obrigatória para qualquer agente

1. `AGENTS.md`
2. este arquivo
3. documento do domínio da tarefa
4. `docs/MANUAL_SOURCE_MAP.md` quando houver mudança visível
5. `docs/CLINICAL_TOOLING_REUSE_PLAN.md` para Nexus/reuso clínico

Referências principais:

- `docs/ASSESSMENT_ENGINE.md`
- `docs/MEDICSPRO_ASSESSMENT_LIBRARY_V1.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`
- `docs/CLINICAL_DOCUMENTS_FOUNDATION.md`
- `docs/CLINICAL_DOCUMENTS_ROADMAP.md`
- `docs/CLINICAL_PRESCRIPTION_V1.md`
- `docs/CLINICAL_DOCUMENT_TEMPLATE_ADMIN.md`
- `docs/CLINICAL_PRESCRIPTION_RENDERER_V2.md`
- `docs/CLINICAL_THERAPEUTIC_GUIDANCE_V1.md`
- `docs/CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.md`
- `docs/NEXUS_GAP_MAP.md`
- `docs/CLINICAL_TOOLING_REUSE_PLAN.md`

Institucionalmente:

```text
OARANHA/crmfisio = runtime canônico
OARANHA/medicspro = referência histórica de produto/UX/workflow
OARANHA/nexus = upstream/laboratório de inteligência clínica
```

---

# Regras arquiteturais que não podem regredir

Papéis operacionais: `owner`, `admin`, `professional`, `recep`, `financeiro`.

`platform_admin` é domínio separado e não recebe acesso implícito aos dados do tenant.

`role` não é profissão. Autorização clínica combina tenant, profile ativo, identidade profissional, conselho/registro quando aplicável, capability e autoria/relação assistencial.

```text
ENGINE != AUTHORIZATION != RELEVANCE
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
PREVIEW == PRINT CONTRACT
ISSUED DOCUMENT != CURRENT TEMPLATE
```

Especialidade altera relevância/organização, nunca ACL.

```text
Nexus = cálculo/instrumento/evidência/farmacologia/apoio à decisão
Assessment Engine = anamneses e avaliações estruturadas
Clinical Documents = atos documentais explícitos do profissional
Clinical Cockpit = composição da experiência no Encounter
```

---

# Clinical Cockpit / Encounter

Workspaces canônicos validados em produção:

```text
Registro
Anamneses & Avaliações
Prescrição
Orientações
Nexus
```

Prescrição e Orientações pertencem ao mesmo Encounter; não criam segundo atendimento/prontuário.

No boundary D2-A/#426 efetivamente testado para autoria de documentos, `appointments.fisio_id` permanece a referência canônica atual. Não introduzir fallback para `professional_id` sem reconciliação explícita.

O guard temporal #399/#400 continua vigente.

---

# Anamneses & Avaliações

**VALIDADO EM PRODUÇÃO.**

Assessment Engine é a fundação única para anamneses/avaliações estruturadas, com templates platform/clinic, versões publicadas imutáveis, draft/resume, finalização e histórico.

Biblioteca V1 validada:

- Anamnese Médica Geral
- Anamnese Psiquiátrica

Diretriz UX: `click-first, prose-when-needed`.

---

# Nexus

Nexus permanece domínio clínico especializado, não segundo prontuário.

- hardening C-01–C-06 integrado;
- PHQ-9/GAD-7 preservam identidade/versionamento/scoring no Nexus;
- `nexus.*` fail-closed;
- resultado Nexus não gera prescrição/conduta automaticamente;
- ativos upstream devem ser absorvidos seletivamente.

---

# Clinical Documents

## D2-A — Clinical Documents Foundation

**VALIDADO EM PRODUÇÃO.**

PR #425 → `0459e5908c942ac63c0dec87d517aa2131936204`.

Entrega `medication_prescription` e `therapeutic_guidance`, lifecycle `draft → issued → canceled`, snapshots imutáveis, validação tipada, cancelamento auditável e authorization/RLS/RPC fail-closed.

## D2-B — Prescription family

**VALIDADO EM PRODUÇÃO.**

Marcos:

```text
#429 Prescription V1
#430 Live Preview
#431 Template Admin backend
#432 Admin UI
#433 Professional Print / Safe Presets
```

D2-B.2C merge canônico: `db364e17a158b2f1f13229ca595f6e7b24cfcab8`.

Produção confirmou migration base + hardening, verifier oficial, editor visual, presets seguros, emissão/impressão profissional e imutabilidade histórica do layout.

Contrato:

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

**D2-B está fechada no escopo atual.** Não reabrir por polimento sem blocker reproduzido.

## D2-C — Therapeutic Guidance V1

**VALIDADO EM PRODUÇÃO.**

PR #435 → `33da15230cd35179681406b212e87305618a4976`.

Contrato funcional:

```text
Encounter próprio ativo
→ Orientações
→ template published
→ draft / save / resume
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

`therapeutic_guidance` não exige hardcode médico/CRM; a autoridade continua server-side por identidade clínica válida + `clinical.documents` + próprio Encounter ativo.

## D2-C.1 — Therapeutic Guidance Professional Print Renderer V1

**VALIDADO EM PRODUÇÃO.**

PR #436 → `af53bf2d7229c238335ab201f3438f44543f7f89`.

Layout:

```text
clinical-document/therapeutic-guidance-v1
```

Entrega validada:

- preview A4 real no workspace;
- mesma composição segura no draft e no print emitido;
- clínica/paciente/profissional/conselho/registro/data/assinatura;
- itens, instruções e observações estruturados;
- novas versões imutáveis dos dois templates platform de guidance;
- impressão nova baseada em `payload_snapshot + context_snapshot + template_definition_snapshot`;
- fallback seguro para documentos históricos `plain-text-v1`;
- nenhuma expansão de RLS/RPC/grants/capabilities/autoria;
- nenhum HTML/CSS/JS administrável;
- ausência do rótulo técnico `therapeutic_guidance` na saída para o paciente.

Produção em 2026-09-12:

```text
backup: /root/medicspro_before_d2c1_20260912_194049.dump
migration: COMMIT / MIGRATION_EXIT=0
verifier: CLINICAL THERAPEUTIC GUIDANCE RENDERER V1 VERIFY PASSED
VERIFIER_EXIT=0
frontend: redeploy concluído
smoke: preview A4 + emissão/histórico/impressão profissional confirmados
```

O campo genérico `renderer_version` não foi reescrito nesta slice; a versão visual efetiva fica congelada em `template_definition_snapshot.render_definition.layout`.

Documento: `docs/CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.md`.

Não incluir `Pedido de Exames` até existir `exam_order` canônico próprio.

---

# Plataforma / tenants / configuração

```text
PLATFORM ENTITLEMENT
→ CLINIC CONFIGURATION
→ USER AUTHORIZATION / CAPABILITY
→ RESOURCE / ENCOUNTER CONTEXT
```

Platform Admin administra o SaaS; owner/admin administram o tenant; nenhuma dessas funções cria autoria clínica implicitamente.

---

# Financeiro

Direção preservada:

```text
Atendimento finalizado
→ pacote/cobrança
→ contas a receber / pagamentos
→ baixa / resolução
→ relatórios
```

A fundação financeira já é extensa. Não reabrir sem evidência/escopo fresco.

---

# Deploy / produção

Frontend: React + TypeScript + Vite em Docker/Nginx/Portainer.

Supabase é stack separada. Merge não significa migration aplicada.

Migrations de produção são controladas manualmente, pinadas ao SHA mergeado, com backup/verifier quando aplicável.

```text
VALIDADO EM PRODUÇÃO
MERGEADO / NÃO VALIDADO EM PRODUÇÃO
IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / DEPRECATED
```

Produção só vira `VALIDADO EM PRODUÇÃO` com evidência real.

---

## Próximo passo imediato

D2-C/D2-C.1 estão fechadas para o escopo atual. Antes de abrir outro `document_type`, escolher a próxima slice a partir do roadmap canônico e do gap de produto real, sem reabrir Prescrição ou Orientações por polimento visual sem blocker reproduzido.
