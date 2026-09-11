# MedicsPro — Current State

> **Snapshot operacional de continuidade. `AGENTS.md` contém as regras de operação. Código/schema atuais prevalecem se este documento envelhecer.**

**Data do snapshot:** 2026-09-11  
**Base funcional observada:** `main@18eac7291d81952f82c23118ed7c8115780b7782`

## Leitura obrigatória

Depois de `AGENTS.md`, todo agente deve ler este arquivo.

Para trabalho em Platform Admin, configurações, planos, entitlements, WhatsApp, templates, assinaturas ou provedores, ler também:

- [`docs/PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md`](PLATFORM_CONTROL_PLANE_AND_CLINIC_CONFIGURATION.md)
- [`docs/MEDICSPRO_LEGACY_REUSE_MAP.md`](MEDICSPRO_LEGACY_REUSE_MAP.md)

Para atendimento ativo e Clinical Cockpit, ler também:

- [`docs/CLINICAL_COCKPIT_V5.md`](CLINICAL_COCKPIT_V5.md)

Regra institucional: **`OARANHA/crmfisio` é o runtime canônico; `OARANHA/medicspro` é referência histórica obrigatória de produto/UX/workflow quando houver equivalente maduro, nunca fonte de arquitetura/autorização.**

---

## Produto em poucas linhas

MedicsPro é um SaaS multiprofissional para clínicas que combina ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente.

Fluxo central:

```text
Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação
```

Papéis canônicos da clínica:

- `owner`
- `admin`
- `professional`
- `recep`
- `financeiro`

`platform_admin` pertence a um domínio separado da clínica.

`role` não é profissão. `professional_id` é a referência clínica canônica; `fisio_id` permanece apenas como compatibilidade residual onde ainda existir.

Atos clínicos exigem identidade + capability + autoria/relação assistencial apropriadas. Owner/admin não recebem bypass clínico por função administrativa.

---

## Estado do fluxo clínico principal

### Foundations já fechadas

- #390 — Clinician Daily Home.
- #391 — Agenda Role-Aware V4.
- #392 — Clinical Encounter UX V4.
- #393 — Legacy Clinical Reconciliation V4.1.
- #394 — Encounter Clinical Record Foundation.
- #395 — production-safe verifier do #394.
- #396 — Consultório / Gestão Privacy Shell.
- #399 — Clinical Instrument Authorization Foundation.
- #400 — Encounter Temporal Start Boundary.
- #402 — repair controlado do único appointment histórico futuro inválido conhecido.
- #404 — sincronização documental pós-repair.
- #410 — Clinical Cockpit V5 + Assessment Runner V2.
- #411 — hotfix de ordem responsiva do Clinical Cockpit V5.

### Encounter Record

O novo atendimento usa **um Encounter Record editável por appointment**.

O profissional registra uma única vez:

- motivo/demanda;
- HDA/história atual;
- achados/exame;
- avaliação clínica/problemas;
- plano/conduta;
- observações.

Após revisão e confirmação humana, o Encounter Record materializa a Evolution oficial determinística e o appointment é finalizado.

**Não criar uma segunda Evolution universal obrigatória.**

Encounter Record finalizado é histórico/read-only. Correção/adendo auditável ainda é evolução futura; nunca sobrescrever silenciosamente o histórico.

### Finalização clínica × cobertura financeira

Após #388, falhas esperadas de cobertura não invalidam uma finalização clínica válida.

`package_exhausted`, `package_expired` e `package_not_eligible` geram `appointment_financial_exception`, sem consumo gratuito silencioso.

#389 adiciona resolução explícita:

- owner/admin: `CHARGE | WAIVE`;
- financeiro: `CHARGE`;
- recep/professional: sem ação de resolução.

---

## Clinical Cockpit V5 — estado atual

**Implementado e mergeado em #410; correção visual estrutural mergeada em #411.**

O atendimento ativo agora é composto como um cockpit, não como uma sequência vertical de todas as superfícies.

Workspaces reais atuais:

```text
[ Registro ] [ Anamneses & Avaliações ] [ Nexus ]
```

Princípios:

