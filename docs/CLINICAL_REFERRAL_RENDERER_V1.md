# MedicsPro — Referral / Encaminhamento Professional Print Renderer V1 (D2-E2)

> Renderer A4 profissional, seguro e versionado para `referral`, reutilizado pela pré-visualização de rascunho e pela impressão do documento emitido.

**Base canônica:** `main@70102eb68cec0699727082bf95c862d267e37466`  
**Estado:** IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO

## Objetivo

Elevar o Encaminhamento D2-E0/D2-E1 ao mesmo contrato visual já validado em Prescrição, Orientações e Pedido de Exames, sem alterar autorização, lifecycle ou conteúdo histórico.

Contrato visual:

```text
clinical-document/referral-v1
```

## Versão de template

D2-E2 publica uma nova versão imutável do template platform `Encaminhamento clínico`:

```text
v1 → clinical-document/plain-text-v1
v2 → clinical-document/referral-v1
```

A promoção do `current_version_id` ocorre somente se o template ainda apontar para a versão canônica D2-E0 v1. Replays posteriores são no-op e não alteram `updated_at`.

Documentos já emitidos com v1 continuam usando `template_definition_snapshot + rendered_snapshot` históricos e não são re-renderizados com v2.

## Contrato A4

O renderer code-owned apresenta:

- clínica;
- endereço e telefone quando configurados;
- profissional emissor;
- profissão;
- conselho/UF/registro quando existentes;
- especialidade quando configurada;
- título humano `Encaminhamento clínico`;
- paciente e data de nascimento;
- data do documento;
- prioridade;
- destino estruturado;
- contato do destino;
- motivo do encaminhamento;
- resumo clínico relevante;
- avaliação / ação solicitada;
- observações;
- região explícita de assinatura do profissional responsável;
- identificador documental.

O código técnico `referral` não é exibido como título ao paciente.

## Preview == Print Contract

```text
render_definition publicado
        ↓
draft live preview A4
        ↓
issue D2-A
        ↓
payload_snapshot
context_snapshot
template_definition_snapshot
rendered_snapshot
        ↓
issued print pelo mesmo renderer
```

A prévia de rascunho permanece claramente marcada como sem validade. O botão `Imprimir` só é mostrado para documento emitido com `payload_snapshot` congelado.

## Segurança

O renderer aceita somente o conjunto fechado:

```text
layout
title
show_clinic_address
show_clinic_phone
show_patient_birth_date
show_specialty
```

Não existe HTML/CSS/JS arbitrário administrável. Todo conteúdo dinâmico é escapado antes de entrar no documento.

## Autorização preservada

D2-E2 não altera:

- `current_user_can_issue_clinical_document()`;
- RLS;
- grants;
- roles;
- capabilities;
- Encounter ownership;
- lifecycle `draft → issued → canceled`;
- payload D2-E0;
- caráter multiprofissional do encaminhamento.

Owner/admin/platform continuam sem bypass de autoria clínica.

## Histórico

Documentos v1 `plain-text-v1` continuam imprimíveis por fallback seguro baseado no snapshot emitido. Documentos v2 usam exclusivamente o contrato A4 congelado em `template_definition_snapshot.render_definition`.

## Escopo negativo

D2-E2 não implementa:

- encaminhamento interno estruturado por `professional_id`/serviço da clínica;
- fila de encaminhamentos recebidos;
- aceite/recusa;
- agendamento;
- contrarreferência;
- envio automático;
- assinatura digital/ICP-Brasil;
- diretório externo;
- cobrança;
- Nexus auto-referral.

A próxima evolução de produto é **D2-E3 — Encaminhamento Interno V1**, mantendo documento clínico imutável separado do workflow operacional de continuidade.

## Validação antes do merge

```text
npm test
typecheck
lint
build
critical dependency audit
PostgreSQL 16 D2-E2
PostgreSQL 16 D2-E0
Clinical Authorization Reconciliation
```

## Rollout futuro

Somente após merge e CI completo:

```text
backup
→ migration D2-E2 pinada ao merge SHA
→ verifier oficial
→ frontend redeploy
→ smoke de preview A4 / emissão / histórico / Imprimir
```

D2-E2 só vira `VALIDADO EM PRODUÇÃO` após essa evidência real.
