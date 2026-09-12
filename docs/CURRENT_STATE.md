# MedicsPro — Current State

> Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução. Código, schema e runtime reais prevalecem se este arquivo envelhecer. Para histórico e detalhes, use os documentos de domínio; este arquivo não é changelog.

**Data do snapshot:** 2026-09-12  
**Main canônica:** `db046f0f8b88864b18a5181b320ae346c59a4419`  
**Clinical Documents D2-A:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.1 Live Preview:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B.2A Template Admin backend:** PR #431 / EM ANDAMENTO / NÃO PRODUÇÃO  
**Clinical Encounter visual:** VALIDADO EM PRODUÇÃO

---

## Leitura obrigatória para qualquer agente

1. `AGENTS.md`
2. este arquivo
3. documento do domínio da tarefa
4. `docs/MANUAL_SOURCE_MAP.md` quando a mudança alterar comportamento visível ao usuário
5. `docs/CLINICAL_TOOLING_REUSE_PLAN.md` para Nexus, ferramenta clínica ou reaproveitamento do MedicsPro histórico

Referências clínicas principais:

- `docs/ASSESSMENT_ENGINE.md`
- `docs/MEDICSPRO_ASSESSMENT_LIBRARY_V1.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`
- `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`
- `docs/CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.md`
- `docs/NEXUS_GAP_MAP.md`
- `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`
- `docs/CLINICAL_TOOLING_REUSE_PLAN.md`
- `docs/CLINICAL_DOCUMENTS_FOUNDATION.md`
- `docs/CLINICAL_DOCUMENTS_ROADMAP.md`
- `docs/CLINICAL_PRESCRIPTION_V1.md`
- `docs/CLINICAL_DOCUMENT_TEMPLATE_ADMIN.md`

Institucionalmente:

```text
OARANHA/crmfisio = runtime canônico
OARANHA/medicspro = referência histórica de produto/UX/workflow
OARANHA/nexus = upstream/laboratório de inteligência clínica
```

Não copiar arquitetura/autorização do MedicsPro antigo e não criar segundo runtime clínico a partir do Nexus.

Revisões históricas auditadas:

- `OARANHA/nexus@427174dd909f7aedae52406f2a5d0cfc0314ce22`
- `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`

---

# Regras arquiteturais que não podem regredir

Papéis operacionais canônicos:

- `owner`
- `admin`
- `professional`
- `recep`
- `financeiro`

`platform_admin` é domínio separado e não recebe acesso implícito aos dados clínicos/financeiros de uma clínica.

`role` não é profissão. Autorização clínica combina tenant, perfil ativo, identidade profissional, conselho/registro quando aplicável, capability e autoria/relação assistencial.

Princípio obrigatório:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

Especialidade pode alterar relevância/ordenação. Não concede ACL.

Para instrumentos/documentos:

