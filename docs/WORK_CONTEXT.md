# MedicsPro — Work Context Router

> Este arquivo é um roteador de continuidade para execução assistida. Ele **não é snapshot de estado**, não substitui `AGENTS.md`/`docs/CURRENT_STATE.md` e não deve carregar uma lista mutável de "próximas slices".

## Ordem obrigatória de leitura

1. `AGENTS.md` — regras operacionais, invariantes e hierarquia de fontes;
2. resolver a `origin/main` atual — não reutilizar SHA de conversa/snapshot;
3. `docs/CURRENT_STATE.md` — estado operacional e evidência de rollout;
4. `TODO.md` — trabalho realmente aberto, quando a missão envolver prioridade;
5. documento(s) canônico(s) do domínio tocado;
6. código, schema, migrations, RPC/RLS, Edge Functions, verifiers e testes relevantes.

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

## Protocolo para nova missão

- verificar `origin/main` e working tree antes de criar branch;
- não misturar uma nova slice com workspace sujo de outra tarefa;
- procurar implementação canônica existente antes de criar caminho paralelo;
- aplicar decisão → segunda revisão adversarial → execução → validação;
- manter mudanças de produção separadas e explicitamente verificadas;
- reportar separadamente `IMPLEMENTADO`, `MERGEADO`, `DEPLOYADO` e `VALIDADO EM PRODUÇÃO`.

O estado atual, próximos passos e rollout pertencem a `docs/CURRENT_STATE.md` e `TODO.md`, não a este arquivo.
