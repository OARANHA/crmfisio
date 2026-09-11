# MedicsPro — Current State

> **Este arquivo é um snapshot de continuidade. AGENTS.md contém as regras operacionais. Código/schema atuais prevalecem quando o snapshot envelhecer.**

**Data do snapshot:** 2026-09-11  
**Base canônica observada:** `main@52c6bfa49cbdbf50e57220a712ca9d38654ab347`

## Leitura obrigatória para continuidade

Depois de `AGENTS.md`, todo agente deve ler este arquivo.

Para trabalho em Platform Admin, configurações, planos, entitlements, WhatsApp, templates, assinaturas ou provedores, ler também:

- [`docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`](PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md)
- [`docs/MEDICSPRO_LEGACY_REUSE_MAP.md`](MEDICSPRO_LEGACY_REUSE_MAP.md)

A regra institucional permanece: **`OARANHA/crmfisio` é o runtime canônico; `OARANHA/medicspro` é referência histórica obrigatória de produto/UX/workflow quando houver equivalente maduro, nunca fonte de arquitetura/autorização.**

## Produto e arquitetura em poucas linhas

MedicsPro é um SaaS multiprofissional para clínicas.

Combina ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente.

O fluxo central é **Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação**.

O núcleo clínico é compartilhado entre profissões.

`role` operacional não é profissão.

Papéis canônicos da clínica: `owner`, `admin`, `professional`, `recep`, `financeiro`.

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

`OARANHA/medicspro` é referência histórica obrigatória de UX/workflow para domínios maduros equivalentes.

Regra institucional: **não portar o velho MedicsPro; absorver o que ele entendia bem sobre o profissional e sobre a operação do SaaS.**

---

## Decisão canônica — Platform Control Plane × Configuração da Clínica

A arquitetura de produto agora registra explicitamente três níveis separados:

```text
PLATFORM ADMIN
    ↓ define o produto SaaS disponível para a clínica

ADMINISTRAÇÃO DA CLÍNICA
    ↓ configura como o tenant usa o que contratou

USUÁRIO / PROFISSIONAL
    ↓ usa somente o que role + identidade + capability + contexto autorizam
```

Contrato canônico:

```text
PLATFORM ENTITLEMENT
        ↓
CLINIC CONFIGURATION
        ↓
USER AUTHORIZATION / CAPABILITY
        ↓
RESOURCE / ENCOUNTER CONTEXT
```

Nunca colapsar essas camadas em um único boolean/menu.

### Platform Admin administra o SaaS

O Platform Admin pode operar:

- lifecycle e provisionamento de clínicas;
- owner/onboarding;
- planos;
- entitlements;
- limites/uso;
- overrides;
- assinatura/receita do SaaS;
- provedores globais;
- saúde de integrações;
- catálogos globais;
- rollout/feature flags;
- governança, auditoria e suporte;
- equipe administrativa da plataforma.

Platform Admin **não recebe acesso implícito ao prontuário clínico nem ao financeiro detalhado de pacientes**.

Suporte futuro que exija dado tenant-sensitive deve possuir boundary separado, temporário, justificado e auditado.

### Administração da clínica

Owner/admin do tenant configuram, dentro dos entitlements:

- identidade/unidades/horários;
- equipe e acessos;
- serviços/procedimentos;
- clínico: avaliações padrão, Minhas avaliações, documentos, consentimentos e protocolos;
- comunicação: WhatsApp, templates, automações, opt-in e NPS;
- financeiro/configuração econômica permitida;
- integrações próprias quando aplicável;
- governança tenant-side.

### Precedência de produto

Direção de longo prazo:

```text
DEFAULT DA PLATAFORMA
        ↓
PLANO
        ↓
OVERRIDE EXPLÍCITO DA CLÍNICA
        ↓
ENTITLEMENT EFETIVO
        ↓
CONFIGURAÇÃO DA CLÍNICA
        ↓
AUTORIZAÇÃO DO USUÁRIO
```

Alterar plano/entitlement/override não deve apagar histórico.

O `PlatformClinicEntitlementsPanel` atual já possui a foundation conceitual para `nexus.access`, `finance.access`, `crm.access`, `reports.access`, `assessments.custom` e `whatsapp.access`. Evoluir esta foundation antes de criar sistema paralelo.

### WhatsApp

Separação obrigatória:

```text
Platform Admin
→ provider global, health, instâncias, filas, consumo, limites e falhas

Admin da clínica
→ conexão/número, QR quando aplicável, templates, opt-in, automações e preferências

Usuário operacional
→ ações autorizadas no contexto do paciente/appointment
```

A fila/reconciliação/idempotência atuais prevalecem sobre a simplicidade do sistema histórico.

### Templates e catálogos

Não existe um único domínio “template”. Separar:

- avaliações estruturadas;
- instrumentos clínicos validados;
- documentos clínicos;
- consentimentos/termos;
- templates de comunicação.

