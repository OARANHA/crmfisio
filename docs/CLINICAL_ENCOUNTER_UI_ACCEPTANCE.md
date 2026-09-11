# Clinical Encounter — Aceitação Visual de Produção

> Registro operacional de evidência visual do Clinical Encounter. Não contém dados identificáveis de paciente e não substitui `docs/CURRENT_STATE.md` nem `docs/MANUAL_SOURCE_MAP.md`.

**Data:** 2026-09-11  
**Runtime observado:** frontend pós-PR #420  
**Base funcional da #420:** `main@39b78ada205a7237341847edcda6a8592d0b0c14`  
**Estado:** **ACEITAÇÃO PARCIAL EM PRODUÇÃO — dois probes visuais ainda pendentes**

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
- rail esquerdo visível no topo, sem clipping aparente nesse estado;
- cards `Estado da consulta` e `Paciente em contexto` densos e legíveis;
- sidebar expandida mantém navegação principal e concentra no rodapé:
  - Modo Consultório/Gestão;
  - seletor de unidade;
  - tema;
  - notificações;
  - identidade;
  - logout;
- área `Anamneses & Avaliações` mostra substancialmente mais conteúdo acima da dobra;
- `Registro`, `Anamneses & Avaliações` e `Nexus` permanecem visualmente coerentes entre si;
- trigger de ajuda contextual aparece discretamente no canto inferior.

## Ainda não comprovado pelos screenshots recebidos

A aceitação final depende de apenas dois probes visuais adicionais:

1. **scroll real da página**
   - rolar o Encounter;
   - confirmar que rail esquerdo permanece visível;
   - confirmar que a toolbar sticky da coluna principal não cobre o rail;
   - confirmar ausência de clipping/overlap durante o scroll.

2. **sidebar collapsed**
   - recolher a sidebar;
   - confirmar ausência de overflow nos `80px`;
   - confirmar avatar e logout empilhados/centralizados;
   - confirmar controle de unidade centralizado e capaz de expandir a sidebar.

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

## Critério de fechamento

Promover para **VALIDADO EM PRODUÇÃO** somente quando os dois probes pendentes acima forem observados sem regressão.

Depois disso:

- atualizar `docs/CURRENT_STATE.md`;
- atualizar `docs/MANUAL_SOURCE_MAP.md`;
- usar apenas screenshots sanitizados/sem dados identificáveis como referência do futuro manual.
