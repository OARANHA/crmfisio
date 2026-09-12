# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Main canônica:** `8247f91ec5c35c6cf409b7356ed1c1601b961623`  
**Estado:** D1 CONCLUÍDO / D2-A PROD / D2-B PROD / D2-B.1 PROD / D2-B.2A PROD / D2-B.2B PROD / D2-B.2C PR #433 EM ANDAMENTO

---

## Princípios

```text
ENGINE != AUTHORIZATION != RELEVANCE
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
PREVIEW == PRINT CONTRACT
ISSUED DOCUMENT != CURRENT TEMPLATE
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

Do MedicsPro histórico reaproveitar conceitos de produto — templates, medicamentos estruturados, observações, preview, impressão e histórico — nunca sua arquitetura/ACL antiga nem HTML livre como fonte documental.

---

# D2-A — Clinical Documents Foundation

**VALIDADO EM PRODUÇÃO.**

PR #425 → `0459e5908c942ac63c0dec87d517aa2131936204`.

D2-A permanece autoridade de eligibility, lifecycle, persistência, versions/snapshots, histórico e cancelamento.

`medication_prescription` exige médico elegível + CRM/UF/registro + `clinical.documents` + próprio Encounter ativo no boundary canônico.

---

# D2-B — Prescription V1

**VALIDADO EM PRODUÇÃO.**

PR #429 → `15692b47fc5bca577948a03de2a686f58d5c7dd9`.

Entregue: workspace Prescrição, medicamentos estruturados, save/resume explícito, revisão humana, issue D2-A, read-only/histórico e impressão baseada em snapshots emitidos.

---

# D2-B.1 — Prescription Live Preview

**VALIDADO EM PRODUÇÃO.**

PR #430 → `db046f0f8b88864b18a5181b320ae346c59a4419`.

A prévia é marcada como rascunho sem validade. O smoke confirmou a UX e evidenciou o gap seguinte: impressão funcional, porém simples.

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

Entregue:

- owner/admin ativos administram templates do próprio tenant;
- administração não exige CRM/capability clínica e não concede emissão;
- listagem administrativa separada da eligibility do médico;
- criar/clone/versionar/metadados/archive;
- platform read-only;
- cross-tenant fail-closed;
- direct mutation de tabelas continua revogada;
- versões publicadas e issued snapshots continuam imutáveis.

## D2-B.2B — Admin UI / Template Library

**VALIDADO EM PRODUÇÃO.**

PR #432 → `8247f91ec5c35c6cf409b7356ed1c1601b961623`.

Smoke real confirmou:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
→ Visualizar
```

Admin consegue listar modelos MedicsPro/clinic-owned, criar, duplicar, editar metadados, visualizar e arquivar/reativar sem receber autoridade clínica.

O smoke também confirmou que a experiência precisava evoluir para uma edição visual próxima do fluxo maduro do MedicsPro histórico, mas sem copiar `v-html`/substituição livre de variáveis.

## D2-B.2C — Professional Print Layout / Safe Presets

**PR #433 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Base:

```text
main@8247f91ec5c35c6cf409b7356ed1c1601b961623
```

Branch:

```text
feat/clinical-prescription-print-presets-d2b2c
```

Contrato:

```text
clinical-document/prescription-v2
```

Presets:

- `classic`
- `institutional`
- `compact`

Acentos:

- `monochrome`
- `navy`
- `emerald`

Medicamentos:

- `numbered`
- `cards`

Direção de runtime:

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

Escopo:

- renderer compartilhado frontend para preview administrativo, draft e impressão;
- edição visual por drawer com título/preset/acento/blocos seguros;
- sem editor HTML/CSS/JS;
- dados dinâmicos escapados;
- template clinic-owned publica nova versão somente quando apresentação muda;
- receitas emitidas permanecem pinadas ao template_version/snapshot usados na emissão;
- novas emissões congelam nome/nascimento do paciente, clínica e identidade profissional necessárias à impressão;
- platform templates curados iniciais: Receita simples, Receita com orientações e Receita compacta;
- `plain-text-v1` continua válido para histórico/compatibilidade com fallback visual seguro;
- nenhum novo `document_type`.

Documento: `docs/CLINICAL_PRESCRIPTION_RENDERER_V2.md`.

Gate:

1. PostgreSQL 16 D2-B.2C;
2. regressão D2-B.2A;
3. regressão D2-A/care/auth;
4. unit/boundary tests do renderer compartilhado;
5. typecheck/lint/build;
6. revisão de ACL/snapshots/diff;
7. Ready for Review somente após tudo verde.

---

# D2-C — Therapeutic Guidance V1

**PLANEJADO após D2-B.2C estabilizada e validada.**

Reutilizará D2-A. Não misturar exames, atestados e relatórios na mesma slice.

---

## Regras de continuidade

1. D2-A não deve ser redesenhada sem blocker reproduzido.
2. Não criar Prescription Engine paralelo.
3. Não tornar especialidade uma ACL.
4. Não transformar template admin em autorização clínica.
5. Não expor HTML/CSS/JS arbitrário como fonte de documento clínico.
6. Preview administrativo e impressão devem obedecer ao mesmo contrato versionado.
7. Produção só vira `VALIDADO EM PRODUÇÃO` com evidência real.
8. Após cada slice, revisar `docs/CURRENT_STATE.md`, documento de domínio e `docs/MANUAL_SOURCE_MAP.md` quando houver mudança visível.
9. Migrations de produção são controladas; merge não significa aplicação.
10. Consultar `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` e `docs/CLINICAL_TOOLING_REUSE_PLAN.md` antes de reinventar ferramenta clínica existente.