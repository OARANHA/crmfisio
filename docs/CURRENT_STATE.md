# MedicsPro — Current State

> **Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução; código, schema e runtime reais prevalecem se este arquivo envelhecer. Para detalhes históricos, use os documentos de domínio — este arquivo não é changelog.**

**Data do snapshot:** 2026-09-12  
**Main canônica:** `15692b47fc5bca577948a03de2a686f58d5c7dd9`  
**Clinical Documents D2-A:** VALIDADO EM PRODUÇÃO  
**Prescription D2-B:** MERGEADO / NÃO VALIDADO EM PRODUÇÃO  
**Prescription D2-B.1 Live Preview:** PR #430 / IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO  
**Clinical Encounter visual:** VALIDADO EM PRODUÇÃO

---

## Leitura obrigatória para qualquer agente

1. `AGENTS.md`
2. este arquivo
3. documento do domínio da tarefa
4. `docs/MANUAL_SOURCE_MAP.md` quando a mudança alterar comportamento visível ao usuário
5. `docs/CLINICAL_TOOLING_REUSE_PLAN.md` quando houver Nexus, ferramenta clínica ou reaproveitamento do MedicsPro histórico

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

Regra institucional:

```text
OARANHA/crmfisio = runtime canônico
OARANHA/medicspro = referência histórica de produto/UX/workflow
OARANHA/nexus = upstream/laboratório de inteligência clínica
```

Não copiar arquitetura/autorização do MedicsPro antigo e não criar segundo runtime clínico a partir do Nexus.

Revisões de referência auditadas:

- `OARANHA/nexus@427174dd909f7aedae52406f2a5d0cfc0314ce22`
- `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`

Os inventários existentes continuam válidos enquanto essas fontes não mudarem ou surgir lacuna comprovada.

---

# Produto e arquitetura

MedicsPro é um SaaS multiprofissional para clínicas combinando Agenda, CRM, prontuário clínico, financeiro, automação e relacionamento com paciente.

Fluxo central:

```text
Paciente
→ Agenda
→ Atendimento / Encounter
→ Registro clínico / Anamneses & Avaliações / Nexus / Documentos
→ Finalização
→ Financeiro
→ Comunicação / acompanhamento
```

Papéis operacionais canônicos da clínica:

- `owner`
- `admin`
- `professional`
- `recep`
- `financeiro`

`platform_admin` é domínio separado e não recebe acesso clínico implícito.

`role` não é profissão. Identidade clínica, profissão, conselho/registro, capability, tenant e relação assistencial compõem autorização clínica. Especialidade afeta relevância/ordenação, nunca ACL.

Princípio obrigatório:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

---

# Clinical Cockpit / Encounter

**Estado funcional/visual em produção:** VALIDADO para a composição anterior à Prescrição V1.

Workspaces canônicos do código após #429:

```text
Registro
Anamneses & Avaliações
Prescrição
Nexus
```

`Prescrição` foi mergeada na `main` pela #429, mas ainda não deve ser descrita como **VALIDADA EM PRODUÇÃO** até existir evidência de deploy + smoke real.

A Prescrição é workspace do mesmo Encounter. Não cria segundo atendimento nem segundo prontuário.

A composição visual do Cockpit continua seguindo a referência pós-#420: hero do atendimento, rail contextual, toolbar de workspaces e comportamento responsivo já consolidados.

Detalhes: `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`.

---

# Registro clínico

O Encounter atual é o centro da consulta. Não criar segunda evolução universal paralela quando o Encounter já representa a fonte clínica daquele atendimento.

Finalização deve preservar histórico, autorização e integridade financeira. Correções posteriores devem ser auditáveis, nunca mutações silenciosas de histórico.

---

# Anamneses & Avaliações / Assessment Engine

**Estado:** VALIDADO EM PRODUÇÃO.

O Assessment Engine é a única fundação para anamneses e avaliações estruturadas.

Conceitos canônicos:

- `assessment_templates`
- `assessment_template_versions`
- ownership platform ou clinic
- template ativo/inativo
- versão publicada imutável
- draft/resume
- finalização/histórico
- seções, ordem, required, opções e tipos de resposta
- Runner reutilizado no Encounter e no contexto longitudinal

Biblioteca MedicsPro V1 validada:

1. Anamnese Médica Geral
2. Anamnese Psiquiátrica

Diretriz de UX:

```text
click-first, prose-when-needed
```

Não duplicar PHQ-9/GAD-7, medicamentos, alergias, problemas ou diagnósticos que possuam fonte canônica própria.

---

# Clinical Instruments / Nexus

