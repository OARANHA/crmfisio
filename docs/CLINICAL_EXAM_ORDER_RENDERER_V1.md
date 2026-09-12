# D2-D2 — Pedido de Exames / Professional Print Renderer V1

**Base canônica:** `main@49cee461f970a3630c4fd98ab93a1ac476798e74`  
**Estado desta slice:** implementada em branch; produção ainda não alterada.

## Objetivo

Fechar a apresentação profissional do `exam_order` sem criar um segundo engine documental e sem alterar autorização, lifecycle ou autoria clínica.

O contrato visual novo é:

```text
clinical-document/exam-order-v1
```

O título exibido ao paciente é sempre humano: **Pedido de exames**.

## Documento A4

A mesma composição code-owned é usada pela pré-visualização do rascunho e pela impressão do documento emitido. O A4 contém:

- identificação da clínica;
- identificação do paciente e nascimento quando configurado;
- profissional solicitante;
- conselho / UF / registro e especialidade quando configurados;
- prioridade do pedido;
- lista estruturada de exames;
- categoria, código, instruções e urgência por item quando presentes;
- indicação clínica;
- hipótese / impressão clínica;
- observações;
- data;
- espaço explícito para assinatura do profissional solicitante;
- identificador imutável do documento.

A prévia é marcada como **rascunho sem validade**.

## Segurança do renderer

`render_definition` não aceita HTML, CSS ou JavaScript administrável. O runtime reconhece somente o conjunto fechado:

```text
layout
title
show_clinic_address
show_clinic_phone
show_patient_birth_date
show_specialty
```

Todo conteúdo dinâmico é escapado. O único script possível é o `window.print()` code-owned, incluído somente no fluxo explícito de impressão.

## Imutabilidade

A migration publica uma nova versão imutável do template platform `Pedido de exames` e avança apenas o `current_version_id`.

```text
v1 / clinical-document/plain-text-v1
→ preservada

v2 / clinical-document/exam-order-v1
→ documentos novos
```

Documentos já emitidos antes da D2-D2 **não são re-renderizados**. A impressão histórica usa:

- `payload_snapshot`;
- `context_snapshot`;
- `template_definition_snapshot`;
- `rendered_snapshot` como fallback legado.

Assim, evolução futura de template ou renderer nunca altera um documento clínico já emitido.

## Autorização preservada

D2-D2 não altera:

- `current_user_can_issue_clinical_document('exam_order')`;
- requisito médico/CRM conservador da D2-D0;
- `clinical.documents`;
- care relationship / próprio Encounter ativo;
- RLS;
- grants;
- RPCs;
- roles;
- lifecycle `draft → issued → canceled`.

`ENGINE != AUTHORIZATION != RELEVANCE` continua valendo.

## Fora de escopo

Não inclui fulfillment, resultados, laudos, integração com laboratório/imagem, agendamento, cobrança, catálogo externo, assinatura digital ou Nexus emitindo pedido automaticamente.

## Rollout

Após merge, a promoção para produção exige:

1. backup controlado;
2. aplicar `supabase-migrations/20260912_clinical_exam_order_renderer_v1.sql` pinada ao SHA mergeado;
3. executar `supabase-verifiers/VERIFY_20260912_CLINICAL_EXAM_ORDER_RENDERER_V1.sql`;
4. redeploy do frontend;
5. smoke real: preview A4 → emitir novo pedido → histórico → Imprimir → conferir cabeçalho, paciente, exames, profissional e assinatura;
6. confirmar que pedidos antigos continuam imprimindo pelo snapshot legado sem mudança de layout.

Somente então D2-D2 pode ser marcada como **VALIDADO EM PRODUÇÃO**.
