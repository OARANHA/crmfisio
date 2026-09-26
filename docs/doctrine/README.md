# MedicsPro Doctrine

> Princípios estáveis para projetar, revisar e aceitar mudanças no MedicsPro.
>
> Esta pasta complementa `AGENTS.md`. Não contém estado mutável, backlog, rollout ou prioridade.

## Precedência

Quando houver divergência:

1. segurança/policy obrigatória e comportamento executável atual;
2. `AGENTS.md`;
3. documentos canônicos de domínio;
4. esta doutrina;
5. método da slice;
6. handoff, roadmap, histórico e conversa.

A doutrina não autoriza ignorar schema, RLS, capability, evidência clínica ou runtime real.

## Relação com o método de slices

A doutrina responde **"quais propriedades a solução deve preservar?"**.

O método em `docs/SLICE_EXECUTION_METHOD.md` responde **"como chegamos a uma decisão e provamos que ela funciona?"**.

```text
DOCTRINE
  ↓ princípios / invariantes
SLICE METHOD
  ↓ evidência / decisão / execução
DOMAIN CONTRACTS
  ↓ implementação específica
CODE + SCHEMA + TESTS + RUNTIME
  ↓ verdade executável
```

## Documentos

- [Sistema Vivo](sistema-vivo.md) — conectividade, visibilidade, próximo passo, feedback e operabilidade.
- [Autoridade e Fronteiras](autoridade-e-fronteiras.md) — tenant, autorização, dados comerciais/clínicos e autoridade de domínio.
- [IA, Humano e Operação](ia-humano-operacao.md) — separação entre conversar, operar e decidir.
- [Canais e Ações Externas](canais-e-acoes-externas.md) — mensageria, providers, consentimento, idempotência e ações irreversíveis.
- [Mudanças Destrutivas](mudancas-destrutivas.md) — confirmação, preservação de histórico e reversibilidade.

## Origem e adaptação

Esta doutrina foi criada após auditoria de padrões maduros no DeskcommCRM, incluindo sua pasta `docs/doctrine`, mas foi **reescrita para o domínio do MedicsPro**.

Snapshot externo considerado na criação inicial:

`melgarafael/DeskcommCRM@77f0eb7652282acb90a3d1febe83e0c2de645691`

Princípios externos podem inspirar o MedicsPro; a aplicação concreta sempre deve ser revalidada contra o MedicsPro atual.

## Regra de manutenção

- princípio estável → doutrina;
- contrato de domínio → documento específico do domínio;
- estado mutável → `docs/CURRENT_STATE.md`;
- trabalho aberto → `TODO.md`;
- direção futura → `PRODUCT_ROADMAP.md`;
- evidência e continuidade de uma execução → pasta da slice.

Se um princípio só faz sentido citando uma tabela/tela específica, provavelmente pertence ao documento do domínio ou à slice, não à doutrina.