Nexus permanece domínio clínico especializado, separado do Assessment Engine e do Clinical Documents Engine.

Direção canônica:

```text
Nexus = cálculos, instrumentos, evidência, farmacologia e apoio à decisão
Clinical Documents = ato documental explícito do profissional
```

Estado relevante:

- hardening C-01–C-06 integrado ao runtime;
- PHQ-9/GAD-7 mantêm identidade/versionamento/scoring no Nexus;
- `nexus.*` permanece fail-closed;
- especialidade pode influenciar relevância, nunca capability;
- resultado Nexus não gera prescrição/conduta automaticamente.

Ativos upstream ainda não absorvidos em massa incluem escalas adicionais, função renal, risco cardiovascular, psicofarmacologia, equivalências, antidepressivos e switching. Portar seletivamente, com validação clínica e contrato próprio.

Detalhes: `docs/NEXUS_GAP_MAP.md` e `docs/CLINICAL_TOOLING_REUSE_PLAN.md`.

---

# Prescrição e Documentos Clínicos

## D2-A — Clinical Documents Foundation

**Estado: VALIDADO EM PRODUÇÃO.**

PR #425 mergeada como:

```text
0459e5908c942ac63c0dec87d517aa2131936204
```

Migration aplicada em produção em 2026-09-12:

```text
supabase-migrations/20260912_clinical_documents_foundation.sql
```

Evidência registrada:

```text
COMMIT
MIGRATION_EXIT=0
CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED
ROLLBACK
VERIFIER_EXIT=0
```

O `ROLLBACK` pertence ao verifier read-only.

Foundation entregue:

- `medication_prescription`
- `therapeutic_guidance`
- templates platform versionados
- lifecycle draft → issued → canceled
- snapshot imutável na emissão
- eventos append-only
- typed issue validation
- identifier humano com UUID completo
- cancelamento auditável
- RLS/RPC/ACL fail-closed
- leitura histórica delegando ao boundary clínico canônico

No branch de autoria/relação assistencial coberto por D2-A/#426, a referência canônica efetivamente verificada continua `appointments.fisio_id`; `professional_id` não é fallback de autoria clínica sem slice explícita de reconciliação.

Detalhes: `docs/CLINICAL_DOCUMENTS_FOUNDATION.md`.

## D2-B — Prescription V1

**Estado: MERGEADO / NÃO VALIDADO EM PRODUÇÃO.**

PR #429 foi validada em CI e mergeada por squash na `main` como:

```text
15692b47fc5bca577948a03de2a686f58d5c7dd9
```

Entregue:

- workspace `Prescrição` no Encounter para relevância médica;
- autorização real continua server-side;
- `medication_prescription` sobre a foundation D2-A;
- seleção de template publicado elegível;
- editor com medicamento, dose, via, frequência, duração e instruções;
- observações;
- draft/resume do próprio emissor no mesmo Encounter;
- salvar rascunho explicitamente, sem autosave genérico;
- revisão humana obrigatória;
- emissão explícita via D2-A;
- read-only pós-emissão;
- impressão somente de `payload_snapshot` + `context_snapshot`;
- identificação profissional congelada na impressão;
- histórico do Encounter separado do histórico anterior do paciente;
- isolamento de estado local por paciente + Encounter + usuário.

Não houve migration, RPC, RLS, grant, capability, novo `document_type` ou integração Nexus na D2-B.

CI final da #429 no head `ca0192331a8233e6280bf63e4b0a63f1f766e732`:

- 77 arquivos / 420 testes / 420 passed;
- typecheck verde;
- lint verde;
- build verde;
- dependency audit gate verde;
- 10/10 workflows clínicos/Nexus associados concluídos com sucesso.

Ainda falta evidência registrada de deploy + smoke real. Não promover para `VALIDADO EM PRODUÇÃO` antes disso.

Detalhes: `docs/CLINICAL_PRESCRIPTION_V1.md`.

## D2-B.1 — Prescription Live Preview

**Estado: IMPLEMENTADO NA PR #430 / NÃO VALIDADO EM PRODUÇÃO.**

Branch:

```text
feat/prescription-live-preview-d2b1
```

Objetivo: recuperar a boa ergonomia da área `Visualização` do MedicsPro histórico sem trazer sua arquitetura antiga.

Contrato da micro-slice:

```text
editor estruturado
        │
        └── estado local do draft ──→ folha de receita ao vivo

emitir
  ↓
payload_snapshot + context_snapshot imutáveis
  ↓
histórico / impressão
```

