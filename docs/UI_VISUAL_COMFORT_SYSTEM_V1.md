# MedicsPro — Visual Comfort System V1

## Objetivo

Evoluir a UI Foundation V2 e a Clinical Visual Hierarchy V1 para uso profissional prolongado. O critério não é “ficar bonito em um screenshot”, e sim permitir que uma pessoa trabalhe várias horas no MedicsPro com leitura rápida, baixo esforço ocular e orientação consistente.

## Decisão → segunda revisão → execução

**Decisão inicial:** aplicar mais cor nas telas principais.

**Segunda revisão:** colorir tela por tela criaria inconsistência, manutenção duplicada e risco de usar cor como decoração. A base atual já possui tokens, componentes comuns e semântica clínica; o maior ganho vem de fortalecer essa fundação.

**Execução escolhida:** ampliar a camada compartilhada e fazer os módulos de alta frequência herdarem tipografia, contraste, superfícies e semântica cromática comuns.

## Princípios

- legibilidade antes de densidade;
- texto secundário precisa continuar claramente legível após horas de uso;
- cor orienta estado/contexto e não substitui texto;
- branco/off-white permanece dominante no tema claro;
- superfícies recebem apenas tonalização suave;
- vermelho/pulse fica reservado a erro, bloqueio ou risco real;
- animação não deve disputar atenção; `prefers-reduced-motion` é respeitado;
- dark e light continuam primeira classe.

## Semântica cromática

```text
blue       → informação / volume / referência
teal/aqua  → contexto / foco
amber      → atenção / andamento
mint       → concluído / ação confirmada
violet     → documentos / registros
pulse      → erro / bloqueio / risco real
```

Essas cores são acentos. Fundos usam mistura de baixa intensidade com `panel`, preservando contraste e conforto.

## Fundação compartilhada

V1 adiciona/reforça:

- `medicspro-page-title`, `medicspro-page-subtitle`, `medicspro-kicker`;
- `medicspro-card` e `medicspro-card-head`;
- `medicspro-button` e `medicspro-field`;
- semantic surfaces `comfort-tone-*`;
- `dashboard-metric` e `dashboard-metric-icon`;
- body em 16px e maior contraste de `fog` no tema claro;
- preferência `prefers-reduced-motion`.

## Superfícies alcançadas

A alteração compartilhada afeta cards, formulários e botões usados em dezenas de telas. A hierarquia de página foi alinhada explicitamente nos fluxos de maior permanência:

- Meu dia / dashboard clínico;
- dashboard da recepção;
- Agenda;
- Pacientes;
- Financeiro;
- CRM;
- Mensagens;
- Relatórios;
- Configurações.

## Invariantes

Nenhuma regra de produto ou autorização muda:

- `PresentationContext != authorization`;
- role, capability, entitlement, RLS e RPCs permanecem inalterados;
- nenhum dado, schema, migration ou Edge Function é alterado;
- a mudança é exclusivamente de apresentação/legibilidade;
- cor nunca concede acesso nem representa autorização.

## Validação esperada

Antes do merge:

```text
visualComfortSystem.test.js
clinicalVisualHierarchyV1.test.js
uiFoundationV2System.test.js
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Depois de deploy, validar visualmente pelo menos dashboard, Agenda, Pacientes e um módulo administrativo em desktop/light; fazer um smoke mobile para garantir que o aumento de legibilidade não introduziu overflow.
