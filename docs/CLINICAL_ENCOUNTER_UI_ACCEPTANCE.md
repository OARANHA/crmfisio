# Clinical Encounter — Aceitação Visual de Produção

> Registro operacional de evidência visual do Clinical Encounter. Não contém dados identificáveis de paciente e não substitui `docs/CURRENT_STATE.md` nem `docs/MANUAL_SOURCE_MAP.md`.

**Data:** 2026-09-11  
**Runtime observado:** frontend pós-PR #420  
**Base funcional da #420:** `main@39b78ada205a7237341847edcda6a8592d0b0c14`  
**Estado:** **VALIDADO EM PRODUÇÃO**

## Contexto

A #417 compactou inicialmente o Clinical Encounter, mas o primeiro smoke real revelou competição entre superfícies sticky e excesso de chrome no topo desktop.

A #420 substituiu essa composição por:

- `EncounterHero` não-sticky;
- rail esquerdo sticky independente em desktop XL;
- toolbar `Registro / Anamneses & Avaliações / Nexus` sticky apenas na coluna principal em desktop XL;
- header global removido em `lg+`;
- utilitários do desktop concentrados no footer da sidebar;
- mobile/tablet mantendo header compacto;
- ajuda contextual flutuante no canto inferior.

## Evidência observada após redeploy

Foram inspecionadas em produção as três superfícies principais do Encounter:

```text
Registro
Anamneses & Avaliações
Nexus
```

### Confirmado visualmente

- header global desktop ausente;
- conteúdo clínico começa mais alto e ocupa melhor a viewport;
- Encounter hero compacto e legível;
- toolbar clínica separada do hero;
- breadcrumb redundante `‹ Pacientes` ausente durante Encounter ativo;
- cards `Estado da consulta` e `Paciente em contexto` densos e legíveis;
- sidebar expandida concentra no rodapé modo, unidade, tema, notificações, identidade e logout;
- área `Anamneses & Avaliações` mostra substancialmente mais conteúdo acima da dobra;
- `Registro`, `Anamneses & Avaliações` e `Nexus` permanecem visualmente coerentes entre si;
- trigger de ajuda contextual aparece discretamente no canto inferior.

### Probe de scroll — PASS

Com o hero já fora da viewport:

- `Estado da consulta` permaneceu visível e íntegro na coluna esquerda;
- a toolbar `Registro / Anamneses & Avaliações / Nexus` permaneceu sticky na coluna principal;
- não houve sobreposição entre rail e toolbar;
- não houve clipping visual relevante.

### Probe de sidebar collapsed — PASS

Com a sidebar recolhida:

- não houve overflow horizontal perceptível;
- utilitários permaneceram organizados em coluna;
- avatar e logout ficaram empilhados/centralizados;
- o estado compacto permaneceu utilizável durante o Encounter.

## Estado funcional preservado

A #420 é frontend/UX only. Não altera:

- backend;
- migrations;
- RLS;
- capabilities;
- Assessment Engine;
- conteúdo clínico;
- draft lifecycle;
- persistência;
- finalização.

Persistência do draft de Anamneses & Avaliações já havia sido validada em produção antes desta aceitação visual.

## Conclusão

A composição visual pós-#420 está **VALIDADA EM PRODUÇÃO** para o fluxo desktop observado.

Referência canônica atual:

- #417 = compactação inicial, visualmente superada;
- #420 = composição atual validada;
- este documento = registro de aceitação visual.

Para o futuro manual, usar apenas screenshots sanitizados e sem dados identificáveis.