- Registro é o workspace inicial;
- uma superfície principal por vez;
- patient/context rail persiste em desktop;
- mobile/tablet priorizam o workspace principal antes do rail;
- desktop XL usa rail de 250px à esquerda e workspace flexível à direita;
- não existem tabs cenográficas de Prescrição/Exames/Instrumentos sem contrato real;
- Encounter Record, finalização, capabilities, refresh financeiro/pacote e boundaries Nexus permanecem os mesmos contratos canônicos.

### #411 — correção responsiva

A revisão visual pós-#410 encontrou um P1 de composição: o `main` estava ocupando a primeira coluna de 250px porque só o `aside` possuía ordem explícita.

#411 corrigiu isso:

- `aside`: `order-2 xl:order-1`;
- `main`: `order-1 xl:order-2`.

Consequência esperada:

- mobile/tablet: workspace primeiro, contexto depois;
- desktop XL: contexto na rail de 250px e workspace na largura restante.

**Nenhuma migration, RLS, RPC, Edge Function ou backend foi alterado por #410/#411.**

### Rollout atual

#410 foi redeployada e inspecionada em produção; essa inspeção revelou o P1 corrigido pela #411.

Após o merge da #411, o único passo operacional pendente é:

1. redeploy somente do frontend atual;
2. repetir smoke visual de Registro, Anamneses & Avaliações e Nexus;
3. confirmar o runner por seções, autosave e responsividade;
4. tratar apenas regressões concretas antes de abrir a próxima feature.

Não existe ação de banco para esse rollout.

---

## Assessment Engine / Anamneses & Avaliações

### #409 — Config UX V1.1 + Assessment Template Library V1

#409 foi mergeada, migration aplicada e verifier de produção passou.

Entregue:

- navegação horizontal compacta em Configurações;
- área **Anamneses & Avaliações**;
- `Biblioteca MedicsPro`;
- `Modelos da clínica`;
- cards;
- drawer de criação/edição;
- seções e perguntas;
- tipos estruturados do Assessment Engine;
- draft/version/publish/archive;
- validação e dirty-state;
- autoria customizada fail-closed por `assessments.custom` explícito.

O smoke real confirmou salvar draft e publicar versão.

### Assessment Runner V2 (#410)

O runner ativo do Encounter agora:

- mostra apenas uma seção por vez;
- calcula progresso sem contar `heading`/`info` como resposta;
- preserva respostas entre Anterior/Próxima;
- leva o usuário à primeira seção com required pendente ao tentar finalizar;
- mantém Body Map dentro da seção do template;
- usa autosave com debounce e estado real: `Alterações não salvas → Salvando… → Salvo`;
- possui coordenador context-aware com `contextKey`, `draftId` e snapshot imutável;
- cancela debounce/fila ao trocar contexto;
- não permite resposta/save obsoleto de paciente/Encounter anterior contaminar o contexto atual;
- serializa save por contexto;
- faz flush do snapshot final antes de finalizar.

Esses comportamentos possuem testes de regressão próprios.

---

## Configuração da clínica / Platform Admin

### #405 — inventário diferencial S1

O inventário Platform Admin × MedicsPro histórico foi realizado e documentado em:

- `docs/PLATFORM_AND_LEGACY_GAP_AUDIT_20260911.md`.

Portanto, **não repetir S1 como se ainda estivesse aberto**.

### #406 / #407 — Clinic Configuration Core V1

Entregue e verificado em produção:

- identidade da clínica;
- timezone;
- horários de funcionamento;
- units/rooms reutilizados;
- RPCs tenant-scoped;
- ACL hardening;
- verifier production-safe.

A falha inicial de `anon` em RPC foi corrigida por migration aditiva e o verifier final passou.

### #409 — UX de Configuração

A Configuração da clínica já possui a nova IA visual:

```text
Geral
Equipe & Acessos
Agenda & Atendimento
Anamneses & Avaliações
Termos
Governança
```

Não reabrir uma Config monolítica nem recriar uma segunda engine de templates.

---

## Plataforma / entitlement / configuração / autorização

Preservar sempre:

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

Platform Admin administra o SaaS, não recebe acesso implícito ao prontuário ou financeiro detalhado do paciente.

