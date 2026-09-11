# MedicsPro — Current State

> **Snapshot de continuidade. `AGENTS.md` contém as regras operacionais; código, schema e runtime atuais prevalecem se este arquivo envelhecer.**

**Data do snapshot:** 2026-09-11  
**Base canônica observada:** `main@9aa1a9f417838bff9425ff2d9fd276e53f8a7b58`

## Leitura obrigatória para qualquer agente

1. `AGENTS.md`
2. este arquivo
3. o documento do domínio em que a tarefa atua
4. `docs/MANUAL_SOURCE_MAP.md` quando a mudança alterar comportamento visível ao usuário

Referências clínicas principais:

- `docs/ASSESSMENT_ENGINE.md`
- `docs/MEDICSPRO_ASSESSMENT_LIBRARY_V1.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`
- `docs/CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.md`
- `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`

A regra institucional permanece: **`OARANHA/crmfisio` é o runtime canônico; `OARANHA/medicspro` é referência histórica de produto/UX/workflow, nunca de arquitetura/autorização; `OARANHA/nexus` é upstream/laboratório de inteligência clínica, não um segundo runtime do produto.**

---

## Produto e arquitetura — resumo executivo

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

`platform_admin` é um domínio separado e não recebe acesso clínico implícito.

`role` não é profissão. Identidade clínica, profissão, conselho/registro, capability e relação assistencial compõem autorização clínica. Especialidade serve para relevância, ordenação e sugestão; **não concede ACL**.

Princípio clínico obrigatório:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

---

# Estado atual do Clinical Cockpit

O fluxo clínico atual para atendimento em andamento usa um workspace de Encounter com três superfícies principais:

```text
Registro
Anamneses & Avaliações
Nexus
```

A tela mantém contexto do paciente, estado da consulta e identidade clínica do profissional.

O prontuário longitudinal/histórico continua disponível como referência secundária; ele não substitui o registro da consulta atual.

## Registro

O profissional registra o atendimento no Encounter atual. O desenho canônico evita obrigar o usuário a preencher uma segunda evolução universal paralela quando o Encounter já é a fonte clínica da consulta.

A finalização deve preservar histórico e regras clínicas/financeiras existentes. Correções posteriores devem ser auditáveis, não mutações silenciosas de histórico.

## Anamneses & Avaliações

Esta superfície usa o **Assessment Engine canônico**.

Comportamento validado em produção em 2026-09-11:

- profissional clínico consegue abrir `Anamneses & Avaliações`;
- biblioteca de modelos é carregada por RLS corretamente;
- um modelo pode ser iniciado dentro do Encounter;
- draft é persistido;
- sair da página e retornar reabre o mesmo draft do appointment;
- campos já preenchidos permanecem persistidos;
- o Runner trabalha por seções, não como um formulário gigante em uma única página.

Quando existe draft do Encounter atual, o sistema prioriza retomá-lo. A melhoria futura de UX pode tornar isso mais explícito com estado “rascunho em andamento”, sem criar outro engine.

## Nexus

O Nexus médico avançado continua sob os boundaries C-01–C-06 e `nexus.*` fail-closed.

Não confundir Nexus com o Assessment Engine. PHQ-9/GAD-7 e instrumentos validados permanecem no eixo de Clinical Instruments/Nexus conforme seus contratos; não viram templates comuns apenas para contornar autorização.

---

# Assessment Engine — contrato atual

O engine existente é a única fundação para anamneses e avaliações estruturadas.

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

Não criar um segundo forms engine.

## Biblioteca MedicsPro V1

A Biblioteca V1 foi mergeada no PR **#413** e aplicada/validada em produção.

Modelos publicados inicialmente:

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

Ambas são `platform-owned`, ativas e publicadas.

Especialidade só altera relevância/ordenação. Um médico psiquiatra pode receber a Psiquiátrica com maior destaque, mas isso não é autorização.

A Biblioteca segue a diretriz:

```text
click-first, prose-when-needed
```

Usar rádio, checkbox, select, sim/não e escala quando clinicamente seguro; manter narrativa para nuance, história, síntese, exame mental e risco contextual.

Não duplicar PHQ-9/GAD-7, medicamentos, alergias, problemas ou diagnósticos que já tenham fonte canônica própria.

Backlog histórico já catalogado para futuras slices: Ginecologia, Dermatologia, Pediatria, Cardiologia, Ortopedia e Oftalmologia. Não implementar em massa sem curadoria clínica e UX.

---

# Reconciliação de leitura da biblioteca — #414 / #415

Produção revelou drift real de RLS: um `professional` ativo, com tenant e identidade clínica válidos, conseguia resolver suas capabilities mas recebia **0 linhas** de `assessment_templates` e `assessment_template_versions`.

A causa efetiva era uma policy de leitura legacy presa ao gate histórico `owner/admin/fisio`.

## #414 — correção aplicada

PR **#414** reassertou apenas as policies de SELECT da biblioteca:

- leitura de modelos platform;
- leitura de modelos da própria clínica;
- zero leitura cross-tenant;
- usuário sem clinic ativa continua fail-closed;
- nenhuma ampliação de authoring/administração;
- nenhuma mudança em `clinical_assessments`, Body Map, capabilities, frontend ou template content.

Migration aplicada em produção e validada.

## #415 — hardening do verifier

O verifier inicial usava `\gset` para um probe opcional de professional desativado e parava quando produção não possuía uma linha desse tipo.

PR **#415** tornou os probes opcionais determinísticos sem alterar runtime ou RLS.

Validação final de produção:

