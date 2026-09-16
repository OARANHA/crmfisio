# MedicsPro — Manual Source Map

> Fonte editorial para um manual futuro coerente. Não substitui código/documentação técnica; registra comportamento visível e estado real de validação.

**Reconciliado em:** 2026-09-16
**Regra de referência:** confirmar `origin/main` + `docs/CURRENT_STATE.md` antes de publicar o manual; não usar SHA histórico como versão atual.

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

Backend sem UI e roadmap não viram instrução de uso. Para cada tela, documentar nome visível, quem acessa, pré-condições, fluxo, resultado, retomada, limitações e fonte técnica.

---

# 1. Acesso e modos de trabalho

**Estado:** IMPLEMENTADO; validar detalhes por role antes da redação final.

Cobrir login/logout, tenant/unidade, Consultório × Gestão, identidade clínica e diferenças owner/admin/professional/recep/financeiro. Disponibilidade visual nunca substitui autorização.

# 2. Agenda e atendimento

**Estado:** IMPLEMENTADO.

Cobrir Agenda, status do appointment, entrada no atendimento, guard temporal, cancelamento/remarcação e handoff clínico realmente exposto. Não documentar `fisio` como papel operacional canônico.

# 3. Pacientes

**Estado:** IMPLEMENTADO; manual ainda não consolidado.

Cobrir busca/abertura, contexto clínico, histórico longitudinal e superfícies realmente implantadas. Não usar dados identificáveis em material público.

# 4. Clinical Encounter

**Estado:** **VALIDADO EM PRODUÇÃO**.

Workspaces validados:

```text
Registro
Anamneses & Avaliações
Prescrição
Exames
Orientações
Encaminhamento
Nexus
```

Os documentos pertencem ao mesmo Encounter; não criam segundo atendimento/prontuário.

# 5. Anamneses & Avaliações

**Estado:** **VALIDADO EM PRODUÇÃO**.

Biblioteca V1 validada:

- Anamnese Médica Geral;
- Anamnese Psiquiátrica.

Runner por seções, save/resume e persistência foram validados. Especialidade influencia relevância/ordem, nunca ACL.

# 6. Nexus / instrumentos clínicos

**Estado:** IMPLEMENTADO em partes; documentar por capability/superfície exposta.

Nexus é motor de instrumentos, cálculo, evidência e apoio à decisão. Não é emissor de Clinical Documents e não gera prescrição, pedido de exame, orientação ou encaminhamento automaticamente.

---

# 7. Clinical Documents

## Foundation — D2-A

**Estado técnico:** **VALIDADO EM PRODUÇÃO**.

Lifecycle visível/conceitual:

```text
rascunho
→ revisão humana
→ emitido
→ histórico imutável
→ cancelamento auditado quando aplicável
```

Template atual não reescreve documento já emitido.

## Prescrição — D2-B

**Estado:** **VALIDADO EM PRODUÇÃO**.

Manual pode ensinar: abrir Encounter → Prescrição → escolher modelo → criar/retomar rascunho → preencher → salvar → revisar → emitir → histórico → imprimir.

Editor/preview, Template Admin e presets seguros foram validados. Administrar modelo não concede autoridade para prescrever.

## Orientações terapêuticas — D2-C / D2-C.1

**Estado:** **VALIDADO EM PRODUÇÃO**.

Fluxo visível:

```text
Encounter
→ Orientações
→ modelo
→ draft / resume
→ conteúdo estruturado
→ revisão humana
→ emitir
→ histórico
→ imprimir
```

Nunca mostrar `therapeutic_guidance` como título ao paciente.

## Pedido de Exames — D2-D0 / D2-D1 / D2-D2

**Estado:** **VALIDADO EM PRODUÇÃO**.

Manual pode ensinar criação de pedido com múltiplos exames, prioridade, indicação clínica, revisão, emissão, histórico e impressão A4. V1 é médico/CRM. Não documentar resultados, laudos, coleta ou integração laboratorial como já existentes.

## Encaminhamento — D2-E0 / D2-E1 / D2-E2

**Estado:** **VALIDADO EM PRODUÇÃO**.

Manual pode ensinar:

```text
Encounter
→ Encaminhamento
→ criar/retomar rascunho
→ escolher prioridade
→ escolher destino
→ informar motivo
→ resumo clínico / ação solicitada / observações quando necessários
→ revisar
→ emitir
→ histórico
→ imprimir
```

O A4 validado mostra clínica, paciente, emissor, credencial/especialidade quando disponível, prioridade, destino, motivo, assinatura e identificador do documento.

## Encaminhamento interno — D2-E3 / D2-E3.1

**Estado:** **VALIDADO EM PRODUÇÃO**.

A UI apresenta três escolhas:

```text
Profissional da clínica
Especialidade / serviço
Destino externo
```

### Profissional da clínica

