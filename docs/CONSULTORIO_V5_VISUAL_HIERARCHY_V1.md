# Consultório V5 — Clinical Visual Hierarchy V1

**Status:** VALIDADO LOCALMENTE / NÃO PRODUÇÃO.

## Objetivo

Aumentar peso visual e conforto de uso prolongado sem transformar o Consultório em um dashboard decorativo. A interface deve ajudar o profissional a reconhecer contexto, ação atual e pendências com menos varredura visual.

## Princípio

Cor é sinal, não ornamento:

- azul/aqua = contexto, referência e foco;
- verde/mint = ação clínica ativa, confirmação e estado saudável;
- laranja/amber = atenção, elaboração ou pendência;
- vermelho/pulse = bloqueio/erro.

A composição evita gradientes fortes, cards coloridos em excesso e múltiplos acentos competindo na mesma superfície.

## Hierarquia aplicada

- Hero do Encounter recebe presença visual maior e uma linha de acento discreta.
- Navegação das sete intenções clínicas recebe plano próprio, maior contraste e estado ativo mais firme.
- Seções clínicas recebem profundidade suave e um marcador lateral azul→verde.
- Cards persistentes do paciente recebem contraste e espaçamento mais claros.
- Sidebar global recebe um indicador vertical discreto no item ativo.

## Prontuário longitudinal

O histórico deixa de ocupar o rodapé da consulta ativa.

Ele passa a ser aberto a partir de **Paciente em contexto** em um drawer lateral amplo. Isso mantém o histórico a um gesto do médico, sem transformar informação passada na superfície principal de documentação do Encounter atual.

Invariantes:

- o drawer não altera dados;
- fechar pelo backdrop ou pela tecla Escape;
- trocar paciente/Encounter/profissional fecha o drawer;
- o histórico continua sendo o mesmo `historicalWorkspace` canônico;
- as sete abas do Consultório V5 não ganham uma oitava aba artificial.

## Boundaries preservados

Esta slice não altera:

- RLS/RPC;
- capabilities;
- lifecycle do Encounter;
- Clinical Documents;
- Assessment Engine;
- Clinician-Assisted Instruments;
- migrations ou Edge Functions.

É composição e apresentação frontend-only.

## Evidência local

- 106/106 arquivos de teste verdes;
- 576/576 testes verdes;
- TypeScript verde;
- ESLint verde sem warnings;
- build Vite verde;
- `git diff --check` verde.

## Critério de promoção

Antes de merge:

1. testes direcionados verdes;
2. suíte completa verde;
3. TypeScript, lint, build e `git diff --check` verdes;
4. revisão visual em tema claro e escuro;
5. smoke manual pós-deploy apenas de navegação/legibilidade, sem ato clínico persistente obrigatório.
