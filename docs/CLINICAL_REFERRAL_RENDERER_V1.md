# MedicsPro — Referral / Encaminhamento Professional Print Renderer V1 (D2-E2)

> Renderer A4 profissional, seguro e versionado para `referral`, reutilizado pela pré-visualização de rascunho e pela impressão do documento emitido.

**Base de produção consolidada:** `main@2ecc17a7efc6d02a94e738bf5b17d748402d8c99`  
**Estado:** **VALIDADO EM PRODUÇÃO**.

## Objetivo

Elevar o Encaminhamento ao mesmo contrato visual de Prescrição, Orientações e Pedido de Exames, sem alterar autorização, lifecycle ou conteúdo histórico.

Contrato visual:

```text
clinical-document/referral-v1
```

## Versão de template

D2-E2 publicou a versão v2 imutável do template platform `Encaminhamento clínico`:

```text
v1 → clinical-document/plain-text-v1
v2 → clinical-document/referral-v1
```

Documentos já emitidos com v1 continuam usando snapshots históricos e não são re-renderizados com v2. Drafts preservam a versão de template à qual nasceram vinculados.

## Contrato A4

O renderer code-owned apresenta:

- clínica, endereço e telefone quando configurados;
- profissional emissor, profissão, conselho/UF/registro e especialidade quando existentes;
- título humano `Encaminhamento clínico`;
- paciente e nascimento;
- data;
- prioridade;
- destino estruturado;
- motivo;
- resumo clínico relevante;
- avaliação/ação solicitada;
- observações;
- área explícita de assinatura;
- identificador documental.

O código técnico `referral` não é exibido ao paciente.

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

A prévia de rascunho permanece marcada como sem validade. `Imprimir` só aparece para documento emitido com snapshot congelado.

## Segurança

O renderer aceita somente contrato visual fechado e code-owned. Não existe HTML/CSS/JS arbitrário administrável e todo conteúdo dinâmico é escapado.

D2-E2 não altera eligibility, RLS, grants, roles, capabilities, Encounter ownership, lifecycle ou caráter multiprofissional do encaminhamento.

## Integração com D2-E3

O renderer consome apenas os campos humanos congelados do destino interno. Metadados técnicos como `target_profile_id` e `destination_scope` nunca aparecem no A4.

O hardening D2-E3.1 também impede que um rascunho interno sem escolha real mostre apenas o nome da clínica como se fosse um destino válido.

## Evidência de produção

Produção confirmou:

```text
migration D2-E2 aplicada
→ CLINICAL REFERRAL RENDERER V1 VERIFY PASSED
→ frontend redeployado
→ preview A4 ao vivo
→ emissão
→ histórico com Imprimir
```

O smoke final D2-E3/D2-E3.1 confirmou impressão real em uma página com destino interno humano `Dr. Aranha · Médico da Família · Clínica Piloto VidaNova`, motivo clínico, emissor, assinatura e identificador documental, sem códigos internos expostos.

## Fora de escopo

Fila de recebidos, aceite/recusa, agendamento, atendimento, conclusão e contrarreferência são workflow operacional D2-E4 e não alteram o documento emitido.
