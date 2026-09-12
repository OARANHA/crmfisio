# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Main canônica:** `655f535a453493052bcd175a9209418d86eaffd0`  
**Estado:** D1 CONCLUÍDO / D2-A PROD / D2-B PROD / D2-B.1 PROD / D2-B.2A PROD / D2-B.2B PROD / D2-B.2C PROD / D2-C PR #435 EM ANDAMENTO

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

Do MedicsPro histórico reaproveitar conceitos de produto — templates, medicamentos estruturados, observações, preview, impressão e histórico — nunca sua arquitetura/ACL antiga nem HTML livre como fonte documental.

---

# D2-A — Clinical Documents Foundation

**VALIDADO EM PRODUÇÃO.**

PR #425 → `0459e5908c942ac63c0dec87d517aa2131936204`.

D2-A permanece autoridade de eligibility, lifecycle, persistência, versions/snapshots, histórico e cancelamento.

`medication_prescription` exige médico elegível + CRM/UF/registro + `clinical.documents` + próprio Encounter ativo no boundary canônico.

`therapeutic_guidance` reutiliza o mesmo boundary-base clínico, mas não possui o requisito adicional médico/CRM da prescrição medicamentosa.

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
→ Visualizar / Duplicar / Editar / Arquivar
```

Admin consegue listar modelos MedicsPro/clinic-owned, criar, duplicar, editar metadados, visualizar e arquivar/reativar sem receber autoridade clínica.

## D2-B.2C — Professional Print Layout / Safe Presets

**VALIDADO EM PRODUÇÃO.**

PR #433 → `db364e17a158b2f1f13229ca595f6e7b24cfcab8`.

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

Runtime validado:

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

Smoke real comprovou:

- edição visual segura de template clinic-owned;
- publicação de nova versão visual;
- persistência do preset publicado;
- preview administrativo coerente com o contrato de impressão;
- emissão nova usando a versão publicada;
- impressão profissional;
- documento já emitido permanecendo com o layout/version snapshot original após evolução posterior do template;
- platform templates somente leitura;
- HTML/CSS/JS arbitrário fora do contrato;
- `plain-text-v1` preservado para histórico/compatibilidade.

Resultado canônico:

```text
Template v2
→ documento A emitido
→ snapshot v2 congelado

Template evolui para v3
→ documento A continua v2
→ documentos novos usam v3
```

Documento: `docs/CLINICAL_PRESCRIPTION_RENDERER_V2.md`.

**Prescrição D2-B está fechada no escopo atual.** Polimento adicional só deve reabrir a família com evidência concreta de problema de produto, segurança ou integridade.

---

# D2-C — Therapeutic Guidance V1

**PR #435 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Base:

```text
main@655f535a453493052bcd175a9209418d86eaffd0
```

A implementação reutiliza integralmente D2-A; não cria engine paralelo, migration, RLS, RPC, grant ou capability novos.

Fluxo implementado na PR:

```text
Encounter próprio ativo
→ Orientações
→ template therapeutic_guidance publicado
→ draft estruturado
→ save / resume
→ revisão humana explícita
→ issue D2-A
→ snapshot imutável
→ histórico / impressão do rendered_snapshot
```

Payload V1:

```text
items[].guidance
patient_instructions
observations
```

Regras:

- draft pode permanecer incompleto;
- emissão exige `items` não vazio e todo `guidance` não vazio, conforme validator D2-A;
- `patient_instructions` e `observations` são opcionais;
- UI não inventa conteúdo clínico;
- `clinical.documents` continua gate-base, mas servidor valida identidade + próprio Encounter ativo;
- não há hardcode médico/CRM para guidance;
- especialidade não concede autoria;
- Nexus não emite orientação automaticamente;
- prévia V1 é apenas conteúdo sem validade;
- impressão histórica usa `rendered_snapshot` congelado, sem reaplicar template corrente.

Templates platform D2-A já existentes:

- `Orientação terapêutica geral`;
- `Orientações pós-atendimento`.

Documento: `docs/CLINICAL_THERAPEUTIC_GUIDANCE_V1.md`.

Antes de sair de draft, a PR deve fechar testes, typecheck, lint, build, dependency audit e regressões Clinical Foundation/Auth/Encounter + Nexus C-01/C-02/C-03/C-04/C-06.

Após merge/redeploy, somente smoke real poderá promover D2-C a `VALIDADO EM PRODUÇÃO`.

---

## Regras de continuidade

1. D2-A não deve ser redesenhada sem blocker reproduzido.
2. Não criar Prescription/Clinical Documents Engine paralelo.
3. Não tornar especialidade uma ACL.
4. Não transformar template admin em autorização clínica.
5. Não expor HTML/CSS/JS arbitrário como fonte de documento clínico.
6. Preview administrativo e impressão devem obedecer ao mesmo contrato versionado quando aplicável.
7. Produção só vira `VALIDADO EM PRODUÇÃO` com evidência real.
8. Após cada slice, revisar `docs/CURRENT_STATE.md`, documento de domínio e `docs/MANUAL_SOURCE_MAP.md` quando houver mudança visível.
9. Migrations de produção são controladas; merge não significa aplicação.
10. Consultar `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` e `docs/CLINICAL_TOOLING_REUSE_PLAN.md` antes de reinventar ferramenta clínica existente.
