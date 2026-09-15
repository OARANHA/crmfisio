# Consultório V5 — Clinical Visual Hierarchy V1

**Status:** PRODUÇÃO — MERGED / DEPLOYED / STRUCTURAL RUNTIME VALIDATED

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

## Produção

PR `#470` mergeada por squash em `main@ea5f982f556b1723c2b036bff961c1f7bb2cdbbe`.

Validação estrutural no `28server / 158.220.97.145` após o GitOps:

- container frontend recriado com nova imagem;
- `restarts=0`, `OOM=false`, `status=running`;
- `clinical-history-drawer` presente no bundle vivo;
- `medicspro-nav-item` presente no JS/CSS vivo;
- texto `Referência longitudinal` e `Prontuário longitudinal e histórico` presentes no bundle;
- `/`, `/agenda`, `/pacientes`, `/nexus` e `/mensagens` retornaram HTTP 200;
- nenhum 4xx/5xx observado nos logs desde o deploy.

A validação acima prova rollout/runtime. Aceitação visual humana contínua permanece uma evidência de UX separada e pode gerar refinamentos posteriores sem reabrir os boundaries clínicos.

## Critério de promoção

Antes de merge:

1. testes direcionados verdes;
2. suíte completa verde;
3. TypeScript, lint, build e `git diff --check` verdes;
4. revisão visual em tema claro e escuro;
5. smoke manual pós-deploy apenas de navegação/legibilidade, sem ato clínico persistente obrigatório.
