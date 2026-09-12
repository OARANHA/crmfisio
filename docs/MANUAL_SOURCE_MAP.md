# MedicsPro — Manual Source Map

> Fonte editorial para um manual futuro coerente. Não substitui código nem documentação técnica; organiza somente comportamento visível e seu estado real de validação.

**Atualizado em:** 2026-09-12  
**Referência funcional do Clinical Encounter:** pós-PR #420  
**Prescrição:** #429 mergeada / ainda não validada em produção  
**Live Preview:** PR #430 / implementado / ainda não validado em produção

## Regra editorial

O manual final deve documentar apenas **o que o usuário realmente consegue fazer na versão implantada e validada**.

Estados:

```text
VALIDADO EM PRODUÇÃO
MERGEADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO
IMPLEMENTADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / NÃO USAR COMO MANUAL ATUAL
```

Nunca transformar roadmap, prompt ou backend sem UI em instrução de uso.

Quando uma tela mudar, registrar:

- nome visível;
- quem pode acessar;
- pré-condições;
- fluxo passo a passo;
- resultado esperado;
- persistência/retomada;
- limitações;
- screenshot sanitizado quando houver;
- documento técnico relacionado.

---

# 1. Acesso e modos de trabalho

**Estado:** IMPLEMENTADO; validar detalhes por role antes da redação final.

Tópicos:

- login/logout;
- seleção de unidade;
- Modo Consultório × Gestão;
- identidade clínica;
- diferenças entre owner/admin/professional/recep/financeiro;
- disponibilidade visual não substitui autorização.

Fonte: `AGENTS.md` e `docs/CURRENT_STATE.md`.

---

# 2. Meu dia e Agenda

**Estado:** IMPLEMENTADO; manual ainda não consolidado.

Tópicos futuros:

- visualizar agenda;
- appointment/status;
- entrar no atendimento;
- limites temporais para iniciar consulta;
- cancelamento e exceções relevantes.

Não documentar `fisio` como papel operacional canônico atual.

---

# 3. Pacientes

**Estado:** IMPLEMENTADO; manual ainda não consolidado.

Tópicos:

- localizar/abrir paciente;
- contexto clínico atual;
- histórico longitudinal;
- documentos/consentimentos quando aplicável;
- LGPD/exportação conforme superfície real.

---

# 4. Atendimento clínico / Clinical Encounter

**Estado funcional:** VALIDADO EM PRODUÇÃO para a composição anterior à Prescrição.  
**Estado visual pós-#420:** VALIDADO EM PRODUÇÃO.

Workspaces do código pós-#429:

```text
Registro
Anamneses & Avaliações
Prescrição
Nexus
```

`Prescrição` já está na `main`, mas **não deve entrar no manual como disponível em produção** até existir deploy + smoke real registrado.

Composição visual já validada:

- hero compacto no topo;
- toolbar de workspaces na coluna principal;
- `Estado da consulta` + `Paciente em contexto` no rail lateral;
- header global desktop ausente em `lg+`;
- utilitários no footer da sidebar;
- sidebar collapsed utilizável;
- ajuda contextual flutuante;
- breadcrumb redundante oculto durante Encounter ativo.

Fonte:

- `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`
- `docs/CURRENT_STATE.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`

Não usar screenshots com dados identificáveis de paciente em manual público.

---

# 5. Anamneses & Avaliações

**Estado:** VALIDADO EM PRODUÇÃO.

Durante o atendimento, profissional autorizado usa o Assessment Engine canônico.

Biblioteca MedicsPro V1 validada:

- Anamnese Médica Geral;
- Anamnese Psiquiátrica.

Especialidade altera relevância/ordenação, nunca autorização.

Runner por seções combina narrativa com campos estruturados, navegação, progresso, salvar/finalizar e retomada de draft.

Persistência/retomada foram validadas em produção.

Não descrever PHQ-9/GAD-7 como modelos comuns da Biblioteca MedicsPro.

