# D2-D2 — Pedido de Exames / Professional Print Renderer V1

**Base canônica implementada:** `main@cc2a22941a0f35f7d1b2a4d00abc9bc45f01c033`  
**PR:** #440  
**Estado desta slice:** VALIDADO EM PRODUÇÃO.

## Objetivo

Fechar a apresentação profissional do `exam_order` sem criar um segundo engine documental e sem alterar autorização, lifecycle ou autoria clínica.

O contrato visual validado é:

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

## Produção

Rollout concluído em 2026-09-12 após merge da PR #440 em `main@cc2a22941a0f35f7d1b2a4d00abc9bc45f01c033`.

Evidência confirmada:

```text
migration D2-D2 aplicada
→ verifier oficial executado com sucesso
→ frontend redeployado
→ workspace Exames carregando o renderer A4 novo
→ pré-visualização profissional visível em produção
→ título humano “PEDIDO DE EXAMES”
→ clínica/paciente/profissional/CRM/especialidade presentes
→ área de assinatura visível
→ histórico emitido exibindo ação “Imprimir”
→ pedidos anteriores preservados como snapshots históricos
```

A evidência visual de produção confirmou também que o código interno `exam_order` não aparece como rótulo para o paciente.

D2-D2 está **VALIDADO EM PRODUÇÃO** e a família atual de Pedido de Exames fica fechada no escopo documental básico. Evoluções futuras de fulfillment/resultados/laboratórios devem nascer em domínio separado.