O seletor mostra somente destinos clínicos elegíveis do mesmo tenant, exclui o próprio emissor e usa linguagem humana, por exemplo:

```text
Dr. Aranha · Médico da Família
```

Perfis administrativos não aparecem como destinos clínicos, mesmo quando possuem `professional_type` legado indevido.

Antes de escolher alguém, a pré-visualização deve dizer **Destino não informado**. O nome da clínica sozinho não representa escolha válida.

### Especialidade / serviço

As áreas disponíveis derivam de profissionais clínicos ativos da própria clínica. A seleção serve para roteamento, não para conceder acesso clínico.

### Destino externo

Continua disponível para encaminhar a profissional, serviço ou instituição fora da clínica.

### Regras editoriais obrigatórias

- encaminhar para alguém não concede automaticamente leitura do prontuário;
- profissão/especialidade não são ACL;
- destino técnico/UUID nunca aparece para o paciente;
- documento emitido permanece snapshot imutável;
- `target_profile_id`, `destination_scope` e outros códigos internos não devem aparecer em screenshots/manual de paciente;
- o próprio emissor não aparece como destino para si mesmo;
- profissionais de outra clínica nunca devem aparecer na lista.

### Evidência de produção

Smoke real confirmou:

- `Dr. Aranha · Médico da Família` no seletor da Clínica Piloto VidaNova;
- preview com `Destino não informado` antes da escolha;
- emissão real com motivo clínico;
- impressão em uma página;
- destino impresso em linguagem humana;
- emissor, assinatura e identificador documental presentes.

Fontes técnicas:

- `docs/CLINICAL_REFERRAL_FOUNDATION.md`
- `docs/CLINICAL_REFERRAL_ENCOUNTER_V1.md`
- `docs/CLINICAL_REFERRAL_RENDERER_V1.md`
- `docs/CLINICAL_REFERRAL_INTERNAL_V1.md`

### Continuidade operacional D2-E4

A foundation D2-E4 de continuidade/agendamento seguro está **VALIDADA EM PRODUÇÃO**. Ela preserva o referral emitido como snapshot imutável, usa operação/eventos separados e vincula o agendamento ao Appointment canônico por boundary server-side de destino exato.

Para o manual, documentar apenas a superfície de agendamento realmente visível e revalidada na versão implantada. **Não** transformar a existência técnica de D2-E4 em uma inbox fictícia.

Ainda não documentar como disponíveis, sem nova evidência de produto:

```text
Inbox dedicada / Recebidos
→ aceitar / recusar com UX própria
→ fila operacional completa do destinatário/área
→ contrarreferência
```

Também não documentar envio automático externo, diretório externo, assinatura ICP-Brasil ou Nexus auto-referral como existentes.

Fonte técnica adicional: `docs/CLINICAL_REFERRAL_INTERNAL_V1.md`.

---

# 8. Consentimentos

**Estado:** IMPLEMENTADO em partes; inventariar UI atual antes da redação final.

# 9. Financeiro

**Estado:** fundação extensa implementada; manual ainda não consolidado.

```text
atendimento
→ pacote/cobrança
→ contas a receber/pagamentos
→ baixa/resolução
→ relatórios
```

# 10. CRM e comunicação

**Estado:** IMPLEMENTADO em partes; manual pendente de inventário atualizado.

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

# 12. Platform Admin

**Estado:** foundation existente; produto em evolução.

Manual interno separado recomendado para provisionamento, clínicas, planos/entitlements, auditoria, suporte e rollout.

---

# Registro de evidências principais

- 2026-09-11 — Assessment Library V1: PROD.
- 2026-09-11 — Clinical Encounter: PROD.
- 2026-09-12 — Clinical Documents D2-A: PROD.
- 2026-09-12 — Prescription D2-B family: PROD.
- 2026-09-12 — Therapeutic Guidance D2-C/C.1: PROD.
- 2026-09-12 — Exam Order D2-D0/D1/D2: PROD.
- 2026-09-12 — Referral D2-E0 Foundation: PROD.
- 2026-09-12/13 — Referral D2-E1 Encounter UX + D2-E2 A4 renderer: PROD.
- 2026-09-12/13 — Referral D2-E3 Internal + D2-E3.1 hardening: PROD após verifier, redeploy, tenant-isolation smoke, seleção de destino interno, emissão e impressão A4.

---

# Checklist antes da primeira versão do manual

- confirmar `main` atual;
- revisar `docs/CURRENT_STATE.md` e este mapa;
- usar screenshots da versão realmente implantada;
- sanitizar dados de pacientes/usuários;
- testar flows por role/capability quando relevante;
- marcar limitações conhecidas;
- excluir funcionalidades apenas planejadas;
- revisar terminologia visível antes de publicar.

O manual deve representar o produto real, não a história dos prompts de desenvolvimento.