Fonte:

- `docs/ASSESSMENT_ENGINE.md`
- `docs/MEDICSPRO_ASSESSMENT_LIBRARY_V1.md`

---

# 6. Nexus

**Estado:** IMPLEMENTADO em partes; manual deve ser produzido por capability/superfície real.

Nexus não é sinônimo de Anamneses & Avaliações e não é emissor de documentos clínicos.

Antes da redação final, validar:

- ferramentas efetivamente expostas;
- profissão/identidade;
- capabilities `nexus.*`;
- C-01–C-06;
- instrumentos/calculadoras disponíveis;
- longitudinal/incorporação ao prontuário.

O upstream contém ferramentas ainda não absorvidas. Roadmap técnico não vira instrução de manual.

Fonte:

- `docs/NEXUS_GAP_MAP.md`
- `docs/CLINICAL_TOOLING_REUSE_PLAN.md`

---

# 7. Instrumentos clínicos

**Estado:** foundation de autorização implementada; documentar somente superfícies expostas/validadas.

PHQ-9/GAD-7 permanecem instrumentos versionados no eixo Clinical Instruments/Nexus.

`RELEVANT`/`RECOMMENDED` não equivalem a autorização.

---

# 8. Prescrição, documentos e consentimentos

## Clinical Documents Foundation — D2-A

**Estado técnico:** VALIDADO EM PRODUÇÃO em 2026-09-12.  
**Estado de UX:** depende das slices frontend posteriores.

D2-A entrega:

- `medication_prescription`;
- `therapeutic_guidance`;
- templates versionados;
- draft/issued/canceled;
- snapshots imutáveis;
- eventos append-only;
- autorização server-side;
- typed validation;
- cancelamento auditável.

Evidência:

```text
migration D2-A → COMMIT / MIGRATION_EXIT=0
verifier oficial → CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED / VERIFIER_EXIT=0
```

Backend validado não deve ser confundido com fluxo de usuário validado.

## Prescrição — D2-B

**Estado:** MERGEADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO.

PR #429 entrou na `main@15692b47fc5bca577948a03de2a686f58d5c7dd9`.

Quando o deploy/smoke confirmar a superfície, o manual deverá explicar:

- abrir `Prescrição` dentro do Encounter ativo;
- escolher template elegível;
- criar/retomar draft;
- preencher medicamento, dose, via, frequência, duração e instruções;
- observações;
- salvar rascunho;
- revisar;
- confirmar emissão;
- documento read-only pós-emissão;
- histórico;
- impressão do documento emitido.

Regras editoriais:

- `clinical.documents` não é permissão universal de prescrição;
- criação pertence ao Encounter atual;
- profissão/especialidade não substituem autorização;
- documento emitido é snapshot imutável;
- impressão histórica usa snapshot emitido;
- cancelamento/correção permanecem auditáveis;
- não descrever assinatura digital/legal sem implementação específica;
- não descrever switching/equivalência/recomendação Nexus como prescrição automática.

## Prescription Live Preview — D2-B.1

**Estado:** IMPLEMENTADO NA PR #430 / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO.

A #430 recupera o conceito de `Visualização` do MedicsPro histórico.

Comportamento previsto para o manual, somente após smoke:

- em tela larga, editor e folha de receita aparecem lado a lado;
- em viewport menor, ficam empilhados;
- a folha atualiza em tempo real durante a edição local;
- mostra profissional/CRM disponível na sessão, paciente, nascimento, data, medicamentos e observações;
- exibe claramente `Rascunho · não emitida` e `Sem validade até a emissão`;
- a prévia não possui ação de imprimir;
- imprimir permanece ação exclusiva do documento emitido.

Distinção que o manual deve preservar:

```text
prévia = representação visual do rascunho local
receita emitida = snapshot clínico imutável
```

Não ensinar a prévia como documento válido, receita eletrônica ou PDF assinado.

