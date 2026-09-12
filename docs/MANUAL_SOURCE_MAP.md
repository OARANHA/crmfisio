# MedicsPro — Manual Source Map

> Fonte editorial para um manual futuro coerente. Não substitui código/documentação técnica; registra apenas comportamento visível e o estado real de validação.

**Atualizado em:** 2026-09-12  
**Prescrição D2-B / D2-B.1 / D2-B.2A / D2-B.2B / D2-B.2C:** VALIDADO EM PRODUÇÃO  
**Therapeutic Guidance D2-C:** MERGEADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO  
**Therapeutic Guidance D2-C.1 Professional Print:** EM ANDAMENTO / NÃO PRODUÇÃO

## Regra editorial

O manual final documenta somente o que o usuário realmente consegue fazer na versão implantada e validada.

```text
VALIDADO EM PRODUÇÃO
MERGEADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO
IMPLEMENTADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / NÃO USAR COMO MANUAL ATUAL
```

Backend sem UI e roadmap não viram instrução de uso. Para cada tela documentar: nome visível, quem acessa, pré-condições, fluxo, resultado, persistência/retomada, limitações e fonte técnica.

---

# 1. Acesso e modos de trabalho

**Estado:** IMPLEMENTADO; validar detalhes por role antes da redação final.

Cobrir login/logout, tenant/unidade, Consultório × Gestão, identidade clínica e diferenças owner/admin/professional/recep/financeiro. Disponibilidade visual nunca substitui autorização.

---

# 2. Agenda e atendimento

**Estado:** IMPLEMENTADO.

Cobrir agenda, status do appointment, entrada no atendimento, boundary temporal de início e cancelamentos/exceções realmente expostos.

Não documentar `fisio` como papel operacional canônico.

---

# 3. Pacientes

**Estado:** IMPLEMENTADO; manual ainda não consolidado.

Cobrir busca/abertura, contexto clínico, histórico longitudinal e superfícies realmente implantadas. Não usar dados identificáveis em material público.

---

# 4. Clinical Encounter

**Estado visual/funcional relevante:** VALIDADO EM PRODUÇÃO para a base anterior à D2-C.

Workspaces na `main` atual:

```text
Registro
Anamneses & Avaliações
Prescrição
Orientações
Nexus
```

`Orientações` entrou pela PR #435, mas ainda aguarda validação real de produção; portanto ainda não deve virar instrução definitiva de manual.

---

# 5. Anamneses & Avaliações

**Estado:** VALIDADO EM PRODUÇÃO.

Biblioteca MedicsPro V1 validada:

- Anamnese Médica Geral;
- Anamnese Psiquiátrica.

Runner por seções, save/resume e persistência foram validados. Especialidade influencia relevância/ordem, nunca ACL.

---

# 6. Nexus / instrumentos clínicos

**Estado:** IMPLEMENTADO em partes; documentar por capability/superfície realmente exposta.

Nexus é motor de instrumentos, cálculo, evidência e apoio à decisão. Não é emissor de Clinical Documents e não gera prescrição/orientação automaticamente.

---

# 7. Prescrição e Clinical Documents

## Clinical Documents Foundation — D2-A

**Estado técnico:** VALIDADO EM PRODUÇÃO.

Foundation entregue:

- `medication_prescription`;
- `therapeutic_guidance`;
- templates versionados;
- lifecycle draft/issued/canceled;
- snapshots imutáveis;
- autorização server-side;
- validação tipada;
- cancelamento auditável.

## Prescrição — D2-B

**Estado:** VALIDADO EM PRODUÇÃO.

Manual pode ensinar:

1. abrir Encounter ativo e entrar em `Prescrição`;
2. escolher template elegível;
3. criar/retomar rascunho;
4. preencher conteúdo estruturado;
5. salvar;
6. revisar explicitamente;
7. emitir;
8. consultar histórico;
9. imprimir o documento emitido.

Regras: `clinical.documents` não é permissão universal; criação pertence ao Encounter atual; especialidade não substitui autorização; emitido é snapshot imutável; Nexus não prescreve automaticamente.

## Prescription Live Preview — D2-B.1

**Estado:** VALIDADO EM PRODUÇÃO.

Editor + folha ao vivo, selo `Rascunho · não emitida`, preview sem validade e impressão exclusiva do emitido foram validados.

## Template Admin — D2-B.2A / D2-B.2B

**Estado:** VALIDADO EM PRODUÇÃO.