Para conteúdo customizável, direção:

```text
MODELO GLOBAL MEDICSPRO
→ clínica adota/clona
→ clínica personaliza
→ versão publicada
→ uso no paciente/Encounter
→ snapshot/histórico imutável
```

`Avaliações padrão` e `Minhas avaliações` devem convergir no Assessment Engine existente quando se tratar de assessment estruturado.

PHQ-9/GAD-7 **não** viram templates comuns para contornar authorization; continuam na engine/versionamento/scoring canônicos do eixo Clinical Instruments/Nexus.

### Consulta direta ao MedicsPro histórico

A auditoria direta do `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83` confirmou conceitos úteis em:

- `crm-clinic-admin/src/router/index.js`;
- `FeaturesManagerView.vue`;
- `PlansManagerView.vue`;
- `ClinicDetailView.vue`;
- `WhatsappView.vue`;
- `AdminManagementView.vue`;
- templates/anamnese/documentos mapeados em `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`.

Antes de redesenhar domínio com equivalente histórico maduro, o agente deve **abrir diretamente o legado e o runtime atual** e classificar: `preservar | evoluir | redesenhar | rejeitar`.

Detalhes e etapas estão em `docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`.

---

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

**Repository state:** Clinical Instrument Authorization Foundation implementada e mergeada.

Ela entrega:

- capability explícita `clinical.instrument.apply`, sem auto-grant por profissão/especialidade;
- catálogo neutro `clinical_instrument_catalog`, separado do registry Nexus, com exposição explícita somente de `phq9` e `gad7` nesta slice;
- vínculo técnico do catálogo neutro com os contratos versionados da engine Nexus, sem duplicar definição, perguntas, validação ou scoring;
- configuração institucional `clinic_clinical_instrument_settings`, default `false`;
- boundary server-side `can_apply_clinical_instrument_in_encounter(...)`, restrito ao próprio `appointments.professional_id`, Encounter ativo e boundary temporal efetivo após #400;
- owner/admin sem bypass de ato clínico;
- helper base não executável pelo browser.

Membership em `nexus_result_contracts` não equivale a exposição multiprofissional. Uma escala Nexus nova só entra na superfície neutra se for explicitamente adicionada ao catálogo clínico controlado.

PHQ-9/GAD-7 continuam usando definição, versão, validação e scoring da engine canônica Nexus. `clinical.assessment.apply` continua distinto de `clinical.instrument.apply`.

**Production state:** #399 já compõe o stack efetivo de produção e foi revalidada pelo regression harness após #400.

Ainda **não** existem:

- Clinician-Assisted Administration;
- novo contrato de persistência multiprofissional de resultados;
- UI PHQ/GAD no Encounter;
- entrega remota/`Enviar ao paciente`.

---

## #400 — Encounter Temporal Start Boundary

PR #400 mergeado e stack efetivo aplicado/verificado em produção.

Contrato:

- appointment futuro não entra normalmente em `em_atendimento`;
- `current_clinic_operational_date()` centraliza a data operacional atual;
- guard de INSERT/UPDATE protege o início temporal;
- bypass somente em contexto trusted/maintenance controlado;
- #399 recebe defesa em profundidade para não aplicar instrumento em appointment futuro;
- verifier histórico foi tornado future-compatible e não congela a implementação de timezone;
- regression efetivo reexecuta a matriz #399 após #400.

Timezone por clínica continua evolução futura antes de operar fora da premissa atual de São Paulo; não reabrir #400 por isso agora.

### Repair histórico decorrente de #400

O appointment conhecido `de857836-baa0-476f-bd7b-d6f52df33007` foi reparado de forma controlada em produção:

- estado histórico incorreto `em_atendimento` → restaurado para `agendado`;
- preconditions/read-only probes executados antes da mutação;
- histórico canônico confirmou `agendado → em_atendimento` como transição indevida;
- nenhum Encounter Record, evolução, pagamento, exceção financeira ou consumo de pacote material bloqueava o repair;
- `clinical_assessments` possuía apenas um draft vazio, não finalizado e semanticamente compatível com o appointment restaurado; permaneceu intocado;
- triggers permaneceram ativos;
- audit history canônico foi preservado;
- postcheck read-only concluído.

Commit operacional de registro na `main`: `52c6bfa49cbdbf50e57220a712ca9d38654ab347`.

Não repetir esse repair.

---

## Instrument Delivery — sequência

Estado atual:

```text
[x] Clinical Instrument Authorization Foundation (#399)
[ ] Clinician-Assisted Administration
[ ] Encounter Instrument UX
[ ] Consultório V5 integration/polish
```

O contrato de UX futuro continua sendo:

```text
PHQ-9
[Aplicar agora] [Enviar ao paciente]

GAD-7
[Aplicar agora] [Enviar ao paciente]
```

