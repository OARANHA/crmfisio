# MedicsPro — Manual Source Map

> Fonte editorial para gerar, no futuro, um manual coerente do sistema. Este arquivo não substitui código nem documentação técnica. Ele organiza comportamento visível e seu estado de validação.

**Atualizado em:** 2026-09-11  
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

Nunca transformar roadmap, prompt, código incompleto ou intenção em instrução de uso.

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

Não documentar `fisio` como papel canônico atual.

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

Superfícies principais:

```text
Registro
Anamneses & Avaliações
Nexus
```

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

## Evidência de produção

Validado visualmente:

- header global desktop realmente não ocupa espaço;
- mais conteúdo clínico fica acima da dobra;
- rail esquerdo permanece íntegro durante scroll;
- toolbar clínica sticky não cobre o rail;
- sidebar collapsed mantém controles organizados;
- avatar/logout ficam empilhados/centralizados no collapsed;
- Registro, Anamneses & Avaliações e Nexus mantêm linguagem visual coerente.

Fonte de aceitação:

- `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`
- `docs/CURRENT_STATE.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`

Não usar screenshots que exponham dados identificáveis de paciente no manual público.

---

# 5. Anamneses & Avaliações

**Estado:** VALIDADO EM PRODUÇÃO.

## Abrir a área

Durante um atendimento, profissional autorizado acessa:

```text
Anamneses & Avaliações
```

A área usa o Assessment Engine canônico.

## Biblioteca MedicsPro V1

Modelos platform validados:

- Anamnese Médica Geral
- Anamnese Psiquiátrica

Especialidade altera relevância/ordenação, não autorização.

## Preencher avaliação

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

Nexus não é sinônimo de Anamneses & Avaliações.

Antes da redação final, validar:

- superfícies realmente expostas;
- profissão/identidade exigidas;
- capabilities `nexus.*`;
- C-01–C-06;
- medicamentos, problemas, diagnósticos, exames e resultados disponíveis na UI.

---

# 7. Instrumentos clínicos

**Estado:** foundation de autorização implementada; documentar somente o que estiver exposto/validado na UI.

PHQ-9/GAD-7 permanecem instrumentos versionados/validados no eixo Clinical Instruments/Nexus.

---

# 8. Documentos e consentimentos

**Estado:** IMPLEMENTADO em partes; manual precisa de inventário da UI atual.

Mapear:

- documentos;
- geração/assinatura;
- consentimentos;
- autoria;
- histórico;
- regras por role/capability.

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

Não usar #417 como referência visual definitiva.

## 2026-09-11 — UX Clinical Encounter #420

**VALIDADO EM PRODUÇÃO**

Validação técnica:

- boundaries Clinical Encounter + Presentation Context: 31/31 PASS;
- suíte completa: 406/406 PASS;
- typecheck, lint e build PASS;
- 9/9 workflows GitHub PASS no head final;
- zero backend, migration, RLS, autorização ou persistência.

Validação visual:

- desktop sem header global;
- hero/toolbar/rail separados corretamente;
- scroll real sem clipping/overlap relevante entre rail e toolbar;
- sidebar expanded organizada;
- sidebar collapsed sem overflow horizontal perceptível;
- avatar/logout empilhados/centralizados;
- mais conteúdo clínico acima da dobra;
- Registro, Anamneses & Avaliações e Nexus coerentes.

Fonte detalhada:

- `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`

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