```text
active professional read probe: PASS
cross-tenant isolation: PASS
optional disabled professional probe: safely skipped when absent
ASSESSMENT LIBRARY READ AUTHORIZATION RECONCILIATION VERIFY PASSED
```

A correção está funcionalmente confirmada pela UI: o Dr. Médico Nexus carregou a Anamnese Médica Geral dentro do Encounter e o draft persistiu após sair e retornar.

---

# Compactação visual do Clinical Encounter — #417

**Status:** IMPLEMENTADO EM `main`; aguarda redeploy do frontend e aceitação visual em produção.  
**Merge:** `main@9aa1a9f417838bff9425ff2d9fd276e53f8a7b58`.  
**Natureza:** frontend/UX only.  
**Não envolve:** migration, RLS, capability, backend, Edge Function, Assessment Engine contract, conteúdo clínico ou persistência.

Problemas tratados:

1. excesso de altura no topo;
2. breadcrumb `‹ Pacientes` redundante durante Encounter ativo;
3. cards laterais altos demais;
4. `Estado da consulta` sofrendo clipping/ocultação parcial durante scroll;
5. baixa densidade vertical da área principal.

Mudanças mergeadas:

- Encounter hero mais compacto, com menos padding, gaps, raio e sombra;
- breadcrumb `Pacientes` e `PatientProfileHeader` deixam de ocupar espaço durante Encounter ativo; fora do Encounter permanecem iguais;
- rail lateral reduzido para `238px` em desktop XL;
- cards `Estado da consulta` e `Paciente em contexto` mais densos;
- sticky lateral alinhado ao header real do shell, que possui `68px`;
- offset: `top: calc(68px + 0.75rem)`;
- altura máxima: `calc(100vh - 68px - 1.5rem)`;
- `overflow-y-auto` somente no rail quando necessário;
- seções principais com padding e espaçamento vertical reduzidos.

Validação técnica da slice:

```text
boundary test: 15/15 PASS antes da publicação
full tests: 405/405 PASS antes da publicação
typecheck: PASS
lint: PASS
build: PASS
GitHub Actions no head final: 9/9 workflows PASS
```

Durante a revisão do PR foi removida uma linha de SHA acidental que havia sido anexada ao arquivo de teste; o head foi revalidado antes do merge.

A aceitação visual ainda está **pendente** porque o browser remoto do agente bloqueou o preview local com `ERR_BLOCKED_BY_CLIENT`. Não marcar esta slice como `VALIDADO EM PRODUÇÃO` antes de:

- redeployar o frontend;
- conferir 1366×768, 1440×900 e 1920×1080 quando possível;
- confirmar ausência de clipping do `Estado da consulta` durante scroll;
- confirmar que o breadcrumb realmente desaparece no Encounter ativo;
- confirmar que mais conteúdo do Runner fica visível acima da dobra;
- confirmar que salvar/retomar draft permanece intacto.

Se houver apenas ajustes cosméticos pequenos após a validação real, fazer micro-slice visual; não reabrir arquitetura clínica nem autorização.

---

# Appointment temporal boundary — estado consolidado

#399 e #400 já estão mergeados e validados.

Contrato:

- appointment futuro não entra normalmente em `em_atendimento`;
- guard temporal protege início de consulta;
- instrumentos/atos clínicos não devem contornar esse boundary;
- bypass é reservado a contexto trusted/maintenance controlado.

O appointment histórico conhecido que havia permanecido em estado inválido foi reparado de forma controlada e não deve ser reparado novamente.

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

Provisionamento, suporte e administração da plataforma não podem virar bypass implícito de dados clínicos.

---

# Financeiro — direção preservada

Fluxo de produto esperado:

```text
Atendimento finalizado
→ pacote/cobrança
→ contas a receber / pagamentos
→ baixa / resolução
→ relatórios
```

Já existem fundações para integridade do ciclo financeiro, `paid_at`, settlements, cancelamento prepaid e exceções financeiras. Não presumir que todo P1/P2 financeiro está fechado sem inspeção fresca.

Integrações futuras de pagamentos devem manter dois planos distintos:

1. MedicsPro cobrando a clínica pelo SaaS;
2. clínica usando seu próprio merchant/provider para receber do paciente.

---

# Regra de continuidade e documentação

Toda slice que alterar comportamento visível ao usuário deve atualizar:

- este snapshot, se mudar estado atual relevante;
- o documento do domínio;
- `docs/MANUAL_SOURCE_MAP.md`, quando a mudança impactar o futuro manual do usuário.

Não documentar comportamento planejado como se já estivesse implementado. Marcar claramente:

```text
VALIDADO EM PRODUÇÃO
IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / DEPRECATED
```

O futuro manual do sistema deve ser gerado a partir do comportamento **validado** e das telas reais, não de backlog, prompts ou intenção de produto.

---

## Próximo passo imediato

Redeployar o frontend contendo `main@9aa1a9f417838bff9425ff2d9fd276e53f8a7b58` e executar aceitação visual real do Clinical Encounter.

Checklist pós-redeploy:

1. confirmar desaparecimento do breadcrumb `‹ Pacientes` no Encounter ativo;
2. comparar altura do topo e quantidade de formulário acima da dobra;
3. rolar a tela e validar o sticky do rail esquerdo sem clipping;
4. verificar se o scroll interno lateral só aparece quando necessário;
5. alternar Registro → Anamneses & Avaliações → Nexus → Anamneses & Avaliações;
6. confirmar persistência/retomada do draft;
7. capturar screenshots oficiais se o resultado estiver aprovado;
8. somente então atualizar este snapshot e `MANUAL_SOURCE_MAP.md` para `VALIDADO EM PRODUÇÃO`.