`Aplicar agora` representa administração presencial/assistida durante a consulta, sem depender de celular ou WhatsApp. `Enviar ao paciente` representa administração remota/self-assessment e requer boundary próprio.

O modo de aplicação não muda a identidade/versionamento do instrumento e deve reutilizar o mesmo scoring validado. A provenance futura deve distinguir conceitualmente `patient_self` e `clinician_assisted`, preservando autoria do ato profissional e `appointment_id` quando houver Encounter.

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

---

## Marcos recentemente fechados / implementados

- #390 — Clinician Daily Home.
- #391 — Agenda Role-Aware V4.
- #392 — Clinical Encounter UX V4.
- #393 — Legacy Clinical Reconciliation V4.1.
- #394 — Encounter Clinical Record Foundation.
- #395 — Production-safe verifier read-only para #394.
- #396 — Consultório / Gestão Privacy Shell.
- #399 — Clinical Instrument Authorization Foundation, efetiva no stack verificado.
- #400 — Encounter Temporal Start Boundary, efetiva em produção.
- repair controlado pós-#400 do único appointment histórico conhecido em estado futuro incorreto.
- Nexus C-01–C-06 hardening.
- #388 — separação finalização clínica × falha esperada de cobertura.
- #389 — resolução explícita de exceção financeira.

---

## Produção / migrations relevantes

### Confirmado até 2026-09-11

- `20260910_clinical_encounter_record_foundation.sql` (#394) aplicada e production-safe verifier aprovado.
- stack #399 efetivo e regression revalidado após #400.
- `20260910_encounter_temporal_start_boundary.sql` (#400) aplicada/verificada.
- repair histórico decorrente de #400 concluído e registrado.
- Clinical Foundation passou nos checks observados.
- Clinical Authorization passou nos checks observados.
- Financial Exception Resolution #389 passou no ambiente verificado.

### Não reaplicar por causa deste snapshot

- não reaplicar #394, #399 ou #400 apenas porque documentação antiga as descreva como futuras;
- não repetir o repair do appointment histórico;
- não executar o verifier comportamental `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_FOUNDATION.sql` diretamente em produção quando ele depender de fixtures/harness;
- para inspeção read-only do #394 usar o verifier production-safe apropriado;
- não usar a assertion histórica do verifier #388 que espera ausência da RPC criada posteriormente pelo #389 como verdade do schema atual.

O ledger/schema real de produção continua sendo autoridade para migrations anteriores; este snapshot não substitui inspeção de migration history.

---

## Evidência operacional conhecida

O smoke real do draft #394 comprovou:

- Encounter Record persistido;
- refresh/navegação preservaram conteúdo;
- revision do draft observada;
- antes da finalização: **1 record, 0 Evolutions, 0 payments, 0 financial exceptions** no cenário exercitado.

Ainda tratar como pendência curta qualquer prova read-only pós-finalização que não esteja registrada em evidência posterior acessível ao agente.

Também não declarar smoke real de `CHARGE`/`WAIVE` como concluído sem evidência específica.

---

## Pendências operacionais abertas

- prova read-only pós-finalização do smoke #394, se ainda não houver evidência registrada;
- smoke real das ações #389 `CHARGE` e `WAIVE`, se ainda não registrado;
- atualizar/versionar a assertion obsoleta do verifier #388;
- smoke visual/uso real de #396 e Encounter com profissionais reais;
- observabilidade suficiente para ampliar piloto com segurança.

Não há rollout pendente de #399/#400 neste snapshot.

---

## Programa Platform Admin / Configurações — estado

A arquitetura foi documentada, mas **não significa implementação completa**.

Etapas canônicas quando esse programa for retomado:

```text
0. reconciliar estado/docs e fechar P0s abertos
1. inventário Platform Admin atual × MedicsPro histórico
2. control plane mínimo: clínicas + plano + entitlements + limites + overrides + auditoria
3. arquitetura de Configurações da Clínica
4. WhatsApp como capability SaaS configurável
5. catálogos/templates
6. receita & assinaturas da plataforma
7. delegação/suporte de plataforma
8. inteligência operacional
```

Não iniciar tudo simultaneamente. Selecionar uma vertical slice 80/20 por vez.

O próximo agente deste eixo deve começar pelo **inventário comparativo atual × histórico** descrito no documento canônico, e não por uma tela isolada.

---

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
14. `platform_admin` administra o SaaS e não recebe prontuário universal.
15. Entitlement ≠ clinic configuration ≠ user authorization.
16. Receita/assinatura MedicsPro ≠ Financeiro paciente→clínica.
17. WhatsApp separa provider da plataforma, configuração tenant e autorização operacional.
18. Templates clínicos/documentais precisam de versionamento/snapshot apropriado ao domínio.
19. PHQ-9/GAD-7 não devem ser duplicados como templates genéricos para contornar authorization.
20. Antes de redesenhar domínio com equivalente maduro, consultar diretamente o MedicsPro histórico e comparar com o runtime atual.