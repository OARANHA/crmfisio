# <SLICE-ID> — Handoff

> Este arquivo deve permitir continuidade em um chat/agente novo. Ele é um roteador local da slice, não fonte absoluta de fatos mutáveis.

## Start here

Leia nesta ordem:

1. `AGENTS.md`
2. `docs/CANONICAL_INDEX.md`
3. resolva a `origin/main` atual
4. `docs/CURRENT_STATE.md`
5. `docs/WORK_CONTEXT.md`
6. `docs/doctrine/README.md`
7. `docs/SLICE_EXECUTION_METHOD.md`
8. `docs/SLICE_LEDGER.md`
9. `<slice README>`
10. este `HANDOFF.md`
11. branch/PR ativa da slice: HEAD, base, diff, checks e merge state
12. documentos de doutrina/domínio apontados pela slice
13. código/schema/tests reais relevantes

Depois reconstrua o ESTADO ATUAL COMPROVADO.

## Slice

- ID:
- status:
- objective:
- branch/PR:
- last reconciled main:

## Proven

- 

## Decisions locked unless new evidence appears

- 

## Do not change/reopen

- 

## Open gaps

- 

## Next exact step

<ação concreta>

## Files / boundaries involved

- 

## Validation still required

- 

## JEV state

- last adversarial question:
- result:
- unresolved disagreement:

## VPS/runtime

- required now: yes/no
- if yes, why:
- MCP_WANDORA_VPS evidence needed:

## Copy-paste prompt for a new chat

```text
Retome o projeto MEDICSPRO pelo estado canônico do repositório OARANHA/crmfisio.

Do not rely on prior chat memory.

Read AGENTS.md, docs/CANONICAL_INDEX.md, docs/CURRENT_STATE.md, docs/WORK_CONTEXT.md,
docs/doctrine/README.md, docs/SLICE_EXECUTION_METHOD.md, docs/SLICE_LEDGER.md,
<slice README> and <slice HANDOFF>.

Resolve current origin/main and revalidate the active PR/branch: HEAD, base, diff, checks and merge state.
Reconstruct ESTADO ATUAL COMPROVADO before deciding or executing.

Follow exactly:
GAPS
→ CAPABILITY AUTHORITY / REUSE GATE
→ DECISION
→ SECOND ADVERSARIAL REVIEW
→ EXECUTION
→ VALIDATION
→ DOCUMENTATION

No new capability enters EXECUTION before passing the first four gates.
Preserve all canonical MedicsPro security, tenant and clinical boundaries.
Continue from the Next exact step unless stronger current evidence invalidates it.
Use JEV only as advisory second adversarial review when consequential.
Use MCP_WANDORA_VPS only if runtime/VPS evidence is actually required.
```