A prévia ao vivo mostra dados já disponíveis do usuário/paciente e reflete medicamentos/observações locais. Ela é explicitamente marcada como rascunho sem validade, não persiste, não chama RPC e não pode ser impressa.

Nenhuma mudança de banco/autorização/Nexus é necessária.

## D2-C — Therapeutic Guidance V1

Permanece planejada **após estabilização e smoke da Prescrição**, reutilizando a mesma foundation. Não misturar Exam Order, Atestados, Relatórios ou novas famílias documentais na mesma slice.

Roadmap: `docs/CLINICAL_DOCUMENTS_ROADMAP.md`.

---

# Reaproveitamento Nexus + MedicsPro histórico

Antes de criar nova ferramenta clínica, consultar:

- `docs/NEXUS_GAP_MAP.md`
- `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`
- `docs/CLINICAL_TOOLING_REUSE_PLAN.md`

Mapa resumido:

```text
Nexus → cálculos, instrumentos, evidência, farmacologia, apoio à decisão
Assessment Engine → anamneses e avaliações estruturadas
Clinical Documents → prescrição/orientação/documentos emitidos
Clinical Cockpit → composição da experiência para o profissional
```

O profissional não precisa conhecer essa separação técnica na UI.

---

# Appointment temporal boundary

#399 e #400 estão mergeadas e validadas.

Contrato:

- appointment futuro não entra normalmente em `em_atendimento`;
- guard temporal protege início da consulta;
- atos/instrumentos clínicos não contornam esse boundary;
- bypass reservado a contexto trusted/maintenance controlado.

O appointment histórico conhecido em estado inválido já foi reparado de forma controlada e não deve ser reparado novamente.

---

# Plataforma, tenants e configuração

Separação obrigatória:

```text
PLATFORM ENTITLEMENT
→ CLINIC CONFIGURATION
→ USER AUTHORIZATION / CAPABILITY
→ RESOURCE / ENCOUNTER CONTEXT
```

Nunca colapsar essas camadas.

Platform Admin administra o SaaS; owner/admin administram o tenant; usuários executam apenas o que a autorização efetiva permite.

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

Já existem fundações para integridade do ciclo financeiro, `paid_at`, settlements, cancelamento prepaid e exceções financeiras. Não presumir que todo P1/P2 financeiro está fechado sem inspeção fresca.

Integrações futuras mantêm dois planos distintos:

1. MedicsPro cobrando a clínica pelo SaaS;
2. clínica usando seu próprio merchant/provider para receber do paciente.

---

# Deploy / produção

Frontend:

- React + TypeScript + Vite;
- Docker/Nginx;
- stack operada via Portainer;
- `main` deve ser tratada como potencialmente produtiva.

Backend Supabase é stack separada. Merge de frontend não significa migration aplicada.

Após mudança visível, registrar somente o que foi realmente observado em smoke.

Detalhes: `DEPLOY.md`.

---

# Continuidade e documentação

A continuidade deve existir no repositório, não apenas na memória do chat:

- `AGENTS.md` exige leitura deste snapshot;
- cada domínio possui documentação especializada;
- `.github/pull_request_template.md` exige revisão de continuidade;
- estado editorial separa implementação, produção e planejamento.

Não existe e não deve existir robô que marque automaticamente algo como `VALIDADO EM PRODUÇÃO`. Esse estado exige evidência real.

Estados editoriais:

```text
VALIDADO EM PRODUÇÃO
MERGEADO / NÃO VALIDADO EM PRODUÇÃO
IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / DEPRECATED
```

Toda slice relevante deve revisar:

- este snapshot;
- documento do domínio;
- `docs/MANUAL_SOURCE_MAP.md` se mudar comportamento visível;
- roadmap/TODO quando a ordem de produto mudar.

---

## Próximo passo imediato

Fechar tecnicamente a **PR #430 — D2-B.1 Prescription Live Preview**:

1. testes;
2. TypeScript;
3. lint;
4. build;
5. dependency audit;
6. workflows clínicos/Nexus aplicáveis;
7. revisão de diff/mergeabilidade.

Depois, parar para decisão de merge.

Após eventual merge/redeploy, executar um único smoke conjunto da Prescrição V1:

```text
abrir Encounter ativo
→ criar/retomar draft
→ editar medicamento
→ confirmar live preview
→ salvar
→ sair/voltar e confirmar resume
→ revisar
→ emitir
→ confirmar read-only/histórico
→ imprimir documento emitido
```

Somente depois promover D2-B/D2-B.1 para `VALIDADO EM PRODUÇÃO` e iniciar D2-C.
