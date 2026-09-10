# MedicsPro — Current State

> **Este arquivo é um snapshot de continuidade. AGENTS.md contém as regras operacionais. Código/schema atuais prevalecem quando o snapshot envelhecer.**

**Data do snapshot:** 2026-09-10  
**Base auditada da #399:** `2385cf1bc1cf9b7ee4f60578413baa37d798a728`

## Produto e arquitetura em poucas linhas

MedicsPro é um SaaS multiprofissional para clínicas.

Combina ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente.

O fluxo central é **Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação**.

O núcleo clínico é compartilhado entre profissões.

`role` operacional não é profissão.

Papéis canônicos: `owner`, `admin`, `professional`, `recep`, `financeiro`.

`platform_admin` pertence a um domínio separado da clínica.

`professional_id` é a referência clínica canônica; `fisio_id` é compatibilidade residual onde ainda existir.

Atos clínicos exigem identidade/capability/autoria ou relação assistencial adequadas, não apenas role.

O novo atendimento usa um Encounter Record editável por appointment.

O profissional registra uma vez motivo/demandas, HDA, achados, avaliação, plano/conduta e observações.

Após revisão e confirmação humana, o Encounter Record materializa a Evolution oficial determinística e o appointment é finalizado.

Não existe uma segunda Evolution universal obrigatória no novo fluxo.

Encounter Record finalizado é histórico; correction/addendum auditável ainda não está implementado.

A finalização clínica não depende de sucesso de cobertura esperada.

`package_exhausted`, `package_expired` e `package_not_eligible` geram `appointment_financial_exception` sem consumo gratuito silencioso.

#389 resolve a exceção explicitamente: owner/admin `CHARGE|WAIVE`, financeiro `CHARGE`.

`PresentationContext = clinical | management` é apresentação/privacy shell, nunca autorização.

Professional é Consultório-only; owner/admin só alternam com identidade clínica válida + `clinical.attend`; recep/financeiro são Gestão-only.

O **Nexus médico avançado** permanece protegido pelos boundaries atuais C-01–C-06; `nexus.*` continua fail-closed. Isso não deve ser confundido com uma regra universal que transforme todo instrumento clínico atualmente implementado no subsistema Nexus em ato exclusivamente médico.

Instrumentos clínicos como PHQ-9/GAD-7 são potencialmente multiprofissionais conforme finalidade clínica, protocolo/configuração e contexto, mas profissão/especialidade nunca fazem auto-grant.

`OARANHA/crmfisio` é o runtime/produto canônico.

`OARANHA/nexus` é upstream/laboratório de inteligência clínica.

`OARANHA/medicspro` é referência histórica obrigatória de UX/workflow, nunca fonte de arquitetura/autorização atual.

Regra institucional: **não portar o velho MedicsPro; absorver o que ele entendia bem sobre o profissional.**

## Decisão canônica — instrumentos clínicos

A arquitetura de instrumentos registra explicitamente:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

Separações obrigatórias:

```text
PROFISSÃO
→ identidade e requisitos profissionais

ESPECIALIDADE
→ relevância, ordenação e sugestão

PROTOCOLO / CONFIGURAÇÃO DA CLÍNICA
→ disponibilidade institucional

CAPABILITY
→ autorização efetiva

CONTEXTO DO ENCOUNTER
→ priority/apresentação
```

Nenhuma camada concede silenciosamente outra.

Profissão/especialidade podem tornar um instrumento muito relevante sem conceder autoridade para aplicá-lo. Contextos potencialmente pertinentes para PHQ-9/GAD-7 incluem, entre outros, Psiquiatria, Medicina de Família/APS, Clínica Médica, equipes de saúde mental e Enfermagem em APS/Saúde da Família, sempre dependendo do protocolo/contexto e da autorização clínica real. Enfermagem ainda não foi adicionada ao catálogo de identidades profissionais do runtime nesta slice.

### Nexus médico avançado

Preservar sem flexibilização:

- C-01–C-06;
- `nexus.*` fail-closed;
- o significado atual de `nexus.eem`;
- entitlement/identidade/boundaries Nexus onde já são exigidos.

A multiprofissionalidade de instrumentos não é resolvida concedendo `nexus.*` a profissionais que apenas precisem administrar um instrumento.

### Instrumentos clínicos — foundation #399

**Repository state:** a Clinical Instrument Authorization Foundation foi implementada no PR #399.

Ela entrega:

- capability explícita `clinical.instrument.apply`, sem auto-grant por profissão/especialidade;
- catálogo neutro `clinical_instrument_catalog`, separado do registry Nexus, com exposição explícita somente de `phq9` e `gad7` nesta slice;
- vínculo técnico do catálogo neutro com os contratos versionados da engine Nexus, sem duplicar definição, perguntas, validação ou scoring;
- configuração institucional `clinic_clinical_instrument_settings`, default `false`;
- boundary server-side `can_apply_clinical_instrument_in_encounter(...)`, restrito ao próprio `appointments.professional_id` e status `em_atendimento`;
- owner/admin sem bypass de ato clínico;
- helper base não executável pelo browser.

