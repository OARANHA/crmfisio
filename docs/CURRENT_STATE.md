# MedicsPro — Current State

> **Snapshot de continuidade. `AGENTS.md` contém as regras operacionais; código, schema e runtime atuais prevalecem se este arquivo envelhecer.**

**Data do snapshot:** 2026-09-11  
**Base observada ao fechar este snapshot:** `main@8414cdf5350e625c91f53e7ba96f7b226d4ce7a0`  
**Runtime funcional do Clinical Encounter validado:** pós-PR #420 (`39b78ada205a7237341847edcda6a8592d0b0c14`)

## Leitura obrigatória para qualquer agente

1. `AGENTS.md`
2. este arquivo
3. o documento do domínio em que a tarefa atua
4. `docs/MANUAL_SOURCE_MAP.md` quando a mudança alterar comportamento visível ao usuário

Referências clínicas principais:

- `docs/ASSESSMENT_ENGINE.md`
- `docs/MEDICSPRO_ASSESSMENT_LIBRARY_V1.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`
- `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`
- `docs/CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.md`
- `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`

A regra institucional permanece: **`OARANHA/crmfisio` é o runtime canônico; `OARANHA/medicspro` é referência histórica de produto/UX/workflow, nunca de arquitetura/autorização; `OARANHA/nexus` é upstream/laboratório de inteligência clínica, não um segundo runtime do produto.**

---

# Produto e arquitetura — resumo executivo

MedicsPro é um SaaS multiprofissional para clínicas, combinando Agenda, CRM, prontuário clínico, financeiro, automação e relacionamento com paciente.

Fluxo central:

```text
Paciente
→ Agenda
→ Atendimento / Encounter
→ Registro clínico / avaliações / documentos / Nexus
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

Superfícies principais:

```text
Registro
Anamneses & Avaliações
Nexus
```

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

## Evidência visual de produção

Confirmado em produção em 2026-09-11:

- header global desktop ausente;
- conteúdo clínico começa mais alto;
- hero compacto e legível;
- rail esquerdo estável;
- toolbar clínica separada do hero;
- `Registro`, `Anamneses & Avaliações` e `Nexus` visualmente coerentes;
- sidebar expandida concentra modo, unidade, tema, notificações, identidade e logout no rodapé;
- durante scroll real, rail esquerdo e toolbar sticky permanecem visíveis sem sobreposição/clipping relevante;
- com sidebar recolhida, não há overflow horizontal perceptível e avatar/logout ficam empilhados/centralizados.

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

- `assessment_templates`
- `assessment_template_versions`
- ownership platform ou clinic
- templates ativos/inativos
- versão publicada imutável
- draft/resume
- finalização/histórico
- seções, ordem, required, opções e tipos de resposta
- Runner reutilizado no Encounter e em contexto longitudinal

Não criar segundo forms engine.

## Biblioteca MedicsPro V1

PR #413, aplicada e validada em produção.

Modelos publicados:

1. **Anamnese Médica Geral**
2. **Anamnese Psiquiátrica**

IDs estáveis:

```text
Anamnese Médica Geral
10000000-0000-4000-8000-000000000003
version 1: 11000000-0000-4000-8000-000000000003

Anamnese Psiquiátrica
10000000-0000-4000-8000-000000000004
version 1: 11000000-0000-4000-8000-000000000004
```

Diretriz de UX:

```text
click-first, prose-when-needed
```

Usar rádio, checkbox, select, sim/não e escala quando clinicamente seguro; manter narrativa para nuance, história, síntese, exame mental e risco contextual.

Não duplicar PHQ-9/GAD-7, medicamentos, alergias, problemas ou diagnósticos que já tenham fonte canônica própria.

Backlog histórico catalogado, ainda não implementado em massa: Ginecologia, Dermatologia, Pediatria, Cardiologia, Ortopedia e Oftalmologia.

## Persistência validada

Em produção:

- profissional clínico acessa `Anamneses & Avaliações`;
- biblioteca é carregada por RLS corretamente;
- modelo pode ser iniciado dentro do Encounter;
- draft persiste;
- sair e retornar reabre o mesmo draft do appointment;
- respostas persistidas permanecem presentes.

Quando existe draft do Encounter atual, o sistema prioriza retomá-lo. Uma UX futura pode tornar o estado “rascunho em andamento” mais explícito sem criar outro engine.

---

# Reconciliação de leitura da biblioteca — #414 / #415

Produção revelou drift de RLS: professional ativo, com tenant e identidade clínica válidos, resolvia capabilities mas recebia 0 linhas de `assessment_templates` e `assessment_template_versions`.

A causa efetiva era policy legacy presa ao gate histórico `owner/admin/fisio`.

## #414

Reassertou apenas policies de SELECT da biblioteca:

- platform visível;
- própria clínica visível;
- zero cross-tenant;
- usuário sem clinic ativa fail-closed;
- nenhuma ampliação de authoring/administração;
- nenhuma mudança em `clinical_assessments`, Body Map, capabilities, frontend ou conteúdo dos templates.

Migration aplicada e validada em produção.

## #415

Endureceu o verifier para probes opcionais sem alterar runtime/RLS.

Validação final:

```text
active professional read probe: PASS
cross-tenant isolation: PASS
optional disabled professional probe: safely skipped when absent
ASSESSMENT LIBRARY READ AUTHORIZATION RECONCILIATION VERIFY PASSED
```

---

# Nexus

Nexus permanece domínio clínico especializado, separado do Assessment Engine, sob boundaries C-01–C-06 e `nexus.*` fail-closed.

Não transformar PHQ-9/GAD-7 ou instrumentos validados em templates comuns apenas para contornar autorização.

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

# Regra de continuidade e documentação

Toda slice que alterar comportamento visível deve atualizar:

- este snapshot quando mudar estado atual relevante;
- documento do domínio;
- `docs/MANUAL_SOURCE_MAP.md` quando impactar o futuro manual.

Estados editoriais permitidos:

```text
VALIDADO EM PRODUÇÃO
IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / DEPRECATED
```

O futuro manual deve ser gerado a partir do comportamento **validado** e das telas reais, nunca de backlog/prompts/intenção.

---

## Próximo passo imediato

A slice visual do Clinical Encounter está fechada.

Ao iniciar a próxima frente, não reabrir #417/#420 sem uma regressão concreta. Partir deste estado canônico e escolher a próxima slice por impacto de produto/fundação.