Suporte futuro tenant-sensitive deve ter boundary separado, temporário, justificado e auditado.

---

## Instrumentos clínicos

Regra canônica:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

#399 já está efetiva no stack e entrega:

- `clinical.instrument.apply`;
- catálogo neutro controlado inicialmente para `phq9` e `gad7`;
- configuração institucional default false;
- boundary server-side ligado ao próprio Encounter/profissional;
- owner/admin sem bypass.

PHQ-9/GAD-7 continuam usando definição/versionamento/scoring da engine Nexus; não duplicar no Assessment Engine.

Ainda faltam neste eixo:

```text
[ ] Clinician-Assisted Administration
[ ] Encounter Instrument UX
[ ] Entrega remota / Enviar ao paciente com boundary próprio
[ ] Integração de Instrumentos no Clinical Cockpit V5 depois que a operação existir
```

O Clinical Cockpit V5 já existe; portanto, documentação antiga que descreva o cockpit inteiro como futuro deve ser interpretada como obsoleta. O que continua futuro é **Instrumentos dentro dele**, não o shell V5 em si.

Resposta positiva ao item 9 do PHQ-9, quando essa UX for implementada, deve permanecer visível e destacar necessidade de avaliação clínica sem equivaler isoladamente a diagnóstico e sem gerar conduta/prescrição automática.

---

## Nexus

O Nexus médico avançado continua protegido por C-01–C-06 e `nexus.*` permanece fail-closed.

Não flexibilizar C-06, não conceder `nexus.*` apenas para permitir aplicação de instrumento e não usar especialidade como autorização.

No V5, Nexus é um workspace contextual; isso é reorganização de UX, não mudança de authority.

---

## Repair pós-#400

O appointment histórico conhecido `de857836-baa0-476f-bd7b-d6f52df33007` já foi reparado de forma controlada:

- `em_atendimento` → `agendado`;
- preconditions verificadas;
- sem Encounter Record/evolução/pagamento/consumo de pacote bloqueante;
- draft vazio de assessment preservado;
- audit trail preservado;
- postcheck concluído.

**Não repetir o repair.**

---

## Próximo gate operacional imediato

Após #411:

```text
redeploy frontend
→ smoke visual do Clinical Cockpit V5
→ confirmar layout/runner/autosave
→ fechar V5 visualmente
```

Se o smoke passar, não continuar refinando o cockpit indefinidamente.

Próximas frentes candidatas de maior valor:

1. **Prescription / Document Engine V1**, com contrato canônico de autoria, emitente, versionamento, histórico imutável e impressão/PDF;
2. **Clinician-Assisted Administration** para PHQ-9/GAD-7 e demais instrumentos neutros autorizados;
3. continuidade do **Control Plane / catálogos / planos / limites** conforme roadmap SaaS.

A escolha deve considerar impacto real do piloto, sem abrir várias foundations ao mesmo tempo.

---

## P0/P1 curtos ainda não devem ser esquecidos

Unless evidence posterior já exista no repositório, continuam como lembretes de fechamento:

- prova read-only pós-finalização real do #394;
- smoke real CHARGE/WAIVE do #389;
- verifier antigo #388 com assertion obsoleta;
- observabilidade mínima para beta;
- smoke residual de Consultório/Gestão e roles reais.

Esses itens não justificam reabrir foundations já fechadas nem bloquear toda entrega visual sem risco concreto.

---

## Regras de continuidade

- Não reaplicar migrations de #399/#400/#406/#407/#409 apenas porque documentação antiga ainda as menciona.
- Não repetir o repair #402.
- Não criar nova migration para #410/#411: essas slices são frontend-only.
- Não criar tabs de Prescrição/Exames/Instrumentos antes de existir contrato funcional.
- Não duplicar PHQ-9/GAD-7 no Assessment Engine.
- Não usar `platform_admin` como role de clínica.
- Não transformar parceria/repasse em role/autorização.
- Para área com equivalente maduro no `OARANHA/medicspro`, consultar o legado diretamente e classificar `PRESERVAR | EVOLUIR | REDESENHAR | REJEITAR`.