Membership em `nexus_result_contracts` não equivale a exposição multiprofissional. Uma escala Nexus nova só entra na superfície neutra se for explicitamente adicionada ao catálogo clínico controlado.

PHQ-9/GAD-7 continuam usando definição, versão, validação e scoring da engine canônica Nexus. `clinical.assessment.apply` continua distinto de `clinical.instrument.apply`.

**Production state:** a migration `20260910_clinical_instrument_encounter_authorization.sql` da #399 **ainda não foi aplicada em produção**.

Portanto, neste momento:

- repository state = foundation implementada;
- production state = rollout pendente;
- nenhuma administração de PHQ-9/GAD-7 foi implementada ainda;
- nenhum novo resultado multiprofissional é persistido;
- nenhuma entrega remota/`Enviar ao paciente` foi implementada;
- nenhuma UI PHQ/GAD foi implementada.

## Instrument Delivery — sequência

Estado após eventual merge da #399:

```text
[x] Clinical Instrument Authorization Foundation (#399)
[ ] Clinician-Assisted Administration
[ ] Encounter Instrument UX
[ ] Consultório V5 integration/polish
```

O contrato de UX futuro para instrumentos como PHQ-9/GAD-7 continua sendo:

```text
PHQ-9
[Aplicar agora] [Enviar ao paciente]

GAD-7
[Aplicar agora] [Enviar ao paciente]
```

`Aplicar agora` representa administração presencial/assistida durante a consulta, sem depender de celular ou WhatsApp. `Enviar ao paciente` representa administração remota/self-assessment.

A #399 implementa somente a autorização foundation para o primeiro boundary contextual; ela não executa a administração. O modo de aplicação não muda a identidade/versionamento do instrumento e deve reutilizar o mesmo scoring validado. A provenance futura deve distinguir o modo de administração, conceitualmente `patient_self` e `clinician_assisted`, preservando autoria do ato profissional e `appointment_id` quando houver Encounter.

## PHQ-9 — requisito futuro de segurança

Resposta positiva ao item 9 deve:

- permanecer visível;
- gerar destaque para necessidade de avaliação clínica;
- preservar a resposta original;
- não equivaler isoladamente a diagnóstico;
- não gerar diagnóstico automático;
- não gerar conduta/prescrição automática.

Esse requisito permanece futuro; não representa implementação já existente de UX/administração.

## Consultório V5 — direção de UX

A direção futura, ainda não implementada, é um Clinical Cockpit organizado em torno de um único Encounter:

```text
um Encounter
├─ Registro
├─ Avaliações
├─ Instrumentos
├─ Prescrição
├─ Exames
├─ Documentos
└─ Nexus
```

A ergonomia do MedicsPro histórico deve ser absorvida seletivamente, sem portar Vue/Pinia/Mongo, autorização antiga, autosave antigo, checkout ou arquitetura legada.

## Marcos recentemente fechados / implementados no repositório

- #390 — Clinician Daily Home.
- #391 — Agenda Role-Aware V4.
- #392 — Clinical Encounter UX V4.
- #393 — Legacy Clinical Reconciliation V4.1.
- #394 — Encounter Clinical Record Foundation.
- #395 — Production-safe verifier read-only para #394.
- #396 — Consultório / Gestão Privacy Shell.
- #399 — Clinical Instrument Authorization Foundation implementada no repositório; rollout de migration ainda pendente.
- Nexus C-01–C-06 hardening.
- #388 — separação finalização clínica × falha esperada de cobertura.
- #389 — resolução explícita de exceção financeira.

## Produção / migrations relevantes

### Confirmado em 2026-09-10

