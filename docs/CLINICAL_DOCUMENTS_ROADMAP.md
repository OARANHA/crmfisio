# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Main canônica:** `af7b87725a62985c0f6a38dc753b737de40b48af`  
**Estado:** D1 CONCLUÍDO / D2-A PROD / D2-B PROD / D2-B.1 PROD / D2-B.2A PROD / D2-B.2B PR #432 EM ANDAMENTO

---

## Princípios

```text
ENGINE != AUTHORIZATION != RELEVANCE
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
```

`clinical.documents` é gate-base clínico. Não concede automaticamente prescrição ou outro ato documental específico.

Especialidade pode influenciar relevância/ordenação, nunca funcionar como bypass de autorização.

Administração de templates pertence ao tenant; emissão continua sendo ato clínico com identity + capability + autoria/contexto assistencial.

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

Documento emitido é historicamente imutável. Evolução posterior do template não altera receita histórica. Impressão histórica deve usar snapshots emitidos, nunca o template corrente.

---

# D1 — inventário e decisão arquitetural

**CONCLUÍDO.**

Decisão:

```text
Clinical Documents Foundation pequena
+
contratos tipados por document_type
```

Do MedicsPro histórico reaproveitar conceitos de produto — templates, medicamentos estruturados, observações, preview, impressão e histórico — nunca sua arquitetura/ACL antiga.

---

# D2-A — Clinical Documents Foundation

**VALIDADO EM PRODUÇÃO.**

PR #425 → `0459e5908c942ac63c0dec87d517aa2131936204`.

Produção:

```text
20260912_clinical_documents_foundation.sql
→ COMMIT / MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql
→ CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED
→ VERIFIER_EXIT=0
```

D2-A permanece autoridade de eligibility, lifecycle, persistência, versions/snapshots, histórico e cancelamento.

`medication_prescription` exige médico elegível + CRM/UF/registro + `clinical.documents` + próprio Encounter ativo no boundary canônico.

---

# D2-B — Prescription V1

**VALIDADO EM PRODUÇÃO.**

PR #429 → `15692b47fc5bca577948a03de2a686f58d5c7dd9`.

Entregue: workspace Prescrição, medicamentos estruturados, save/resume explícito, revisão humana, issue D2-A, read-only/histórico e impressão baseada em snapshots emitidos.

Smoke real confirmou o fluxo.

---

# D2-B.1 — Prescription Live Preview

**VALIDADO EM PRODUÇÃO.**

PR #430 → `db046f0f8b88864b18a5181b320ae346c59a4419`.

```text
LIVE PREVIEW != ISSUED DOCUMENT
```

A prévia é marcada como rascunho sem validade, não persiste, não chama RPC e não imprime. Documento emitido continua vindo dos snapshots D2-A.

O smoke confirmou a UX e evidenciou o próximo gap: impressão funcional, porém simples.

---

# D2-B.2 — Prescription Templates + Professional Print

Objetivo:

```text
PLATFORM
→ oferece modelos seguros

CLINIC ADMIN
→ configura/clona modelos do tenant

DOCTOR
→ escolhe modelo publicado elegível e emite

ISSUED DOCUMENT
→ nunca muda quando o template evolui
```

## D2-B.2A — Template Admin backend

**VALIDADO EM PRODUÇÃO.**

PR #431 → `af7b87725a62985c0f6a38dc753b737de40b48af`.

Produção:

```text
20260912_clinical_document_template_admin.sql
→ COMMIT / MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENT_TEMPLATE_ADMIN.sql
→ CLINICAL DOCUMENT TEMPLATE ADMIN VERIFY PASSED
→ VERIFIER_EXIT=0
```

Entregue:

- gestão apenas de `medication_prescription` nesta etapa;
- owner/admin ativos administram templates do próprio tenant;
- administração não exige CRM/capability clínica e não concede emissão;
- listagem administrativa separada da eligibility do médico;
- criar/clone/versionar/metadados/archive;
- platform read-only;
- cross-tenant fail-closed;
- direct mutation de tabelas continua revogada;
- versões publicadas e issued snapshots continuam imutáveis;
- renderer fechado em `clinical-document/plain-text-v1`.

Documento: `docs/CLINICAL_DOCUMENT_TEMPLATE_ADMIN.md`.

## D2-B.2B — Admin UI / Template Library

**PR #432 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Alvo:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
```

Admin:

- lista modelos MedicsPro e clinic-owned;
- visualiza exemplo estrutural;
- duplica platform → clinic-owned;
- cria modelo da clínica;
- edita nome/descrição/especialidade-relevância;
- arquiva/reativa.

Boundary:

- frontend consome somente RPCs D2-B.2A;
- sem grants diretos;
- sem nova migration/RLS/RPC;
- sem editor HTML/CSS;
- especialidade continua relevância, nunca autorização;
- prévia administrativa não finge ser novo renderer de impressão.

## D2-B.2C — Professional Print Layout / Safe Presets

**PLANEJADO após estabilização da #432.**

Objetivo: elevar a saída impressa ao padrão profissional observado no MedicsPro histórico sem voltar a HTML arbitrário.

Direção:

- `render_definition` versionado e fechado;
- presets visuais seguros;
- preview fiel ao preset publicado;
- contexto emitido congela os dados necessários de paciente/clínica/profissional;
- histórico renderiza somente dados/snapshots congelados;
- nenhuma alteração retroativa em documentos emitidos.

Presets candidatos iniciais:

- Receita Simples;
- Receita com Orientações;
- Receita Compacta/Clássica como variações visuais seguras.

Especialidades podem ordenar/sugerir modelos; não devem criar ACL nem modelos ficticiamente diferentes sem necessidade clínica real.

---

# D2-C — Therapeutic Guidance V1

**PLANEJADO.**

Reutilizará D2-A depois de estabilizada a trilha de Prescrição. Não misturar exames, atestados e relatórios na mesma slice.

---

## Regras de continuidade

1. D2-A não deve ser redesenhada sem blocker reproduzido.
2. Não criar Prescription Engine paralelo.
3. Não tornar especialidade uma ACL.
4. Não transformar template admin em autorização clínica.
5. Não expor HTML/CSS/JS arbitrário como fonte de documento clínico.
6. Produção só vira `VALIDADO EM PRODUÇÃO` com evidência real.
7. Após cada slice, revisar `docs/CURRENT_STATE.md`, documento de domínio e `docs/MANUAL_SOURCE_MAP.md` quando houver mudança visível.
8. Migrations de produção são controladas; merge não significa aplicação.
9. Consultar `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` e `docs/CLINICAL_TOOLING_REUSE_PLAN.md` antes de reinventar ferramenta clínica existente.
