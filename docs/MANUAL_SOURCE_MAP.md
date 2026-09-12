# MedicsPro — Manual Source Map

> Fonte editorial para um manual futuro coerente. Não substitui código/documentação técnica; registra apenas comportamento visível e o estado real de validação.

**Atualizado em:** 2026-09-12  
**Prescrição D2-B:** VALIDADO EM PRODUÇÃO  
**Live Preview D2-B.1:** VALIDADO EM PRODUÇÃO  
**Template Admin D2-B.2A:** backend PR #431 / não é ainda instrução de manual

## Regra editorial

O manual final documenta somente o que o usuário realmente consegue fazer na versão implantada e validada.

Estados:

```text
VALIDADO EM PRODUÇÃO
MERGEADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO
IMPLEMENTADO / AGUARDANDO VALIDAÇÃO DE PRODUÇÃO
EM ANDAMENTO
PLANEJADO
HISTÓRICO / NÃO USAR COMO MANUAL ATUAL
```

Backend sem UI e roadmap não viram instrução de uso.

Para cada tela documentar: nome visível, quem acessa, pré-condições, fluxo, resultado, persistência/retomada, limitações, screenshot sanitizado quando houver e fonte técnica.

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

Cobrir busca/abertura, contexto clínico, histórico longitudinal, documentos/consentimentos visíveis e LGPD quando a superfície for confirmada.

---

# 4. Clinical Encounter

**Estado visual/funcional relevante:** VALIDADO EM PRODUÇÃO.

Workspaces atuais:

```text
Registro
Anamneses & Avaliações
Prescrição
Nexus
```

Prescrição já está validada como workspace real do mesmo Encounter.

Composição visual consolidada inclui hero do atendimento, toolbar de workspaces, rail contextual, sidebar e comportamento responsivo conforme `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`.

Não usar dados identificáveis de paciente em manual público.

---

# 5. Anamneses & Avaliações

**Estado:** VALIDADO EM PRODUÇÃO.

Biblioteca MedicsPro V1 validada:

- Anamnese Médica Geral;
- Anamnese Psiquiátrica.

Runner por seções, save/resume e persistência foram validados. Especialidade influencia relevância/ordem, nunca ACL.

PHQ-9/GAD-7 permanecem no eixo de instrumentos/Nexus, não como simples templates da biblioteca MedicsPro.

---

# 6. Nexus / instrumentos clínicos

**Estado:** IMPLEMENTADO em partes; documentar por capability/superfície realmente exposta.

Nexus é motor de instrumentos, cálculo, evidência e apoio à decisão. Não é emissor de Clinical Documents e não gera prescrição automaticamente.

Fontes: `docs/NEXUS_GAP_MAP.md`, `docs/CLINICAL_TOOLING_REUSE_PLAN.md`.

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

PR #429 → `15692b47fc5bca577948a03de2a686f58d5c7dd9`.

Manual pode ensinar o fluxo observado:

1. abrir um Encounter ativo e entrar em `Prescrição`;
2. escolher template elegível;
3. criar/retomar rascunho;
4. preencher medicamento, dose, via, frequência, duração, instruções e observações;
5. salvar rascunho;
6. sair/retornar e retomar o mesmo draft;
7. revisar explicitamente;
8. confirmar emissão;
9. consultar documento emitido em read-only/histórico;
10. imprimir o documento emitido.

Regras do manual:

- `clinical.documents` não é permissão universal de prescrição;
- criação pertence ao Encounter atual;
- profissão/especialidade não substituem autorização;
- documento emitido é snapshot imutável;
- impressão histórica usa snapshot emitido;
- não prometer assinatura digital/PDF certificado;
- Nexus não prescreve automaticamente.

## Prescription Live Preview — D2-B.1

**Estado:** VALIDADO EM PRODUÇÃO.

PR #430 → `db046f0f8b88864b18a5181b320ae346c59a4419`.

Comportamento validado:

- editor + folha de receita lado a lado em tela larga;
- empilhamento em viewport menor;
- atualização visual em tempo real durante a edição;
- profissional/registro, paciente, nascimento, data, medicamentos e observações;
- selo `Rascunho · não emitida` e aviso `Sem validade até a emissão`;
- prévia não é imprimível;
- impressão é exclusiva do documento emitido.

```text
prévia = representação visual do rascunho local
receita emitida = snapshot clínico imutável
```

O smoke de 2026-09-12 confirmou save/resume, preview, emissão, histórico/read-only e abertura da impressão do emitido.

Limitação observada: o layout impresso atual é funcional, mas visualmente simples. A evolução prevista é por presets/renderers seguros e versionados, não por HTML arbitrário.

## Template Admin — D2-B.2A

**Estado:** PR #431 EM ANDAMENTO; backend-only; NÃO documentar como funcionalidade disponível ao admin ainda.

Depois de merge + migration/verifier + UI D2-B.2B, o manual poderá cobrir `Configurações → Modelos de Prescrição`.

---

# 8. Consentimentos

**Estado:** IMPLEMENTADO em partes; inventariar a UI atual antes da redação final.

Não tratar consentimentos automaticamente como Clinical Documents genéricos.

---

# 9. Financeiro

**Estado:** fundação extensa implementada; manual ainda não consolidado.

Fluxo conceitual:

```text
atendimento
→ pacote/cobrança
→ contas a receber/pagamentos
→ baixa/resolução
→ relatórios
```

Separar cobrança do paciente pela clínica de cobrança SaaS da clínica pelo MedicsPro.

---

# 10. CRM e comunicação

**Estado:** IMPLEMENTADO em partes; manual pendente de inventário atualizado.

---

# 11. Configurações da clínica

**Estado:** IMPLEMENTADO em partes.

Separar sempre:

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

## 2026-09-11 — Assessment Library V1

**VALIDADO EM PRODUÇÃO** — templates MedicsPro, Runner por seções e save/resume observados.

## 2026-09-11 — Clinical Encounter #420

**VALIDADO EM PRODUÇÃO** — referência visual em `docs/CLINICAL_ENCOUNTER_UI_ACCEPTANCE.md`.

## 2026-09-12 — Clinical Documents D2-A

**BACKEND VALIDADO EM PRODUÇÃO** — migration aplicada com COMMIT e verifier oficial verde.

## 2026-09-12 — Prescription D2-B + Live Preview D2-B.1

**VALIDADO EM PRODUÇÃO**

- PR #429 mergeada;
- PR #430 mergeada;
- draft salvo;
- saída/retorno com resume correto;
- live preview observado;
- emissão concluída;
- histórico/read-only pós-emissão;
- impressão do documento emitido aberta;
- layout impresso funcional, com refinamento visual planejado em D2-B.2C.

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
