# Doutrina — Sistema Vivo MedicsPro

## Princípio

MedicsPro não deve acumular features isoladas. Uma capability só é considerada integrada quando participa de um fluxo real, deixa evidência útil e possui uma continuação coerente.

"Sistema vivo" não significa automatizar tudo. Em saúde, muitas decisões devem permanecer deliberadamente humanas.

## Invariantes

### 1. Toda capability tem entrada e saída reais

Antes de criar uma peça, nomear:

- quem a alimenta;
- quem consome seu resultado.

Uma tabela, worker ou tela sem consumidor concreto é dívida disfarçada de feature.

### 2. Toda mutação relevante deixa registro apropriado

Ações importantes devem produzir evento, atividade, audit trail ou histórico conforme o domínio.

O registro deve ser legível por quem realmente precisa dele. Audit técnico global não substitui timeline operacional; timeline comercial não substitui histórico clínico.

### 3. Demanda operacional aberta precisa de próximo passo ou encerramento explícito

Lead, confirmação pendente, no-show a recuperar, falha de integração, exceção financeira e handoff humano não podem desaparecer silenciosamente.

Isto não significa perseguir pacientes nem criar follow-up clínico automático. O próximo passo deve respeitar consentimento, finalidade, risco e contexto assistencial.

### 4. Configuração operacional precisa ser operável

Estado configurável que afeta comportamento deve ter:

- forma autorizada de leitura;
- forma autorizada de alteração;
- estado de erro/ausência visível.

Configuração exclusiva por SQL/manual pode existir como transição técnica, mas não deve ser tratada como produto pronto.

### 5. Informação exibida precisa justificar sua presença

Mostrar dado sensível ou métrica sem efeito sobre decisão, ação ou contexto adiciona risco e ruído.

Aplicar minimização: a superfície deve receber o necessário para sua função, não "tudo porque está disponível".

### 6. Automação precisa de retorno

Para cada classe de decisão automática, perguntar:

- como sabemos se funcionou?
- como sabemos se causou dano/erro?
- quem ou o que usa esse retorno?

O retorno pode gerar revisão humana, métrica, ajuste de regra ou proposta. Não precisa gerar autoaprendizado.

### 7. IA e humano precisam de continuidade nos dois sentidos

Quando a IA transfere para humano, deve entregar contexto estruturado suficiente para continuar.

Quando o humano conclui, corrige, agenda, classifica ou resolve, deve deixar estado estruturado suficiente para automação/IA posterior entender o resultado.

### 8. Observar rápido não implica agir rápido

Painéis, inbox e health podem exigir atualização rápida.

Mensagens externas, mudanças financeiras, alterações clínicas, ações destrutivas e outras operações irreversíveis devem ocorrer no ritmo seguro para o humano e para o domínio.

A ação não deve ser mais rápida do que a possibilidade real de interromper/revisar quando o risco justificar isso.

### 9. O que é enumerável deve virar gate mecânico quando o custo compensar

Se uma propriedade pode ser derivada de forma confiável do repositório, prefira teste/invariante a depender apenas de memória de revisão.

Exemplos candidatos:

- tabela tenant nova sem boundary;
- provider literal fora da seam;
- rota registrada apontando para destino inexistente;
- migration sensível sem verifier;
- browser acessando boundary service-role;
- ferramenta de IA/MCP fora do catálogo permitido.

Questões de produto e julgamento permanecem em review/JEV/humano.

### 10. Feature nova não pode criar autoridade nova por acidente

Visibilidade, configuração, integração, automação ou conveniência não concedem autoridade.

Toda capability deve reutilizar a boundary canônica ou declarar explicitamente uma nova autoridade aprovada.

## Living System Check

Antes de mover uma slice relevante para `IMPLEMENTING` ou `PROVED`, responder com artefatos concretos:

```text
[ ] Quem alimenta esta capability?
[ ] Quem consome seu resultado?
[ ] Que evento/audit/activity/histórico ela produz?
[ ] Onde o resultado ou falha fica visível para o ator correto?
[ ] Por qual fluxo/porta legítima se chega a ela?
[ ] Qual o próximo passo ou encerramento explícito?
[ ] Onde a configuração aplicável é vista e alterada?
[ ] Como ocorre continuidade IA ↔ humano, quando aplicável?
[ ] Qual sinal de retorno fecha o laço?
[ ] Qual autoridade é reutilizada e qual autoridade esta feature NÃO ganha?
[ ] Quais itens acima podem virar gate mecânico?
```

"N/A" é permitido quando justificado. Resposta genérica ou futura não satisfaz o gate.

## Exceções clínicas

Uma capability clínica pode terminar deliberadamente em julgamento humano.

"Não automatizar" pode ser o desenho correto.

A doutrina exige que essa fronteira seja explícita e operável; não exige transformar cuidado em fluxo automático.
