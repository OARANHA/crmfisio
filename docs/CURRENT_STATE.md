# MedicsPro — Current State

> Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução. Código, schema e runtime reais prevalecem se este arquivo envelhecer; detalhes ficam nos documentos de domínio.

**Data do snapshot:** 2026-09-13  
**Base canônica:** `main@9d04f011454db77f5197e227c540aa0d361d9442`

## Estado clínico resumido

```text
Clinical Documents D2-A                                      PROD
Prescription D2-B / B.1 / B.2A / B.2B / B.2C               PROD
Therapeutic Guidance D2-C / D2-C.1                           PROD
Exam Order D2-D0 / D2-D1 / D2-D2                             PROD
Referral D2-E0 / D2-E1 / D2-E2 / D2-E3 / D2-E3.1            PROD
Clinical Encounter visual                                     PROD
Assessment Library V1                                         PROD
D2-E4 Referral Operational Continuity                         PROD
Clinic Referral Authoring Policy V1                           MERGED / NÃO VALIDADO EM PRODUÇÃO
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
- `docs/CLINIC_CLINICAL_FLOW_SETTINGS_V1.md`

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

# D2-E4 — Referral Operational Continuity

**VALIDADO EM PRODUÇÃO.**

A implementação não altera o lifecycle do documento emitido. O workflow operacional é separado e vinculado ao `clinical_documents.id` emitido:

```text
referral emitido e imutável
→ recebido
→ aceito / recusado
→ agendamento vinculado
→ atendimento
→ conclusão
```

Invariantes preservadas:

- mesmo tenant sempre;
- documento emitido permanece imutável;
- estados operacionais vivem fora de `clinical_documents.status`;
- destino/aceite não concedem automaticamente leitura de prontuário;
- agendamento reutiliza Agenda/Appointment canônicos;
- handoff para atendimento continua sujeito a autorização clínica e guard temporal existentes;
- especialidade/profissão continuam roteamento/relevância, nunca ACL;
- agendamento cross-professional pelo emissor só existe para o destino interno exato congelado no referral e mediante prova transacional same-transaction.

V1 mantém uma única operação por referral interno em `clinical_referral_operations`, auditável e tenant-scoped. A Agenda continua dona de data/hora, status, remarcação e atendimento; `schedule_clinical_referral_operation(...)` revalida tenant, paciente, documento emitido, destino imutável, profissional ativo e appointment boundary antes de criar ou retornar idempotentemente o vínculo canônico.

Produção validou a stack final após #450–#453:

- migration e verifier da continuidade operacional aplicados com sucesso;
- handoff da UI usa o `clinical_documents.id` correto;
- profissional destinatário congelado é preservado no modal;
- o guard global de Appointment aceita apenas o cross-target exato sustentado pela prova transacional criada no mesmo RPC/transaction;
- tentativa direta de agendar outro colega continua bloqueada;
- referral snapshot permanece imutável;
- smoke real criou exatamente um appointment para o profissional alvo e vinculou a operação como `scheduled`;
- retry do mesmo referral retornou `Este encaminhamento já possui um agendamento vinculado.` sem criar segundo appointment.

O D2-E4 está encerrado como funcionalmente validado; mudanças futuras de política/configuração da clínica devem compor essa autorização sem enfraquecer suas invariantes.

---

# Clinic Clinical Flow Settings

## Referral Authoring Policy V1

**MERGED / NÃO VALIDADO EM PRODUÇÃO.**

A #454 adiciona em `Configurações → Fluxos clínicos` a política institucional:

```text
Permitir que profissionais emitam encaminhamentos
```

O default é `true`, preservando o comportamento atual. Quando `false`, PostgreSQL bloqueia criação, edição de draft e emissão de novos `referral`, sem alterar histórico emitido, snapshots, leitura já autorizada, cancelamento lifecycle, D2-E4 já materializado ou outros Clinical Documents.

A configuração pode restringir o fluxo, mas nunca concede identidade, capability, care relationship ou acesso clínico. Somente owner/admin alteram a policy da própria clínica; usuários autenticados não possuem escrita direta na tabela.

O toggle de agendamento direto pelo encaminhador **não entrou nesta V1** porque ainda não existe uma rota operacional alternativa equivalente para recepção/destinatário assumir o agendamento. Desativá-lo agora criaria risco de dead-end. Essa decisão fica separada do D2-E4 validado.

Rollout de produção da #454 ainda exige migration, verifier, frontend redeploy e smoke funcional.

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
