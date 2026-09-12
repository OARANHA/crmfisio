# MedicsPro — Manual Source Map

> Fonte editorial para um manual futuro coerente. Não substitui código/documentação técnica; registra apenas comportamento visível e o estado real de validação.

**Atualizado em:** 2026-09-12  
**Prescrição D2-B:** VALIDADO EM PRODUÇÃO  
**Live Preview D2-B.1:** VALIDADO EM PRODUÇÃO  
**Template Admin D2-B.2A:** VALIDADO EM PRODUÇÃO  
**Template Admin UI D2-B.2B:** VALIDADO EM PRODUÇÃO  
**Professional Print / Safe Presets D2-B.2C:** VALIDADO EM PRODUÇÃO

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

Regras:

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
- selo `Rascunho · não emitida`;
- preview sem validade;
- impressão exclusiva do emitido.

## Template Admin backend — D2-B.2A

**Estado técnico:** VALIDADO EM PRODUÇÃO.

PR #431 → `af7b87725a62985c0f6a38dc753b737de40b48af`.

Backend administra templates da clínica por RPC, preservando separação entre administração e autoria clínica.

## Template Admin UI — D2-B.2B

**Estado:** VALIDADO EM PRODUÇÃO.

PR #432 → `8247f91ec5c35c6cf409b7356ed1c1601b961623`.

Manual já pode cobrir:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
```

Fluxos observados/entregues:

- listar modelos MedicsPro read-only;
- listar modelos da clínica;
- visualizar modelo;
- criar modelo da clínica;
- duplicar modelo MedicsPro para cópia do tenant;
- editar nome, descrição e relevância/especialidade;
- arquivar/reativar clinic-owned.

Regra obrigatória no manual: administrar um modelo não concede permissão para emitir receita.

## Professional Print / Safe Presets — D2-B.2C

**Estado:** VALIDADO EM PRODUÇÃO.

PR #433 → `db364e17a158b2f1f13229ca595f6e7b24cfcab8`.

Manual pode documentar agora:

- editar a apresentação de um modelo da clínica;
- escolher preset visual seguro (`Clássico`, `Institucional`, `Compacto`);
- escolher identidade visual/acento entre as opções permitidas;
- escolher apresentação dos medicamentos;
- mostrar/ocultar dados de apresentação permitidos;
- visualizar a folha de exemplo antes de publicar;
- usar `Salvar e publicar` para criar a nova versão visual;
- compreender que modelos MedicsPro permanecem somente leitura e podem ser duplicados para adaptação da clínica.

Comportamento validado em produção:

```text
Template v2 publicado
→ receita emitida com v2
→ snapshot do documento congela v2

Admin publica v3
→ novas receitas usam v3
→ receita já emitida continua imprimindo v2
```

Regras obrigatórias no manual:

- a pré-visualização administrativa não possui validade clínica;
- administrar/apresentar modelo não concede autoridade para prescrever;
- mudanças posteriores do modelo não alteram documentos já emitidos;
- não existe editor HTML/CSS/JS livre;
- presets e blocos são controlados pelo MedicsPro;
- a impressão do emitido é baseada no snapshot da emissão, não no template corrente.

---

# 8. Consentimentos

**Estado:** IMPLEMENTADO em partes; inventariar a UI atual antes da redação final.

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

**VALIDADO EM PRODUÇÃO**.

## 2026-09-12 — Clinical Documents D2-A

**BACKEND VALIDADO EM PRODUÇÃO** — migration aplicada com COMMIT e verifier oficial verde.

## 2026-09-12 — Prescription D2-B + Live Preview D2-B.1

**VALIDADO EM PRODUÇÃO** — draft/save-resume/preview/emissão/histórico/impressão observados.

## 2026-09-12 — Template Admin D2-B.2A + D2-B.2B

**VALIDADO EM PRODUÇÃO** — backend administrativo aplicado/verificado e UI real em `Configurações → Documentos clínicos → Modelos de prescrição` observada.

## 2026-09-12 — Professional Print / Safe Presets D2-B.2C

**VALIDADO EM PRODUÇÃO** — migrations base/hardening aplicadas com COMMIT, verifier oficial verde, editor visual observado, nova versão publicada, nova emissão impressa com o preset publicado e imutabilidade histórica comprovada após evolução posterior do template.

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