- `20260910_clinical_encounter_record_foundation.sql` (#394) **já foi aplicada em produção**.
- O verifier production-safe passou com `VERIFY #394 PRODUCTION OK`.
- Clinical Foundation passou.
- Clinical Authorization passou.
- Financial Exception Resolution #389 passou no ambiente verificado.

### Rollout pendente

- `20260910_clinical_instrument_encounter_authorization.sql` (#399) está implementada e verificada no repositório/CI, mas **não foi aplicada em produção**.
- não declarar `clinical.instrument.apply`, `clinical_instrument_catalog`, `clinic_clinical_instrument_settings` ou o boundary #399 como disponíveis no schema de produção antes do rollout explícito.

### Não reaplicar por causa deste snapshot

- não reaplicar a migration #394 apenas porque um documento antigo a descreva como futura;
- não executar o verifier comportamental `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_FOUNDATION.sql` como verifier direto de produção: ele depende do harness/fixtures;
- em produção, para inspeção read-only do #394, usar `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql`;
- não usar a assertion histórica do verifier #388 que espera ausência da RPC criada posteriormente pelo #389 como verdade do schema atual.

O ledger/schema real de produção continua sendo autoridade para migrations anteriores; este snapshot não substitui uma inspeção de migration history.

## Evidência operacional conhecida

O smoke real do draft #394 comprovou:

- Encounter Record persistido;
- refresh/navegação preservaram conteúdo;
- revision do draft observada;
- antes da finalização: **1 record, 0 Evolutions, 0 payments, 0 financial exceptions** no cenário exercitado.

Não há evidência documental suficiente neste snapshot para afirmar a comprovação read-only pós-finalização desse mesmo smoke. Tratar isso como pendência curta até haver observação registrada.

Também não declarar smoke real de `CHARGE`/`WAIVE` como concluído sem evidência posterior.

## Pendências operacionais abertas

- prova read-only pós-finalização do smoke #394;
- smoke real das ações #389 `CHARGE` e `WAIVE`, se ainda não registrado;
- atualizar/versionar a assertion obsoleta do verifier #388;
- smoke visual/uso real de #396 e Encounter com profissionais reais;
- rollout da migration #399 após aprovação/merge explícitos;
- observabilidade suficiente para ampliar piloto com segurança.

## Decisões canônicas que não devem regredir

1. Encounter Record é a unidade editável do novo atendimento.
2. Evolution é a materialização oficial após confirmação humana.
3. Finalização clínica ≠ sucesso financeiro de cobertura.
4. PresentationContext ≠ autorização.
5. Parceiro/repasse ≠ role.
6. Consultório é privacy/presentation shell.
7. `professional_id` é a referência clínica canônica.
8. Nexus médico avançado mantém C-01–C-06 e `nexus.*` fail-closed; não é liberado por role/especialidade isolados.
9. Instrumentos clínicos podem ser multiprofissionais sem que isso conceda Nexus ou converta relevância em autorização.
10. `ENGINE != AUTHORIZATION != RELEVANCE`.
11. Nexus engine registry membership não equivale a multiprofessional clinical exposure.
12. Histórico finalizado não é reaberto/reescrito silenciosamente.
13. Foundations fechadas não devem ser reabertas sem evidência real.

## Próximos passos recomendados

1. fechar as evidências operacionais curtas #394/#389/#396;
2. pilotar e polir ergonomia do Encounter com profissionais reais;
3. construir **Cobertura deste atendimento** sem expor Financeiro global;
4. evoluir instrumentos a partir da foundation #399: Clinician-Assisted Administration → Encounter Instrument UX → Consultório V5 integration/polish;
5. entregar Prescription V1;
6. priorizar demais documentos médicos conforme piloto;
7. evoluir Finance Configuration para solo/equipe, categorias e parceiro %/fixo com histórico/effective dates;
8. remover fricção de onboarding e só então ampliar financeiro/integracões conforme evidência.

## Documentos especializados

- [`../AGENTS.md`](../AGENTS.md) — autoridade operacional.
- [`../PRODUCT_ROADMAP.md`](../PRODUCT_ROADMAP.md) — sequência estratégica.
- [`../TODO.md`](../TODO.md) — trabalho aberto.
- [`MULTIPROFESSIONAL_DOMAIN_MODEL.md`](MULTIPROFESSIONAL_DOMAIN_MODEL.md) — separações de role/profissão/especialidade/capability e instrumentos multiprofissionais.
- [`ASSESSMENT_ENGINE.md`](ASSESSMENT_ENGINE.md) — engine de avaliações e relação com Instrument Delivery.
- [`BETA_READINESS.md`](BETA_READINESS.md) — gates de beta.
- [`CLINICAL_ENCOUNTER_RECORD.md`](CLINICAL_ENCOUNTER_RECORD.md) — contrato do Encounter Record.
- [`PRESENTATION_CONTEXT.md`](PRESENTATION_CONTEXT.md) — Consultório/Gestão.
- [`CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.md`](CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.md) — foundation #399 e rollout pendente.
- [`CLINICAL_PILOT_ACCEPTANCE.md`](CLINICAL_PILOT_ACCEPTANCE.md) — aceite clínico.
- [`FINANCIAL_PILOT_ACCEPTANCE.md`](FINANCIAL_PILOT_ACCEPTANCE.md) — aceite financeiro.
- [`BETA_ROLLOUT_ORDER.md`](BETA_ROLLOUT_ORDER.md) — ordem operacional.
- [`BETA_RELEASE_CANDIDATE.md`](BETA_RELEASE_CANDIDATE.md) — release candidate/pilot evidence.
- [`../DEPLOY.md`](../DEPLOY.md) — implantação e rollout.

Quando este arquivo divergir do código/schema atuais, **não force o sistema a caber no snapshot**. Atualize o snapshot após verificar a fonte canônica.
