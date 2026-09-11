# MedicsPro — Manual Source Map

> Fonte editorial para gerar, no futuro, um manual coerente do sistema. Este arquivo não substitui código nem documentação técnica. Ele organiza apenas comportamento visível ao usuário e seu estado de validação.

**Atualizado em:** 2026-09-11  
**Base de referência ao criar este documento:** `main@9aa1a9f417838bff9425ff2d9fd276e53f8a7b58`

## Regra editorial

O manual final deve documentar **o que o usuário realmente consegue fazer**.

Usar estes estados:

```text
VALIDADO EM PRODUÇÃO
IMPLEMENTADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / NÃO USAR COMO MANUAL ATUAL
```

Nunca transformar roadmap, prompt, código incompleto ou intenção de produto em instrução de uso.

Quando uma tela mudar, registrar:

- nome visível da área;
- quem pode acessar;
- pré-condições;
- fluxo passo a passo;
- resultado esperado;
- persistência/retomada;
- limitações conhecidas;
- screenshot de referência quando houver;
- documento técnico relacionado.

---

# Estrutura prevista do manual

## 1. Acesso e modos de trabalho

**Estado:** IMPLEMENTADO; validar detalhes por role antes da redação final.

Tópicos futuros:

- login/logout;
- seleção de unidade;
- Modo Consultório × Gestão;
- identidade clínica;
- diferenças entre owner/admin/professional/recep/financeiro;
- por que disponibilidade visual não substitui autorização.

Fonte técnica principal:

- `AGENTS.md`
- `docs/CURRENT_STATE.md`

---

## 2. Meu dia e Agenda

**Estado:** IMPLEMENTADO; manual ainda não consolidado.

Tópicos futuros:

- visualizar agenda;
- appointment/status;
- entrar no atendimento;
- limites temporais para iniciar consulta;
- cancelamento e exceções relevantes.

Não documentar estados históricos `fisio` como modelo atual de autorização.

---

## 3. Pacientes

**Estado:** IMPLEMENTADO; manual ainda não consolidado.

Tópicos futuros:

- localizar paciente;
- abrir paciente;
- contexto clínico atual;
- histórico longitudinal;
- documentos/consentimentos quando aplicável;
- LGPD/exportação conforme superfície realmente disponível.

---

# 4. Atendimento clínico / Clinical Encounter

**Estado funcional:** VALIDADO EM PRODUÇÃO para o fluxo clínico atual.  
**Estado visual #417:** IMPLEMENTADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO.

Superfícies visíveis principais:

```text
Registro
Anamneses & Avaliações
Nexus
```

Elementos de contexto atualmente observados:

- status da consulta;
- paciente em contexto;
- horário/faixa da consulta;
- identidade clínica do profissional;
- ações de registro/finalização;
- prontuário longitudinal como referência secundária.

### Compactação visual #417

**Estado:** IMPLEMENTADO EM MAIN; screenshots e aceitação visual de produção ainda pendentes.

Mudanças mergeadas:

- header/resumo do atendimento mais compacto;
- breadcrumb `‹ Pacientes` e `PatientProfileHeader` ocultos durante Encounter ativo;
- lateral desktop reduzida para 238px;
- cards laterais mais densos;
- sticky do rail alinhado ao header real de 68px;
- `top: calc(68px + 0.75rem)`;
- `max-height: calc(100vh - 68px - 1.5rem)`;
- scroll interno da lateral apenas quando necessário;
- seções principais com menor espaço vertical.

A slice é frontend-only e não altera persistência, autorização, RLS, lifecycle de draft ou regras clínicas.

Antes de transformar esta seção em instrução visual definitiva do manual:

1. redeployar o frontend contendo #417;
2. validar 1366×768, 1440×900 e 1920×1080 quando possível;
3. confirmar ausência de clipping no `Estado da consulta`;
4. confirmar breadcrumb ausente durante Encounter ativo;
5. confirmar mais conteúdo acima da dobra;
6. capturar screenshot oficial posterior ao deploy.

Fonte:

- `docs/CURRENT_STATE.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`

---

# 5. Anamneses & Avaliações

**Estado:** VALIDADO EM PRODUÇÃO.

## 5.1 Abrir a área

Durante um atendimento, o profissional autorizado acessa a aba:

```text
Anamneses & Avaliações
```

A área usa o Assessment Engine canônico.

## 5.2 Biblioteca MedicsPro V1

Modelos platform disponíveis nesta versão:

- Anamnese Médica Geral
- Anamnese Psiquiátrica

Especialidade pode alterar a ordem/relevância, mas não cria autorização.

## 5.3 Preencher uma avaliação

O Runner apresenta a anamnese por seções.

A experiência combina:

- campos narrativos quando há nuance clínica;
- selects/radios/checklists/escalas quando a resposta pode ser estruturada com segurança;
- navegação entre seções;
- indicador de respostas/progresso;
- ações de salvar e finalizar.

## 5.4 Persistência e retomada

**Validado em produção:**

