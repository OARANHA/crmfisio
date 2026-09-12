# MedicsPro — Current State

> Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução. Código, schema e runtime reais prevalecem se este arquivo envelhecer; detalhes históricos ficam nos documentos de domínio.

**Data do snapshot:** 2026-09-12  
**Main canônica:** `af7b87725a62985c0f6a38dc753b737de40b48af`  
**Clinical Documents D2-A:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.1 Live Preview:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.2A Template Admin backend:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.2B Admin UI:** PR #432 / EM ANDAMENTO / NÃO PRODUÇÃO  
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
- `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`
- `docs/CLINICAL_DOCUMENTS_FOUNDATION.md`
- `docs/CLINICAL_DOCUMENTS_ROADMAP.md`
- `docs/CLINICAL_PRESCRIPTION_V1.md`
- `docs/CLINICAL_DOCUMENT_TEMPLATE_ADMIN.md`
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
```

Especialidade pode alterar relevância/ordenação. Não concede ACL.

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

Prescrição pertence ao mesmo Encounter; não cria segundo atendimento/prontuário.

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

```text
20260912_clinical_documents_foundation.sql
→ COMMIT / MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql
→ CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED
→ VERIFIER_EXIT=0
```

Entrega `medication_prescription` e `therapeutic_guidance`, lifecycle `draft → issued → canceled`, snapshots imutáveis, validação tipada, cancelamento auditável e authorization/RLS/RPC fail-closed.

## D2-B — Prescription V1

**VALIDADO EM PRODUÇÃO.**

PR #429 → `15692b47fc5bca577948a03de2a686f58d5c7dd9`.

Smoke real confirmou criação/salvamento/resume de draft, revisão/emissão, read-only/histórico e impressão do documento emitido.

## D2-B.1 — Prescription Live Preview

**VALIDADO EM PRODUÇÃO.**

PR #430 → `db046f0f8b88864b18a5181b320ae346c59a4419`.

Editor + folha ao vivo funcionam no mesmo Encounter. Prévia permanece explicitamente sem validade e não imprime; documento emitido continua vindo do snapshot D2-A.

Observação confirmada no smoke: a impressão atual é funcional, porém simples demais para o padrão desejado. Melhorias devem vir por renderer/presets seguros, nunca HTML arbitrário.

## D2-B.2A — Prescription Template Admin backend

**VALIDADO EM PRODUÇÃO.**

PR #431 squash-mergeada em:

```text
af7b87725a62985c0f6a38dc753b737de40b48af
```

Produção confirmada em 2026-09-12:

```text
20260912_clinical_document_template_admin.sql
→ COMMIT
→ MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENT_TEMPLATE_ADMIN.sql
→ CLINICAL DOCUMENT TEMPLATE ADMIN VERIFY PASSED
→ ROLLBACK intencional do verifier
→ VERIFIER_EXIT=0
```

Contrato entregue:

- owner/admin ativos administram templates `medication_prescription` da própria clínica por RPC;
- gestão não exige CRM/capability clínica e não concede emissão;
- platform templates read-only;
- clone platform → cópia independente clinic-owned;
- publicação append-only;
- metadados + `active|archived`;
- direct table mutation continua revogada;
- cross-tenant fail-closed;
- published versions e documentos emitidos permanecem historicamente imutáveis;
- renderer segue fechado em `clinical-document/plain-text-v1`.

## D2-B.2B — Admin UI / Template Library

**PR #432 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Branch:

```text
feat/clinical-prescription-template-admin-d2b2b
```

Base:

```text
main@af7b87725a62985c0f6a38dc753b737de40b48af
```

Alvo visível:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
```

Escopo:

- listar modelos MedicsPro e clinic-owned;
- visualizar exemplo estrutural sem dados reais de paciente;
- criar modelo da clínica;
- duplicar platform → clinic-owned;
- editar nome/descrição/especialidade-relevância;
- arquivar/reativar;
- usar exclusivamente os RPCs D2-B.2A;
- nenhuma migration/RLS/RPC nova;
- sem editor HTML/CSS;
- especialidade continua relevância, nunca autorização.

Não confundir a prévia administrativa B.2B com o futuro Professional Print Layout. O renderer publicado continua `plain-text-v1` até slice explícita de presets seguros.

Próxima slice após B.2B estabilizada:

1. D2-B.2C — Professional Print Layout + safe presets versionados;
2. D2-C — Therapeutic Guidance V1.

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

Frontend: React + TypeScript + Vite em Docker/Nginx/Portainer. `main` pode resultar em deploy do app.

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

Fechar tecnicamente a **PR #432 — D2-B.2B Prescription Template Admin UI**:

1. testes de client/mapping e boundary;
2. validar ConfigPremium;
3. typecheck/lint/build;
4. revisar que não existe escrita direta em tabelas clínicas;
5. atualizar documentação/PR com head final;
6. somente então Ready for Review.

Nenhuma ação de servidor é necessária nesta slice frontend-only.
