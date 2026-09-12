# MedicsPro — Current State

> Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução. Código, schema e runtime reais prevalecem se este arquivo envelhecer; detalhes históricos ficam nos documentos de domínio.

**Data do snapshot:** 2026-09-12  
**Main canônica:** `655f535a453493052bcd175a9209418d86eaffd0`  
**Clinical Documents D2-A:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.1 Live Preview:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.2A Template Admin backend:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.2B Admin UI:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.2C Professional Print / Safe Presets:** VALIDADO EM PRODUÇÃO  
**Therapeutic Guidance D2-C:** PR #435 / EM ANDAMENTO / NÃO PRODUÇÃO  
**Clinical Encounter visual:** VALIDADO EM PRODUÇÃO

---

## Leitura obrigatória para qualquer agente

1. `AGENTS.md`
2. este arquivo
3. documento do domínio da tarefa
4. `docs/MANUAL_SOURCE_MAP.md` quando houver mudança visível ao usuário
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

Princípios obrigatórios:

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

Workspaces canônicos em produção:

```text
Registro
Anamneses & Avaliações
Prescrição
Nexus
```

A PR #435 propõe adicionar `Orientações` ao mesmo Clinical Cockpit; esse workspace ainda não deve ser tratado como produção até merge/redeploy/smoke.

Prescrição pertence ao mesmo Encounter; não cria segundo atendimento/prontuário. D2-C segue o mesmo princípio para `therapeutic_guidance`.

No boundary D2-A/#426 atualmente comprovado para autoria clínica de documentos, `appointments.fisio_id` permanece a referência efetivamente testada. Não introduzir fallback para `professional_id` sem reconciliação explícita.

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

# Clinical Documents / Prescrição

## D2-A — Clinical Documents Foundation

**VALIDADO EM PRODUÇÃO.**

PR #425 → `0459e5908c942ac63c0dec87d517aa2131936204`.

Entrega `medication_prescription` e `therapeutic_guidance`, lifecycle `draft → issued → canceled`, snapshots imutáveis, validação tipada, cancelamento auditável e authorization/RLS/RPC fail-closed.

## D2-B — Prescription V1

**VALIDADO EM PRODUÇÃO.**

PR #429 → `15692b47fc5bca577948a03de2a686f58d5c7dd9`.

Smoke real confirmou criação/salvamento/resume de draft, revisão/emissão, read-only/histórico e impressão do documento emitido.

## D2-B.1 — Prescription Live Preview

**VALIDADO EM PRODUÇÃO.**

PR #430 → `db046f0f8b88864b18a5181b320ae346c59a4419`.

Editor + folha ao vivo funcionam no mesmo Encounter. Prévia é explicitamente sem validade; documento emitido vem do snapshot D2-A.

## D2-B.2A — Prescription Template Admin backend

**VALIDADO EM PRODUÇÃO.**

PR #431 → `af7b87725a62985c0f6a38dc753b737de40b48af`.

Produção confirmada:

```text
20260912_clinical_document_template_admin.sql
→ COMMIT / MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENT_TEMPLATE_ADMIN.sql
→ CLINICAL DOCUMENT TEMPLATE ADMIN VERIFY PASSED
→ VERIFIER_EXIT=0
```

Owner/admin ativos administram templates clinic-owned via RPC sem receber autoria clínica; platform templates permanecem read-only; clone/publicação são tenant-scoped; direct table mutation e cross-tenant seguem fail-closed; versões publicadas/documentos emitidos continuam imutáveis.

## D2-B.2B — Admin UI / Template Library

**VALIDADO EM PRODUÇÃO.**

PR #432 → `8247f91ec5c35c6cf409b7356ed1c1601b961623`.

Smoke real em 2026-09-12 confirmou:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
→ Visualizar / Duplicar / Editar / Arquivar
```

Biblioteca administrativa funcional com modelos MedicsPro read-only e modelos clinic-owned, preservando a separação entre administração do template e autoria clínica.

## D2-B.2C — Professional Print Layout + Safe Presets

**VALIDADO EM PRODUÇÃO.**

PR #433 → `db364e17a158b2f1f13229ca595f6e7b24cfcab8`.

Produção confirmada em 2026-09-12:

```text
20260912_clinical_prescription_renderer_v2.sql
→ COMMIT / MIGRATION_1_EXIT=0

20260912_clinical_prescription_renderer_v2_hardening.sql
→ COMMIT / MIGRATION_2_EXIT=0

VERIFY_20260912_CLINICAL_PRESCRIPTION_RENDERER_V2.sql
→ CLINICAL PRESCRIPTION RENDERER V2 VERIFY PASSED
→ VERIFIER_EXIT=0
```

Smoke real confirmou:

- edição visual de template clinic-owned no admin;
- publicação de nova versão visual imutável;
- presets seguros `classic`, `institutional`, `compact`;
- acentos fechados `monochrome`, `navy`, `emerald`;
- preview administrativo e impressão com renderer compartilhado;
- nova emissão usando a versão visual publicada;
- impressão profissional do documento emitido;
- receita emitida preservando o layout/version snapshot mesmo após publicação posterior do template;
- HTML/CSS/JS arbitrário continua fora do contrato;
- `plain-text-v1` permanece compatível para histórico.

Contrato canônico:

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

Documento canônico: `docs/CLINICAL_PRESCRIPTION_RENDERER_V2.md`.

**D2-B / Prescrição está fechada para o escopo atual.** Não reabrir por polimento visual sem blocker reproduzido.

## D2-C — Therapeutic Guidance V1

**PR #435 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Base:

```text
main@655f535a453493052bcd175a9209418d86eaffd0
```

A slice reutiliza o document type `therapeutic_guidance` já existente na D2-A e não adiciona migration, RPC, RLS, grant ou capability.

Contrato funcional proposto:

```text
Encounter próprio ativo
→ Orientações
→ template publicado
→ draft / save / resume
→ revisão humana explícita
→ issue D2-A
→ snapshot imutável
→ histórico / impressão do rendered_snapshot emitido
```

O payload V1 permanece no contrato D2-A:

```text
items[].guidance
patient_instructions
observations
```

Ao contrário de `medication_prescription`, `therapeutic_guidance` não exige hardcode médico/CRM no contrato D2-A. Identidade clínica válida + `clinical.documents` + próprio Encounter ativo continuam obrigatórios e server-authoritative.

A prévia V1 é apenas prévia de conteúdo sem validade; a impressão histórica usa o `rendered_snapshot` emitido e não reconstrói o documento a partir do template corrente.

Documento: `docs/CLINICAL_THERAPEUTIC_GUIDANCE_V1.md`.

Não incluir `Pedido de Exames` até existir `exam_order` canônico próprio.

---

# Plataforma / tenants / configuração

Separação obrigatória:

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

Migrations/Edge Functions de produção são controladas manualmente, com revisão pinada, backup conforme risco e verifier canônico.

Estados editoriais:

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

Fechar tecnicamente a **PR #435 — D2-C Therapeutic Guidance V1** antes de qualquer merge:

1. validar testes do payload D2-C;
2. validar boundary do Clinical Cockpit/Encounter;
3. rodar `npm test`, typecheck, lint e build;
4. dependency audit;
5. Clinical Foundation/Auth/Encounter regressions;
6. Nexus C-01/C-02/C-03/C-04/C-06 sem relaxamento;
7. revisar o diff final e a ausência de backend/schema novo;
8. remover draft somente após tudo verde;
9. parar para revisão antes de merge/produção.
