# Biblioteca MedicsPro de Anamneses V1

Origem: curadoria do MedicsPro histórico (`0fd709612598fa93a9cf0517b9ba924b1405ec83`), absorvida pela Assessment Engine canônica do `OARANHA/crmfisio`.

## Estado atual

**Status:** VALIDADO EM PRODUÇÃO em 2026-09-11.

A V1 publica apenas:

1. **Anamnese Médica Geral**
2. **Anamnese Psiquiátrica**

Ambas são `platform-owned`, ativas e possuem versão publicada imutável.

IDs estáveis:

```text
Anamnese Médica Geral
10000000-0000-4000-8000-000000000003
version 1: 11000000-0000-4000-8000-000000000003

Anamnese Psiquiátrica
10000000-0000-4000-8000-000000000004
version 1: 11000000-0000-4000-8000-000000000004
```

Especialidade é metadado de relevância/ranking; **não concede ACL**. Templates de clínica continuam no mesmo engine e não são alterados pela biblioteca platform.

## Contrato de conteúdo

A biblioteca segue:

```text
click-first, prose-when-needed
```

Usar escolha única, múltipla escolha, sim/não e escala quando clinicamente seguros; preservar narrativa para história, síntese, exame mental e risco contextual.

Medicamentos e alergias são snapshots contextuais, não substitutos da fonte canônica de prescrições/cadastro clínico. PHQ-9/GAD-7 permanecem no eixo de Instrumentos Clínicos/Nexus e não devem ser duplicados como perguntas comuns apenas para contornar autorização/versionamento.

Não há lógica condicional nesta V1 porque o engine atual não a suporta. Não criar conditionals paralelos fora do engine.

## Integração no Encounter

A superfície canônica é:

```text
Clinical Encounter
→ Anamneses & Avaliações
→ ClinicalAssessmentRunner
→ template publicado
→ draft do appointment
→ save/resume
→ finalização/histórico
```

Comportamento validado em produção:

- professional clínico autenticado consegue ler a biblioteca platform;
- cross-tenant continua invisível;
- ao iniciar uma anamnese, o draft é associado ao Encounter/appointment;
- sair da página e retornar reabre o mesmo draft;
- respostas persistem corretamente;
- Runner navega por seções;
- não há segundo forms engine.

## Reconciliação de RLS

Após o PR #413, produção revelou drift de leitura em `assessment_templates` e `assessment_template_versions`: professional válido recebia zero linhas por uma policy legacy presa a `owner/admin/fisio`.

### #414

Reassertou somente as policies de SELECT da biblioteca:

- platform + same-clinic visíveis;
- cross-tenant negado;
- usuário sem clinic ativa fail-closed;
- nenhuma mudança em authoring/administração, `clinical_assessments`, Body Map, capabilities ou frontend.

Migration aplicada e verificada em produção.

### #415

Tornou os probes opcionais do verifier determinísticos quando não há professional desativado em produção. Não alterou runtime.

Resultado final:

```text
ASSESSMENT LIBRARY READ AUTHORIZATION RECONCILIATION VERIFY PASSED
```

A UI confirmou o resultado real com o Dr. Médico Nexus: a **Anamnese Médica Geral** abriu dentro do atendimento e o draft permaneceu persistente após navegação de saída/retorno.

## UX atual e slice em andamento

A funcionalidade está correta. A próxima slice aprovada é apenas de densidade visual do Clinical Encounter:

- compactar header do atendimento;
- reduzir chrome/breadcrumb redundante;
- compactar cards `Estado da consulta` e `Paciente em contexto`;
- corrigir clipping/sticky da lateral;
- aumentar conteúdo do Runner visível acima da dobra.

Essa slice é **frontend-only** e não pode alterar engine, RLS, capabilities, conteúdo das anamneses ou persistência.

## Backlog histórico

Backlog de especialidades já catalogado:

- Ginecologia
- Dermatologia
- Pediatria
- Cardiologia
- Ortopedia
- Oftalmologia

O inventário histórico reportado contém 181 **itens de formulário** (perguntas, opções, agrupamentos e elementos auxiliares), não 181 perguntas.

Antes da próxima especialidade, preservar arquivo-fonte histórico + inventário detalhado para contagem auditável e classificar cada item como `KEEP | ADAPT | MERGE | REFERENCE | DROP | INSTRUMENT` antes de curar o novo template.
