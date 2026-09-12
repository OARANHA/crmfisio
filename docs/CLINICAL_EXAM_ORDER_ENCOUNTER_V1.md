# MedicsPro — Exam Order Encounter UX V1 (D2-D1)

> Primeira superfície funcional de `exam_order` no Encounter, consumindo exclusivamente a Clinical Documents Foundation já validada em D2-D0.

**Base implementada:** `main@2f4fea83dbb1085c7bea2309ccd4dd1b8bc846db`  
**PR:** #439  
**Merge canônico:** `49cee461f970a3630c4fd98ab93a1ac476798e74`  
**Estado:** VALIDADO EM PRODUÇÃO

## Objetivo

Transformar a fundação canônica `exam_order` em um fluxo clínico utilizável sem criar persistence/lifecycle/ACL paralelos.

```text
Encounter próprio ativo
→ Exames
→ modelo Pedido de exames publicado
→ draft estruturado
→ múltiplos exames
→ prioridade + indicação/impressão + observações
→ salvar / retomar
→ revisão humana explícita
→ issue D2-A
→ snapshots imutáveis
→ histórico
```

## Autoridade

A UI não concede autoria.

A autoridade efetiva continua no servidor:

```text
current_user_can_issue_clinical_document('exam_order')
+
create_clinical_document_draft(...)
+
save_clinical_document_draft(...)
+
issue_clinical_document(...)
```

D2-D1 não cria mutation direta em `clinical_documents`.

A apresentação V1 mostra a aba `Exames` no mesmo recorte médico conservador já usado para Prescrição, porque D2-D0 atualmente exige identidade médica ativa + CRM/UF/registro. Isso é apenas relevância/apresentação: o workspace chama novamente o helper server-side antes de carregar templates/documentos e cada RPC revalida o boundary clínico.

Nenhum papel owner/admin/platform recebe bypass.

## Payload V1

A UI edita exatamente o contrato D2-D0:

```json
{
  "items": [
    {
      "exam_name": "Hemograma completo",
      "code": "optional",
      "category": "optional",
      "instructions": "optional",
      "urgent": false
    }
  ],
  "clinical_indication": "optional",
  "impression": "optional",
  "priority": "routine | high | urgent",
  "observations": "optional"
}
```

Draft pode permanecer incompleto. Emissão só é habilitada no client quando todo item tem `exam_name`, mas a validação autoritativa continua no servidor.

## UX

O Clinical Cockpit em produção apresenta:

```text
Registro
Anamneses & Avaliações
Prescrição
Exames
Orientações
Nexus
```

O workspace `Exames` oferece:

- modelo publicado;
- múltiplos exames no mesmo pedido;
- categoria e código opcionais;
- chips rápidos de categoria;
- instruções por exame;
- urgência por item;
- prioridade global `Rotina | Alta | Urgente`;
- indicação clínica;
- hipótese/impressão;
- observações;
- save/resume explícito;
- revisão humana explícita antes da emissão;
- histórico do atendimento e histórico anterior.

O histórico usa `payload_snapshot` quando disponível. Documento emitido não acompanha mudanças futuras do draft/template.

## Prévia e impressão

D2-D1 entrou em produção com uma prévia clínica de conteúdo marcada como sem validade. Ela provou o fluxo funcional, mas não era o renderer profissional final.

A evolução visual é D2-D2, que publica nova versão imutável do template com layout A4 próprio e reutiliza a mesma composição segura para preview profissional e impressão emitida, preservando versões `plain-text-v1` históricas.

## Escopo negativo

D2-D1 não implementa:

- resultado do exame;
- upload de laudo;
- status de coleta/execução;
- agendamento;
- autorização por convênio;
- cobrança;
- integração laboratorial/imagem;
- catálogo externo de exames;
- auto-sugestão/auto-ordering pelo Nexus;
- alteração de RLS/RPC/grants;
- migration de banco;
- expansão multiprofissional da autoria.

`Exam Order document` e futuro `Exam Fulfillment/Results` permanecem domínios separados.

## Testes e gates

D2-D1 adicionou:

- unit tests do payload/normalização/readiness;
- boundary test para server eligibility + lifecycle genérico;
- boundary do workspace `Exames` no Encounter;
- regressão D2-D0 PostgreSQL 16;
- regressão Clinical Authorization Reconciliation;
- `npm test`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- `npm audit --audit-level=critical`.

Nenhum gate anterior foi relaxado.

## Produção

D2-D1 não possui migration. O rollout foi frontend-only após o merge #439.

Em 2026-09-12, o frontend foi redeployado e o smoke real confirmou a aba `Exames` em Encounter médico elegível, emissão de `Pedido de exames` e histórico de documentos emitidos baseado em snapshot. A evidência visual de produção mostrou múltiplos pedidos emitidos no mesmo atendimento sem exposição do código técnico `exam_order` ao usuário.

A ausência de impressão profissional observada nesse smoke não é regressão D2-D1: ela era o escopo explicitamente reservado à D2-D2.
