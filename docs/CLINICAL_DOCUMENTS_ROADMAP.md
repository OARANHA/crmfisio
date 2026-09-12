# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Main canônica:** `db046f0f8b88864b18a5181b320ae346c59a4419`  
**Estado:** D1 CONCLUÍDO / D2-A VALIDADO EM PRODUÇÃO / D2-B VALIDADO EM PRODUÇÃO / D2-B.1 VALIDADO EM PRODUÇÃO / D2-B.2A PR #431 EM ANDAMENTO

---

## Princípios

```text
ENGINE != AUTHORIZATION != RELEVANCE
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
```

`clinical.documents` é gate-base clínico. Ele não concede automaticamente prescrição ou outro ato documental específico.

Profissão/especialidade podem influenciar eligibility/relevância quando houver contrato explícito, nunca funcionar como bypass de autorização.

Administração de templates pertence ao tenant; emissão de documento continua sendo ato clínico com identity + capability + autoria/contexto assistencial.

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

Não apresentar `Pedido de Exames` como template funcional antes de `exam_order` existir canonicamente.

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

Estados do documento:

```text
draft → issued → canceled
```

Regras:

- documento emitido é historicamente imutável;
- template/version usado na emissão fica congelado por referência + snapshot;
- evolução posterior do template não altera receita histórica;
- sem hard delete pós-emissão;
- cancelamento exige motivo/auditoria;
- impressão histórica usa snapshot emitido, nunca template corrente.

---

# D1 — inventário e decisão arquitetural

**CONCLUÍDO.**

Decisão preservada:

```text
Clinical Documents Foundation pequena
+
contratos tipados por document_type
```

Do MedicsPro histórico reaproveitar conceitos bons de produto — templates, medicamentos estruturados, observações, preview, impressão e histórico — nunca sua arquitetura Vue/Pinia/Mongo/Express ou ACL antiga.

---

# D2-A — Clinical Documents Foundation

**VALIDADO EM PRODUÇÃO.**

PR #425 → `0459e5908c942ac63c0dec87d517aa2131936204`.

Produção 2026-09-12:

```text
20260912_clinical_documents_foundation.sql
→ COMMIT / MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql
→ CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED
→ VERIFIER_EXIT=0
```

D2-A continua autoridade de:

- eligibility/autorização de emissão;
- lifecycle;
- persistência;
- versions/snapshots;
- histórico;
- cancelamento.

`medication_prescription` V1 exige médico elegível + CRM/UF/registro + `clinical.documents` + próprio Encounter ativo no boundary canônico.

---

# D2-B — Prescription V1

**VALIDADO EM PRODUÇÃO.**

PR #429 → `15692b47fc5bca577948a03de2a686f58d5c7dd9`.

Entregue:

- workspace Prescrição no Encounter;
- templates publicados elegíveis;
- medicamentos estruturados;
- save/resume explícito;
- revisão humana;
- issue via D2-A;
- read-only/histórico pós-emissão;
- impressão a partir de snapshots emitidos;
- estado local isolado por paciente + Encounter + usuário.

Smoke real confirmou draft/save, saída/retorno, emissão, histórico/read-only e impressão.

---

# D2-B.1 — Prescription Live Preview

**VALIDADO EM PRODUÇÃO.**

PR #430 → `db046f0f8b88864b18a5181b320ae346c59a4419`.

UX:

```text
Desktop largo:
Editor estruturado | folha da receita ao vivo

Viewport menor:
Editor
↓
folha da receita
```

Boundary:

```text
LIVE PREVIEW != ISSUED DOCUMENT
```

A prévia é marcada como rascunho sem validade, não persiste, não chama RPC e não imprime. Documento emitido continua vindo dos snapshots D2-A.

O smoke real confirmou o fluxo. A impressão atual é funcional, porém visualmente simples; a melhoria deve vir de renderer/presets seguros, não de HTML arbitrário.

---

# D2-B.2 — Prescription Templates + Professional Print

Objetivo de produto:

```text
PLATFORM
→ oferece templates seguros iniciais

CLINIC ADMIN
→ configura/clona/publica modelos da própria clínica

DOCTOR
→ escolhe modelo publicado elegível e emite

ISSUED DOCUMENT
→ nunca muda quando o template evolui
```

## D2-B.2A — Template Admin backend

**PR #431 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Base:

```text
main@db046f0f8b88864b18a5181b320ae346c59a4419
```

Escopo:

- gestão apenas de `medication_prescription` nesta etapa;
- owner/admin ativos do tenant podem administrar templates;
- administração não exige CRM nem capability clínica;
- administração não concede emissão;
- listagem administrativa separada da RLS de eligibility do médico;
- criar template clinic-owned com versão publicada;
- clonar platform/mesma-clínica para cópia independente;
- publicar nova versão append-only;
- editar metadados e active/archive;
- platform template read-only;
- cross-tenant fail-closed;
- direct mutation de tabelas continua revogada;
- versões publicadas permanecem imutáveis;
- issued snapshots permanecem imutáveis após nova versão/archive;
- renderer fechado em `clinical-document/plain-text-v1` nesta micro-slice;
- sem UI e sem produção.

Documento: `docs/CLINICAL_DOCUMENT_TEMPLATE_ADMIN.md`.

Gate:

1. behavior matrix PostgreSQL 16;
2. production-safe verifier;
3. regressões D2-A/care/auth;
4. testes/typecheck/lint/build;
5. revisão de ACL/diff;
6. Ready for Review somente após tudo verde.

## D2-B.2B — Admin UI / Template Library

**PLANEJADO após D2-B.2A estabilizada e aplicada.**

Alvo:

`Configurações → Modelos de Prescrição`

Admin poderá:

- listar modelos MedicsPro e clinic-owned;
- visualizar;
- clonar;
- criar modelo da clínica;
- editar metadados;
- publicar nova versão;
- arquivar;
- utilizar especialidade apenas como relevância/organização.

Templates platform continuam não editáveis diretamente.

## D2-B.2C — Professional Print Layout / Safe Presets

**PLANEJADO.**

Objetivo: elevar a saída impressa ao padrão profissional observado no MedicsPro histórico sem voltar a HTML arbitrário.

Presets iniciais candidatos:

- Receita Simples;
- Receita com Orientações;
- Receita Pediátrica;
- Receita Cardiológica;
- Receita Dermatológica.

O renderer deve usar layout/preset versionado e seguro. Logo/cabeçalho/rodapé/blocos poderão ser configuráveis dentro de um contrato fechado.

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
