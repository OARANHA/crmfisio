# MedicsPro — Manual Source Map

> Fonte editorial para gerar, no futuro, um manual coerente do sistema. Este arquivo não substitui código nem documentação técnica. Ele organiza comportamento visível e seu estado de validação.

**Atualizado em:** 2026-09-12  
**Referência funcional do Clinical Encounter:** pós-PR #420  
**Estado visual atual do Encounter:** **VALIDADO EM PRODUÇÃO**

## Regra editorial

O manual final deve documentar **o que o usuário realmente consegue fazer**.

Estados permitidos:

```text
VALIDADO EM PRODUÇÃO
IMPLEMENTADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / NÃO USAR COMO MANUAL ATUAL
```

Nunca transformar roadmap, prompt, backend sem UI ou intenção em instrução de uso.

Quando uma tela mudar, registrar:

- nome visível da área;
- quem pode acessar;
- pré-condições;
- fluxo passo a passo;
- resultado esperado;
- persistência/retomada;
- limitações conhecidas;
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

Fonte:

- `AGENTS.md`
- `docs/CURRENT_STATE.md`

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

- localizar paciente;
- abrir paciente;
- contexto clínico atual;
- histórico longitudinal;
- documentos/consentimentos quando aplicável;
- LGPD/exportação conforme superfície real.

---

# 4. Atendimento clínico / Clinical Encounter

**Estado funcional:** VALIDADO EM PRODUÇÃO.  
**Estado visual pós-#420:** VALIDADO EM PRODUÇÃO.

Superfícies visíveis atuais:

```text
Registro
Anamneses & Avaliações
Nexus
```

A Clinical Documents Foundation D2-A existe e está validada no backend de produção, mas **`Prescrição` ainda não existe como fluxo de usuário**. Só deve entrar no manual após D2-B.

## Composição visual canônica para o manual

A referência vigente é a #420. A #417 é histórica/superada visualmente.

Documentar a UI atual assim:

- hero compacto no topo do Encounter;
- `Registro / Anamneses & Avaliações / Nexus` como toolbar da coluna principal;
- `Estado da consulta` + `Paciente em contexto` na coluna lateral;
- header global desktop ausente em `lg+`;
- utilitários no footer da sidebar;
- sidebar collapsed utilizável sem overflow horizontal perceptível;
- ajuda contextual flutuante no canto inferior;
- breadcrumb `‹ Pacientes` ausente durante Encounter ativo.

Fonte de aceitação:

- `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`
- `docs/CURRENT_STATE.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`

Não usar screenshots que exponham dados identificáveis de paciente no manual público.

---

# 5. Anamneses & Avaliações

**Estado:** VALIDADO EM PRODUÇÃO.

Durante um atendimento, profissional autorizado acessa `Anamneses & Avaliações`, usando o Assessment Engine canônico.

## Biblioteca MedicsPro V1

Modelos platform validados:

- Anamnese Médica Geral
- Anamnese Psiquiátrica

Especialidade altera relevância/ordenação, não autorização.

## Preenchimento

O Runner trabalha por seções e combina:

- narrativa quando há nuance clínica;
- selects/radios/checklists/escalas quando estruturável com segurança;
- navegação entre seções;
- progresso;
- salvar/finalizar.

## Persistência e retomada

Validado em produção:

- iniciar anamnese cria/usa draft do Encounter;
- respostas salvas persistem;
- sair e retornar retoma o draft da mesma consulta;
- usuário não precisa reiniciar o formulário.

Não descrever PHQ-9/GAD-7 como modelos comuns da Biblioteca MedicsPro.

Fonte:

- `docs/ASSESSMENT_ENGINE.md`
- `docs/MEDICSPRO_ASSESSMENT_LIBRARY_V1.md`

---

# 6. Nexus

**Estado:** IMPLEMENTADO em partes; manual deve ser produzido por capability/superfície real.

Nexus não é sinônimo de Anamneses & Avaliações e não é o emissor de documentos clínicos.

Antes da redação final, validar por superfície:

- ferramentas realmente expostas;
- profissão/identidade exigidas;
- capabilities `nexus.*`;
- C-01–C-06;
- instrumentos e calculadoras efetivamente disponíveis;
- longitudinal e incorporação ao prontuário.

O upstream contém ferramentas ainda não absorvidas em massa. Elas permanecem roadmap técnico, não instruções do manual.

Fonte:

- `docs/NEXUS_GAP_MAP.md`
- `docs/CLINICAL_TOOLING_REUSE_PLAN.md`

---

# 7. Instrumentos clínicos

**Estado:** foundation de autorização implementada; documentar somente o que estiver exposto/validado na UI.

PHQ-9/GAD-7 permanecem instrumentos versionados/validados no eixo Clinical Instruments/Nexus.

Não inferir que `RELEVANT` ou `RECOMMENDED` equivale a autorização.

---

# 8. Prescrição, documentos e consentimentos

## Clinical Documents Foundation