```text
Nexus = cálculos, instrumentos, evidência, farmacologia e apoio à decisão
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

A Prescrição pertence ao mesmo Encounter; não cria segundo atendimento nem segundo prontuário.

No boundary D2-A/#426 atualmente comprovado para autoria clínica de documentos, `appointments.fisio_id` permanece a referência efetivamente testada. Não introduzir fallback para `professional_id` sem slice explícita de reconciliação.

O guard temporal de #399/#400 permanece: appointment futuro não deve entrar normalmente em `em_atendimento`.

---

# Anamneses & Avaliações

**Estado: VALIDADO EM PRODUÇÃO.**

Assessment Engine continua sendo a fundação única para anamneses/avaliações estruturadas, com templates platform/clinic, versões publicadas imutáveis, draft/resume, finalização e histórico.

Biblioteca MedicsPro V1 validada:

1. Anamnese Médica Geral
2. Anamnese Psiquiátrica

Diretriz UX:

```text
click-first, prose-when-needed
```

Não duplicar PHQ-9/GAD-7, medicamentos, alergias, problemas ou diagnósticos que tenham fonte canônica própria.

---

# Nexus

Nexus permanece domínio clínico especializado, não segundo prontuário.

- hardening C-01–C-06 integrado;
- PHQ-9/GAD-7 preservam identidade/versionamento/scoring no Nexus;
- `nexus.*` fail-closed;
- resultado Nexus não gera prescrição/conduta automaticamente;
- ativos upstream como função renal, risco cardiovascular, psicofarmacologia, equivalências e switching devem ser absorvidos seletivamente, nunca copiados em massa.

---

# Clinical Documents / Prescrição

## D2-A — Clinical Documents Foundation

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

Entregue:

- `medication_prescription`
- `therapeutic_guidance`
- templates versionados platform/clinic
- lifecycle `draft → issued → canceled`
- snapshots imutáveis na emissão
- typed issue validation
- cancelamento auditável
- RLS/RPC/ACL fail-closed
- histórico longitudinal protegido pelo boundary clínico canônico

## D2-B — Prescription V1

**VALIDADO EM PRODUÇÃO.**

PR #429 mergeada em `15692b47fc5bca577948a03de2a686f58d5c7dd9`.

Smoke real confirmado pelo usuário em 2026-09-12:

- criação e salvamento de rascunho;
- saída/retorno com resume correto;
- emissão do documento;
- histórico/read-only pós-emissão;
- impressão aberta a partir do documento emitido.

Entregue:

- workspace Prescrição no Encounter;
- editor estruturado de medicamentos;
- save explícito;
- revisão humana obrigatória;
- emissão via D2-A;
- impressão/histórico baseados em snapshots emitidos;
- isolamento local por paciente + Encounter + usuário.

## D2-B.1 — Prescription Live Preview

**VALIDADO EM PRODUÇÃO.**

PR #430 mergeada na `main` como:

```text
db046f0f8b88864b18a5181b320ae346c59a4419
```

Smoke real confirmou a prévia e o fluxo conjunto D2-B/D2-B.1. A folha de rascunho acompanha a edição e permanece explicitamente sem validade; impressão continua exclusiva do documento emitido.

Observação de produto confirmada no smoke: a impressão funcional atual ainda é visualmente simples demais para o padrão desejado. O acabamento profissional será evoluído por presets seguros de template/renderer, não por HTML arbitrário.

## D2-B.2A — Prescription Template Admin backend

**PR #431 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Branch:

```text
feat/clinical-prescription-template-admin-d2b2a
```

Base preservada:

```text
main@db046f0f8b88864b18a5181b320ae346c59a4419
```

Objetivo:

```text
admin configura templates
!=
médico recebe autoridade para prescrever
```

Escopo da micro-slice:

- owner/admin ativos gerenciam templates `medication_prescription` da própria clínica por RPC;
- templates MedicsPro/platform permanecem read-only;
- clone platform → cópia independente clinic-owned;
- publicação append-only de versões;
- metadados/status active|archived;
- direct table mutation permanece revogada;
- cross-tenant fail-closed;
- published versions e documentos emitidos permanecem historicamente imutáveis;
- renderer V1 permanece fechado; sem HTML/CSS/JS arbitrário;
- nenhuma UI nesta micro-slice;
- nenhuma mudança de produção antes de merge + autorização explícita.

Documento: `docs/CLINICAL_DOCUMENT_TEMPLATE_ADMIN.md`.

Próximas slices após B.2A estabilizada:

1. D2-B.2B — `Configurações → Modelos de Prescrição`, biblioteca/admin + preview;
2. D2-B.2C — presets seguros e Professional Print Layout;
3. D2-C — Therapeutic Guidance V1, depois de estabilizar a trilha de Prescrição.

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

Já existem fundações para integridade financeira, `paid_at`, settlements, cancelamento prepaid e exceções financeiras. Não reabrir o domínio sem evidência/escopo fresco.

---

# Deploy / produção

Frontend:

- React + TypeScript + Vite;
- Docker/Nginx;
- stack via Portainer;
- `main` é potencialmente produtiva.

Supabase é stack separada. Merge não significa migration aplicada.

Migrations/Edge Functions de produção são controladas manualmente e devem usar revisão pinada, backup conforme risco e verifier canônico.

---

# Continuidade

A continuidade deve estar no repositório, não apenas na memória do chat.

Estados editoriais:

```text
VALIDADO EM PRODUÇÃO
MERGEADO / NÃO VALIDADO EM PRODUÇÃO
IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / DEPRECATED
```

Não existe gatilho automático que promova algo para `VALIDADO EM PRODUÇÃO`; isso exige evidência real.

Toda slice relevante revisa este arquivo e o documento de domínio. Mudança visível revisa também `docs/MANUAL_SOURCE_MAP.md`.

---

## Próximo passo imediato

Fechar tecnicamente a **PR #431 — D2-B.2A Prescription Template Admin Backend**:

1. PostgreSQL 16 behavior matrix;
2. verifier production-safe;
3. regressão D2-A/care/auth;
4. testes/typecheck/lint/build;
5. revisão adversarial do diff/ACL;
6. atualizar documentação com o head final;
7. somente então marcar Ready for Review.

Não mergear e não aplicar migration em produção sem nova fronteira explícita.
