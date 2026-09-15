# MedicsPro — Typography Comfort Pass V1

## Objetivo

Aumentar a legibilidade para profissionais que permanecem horas no MedicsPro, sem transformar toda a interface em um único tamanho ou perder densidade operacional.

## Evidência de produto

Após o Visual Comfort System V1 entrar em produção, o dashboard autenticado confirmou que cor e hierarquia melhoraram, mas labels e textos operacionais ainda pareciam pequenos em uso real. O repositório ainda continha centenas de utilitários legados entre 9px e 15px.

## Escala adotada

- corpo operacional do workspace: 18px;
- títulos compartilhados de card: 20px;
- subtítulos compartilhados de card: 17px;
- labels dos KPIs: 19px;
- descrição dos KPIs: 17px;
- campos: 17px;
- botões compartilhados: 16.5px;
- microcopy legado: promovido progressivamente para 13.5–18px conforme a hierarquia original.

## Princípios

1. leitura prolongada prevalece sobre densidade visual extrema;
2. microcopy continua menor que conteúdo primário;
3. títulos, KPIs e ações preservam hierarquia clara;
4. escala é aplicada por tokens/primitives e compatibilidade global, não por redesign independente de cada página;
5. desktop e mobile devem permanecer sem overflow horizontal;
6. alteração é exclusivamente de apresentação e não modifica autorização, RLS, RPC, schema, dados ou lifecycle clínico.

## Aceite técnico

- teste dedicado da escala tipográfica;
- testes do Visual Comfort System e UI Foundation continuam verdes;
- suíte completa, TypeScript, lint e build verdes;
- smoke visual pós-deploy deve confirmar Home, Agenda, Pacientes e Financeiro em desktop e mobile.
