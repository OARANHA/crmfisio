# MedicsPro — Exam Order Encounter UX V1 (D2-D1)

> Primeira superfície funcional de `exam_order` no Encounter, consumindo exclusivamente a Clinical Documents Foundation já validada em D2-D0.

**Base:** `main@2f4fea83dbb1085c7bea2309ccd4dd1b8bc846db`  
**Estado:** IMPLEMENTADO NA BRANCH / NÃO PRODUÇÃO

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

O Clinical Cockpit passa a apresentar:

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
- prévia de conteúdo sem validade;
- revisão humana explícita antes da emissão;
- histórico do atendimento e histórico anterior.

O histórico usa `payload_snapshot` quando disponível. Documento emitido não acompanha mudanças futuras do draft/template.

## Prévia e impressão

D2-D1 entrega uma prévia clínica de conteúdo para conferência, propositalmente marcada:

```text
Prévia de conteúdo · Sem validade
```

Ela ainda não é o renderer profissional final.

O próximo recorte visual é D2-D2, que deve publicar uma nova versão imutável do template com layout A4 próprio e reutilizar a mesma composição para preview profissional e impressão emitida, preservando versões `plain-text-v1` históricas.

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
- expansão multiprofissional da autoria;
- renderer A4 final.

`Exam Order document` e futuro `Exam Fulfillment/Results` permanecem domínios separados.

## Testes e gates

D2-D1 adiciona:

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

Nenhum gate anterior deve ser relaxado.

## Produção

Não há migration nesta slice.

Após merge, o rollout é somente frontend/redeploy seguido de smoke real com médico elegível:

1. abrir Encounter próprio ativo;
2. confirmar aba `Exames`;
3. criar draft;
4. adicionar dois ou mais exames;
5. definir prioridade e campos clínicos;
6. salvar;
7. sair/retomar o mesmo draft;
8. revisar explicitamente;
9. emitir;
10. confirmar histórico imutável;
11. confirmar que profissional não elegível não consegue operar `exam_order`.

Somente após esse smoke D2-D1 pode virar `VALIDADO EM PRODUÇÃO`.