**Estado técnico:** VALIDADO EM PRODUÇÃO em 2026-09-12.  
**Estado de UX:** ainda não existe fluxo visível de Prescrição.

D2-A entregue:

- `medication_prescription`;
- `therapeutic_guidance`;
- templates versionados;
- draft/issued/canceled;
- snapshots imutáveis;
- eventos append-only;
- autorização server-side;
- typed validation na emissão;
- cancelamento auditável.

Evidência operacional registrada:

```text
migration D2-A → COMMIT / MIGRATION_EXIT=0
official verifier → CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED / VERIFIER_EXIT=0
```

**Não transformar essa evidência backend em instrução de usuário.** Ainda não existe aba/fluxo Prescrição validado.

## Prescrição — D2-B

**Estado:** PLANEJADO / PRÓXIMA SLICE.

Quando D2-B estiver implementada e validada, documentar no mínimo:

- abrir `Prescrição` dentro do Encounter;
- escolher template elegível;
- criar/retomar draft;
- preencher itens;
- preview;
- confirmação humana;
- emissão;
- read-only pós-emissão;
- impressão;
- histórico.

Regras editoriais futuras:

- `clinical.documents` não é permissão universal de prescrição;
- Prescrição pertence ao Encounter atual, não ao Histórico clínico como ação de criação;
- templates/especialidade afetam descoberta/relevância, não autorização;
- documento emitido é snapshot imutável;
- cancelamento/correção permanecem auditáveis;
- não descrever assinatura digital/legal enquanto não houver implementação específica;
- não descrever switching, equivalência ou recomendação Nexus como prescrição automática.

Fonte:

- `docs/CLINICAL_DOCUMENTS_FOUNDATION.md`
- `docs/CLINICAL_DOCUMENTS_ROADMAP.md`
- `docs/CLINICAL_TOOLING_REUSE_PLAN.md`
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

Distinguir:

- cobrança do paciente pela clínica;
- cobrança SaaS da clínica pelo MedicsPro.

Não documentar integrações merchant/provider antes de estarem entregues.

---

# 10. CRM e comunicação

**Estado:** IMPLEMENTADO em partes; manual ainda não consolidado.

Mapear posteriormente:

- funil/CRM;
- mensagens;
- WhatsApp;
- templates;
- opt-in;
- NPS;
- automações;
- boundaries de role/capability.

---

# 11. Configurações da clínica

**Estado:** IMPLEMENTADO em partes.

Manual deve separar claramente:

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

Manual separado recomendado para operação interna da plataforma.

Tópicos futuros:

- provisionamento;
- clínicas;
- planos/entitlements;
- auditoria;
- suporte;
- rollout/feature flags;
- saúde de integrações.

---

# Registro de evidências

## 2026-09-11 — Assessment Library V1

**VALIDADO EM PRODUÇÃO**

Evidência sanitizada:

- aba `Anamneses & Avaliações` acessível;
- modelo platform aberto no atendimento;
- Runner exibindo seções/campos;
- salvar/retomar draft funcionando;
- sair e retornar preservando estado;
- leitura RLS validada após #414/#415.

## 2026-09-11 — UX Clinical Encounter #417

**HISTÓRICO / SUPERADO VISUALMENTE PELA #420**

A compactação inicial foi útil, mas o primeiro smoke revelou conflito sticky e excesso de chrome superior.

## 2026-09-11 — UX Clinical Encounter #420

**VALIDADO EM PRODUÇÃO**

Validação técnica e visual registrada em `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`.

## 2026-09-11 — Clinical Documents D1 / D2 decomposition

**HISTÓRICO DE PLANEJAMENTO — D2-A POSTERIORMENTE ENTREGUE**

D1 definiu a arquitetura foundation + contratos tipados e decompôs D2 em D2-A, D2-B e D2-C.

## 2026-09-12 — Clinical Documents D2-A

**BACKEND VALIDADO EM PRODUÇÃO**

- PR #425 mergeada;
- `main@0459e5908c942ac63c0dec87d517aa2131936204`;
- migration `20260912_clinical_documents_foundation.sql` aplicada com COMMIT;
- `MIGRATION_EXIT=0`;
- verifier oficial retornou `CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED`;
- `VERIFIER_EXIT=0`;
- nenhuma UI de Prescrição foi criada por D2-A.

Próximo passo editorial: somente promover Prescrição para fluxo de manual após D2-B ser utilizável e validada.

---

# Checklist antes da primeira versão do manual

- confirmar `main` atual;
- revisar `docs/CURRENT_STATE.md`;
- revisar este mapa;
- usar screenshots da versão efetivamente implantada;
- sanitizar nomes/identificadores/dados de pacientes;
- testar fluxos com professional e owner/admin quando relevante;
- separar comportamento por role/capability;
- marcar limitações conhecidas;
- excluir funcionalidades apenas planejadas;
- revisar terminologia visível antes de publicar.

O objetivo é que o manual represente o produto real, não a história dos prompts de desenvolvimento.
