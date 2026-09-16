# MedicsPro — Clinical Documents Roadmap

> Continuidade canônica para documentos clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Regra de base:** sempre resolver a `origin/main` atual; SHAs históricos neste documento não são instrução de checkout.
**Estado reconciliado em 2026-09-16:** D1 CONCLUÍDO / D2-A PROD / D2-B PROD / D2-C PROD / D2-D PROD / D2-E0–E3.1 PROD / D2-E4 V1 PROD

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

**V1 VALIDADA EM PRODUÇÃO.**

A V1 transforma um encaminhamento interno emitido em continuidade operacional rastreável sem alterar o documento clínico. Usa `clinical_referral_operations` e eventos operacionais separados do lifecycle documental, mantendo uma operação por referral interno e vínculo estável ao appointment canônico.

O agendamento cross-professional somente atravessa o boundary por `schedule_clinical_referral_operation(...)`, que revalida tenant, paciente, ator, referral emitido, destino fixo/imutável e profissional alvo e executa a criação canônica do appointment com prova same-transaction/exact-target. INSERT direto para outro profissional continua bloqueado.

## Invariantes entregues

- documento `referral` emitido e snapshots permanecem imutáveis;
- workflow operacional não adiciona estados de recebimento/agendamento ao `clinical_documents.status`;
- mesma clínica/paciente/destino são revalidados;
- Agenda/Appointment continuam donos de data, hora e lifecycle do atendimento;
- o vínculo referral → operation → appointment é auditável/idempotente;
- a exceção cross-professional não é reutilizável fora da mesma transação e não abre bypass genérico de appointment.

## Expansões que **não** devem ser inferidas da V1

O alvo amplo abaixo continua composto de slices separadas e não está todo disponível apenas porque D2-E4 V1 está em produção:

```text
Inbox dedicada / Recebidos
→ aceitar / recusar com UX própria
→ filas/roteamento operacional por destinatário/área
→ mensageria/reconciliação específica
→ contrarreferência e políticas adicionais
```

Essas expansões devem reutilizar a foundation D2-E4 já validada, nunca reabrir o documento emitido nem criar scheduler paralelo.

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
