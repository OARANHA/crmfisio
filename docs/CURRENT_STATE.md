# MedicsPro — Current State

> **Snapshot de continuidade. `AGENTS.md` contém as regras operacionais; código, schema e runtime atuais prevalecem se este arquivo envelhecer.**

**Data do snapshot:** 2026-09-12  
**Base canônica observada:** `main@0459e5908c942ac63c0dec87d517aa2131936204`  
**Clinical Documents D2-A:** mergeada e migration aplicada/verificada em produção em 2026-09-12  
**Clinical Encounter visual:** pós-PR #420, validado em produção

## Leitura obrigatória para qualquer agente

1. `AGENTS.md`
2. este arquivo
3. o documento do domínio em que a tarefa atua
4. `docs/MANUAL_SOURCE_MAP.md` quando a mudança alterar comportamento visível ao usuário
5. `docs/CLINICAL_TOOLING_REUSE_PLAN.md` para trabalho que envolva Nexus, ferramentas clínicas ou reaproveitamento do MedicsPro histórico

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

A regra institucional permanece: **`OARANHA/crmfisio` é o runtime canônico; `OARANHA/medicspro` é referência histórica de produto/UX/workflow, nunca de arquitetura/autorização; `OARANHA/nexus` é upstream/laboratório de inteligência clínica, não um segundo runtime do produto.**

As revisões de referência continuam estáveis:

- `OARANHA/nexus@427174dd909f7aedae52406f2a5d0cfc0314ce22`;
- `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`.

Portanto os inventários já produzidos continuam úteis e não devem ser refeitos do zero sem mudança dessas fontes ou evidência de lacuna.

---

# Produto e arquitetura — resumo executivo

MedicsPro é um SaaS multiprofissional para clínicas, combinando Agenda, CRM, prontuário clínico, financeiro, automação e relacionamento com paciente.

Fluxo central:

```text
Paciente
→ Agenda
→ Atendimento / Encounter
→ Registro clínico / avaliações / Nexus / documentos
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

`role` não é profissão. Identidade clínica, profissão, conselho/registro, capability e relação assistencial compõem autorização clínica. Especialidade afeta relevância/ordenação, **não ACL**.

Princípio clínico obrigatório:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

---

# Clinical Cockpit / Encounter

**Estado funcional:** VALIDADO EM PRODUÇÃO.  
**Estado visual pós-#420:** VALIDADO EM PRODUÇÃO.

Superfícies visíveis atuais:

```text
Registro
Anamneses & Avaliações
Nexus
```

A infraestrutura de documentos clínicos agora existe no backend, mas **`Prescrição` ainda não é uma superfície de usuário disponível**. A inclusão visual/funcional é D2-B.

## Composição visual canônica atual

A referência visual vigente é a #420. A #417 foi uma compactação inicial e não deve ser usada como arquitetura final.

Contrato atual:

- `EncounterHero` não-sticky;
- rail esquerdo (`Estado da consulta` + `Paciente em contexto`) sticky independente em desktop XL;
- toolbar `Registro / Anamneses & Avaliações / Nexus` sticky apenas na coluna principal em desktop XL;
- rail e toolbar usam o mesmo offset de coluna sem competir entre si;
- header global desktop não renderiza em `lg+`;
- utilitários desktop ficam no footer da sidebar;
- sidebar collapsed mantém controles utilizáveis sem overflow horizontal perceptível;
- avatar/logout ficam empilhados/centralizados no collapsed;
- mobile/tablet preservam header compacto;
- ajuda contextual fica flutuante no canto inferior;
- breadcrumb redundante `‹ Pacientes` permanece oculto durante Encounter ativo.

Registro detalhado: `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`.

---

# Registro clínico

O profissional registra o atendimento no Encounter atual. O desenho canônico evita obrigar o usuário a preencher uma segunda evolução universal paralela quando o Encounter já é a fonte clínica da consulta.

A finalização deve preservar histórico e regras clínicas/financeiras existentes. Correções posteriores devem ser auditáveis, não mutações silenciosas de histórico.

---

# Anamneses & Avaliações / Assessment Engine

**Estado:** VALIDADO EM PRODUÇÃO.

O Assessment Engine é a única fundação para anamneses e avaliações estruturadas.

Conceitos canônicos:

- `assessment_templates`;
- `assessment_template_versions`;
- ownership platform ou clinic;
- templates ativos/inativos;
- versão publicada imutável;
- draft/resume;
- finalização/histórico;
- seções, ordem, required, opções e tipos de resposta;
- Runner reutilizado no Encounter e em contexto longitudinal.

Não criar segundo forms engine.

## Biblioteca MedicsPro V1

PR #413 aplicada e validada em produção.

Modelos publicados:

1. **Anamnese Médica Geral**
2. **Anamnese Psiquiátrica**

Diretriz de UX:

```text
click-first, prose-when-needed
```

Usar rádio, checkbox, select, sim/não e escala quando clinicamente seguro; manter narrativa para nuance, história, síntese, exame mental e risco contextual.

Não duplicar PHQ-9/GAD-7, medicamentos, alergias, problemas ou diagnósticos que já tenham fonte canônica própria.

Backlog histórico catalogado, ainda não implementado em massa: Ginecologia, Dermatologia, Pediatria, Cardiologia, Ortopedia e Oftalmologia.

Persistência de draft/resume foi validada em produção.

---

# Clinical Instruments / Nexus

Nexus permanece domínio clínico especializado, separado do Assessment Engine e do Clinical Documents Engine.

Estado canônico:

- hardening C-01–C-06 integrado ao runtime;
- PHQ-9/GAD-7 mantêm identidade/versionamento/scoring na engine Nexus;
- Clinical Instrument Authorization Foundation (#399) separa exposição multiprofissional de membership do registry Nexus;
- `nexus.*` permanece fail-closed;
- especialidade pode influenciar relevância/apresentação, nunca capability;
- resultado Nexus não gera prescrição/conduta automaticamente.

O upstream auditado também possui ativos ainda não absorvidos em massa — escalas adicionais, função renal, risco cardiovascular, psicofarmacologia, equivalências, base de antidepressivos e switching. Eles ficam registrados no `docs/CLINICAL_TOOLING_REUSE_PLAN.md` e devem ser portados seletivamente, com validação clínica e contratos próprios.

---

# Prescrição e Documentos Clínicos

**Estado:** D1 CONCLUÍDO / D2-A VALIDADO EM PRODUÇÃO / D2-B PRÓXIMA SLICE.

## D2-A — Clinical Documents Foundation

PR #425 foi mergeada por squash na `main` como:

```text
0459e5908c942ac63c0dec87d517aa2131936204
```

Em 2026-09-12 foi aplicada em produção:

```text
supabase-migrations/20260912_clinical_documents_foundation.sql
```

Resultado operacional observado:

```text
COMMIT
MIGRATION_EXIT=0
```

Em seguida foi executado o verifier oficial:

```text
supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql
```

Resultado:

```text
CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED
ROLLBACK
VERIFIER_EXIT=0
```

O `ROLLBACK` pertence ao verifier read-only e não desfaz a migration.

A foundation entregue inclui:

- `medication_prescription`;
- `therapeutic_guidance`;
- templates platform versionados;
- draft → issued → canceled;
- snapshots imutáveis na emissão;
- eventos append-only;
- identifier humano com UUID completo;
- typed issue validation;
- cancelamento auditável;
- RLS/RPC/ACL fail-closed;
- history read delegando ao boundary clínico canônico pós-#426.

### Boundary de autoria/leitura específico da D2-A

A D2-A e a reconciliação #426 foram verificadas contra o runtime efetivo que usa `appointments.fisio_id` no branch de relação assistencial/autoria coberto por essas slices, com negative control para `professional_id` divergente.

Isso **não deve ser interpretado como autorização para renomear ou redesenhar globalmente o modelo de profissional**. Qualquer reconciliação futura desses aliases deve ser uma slice explícita, com migrations/verifiers/consumidores atualizados em conjunto.

## D2-B — Prescription V1

**Próxima implementação funcional aprovada.**

Escopo mínimo:

- workspace `Prescrição` no Encounter;
- somente `medication_prescription`;
- seleção de template elegível;
- editor tipado de medicamentos;
- draft/resume no Encounter correto;
- preview determinístico;
- emissão explícita;
- read-only pós-emissão;
- impressão;
- histórico do Encounter/paciente.

Não reabrir schema/lifecycle D2-A sem blocker comprovado. Nexus pode futuramente fornecer conhecimento/apoio farmacológico, mas não deve ser autor da prescrição.

## D2-C — Therapeutic Guidance V1

Permanece após D2-B, reutilizando a mesma foundation, renderer e histórico e sem abrir Exam Order/Atestados/Relatórios na mesma slice.

Documento de continuidade: `docs/CLINICAL_DOCUMENTS_ROADMAP.md`.

---

# Reaproveitamento Nexus + MedicsPro histórico

O trabalho não deve começar por “inventar ferramenta”. Antes de criar nova superfície clínica, consultar:

- `docs/NEXUS_GAP_MAP.md`;
- `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`;
- `docs/CLINICAL_TOOLING_REUSE_PLAN.md`.

Regra resumida:

```text
Nexus → cálculos, instrumentos, evidência, farmacologia, apoio à decisão
Assessment Engine → anamneses e avaliações estruturadas
Clinical Documents → prescrição/orientação/documentos emitidos
Clinical Cockpit → composição da experiência para o profissional
```

O profissional não precisa conhecer essa separação técnica na UI.

---

# Appointment temporal boundary

#399 e #400 já estão mergeados e validados.

Contrato:

- appointment futuro não entra normalmente em `em_atendimento`;
- guard temporal protege início de consulta;
- atos/instrumentos clínicos não contornam esse boundary;
- bypass fica reservado a contexto trusted/maintenance controlado.

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

Integrações futuras devem manter dois planos distintos:

1. MedicsPro cobrando a clínica pelo SaaS;
2. clínica usando seu próprio merchant/provider para receber do paciente.

---

# Continuidade e documentação

O repositório possui continuidade explícita, não memória informal de chat:

- `AGENTS.md` manda qualquer agente ler este snapshot imediatamente;
- cada domínio possui documentação especializada;
- `.github/pull_request_template.md` exige checklist de continuidade nas novas PRs;
- estado editorial deve separar implementação, produção e planejamento.

Não existe nem deve existir um robô que marque automaticamente uma funcionalidade como `VALIDADO EM PRODUÇÃO`. Esse estado exige evidência real.

Toda slice que alterar comportamento ou estado relevante deve revisar:

- este snapshot;
- documento do domínio;
- `docs/MANUAL_SOURCE_MAP.md` se houver mudança visível;
- `TODO.md` / `PRODUCT_ROADMAP.md` quando o roadmap mudar.

Estados editoriais permitidos:

```text
VALIDADO EM PRODUÇÃO
IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / DEPRECATED
```

---

## Próximo passo imediato

Executar **D2-B — Prescription V1** sobre a Clinical Documents Foundation já validada em produção.

Antes de implementar, comparar explicitamente:

- foundation D2-A atual;
- UX de prescrição do `OARANHA/medicspro` histórico;
- ativos farmacológicos do Nexus que sejam apenas referência/apoio e não devam entrar no escopo D2-B.

Objetivo: entregar o primeiro documento clínico real no Cockpit sem expandir simultaneamente para exames, atestados, relatórios ou switching farmacológico.