- iniciar uma anamnese cria/usa draft do Encounter;
- respostas salvas persistem;
- sair da página e retornar retoma o draft da mesma consulta;
- o usuário não precisa reiniciar o formulário.

## 5.5 Limites editoriais

Não descrever PHQ-9/GAD-7 como modelos comuns da Biblioteca MedicsPro.

Não descrever medicamentos/alergias como pertencentes à anamnese se a fonte canônica estiver em outro domínio.

Fonte técnica:

- `docs/ASSESSMENT_ENGINE.md`
- `docs/MEDICSPRO_ASSESSMENT_LIBRARY_V1.md`

---

# 6. Nexus

**Estado:** IMPLEMENTADO em partes; documentação de usuário deve ser produzida por capability/superfície real.

O Nexus é um domínio clínico especializado e não deve ser apresentado como sinônimo de Anamneses & Avaliações.

Antes de redigir manual de Nexus, validar:

- surfaces atualmente expostas;
- profissão/identidade exigidas;
- capabilities `nexus.*`;
- C-01–C-06;
- fluxos de medicação, problemas, diagnósticos, exames e resultados efetivamente disponíveis na UI atual.

---

# 7. Instrumentos clínicos

**Estado:** foundation de autorização implementada; experiência completa de aplicação ainda não deve ser documentada como disponível se a UI correspondente não estiver presente.

PHQ-9/GAD-7 permanecem instrumentos versionados/validados no eixo Clinical Instruments/Nexus.

Direção futura conhecida:

```text
Aplicar agora
Enviar ao paciente
```

Mas somente incluir no manual quando cada modo estiver implementado e validado.

---

# 8. Documentos e consentimentos

**Estado:** IMPLEMENTADO em partes; manual precisa de inventário de UI atual.

Antes da redação final, mapear:

- documentos disponíveis;
- geração/assinatura;
- consentimentos;
- autoria;
- histórico;
- regras por role/capability.

---

# 9. Financeiro

**Estado:** fundação extensa implementada; manual ainda não consolidado.

Fluxo conceitual a validar em UI antes de escrever:

```text
atendimento
→ pacote/cobrança
→ contas a receber/pagamentos
→ baixa/resolução
→ relatórios
```

O manual deve distinguir:

- cobrança do paciente pela clínica;
- cobrança SaaS da clínica pelo MedicsPro.

Integrações futuras de merchant/provider não devem ser documentadas antes de estarem entregues.

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

Não confundir provider global administrado pela plataforma com configuração da clínica.

---

# 11. Configurações da clínica

**Estado:** IMPLEMENTADO em partes; programa de Platform Admin/Configurações ainda possui etapas futuras.

Manual futuro deve separar claramente:

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

Nunca misturar no manual da clínica permissões de Platform Admin como se fossem papel de tenant.

Tópicos futuros:

- provisionamento;
- clínicas;
- planos/entitlements;
- auditoria;
- suporte;
- rollout/feature flags;
- saúde de integrações.

---

# Registro de evidências para o manual

## 2026-09-11 — Assessment Library V1

**VALIDADO EM PRODUÇÃO**

Conta de teste clínica: profissional médico com especialidade Psiquiatria.

Evidência observada:

- aba `Anamneses & Avaliações` acessível;
- `Anamnese Médica Geral` aberta no atendimento;
- Runner exibindo seções e campos;
- salvar/retomar draft funcionando;
- sair e retornar preservando o estado;
- leitura RLS de biblioteca validada após #414/#415.

Não registrar identificadores de paciente real no manual público.

## 2026-09-11 — UX do Clinical Encounter #417

**IMPLEMENTADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO**

PR #417 foi mergeado em `main@9aa1a9f417838bff9425ff2d9fd276e53f8a7b58`.

Validação técnica:

- boundary test 15/15 PASS antes da publicação;
- suíte completa 405/405 PASS antes da publicação;
- typecheck, lint e build PASS;
- 9/9 workflows GitHub PASS no head final;
- nenhuma mudança de backend, migration, RLS, autorização ou persistência.

Mudanças visuais esperadas no deploy:

- topo mais compacto;
- breadcrumb `‹ Pacientes` removido durante Encounter ativo;
- lateral de 238px mais densa;
- `Estado da consulta` sem clipping com sticky relativo ao header real de 68px;
- mais conteúdo visível acima da dobra.

Ainda falta evidência visual pós-deploy. Não usar screenshots anteriores como imagem definitiva do manual.

---

# Checklist antes de gerar a primeira versão do manual

- confirmar `main` atual;
- revisar `docs/CURRENT_STATE.md`;
- revisar este mapa;
- capturar screenshots da versão efetivamente implantada;
- testar fluxos com pelo menos professional e owner/admin onde relevante;
- separar comportamento por role/capability;
- não expor UUIDs, tokens ou dados de pacientes nas imagens;
- marcar limitações conhecidas;
- excluir funcionalidades apenas planejadas;
- revisar terminologia visível na UI antes de publicar.

O objetivo é que o futuro manual seja uma representação do produto real, não uma coleção de decisões históricas de desenvolvimento.
