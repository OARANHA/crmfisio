# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para documentos clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Base canônica:** `main@2ecc17a7efc6d02a94e738bf5b17d748402d8c99`  
**Estado:** D1 CONCLUÍDO / D2-A PROD / D2-B PROD / D2-C PROD / D2-D PROD / D2-E0–E3.1 PROD / D2-E4 PRÓXIMO

---

## Princípios

```text
ENGINE != AUTHORIZATION != RELEVANCE
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
PREVIEW == PRINT CONTRACT
ISSUED DOCUMENT != CURRENT TEMPLATE
DOCUMENT LIFECYCLE != OPERATIONAL WORKFLOW
```

`clinical.documents` é gate-base clínico. Não concede automaticamente autoridade para qualquer ato documental. Especialidade e profissão podem influenciar relevância/roteamento, nunca ACL implícita.

---

## Document types canônicos em produção

```text
medication_prescription
therapeutic_guidance
exam_order
referral
```

Candidatos posteriores, cada um com contrato próprio:

```text
attendance_declaration
medical_certificate
clinical_report
```

Não apresentar atestado, declaração ou relatório como funcionalidade até existir `document_type` canônico correspondente.

---

## Lifecycle documental

```text
published template version
→ draft
→ structured payload
→ explicit human review
→ issue
→ immutable snapshots
→ history
→ optional audited cancellation
```

Documento emitido é historicamente imutável. Mudanças posteriores de template, profissional, clínica ou workflow operacional não reescrevem o snapshot emitido.

---

# D1 — Inventário e decisão arquitetural

**CONCLUÍDO.**

Decisão: uma Clinical Documents Foundation pequena + contratos tipados por `document_type`. O MedicsPro histórico é referência de produto/UX, nunca de ACL/arquitetura.

# D2-A — Clinical Documents Foundation

**VALIDADO EM PRODUÇÃO.**

Autoridade de eligibility, lifecycle, persistência, versions/snapshots, histórico e cancelamento.

# D2-B — Prescription Family

**VALIDADO EM PRODUÇÃO.**

Marcos #429–#433: Prescrição V1, Live Preview, Template Admin, Admin UI e Professional Print/Safe Presets. Família fechada no escopo atual.

# D2-C — Therapeutic Guidance

**VALIDADO EM PRODUÇÃO.**

Orientações estruturadas, revisão humana, emissão, snapshots e renderer A4 profissional. `therapeutic_guidance` nunca aparece como rótulo para paciente.

# D2-D — Exam Order

**VALIDADO EM PRODUÇÃO.**

- D2-D0 Foundation `exam_order` próprio;
- D2-D1 Encounter UX;
- D2-D2 Professional Print Renderer.

V1 mantém autoria médico/CRM conservadora. Resultados, laudos, coleta e fulfillment permanecem domínios separados.

---

# D2-E — Referral / Encaminhamento

## D2-E0 — Referral Foundation

**VALIDADO EM PRODUÇÃO.**

`referral` é documento canônico próprio e multiprofissional. Não reutiliza `therapeutic_guidance`. Herda lifecycle/snapshots/auditoria da D2-A.

Autoria exige identidade clínica elegível, `clinical.documents` e próprio Encounter ativo. Não existe owner/admin/platform bypass.

## D2-E1 — Encounter UX V1

**VALIDADO EM PRODUÇÃO.**

Aba `Encaminhamento` no mesmo Clinical Cockpit, com draft/save/resume, destino, motivo, contexto clínico, revisão humana, emissão e histórico.

## D2-E2 — Professional Print Renderer V1

**VALIDADO EM PRODUÇÃO.**

Contrato visual:

```text
clinical-document/referral-v1
```

Preview A4 e impressão usam o mesmo renderer seguro; documentos históricos preservam seus snapshots/layouts originais.

## D2-E3 — Encaminhamento Interno V1

**VALIDADO EM PRODUÇÃO.**

Um único documento `referral` suporta:

```text
Profissional da clínica
Especialidade / serviço
Destino externo
```

Metadados técnicos de roteamento (`destination_scope`, `target_profile_id`) ficam no payload/snapshot e nunca aparecem para o paciente.

O diretório interno é mesmo-tenant, ativo, self-excluded e server-governed. Seleção de destino não concede chart access/care relationship.

## D2-E3.1 — Internal Directory Hardening

**VALIDADO EM PRODUÇÃO.**

Após smoke real, o boundary foi endurecido para aceitar somente o catálogo clínico canônico atual:

```text
medico
fisioterapeuta
psicologo
quiropraxista
```

Isso bloqueia perfis administrativos legados com `professional_type` arbitrário sem voltar a acoplar role e profissão.

Também foi corrigida a prévia: o nome da clínica não aparece como destino interno até uma escolha real.

Produção confirmou destino interno real, preview correto, emissão e impressão A4 em linguagem humana.

---

# D2-E4 — Referral Operational Continuity

**PRÓXIMO.**

Objetivo: transformar um encaminhamento interno emitido em continuidade operacional rastreável sem alterar o documento clínico.

Fluxo-alvo:

```text
referral interno emitido
→ recebido
→ aceito / recusado
→ agendamento vinculado
→ atendimento
→ conclusão
```

## Boundary obrigatório

D2-E4 deve usar entidade operacional própria, ligada ao `clinical_documents.id` emitido. Nunca adicionar `received`, `accepted`, `scheduled`, `attended` ou `completed` ao `clinical_documents.status`.

Regras:

- apenas `referral` **issued** e interno origina workflow;
- mesmo tenant sempre;
- destino específico só é operável pelo profissional alvo ou por autoridade operacional explicitamente definida;
- destino por área pode ser roteado/assumido por profissional elegível da mesma clínica, mas profissão/especialidade continuam roteamento, não ACL de prontuário;
- aceitar referral não concede automaticamente leitura histórica do prontuário;
- scheduling deve reutilizar Agenda/Appointment canônicos;
- handoff para atendimento respeita `clinical.attend`, profissional atribuído e guard temporal;
- conclusão é auditável e, quando houver atendimento resultante, guarda vínculo estável com o appointment;
- documento emitido e seus snapshots nunca mudam por causa do workflow.

## Decomposição recomendada

Para reduzir risco, D2-E4 pode ser implementado em micro-slices sem mudar o contrato de produto:

```text
D2-E4.0 Operational Foundation
  referral work item + lifecycle operacional + RLS/RPC/auditoria

D2-E4.1 Inbox / Accept / Decline
  fila do profissional/área e transições humanas

D2-E4.2 Schedule Link
  vínculo controlado com Agenda/Appointment canônico

D2-E4.3 Attend / Complete
  handoff clínico + conclusão rastreável
```

A separação é de engenharia; para o usuário continua sendo um único fluxo de continuidade interna.

---

## Regras de continuidade

1. D2-A não deve ser redesenhada sem blocker reproduzido.
2. Não criar Clinical Documents Engine paralelo.
3. Não tornar especialidade/profissão uma ACL.
4. Não transformar Template Admin em autorização clínica.
5. Não expor HTML/CSS/JS arbitrário como fonte documental.
6. Preview e impressão usam contrato versionado compartilhado.
7. Produção só vira `VALIDADO EM PRODUÇÃO` com evidência real.
8. Migrations de produção são controladas; merge não significa aplicação.
9. Referral operacional não pode mutar snapshots emitidos.
10. Reusar Agenda/Appointment existentes em vez de criar um segundo agendador.