Manual pode cobrir:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
```

Fluxos: listar modelos MedicsPro read-only e clinic-owned; criar; duplicar; editar metadados; visualizar; arquivar/reativar. Administrar template não concede autoridade para prescrever.

## Professional Print / Safe Presets — D2-B.2C

**Estado:** VALIDADO EM PRODUÇÃO.

Manual pode documentar presets seguros, acentos permitidos, apresentação de medicamentos, toggles visuais, preview administrativo, `Salvar e publicar` e imutabilidade histórica do layout.

```text
Template v2 publicado
→ receita emitida com v2
→ snapshot congela v2

Admin publica v3
→ novas receitas usam v3
→ receita antiga continua v2
```

Não existe editor HTML/CSS/JS livre.

## Therapeutic Guidance — D2-C

**Estado:** MERGEADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO.

PR #435 → `33da15230cd35179681406b212e87305618a4976`.

Superfície prevista na `main`:

```text
Encounter
→ Orientações
→ escolher modelo
→ criar/retomar draft
→ orientações estruturadas
→ instruções/observações opcionais
→ revisão humana
→ emitir
→ histórico
```

Ainda não transformar esse fluxo em manual definitivo antes do smoke real.

## Therapeutic Guidance Professional Print — D2-C.1

**Estado:** PR #436 / EM ANDAMENTO / NÃO PRODUÇÃO.

Comportamento em implementação:

- folha A4 ao vivo ao lado do editor;
- título humano do documento;
- clínica/paciente/profissional/conselho/registro/data;
- orientações, instruções e observações formatadas;
- assinatura visual;
- mesma composição segura para preview e impressão nova;
- impressão do emitido usando snapshots congelados;
- fallback seguro para orientações históricas `plain-text-v1`;
- nenhum HTML/CSS/JS administrável.

Somente após migration/verifier/redeploy/smoke esse comportamento poderá ser promovido a instrução de manual.

---

# 8. Consentimentos

**Estado:** IMPLEMENTADO em partes; inventariar a UI atual antes da redação final.

---

# 9. Financeiro

**Estado:** fundação extensa implementada; manual ainda não consolidado.

```text
atendimento
→ pacote/cobrança
→ contas a receber/pagamentos
→ baixa/resolução
→ relatórios
```

---

# 10. CRM e comunicação

**Estado:** IMPLEMENTADO em partes; manual pendente de inventário atualizado.

---

# 11. Configurações da clínica

**Estado:** IMPLEMENTADO em partes.

```text
Platform Admin
≠
Administração da clínica
≠
Usuário operacional
```

Owner/admin configuram o tenant; isso não concede atos clínicos.

---

# 12. Platform Admin

**Estado:** foundation existente; produto em evolução.

Manual interno separado recomendado para provisionamento, clínicas, planos/entitlements, auditoria, suporte e rollout.

---

# Registro de evidências

- **2026-09-11 — Assessment Library V1:** VALIDADO EM PRODUÇÃO.
- **2026-09-11 — Clinical Encounter #420:** VALIDADO EM PRODUÇÃO.
- **2026-09-12 — Clinical Documents D2-A:** BACKEND VALIDADO EM PRODUÇÃO.
- **2026-09-12 — Prescription D2-B + D2-B.1:** VALIDADO EM PRODUÇÃO.
- **2026-09-12 — Template Admin D2-B.2A + D2-B.2B:** VALIDADO EM PRODUÇÃO.
- **2026-09-12 — Professional Print / Safe Presets D2-B.2C:** VALIDADO EM PRODUÇÃO, inclusive imutabilidade visual histórica.
- **2026-09-12 — Therapeutic Guidance D2-C:** PR #435 MERGEADA; ainda sem evidência suficiente para `VALIDADO EM PRODUÇÃO`.
- **2026-09-12 — Therapeutic Guidance D2-C.1:** PR #436 EM ANDAMENTO; não produção.

---

# Checklist antes da primeira versão do manual

- confirmar `main` atual;
- revisar `docs/CURRENT_STATE.md` e este mapa;
- usar screenshots da versão realmente implantada;
- sanitizar dados de pacientes/usuários;
- testar flows com professional e owner/admin quando relevante;
- separar comportamento por role/capability;
- marcar limitações conhecidas;
- excluir funcionalidades apenas planejadas;
- revisar terminologia visível antes de publicar.

O manual deve representar o produto real, não a história dos prompts de desenvolvimento.
