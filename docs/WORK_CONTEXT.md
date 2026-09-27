# MedicsPro — Work Context Router

> Este arquivo é um roteador de continuidade para execução assistida. Ele **não é snapshot de estado**, não substitui `AGENTS.md`/`docs/CURRENT_STATE.md` e não deve carregar uma lista mutável de "próximas slices".

## Ordem obrigatória de leitura

1. `AGENTS.md` — regras operacionais, invariantes e hierarquia de fontes;
2. `docs/CANONICAL_INDEX.md` — roteador estável de continuidade;
3. resolver a `origin/main` atual — não reutilizar SHA de conversa/snapshot;
4. `docs/CURRENT_STATE.md` — estado operacional e evidência de rollout;
5. `docs/doctrine/README.md` — princípios estáveis e roteamento das doutrinas aplicáveis;
6. `docs/SLICE_EXECUTION_METHOD.md` — método obrigatório para slices significativas;
7. `docs/SLICE_LEDGER.md` + `docs/slices/<SLICE-ID>/` — quando a missão já pertence a uma slice registrada;
8. branch/PR ativa da slice — HEAD, base, diff, checks e merge state;
9. `TODO.md` — trabalho realmente aberto, quando a missão envolver prioridade;
10. documento(s) canônico(s) do domínio tocado;
11. código, schema, migrations, RPC/RLS, Edge Functions, verifiers e testes relevantes.

Se houver divergência, não force o runtime a obedecer este arquivo. Inspecione a implementação/evidência real e corrija a documentação apropriada.

## Autoridade dos repositórios

- **`OARANHA/crmfisio`** — produto/runtime canônico e único destino de implementação;
- **`OARANHA/nexus`** — upstream/laboratório de inteligência clínica; nunca segundo runtime;
- **`OARANHA/medicspro`** — referência histórica de UX/workflow para equivalentes maduros; nunca autoridade de arquitetura, tenancy ou autorização atual.

Regra institucional: **não portar o velho MedicsPro; absorver o que ele entendia bem sobre o profissional.**

## Distinções que nunca podem ser colapsadas

```text
main mergeada != produção observada
roadmap != implementação
UI visibility != authorization
PresentationContext != authorization
ENGINE != AUTHORIZATION != RELEVANCE
role != profissão
platform entitlement != clinic configuration != user authorization
```

Nexus avançado permanece `nexus.*` fail-closed. Instrumentos clínicos neutros usam boundaries/capabilities próprios e não recebem `nexus.*` como atalho.

Encounter Record continua a unidade editável do novo atendimento; Evolution oficial é a materialização após confirmação humana. Registros finalizados não são sobrescritos; correções/adendos usam mecanismo explícito e auditável.

## Frase padrão de retomada

> **Retome o projeto MEDICSPRO pelo estado canônico do repositório `OARANHA/crmfisio`.**

Essa frase significa: não confiar em memória de chat; reconstruir estado atual pelo repositório, slice ativa, PR/branch, checks e runtime quando necessário.

## Protocolo para nova missão

- verificar `origin/main` e working tree antes de criar branch;
- não misturar uma nova slice com workspace sujo de outra tarefa;
- procurar implementação canônica existente antes de criar caminho paralelo;
- estabelecer primeiro o **ESTADO ATUAL COMPROVADO** a partir da main atual, documentação canônica, código/schema/testes e runtime quando necessário;
- aplicar então a disciplina obrigatória `GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW → EXECUTION → VALIDATION → DOCUMENTATION`;
- nenhuma capability nova passa para EXECUTION sem atravessar explicitamente GAPS, REUSE GATE, DECISION e SECOND ADVERSARIAL REVIEW;
- quando houver slice registrada, atualizar seu `HANDOFF.md` para que outro chat/agente possa continuar sem memória da conversa;
- manter mudanças de produção separadas e explicitamente verificadas;
- reportar separadamente `IMPLEMENTADO`, `MERGEADO`, `DEPLOYADO` e `VALIDADO EM PRODUÇÃO`.

O estado atual, próximos passos e rollout pertencem a `docs/CURRENT_STATE.md` e `TODO.md`, não a este arquivo.


## Protocolo para gerar o próximo texto de chat

Quando o usuário pedir para gerar o próximo texto/prompt para outro chat:

1. não resumir a conversa como fonte de verdade;
2. revalidar a main atual, PR/branch ativa e checks relevantes;
3. identificar a slice ativa pelo `docs/SLICE_LEDGER.md`;
4. atualizar primeiro o `HANDOFF.md` dessa slice;
5. apontar o novo chat para `AGENTS.md`, `docs/WORK_MASTER_PROMPT.md`, este roteador, `docs/SLICE_EXECUTION_METHOD.md`, `docs/CURRENT_STATE.md`, doutrina aplicável e README/HANDOFF da slice;
6. incluir no prompt apenas estado fresco necessário, boundaries, objetivo e próximo passo;
7. obrigar o novo chat a reconstruir o ESTADO ATUAL COMPROVADO antes de decidir;
8. preservar a disciplina:
   `GAPS → CAPABILITY AUTHORITY / REUSE GATE → DECISION → SECOND ADVERSARIAL REVIEW → EXECUTION → VALIDATION → DOCUMENTATION`.

Se não houver slice ativa adequada, o novo chat deve começar por GAPS e REUSE GATE antes de criar uma nova slice.

> O handoff é um índice operacional. Ele não transforma fatos mutáveis em permanentes.