Fontes:

- `docs/CLINICAL_DOCUMENTS_FOUNDATION.md`
- `docs/CLINICAL_DOCUMENTS_ROADMAP.md`
- `docs/CLINICAL_PRESCRIPTION_V1.md`
- `docs/CURRENT_STATE.md`

## Consentimentos atuais

**Estado:** IMPLEMENTADO em partes; manual precisa de inventário da UI atual antes da redação final.

Não tratar consentimentos como Clinical Documents Engine genérico.

---

# 9. Financeiro

**Estado:** fundação extensa implementada; manual ainda não consolidado.

Fluxo conceitual a validar em UI:

```text
atendimento
→ pacote/cobrança
→ contas a receber/pagamentos
→ baixa/resolução
→ relatórios
```

Distinguir cobrança do paciente pela clínica de cobrança SaaS da clínica pelo MedicsPro.

Não documentar merchant/provider antes de entrega real.

---

# 10. CRM e comunicação

**Estado:** IMPLEMENTADO em partes; manual ainda não consolidado.

Mapear posteriormente funil/CRM, mensagens, WhatsApp, templates, opt-in, NPS, automações e boundaries de role/capability.

---

# 11. Configurações da clínica

**Estado:** IMPLEMENTADO em partes.

Manual deve separar:

```text
Platform Admin
≠
Administração da clínica
≠
Usuário operacional
```

Owner/admin configuram o tenant dentro de entitlements; isso não concede automaticamente atos clínicos.

---

# 12. Platform Admin

**Estado:** foundation existente; produto ainda em evolução.

Manual interno separado recomendado para provisionamento, clínicas, planos/entitlements, auditoria, suporte, rollout/flags e saúde de integrações.

---

# Registro de evidências

## 2026-09-11 — Assessment Library V1

**VALIDADO EM PRODUÇÃO**

- `Anamneses & Avaliações` acessível;
- template platform aberto no atendimento;
- Runner por seções;
- salvar/retomar draft funcionando;
- leitura RLS validada após #414/#415.

## 2026-09-11 — UX Clinical Encounter #417

**HISTÓRICO / SUPERADO VISUALMENTE PELA #420**

## 2026-09-11 — UX Clinical Encounter #420

**VALIDADO EM PRODUÇÃO**

Validação registrada em `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`.

## 2026-09-12 — Clinical Documents D2-A

**BACKEND VALIDADO EM PRODUÇÃO**

- PR #425 mergeada;
- `main@0459e5908c942ac63c0dec87d517aa2131936204`;
- migration aplicada com COMMIT;
- `MIGRATION_EXIT=0`;
- verifier oficial passou;
- `VERIFIER_EXIT=0`.

## 2026-09-12 — Prescription D2-B

**MERGEADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO**

- PR #429 mergeada;
- `main@15692b47fc5bca577948a03de2a686f58d5c7dd9`;
- 420/420 testes + typecheck/lint/build + gates associados verdes antes do merge;
- nenhuma migration necessária;
- deploy/smoke ainda não registrado neste mapa.

## 2026-09-12 — Prescription Live Preview D2-B.1

**IMPLEMENTADO NA PR #430 / AGUARDANDO VALIDAÇÃO**

- editor + folha visual ao vivo;
- rascunho explicitamente não emitido;
- sem impressão da prévia;
- nenhuma alteração backend.

---

# Checklist antes da primeira versão do manual

- confirmar `main` atual;
- revisar `docs/CURRENT_STATE.md`;
- revisar este mapa;
- usar screenshots da versão realmente implantada;
- sanitizar nomes/identificadores/dados de pacientes;
- testar fluxos com professional e owner/admin quando relevante;
- separar comportamento por role/capability;
- marcar limitações conhecidas;
- excluir funcionalidades apenas planejadas;
- revisar terminologia visível antes de publicar.

O manual deve representar o produto real, não a história dos prompts de desenvolvimento.
