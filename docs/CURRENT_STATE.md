# MedicsPro — Current State

> Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução. Código, schema e runtime reais prevalecem se este arquivo envelhecer; detalhes ficam nos documentos de domínio.

**Data do snapshot:** 2026-09-12/13  
**Base canônica:** `main@2ecc17a7efc6d02a94e738bf5b17d748402d8c99`

## Estado clínico resumido

```text
Clinical Documents D2-A                                      PROD
Prescription D2-B / B.1 / B.2A / B.2B / B.2C               PROD
Therapeutic Guidance D2-C / D2-C.1                           PROD
Exam Order D2-D0 / D2-D1 / D2-D2                             PROD
Referral D2-E0 / D2-E1 / D2-E2 / D2-E3 / D2-E3.1            PROD
Clinical Encounter visual                                     PROD
Assessment Library V1                                         PROD
D2-E4 Referral Operational Continuity                         PRÓXIMO
```

---

## Leitura obrigatória

1. `AGENTS.md`
2. este arquivo
3. documento do domínio da tarefa
4. `docs/MANUAL_SOURCE_MAP.md` para mudanças visíveis
5. `docs/CLINICAL_DOCUMENTS_ROADMAP.md` para continuidade documental
6. `docs/CLINICAL_TOOLING_REUSE_PLAN.md` para Nexus/reuso clínico

Referências Referral:

- `docs/CLINICAL_REFERRAL_FOUNDATION.md`
- `docs/CLINICAL_REFERRAL_ENCOUNTER_V1.md`
- `docs/CLINICAL_REFERRAL_RENDERER_V1.md`
- `docs/CLINICAL_REFERRAL_INTERNAL_V1.md`

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
DOCUMENT LIFECYCLE != OPERATIONAL REFERRAL WORKFLOW
```

Especialidade/profissão podem orientar relevância, filtro e roteamento; nunca viram ACL implícita.

Nexus apoia decisão; não prescreve, pede exame ou encaminha automaticamente.

---

# Clinical Cockpit / Encounter

Workspaces validados em produção:

```text
Registro
Anamneses & Avaliações
Prescrição
Exames
Orientações
Encaminhamento
Nexus
```

Prescrição, Pedido de Exames, Orientações e Encaminhamento pertencem ao mesmo Encounter e não criam segundo prontuário.

No boundary D2-A atualmente testado para autoria documental, `appointments.fisio_id` permanece referência vigente. `professional_id` existe como direção canônica/staged compatibility, mas não deve substituir silenciosamente o boundary existente sem reconciliação dedicada.

O guard temporal #399/#400 continua vigente.

---

# Assessment Engine

**VALIDADO EM PRODUÇÃO.**

Fundação única para anamneses/avaliações estruturadas, com templates platform/clinic, versões imutáveis, draft/resume, finalização e histórico.

Biblioteca V1 validada:

- Anamnese Médica Geral
- Anamnese Psiquiátrica

Diretriz UX: `click-first, prose-when-needed`.

---

# Nexus

Nexus permanece domínio especializado de instrumentos, cálculo, evidência, farmacologia e apoio à decisão.

- hardening C-01–C-06 integrado;
- PHQ-9/GAD-7 preservam identidade/versionamento/scoring;
- `nexus.*` fail-closed;
- resultado Nexus não gera ato documental automaticamente.

---

# Clinical Documents

## D2-A — Foundation

**VALIDADO EM PRODUÇÃO.**

Lifecycle canônico:

```text
draft → issued → canceled
```

Templates publicados são versionados; emissão congela payload, contexto e definição visual; histórico emitido é imutável.

## D2-B — Prescrição

**VALIDADO EM PRODUÇÃO.**

Marcos: #429–#433. Preview/print versionado, presets seguros, Template Admin e imutabilidade visual histórica confirmados.

## D2-C — Orientações terapêuticas

**VALIDADO EM PRODUÇÃO.**

Fluxo estruturado, revisão humana, emissão e renderer A4 profissional confirmados. `therapeutic_guidance` não aparece como rótulo para paciente.

## D2-D — Pedido de Exames

**VALIDADO EM PRODUÇÃO.**

`exam_order` próprio, autoria V1 médico/CRM conservadora, Encounter UX, preview A4, emissão e impressão histórica por snapshot confirmados.

## D2-E0 — Referral Foundation

**VALIDADO EM PRODUÇÃO.**

`referral` é documento canônico próprio, multiprofissional, sem reutilizar `therapeutic_guidance`. Emissão exige identidade clínica elegível + `clinical.documents` + próprio Encounter ativo. Owner/admin/platform não recebem bypass.

## D2-E1 — Referral Encounter UX

**VALIDADO EM PRODUÇÃO.**

Aba `Encaminhamento` no Clinical Cockpit com draft/save/resume, motivo/contexto, revisão humana, emissão e histórico.

## D2-E2 — Referral Professional Print Renderer V1

**VALIDADO EM PRODUÇÃO.**

Layout `clinical-document/referral-v1`. Preview A4 e impressão emitida compartilham renderer seguro. Histórico legado permanece no snapshot/layout original.

## D2-E3 / D2-E3.1 — Encaminhamento Interno V1 + Hardening

**VALIDADO EM PRODUÇÃO.**

Modos:

```text
Profissional da clínica
Especialidade / serviço
Destino externo
```

O diretório interno é server-governed, mesmo tenant, perfil ativo, self-excluded e limitado ao catálogo clínico canônico atual:

```text
medico
fisioterapeuta
psicologo
quiropraxista
```

Não existe acoplamento `role='professional'`. Perfis administrativos com `professional_type` legado ficam fail-closed.

Smoke real de produção confirmou:

- isolamento entre tenants;
- destino interno real `Dr. Aranha · Médico da Família`;
- preview mantém `Destino não informado` até uma escolha real;
- emissão e impressão A4 em uma página;
- documento mostra somente rótulos humanos;
- UUID, `target_profile_id` e `destination_scope` não aparecem para o paciente.

O roteamento interno **não concede acesso ao prontuário nem care relationship automaticamente**.

---

# Próximo passo — D2-E4 Referral Operational Continuity

A próxima etapa não deve alterar o lifecycle do documento emitido. O desenho canônico é separar um workflow operacional vinculado ao `clinical_documents.id` emitido:

```text
referral emitido e imutável
→ recebido
→ aceito / recusado
→ agendamento vinculado
→ atendimento
→ conclusão
```

Requisitos arquiteturais para D2-E4:

- mesmo tenant sempre;
- documento emitido permanece imutável;
- estados operacionais vivem fora de `clinical_documents.status`;
- destino/aceite não concedem automaticamente leitura de prontuário;
- agendamento deve reutilizar os contratos canônicos de Agenda/Appointment, sem INSERT paralelo improvisado;
- handoff para atendimento deve respeitar `clinical.attend`, profissional atribuído e guard temporal existentes;
- conclusão deve ser auditável e referenciar o atendimento resultante quando houver;
- especialidade/profissão continuam roteamento/relevância, nunca ACL.

---

# Plataforma / tenants

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

Não reabrir sem evidência/escopo fresco.

---

# Deploy / produção

Frontend: React + TypeScript + Vite em Docker/Nginx/Portainer. Supabase é stack separada. Merge não significa migration aplicada.

Migrations de produção são manuais, pinadas ao SHA mergeado, com backup e verifier quando aplicável.

Estados documentais:

```text
VALIDADO EM PRODUÇÃO
MERGEADO / NÃO VALIDADO EM PRODUÇÃO
IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / DEPRECATED
```

Produção só vira `VALIDADO EM PRODUÇÃO` com evidência real.
