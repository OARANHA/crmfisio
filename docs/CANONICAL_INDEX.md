# MEDICSPRO — Índice Canônico

> Roteador estável de continuidade. Não é snapshot de estado e não substitui código, GitHub, runtime ou documentação de domínio.

## Frase padrão de retomada

> **Retome o projeto MEDICSPRO pelo estado canônico do repositório `OARANHA/crmfisio`.**

Ao receber essa instrução, reconstrua o **ESTADO ATUAL COMPROVADO** antes de decidir ou executar.

## Repositório canônico

`OARANHA/crmfisio` é a fonte canônica do produto/runtime e o destino padrão de implementação.

## Leitura inicial

1. `AGENTS.md`
2. `docs/CURRENT_STATE.md`
3. `docs/WORK_MASTER_PROMPT.md`
4. `docs/WORK_CONTEXT.md`
5. `docs/doctrine/README.md` + doutrinas relevantes
6. `docs/SLICE_EXECUTION_METHOD.md`
7. `docs/SLICE_LEDGER.md`
8. `docs/slices/<SLICE-ID>/README.md`
9. `docs/slices/<SLICE-ID>/HANDOFF.md`
10. documentos canônicos do domínio tocado
11. código/schema/migrations/RPC/RLS/Edge Functions/testes/verifiers relevantes

## Continuidade de uma slice ativa

Uma slice em andamento não pode ser reconstruída olhando apenas para `main`.

Verifique obrigatoriamente:

- branch ativa;
- PR ativa;
- HEAD atual da PR;
- base atual em `origin/main`;
- diff da PR;
- checks/status;
- merge state;
- README/HANDOFF da slice.

Regra de leitura:

- **docs** = memória institucional;
- **PR/branch** = trabalho vivo ainda não integrado;
- **main** = estado integrado;
- **runtime** = estado realmente implantado;
- **GitHub checks/verifiers** = evidência de validação.

Nenhuma dessas camadas substitui as demais.

## Disciplina obrigatória

O ESTADO ATUAL COMPROVADO é uma pré-condição factual.

A disciplina de mudança é:

```text
GAPS
→ CAPABILITY AUTHORITY / REUSE GATE
→ DECISION
→ SECOND ADVERSARIAL REVIEW
→ EXECUTION
→ VALIDATION
→ DOCUMENTATION
```

Nenhuma capability nova passa para EXECUTION sem atravessar explicitamente GAPS, REUSE GATE, DECISION e SECOND ADVERSARIAL REVIEW.

## Regra de autoridade

Código prova o que existe.

Documentação explica autoridade, boundaries, decisões e continuidade.

Runtime prova o que está implantado.

Quando houver divergência, revalide a evidência mais forte; não escolha silenciosamente por memória ou conveniência.

## Próximo chat

Quando o usuário disser **“gere o próximo texto para chat”**:

1. revalidar `origin/main`, branch/PR ativa, HEAD, diff, checks e merge state;
2. identificar a slice ativa;
3. atualizar primeiro o `HANDOFF.md` da slice com evidência fresca e próximo passo exato;
4. atualizar `docs/CURRENT_STATE.md` somente se a continuidade global/rollout realmente mudou;
5. gerar um prompt curto que aponte o novo chat para este índice e para os docs canônicos;
6. o novo chat deve reconstruir o ESTADO ATUAL COMPROVADO novamente.

> **A memória do projeto vive no repositório e na evidência reproduzível. O chat é apenas uma sessão de trabalho.**
