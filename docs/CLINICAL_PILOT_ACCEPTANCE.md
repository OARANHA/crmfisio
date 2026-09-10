# MedicsPro — Clinical Pilot Acceptance

Checklist canônico para validar o fluxo multiprofissional de atendimento sem criar caminhos paralelos.

## Estado técnico

A **foundation clínica está GREEN estruturalmente** para piloto controlado. Isso não significa que a ergonomia já foi validada por profissionais externos.

Contratos atuais:

- `professional_id` identifica o profissional canônico do appointment;
- role operacional não substitui profissão/identidade clínica;
- somente ator que satisfaz identidade, capability e vínculo/autoria necessários executa atos clínicos;
- `resolveOwnActiveEncounter()` identifica o próprio atendimento editável `em_atendimento`;
- o novo fluxo usa um único Encounter Record por appointment;
- draft usa revision/concorrência e não depende de autosave genérico;
- após confirmação humana, Encounter Record materializa a Evolution oficial determinística e o appointment é finalizado;
- não existe segunda Evolution universal obrigatória no novo fluxo;
- histórico finalizado é read-only; correction/addendum ainda não existe;
- leitura clínica continua sob relação assistencial/authorization server-side;
- owner/admin não recebem autoria clínica implícita.

## Consultório / Gestão

Durante o piloto, validar também #396:

- professional permanece Consultório-only;
- owner/admin só recebem Consultório se tiverem identidade clínica válida + `clinical.attend`;
- recep/financeiro permanecem Gestão-only;
- Consultório esconde Financeiro global, CRM gerencial, Relatórios administrativos e Configurações;
- URL administrativa continua passando por guards reais e privacy boundary;
- PresentationContext nunca altera role, JWT, tenant, RLS, capability, entitlement ou `canView`.

Autoentrada automática no Consultório ainda não faz parte do contrato e não deve ser simulada por rota/query.

## Roteiro vivo recomendado

Use um appointment controlado de um profissional real do piloto.

1. Entrar como o profissional responsável.
2. Abrir Meu dia/Agenda e localizar o próprio appointment.
3. Iniciar/continuar o atendimento pelo comando permitido.
4. Confirmar paciente, appointment, horário e profissional corretos no Encounter.
5. Confirmar que o Encounter Record atual é o único registro editável do atendimento.
6. Preencher parcialmente, salvar draft e observar revision/estado de persistência real.
7. Navegar/atualizar a página e confirmar que o draft persistido reaparece sem perda.
8. Completar apenas as seções clinicamente pertinentes: motivo/demandas, HDA, achados/exame, avaliação/problemas, plano/conduta e observações.
9. Usar Assessment estruturada somente quando pertinente; não duplicar conteúdo artificialmente.
10. Revisar o registro final em modo read-only e confirmar conscientemente a conclusão.
11. Após finalização, verificar por leitura que o Encounter Record ficou `finalized`, existe exatamente uma Evolution oficial vinculada e o appointment ficou `finalizado`.
12. Confirmar que o novo fluxo não pede uma segunda Evolution universal.
13. Entrar como outro profissional da mesma clínica e confirmar ausência de ação clínica indevida sobre o atendimento alheio.
14. Exercitar owner/admin clínico e professional clinical-only no privacy shell sem transformar apresentação em autorização.

## Financeiro durante a validação clínica

Não usar cobertura como falso blocker clínico.

Após #388:

- `package_exhausted`, `package_expired` e `package_not_eligible` são falhas esperadas de cobertura;
- uma finalização clínica válida pode permanecer finalizada;
- o sistema registra `appointment_financial_exception`;
- não ocorre consumo gratuito silencioso.

Falha financeira inesperada de integridade continua fail-closed e deve reverter atomicamente a transação, conforme os verifiers existentes.

A resolução posterior de exceção é domínio financeiro (#389), não etapa obrigatória para o profissional concluir o registro clínico.

## Nexus

Para ator médico com Nexus relevante, confirmar que a engine permanece fail-closed por entitlement + capability + identidade médica válida + relação assistencial + autorização server-side. Especialidade informa relevância; role isolado não autoriza.

Profissionais sem os requisitos de Nexus não devem receber o recurso por causa de role ou PresentationContext.

## Evidência já conhecida do #394

Em produção, a migration #394 foi aplicada em 2026-09-10 e o verifier read-only passou com `VERIFY #394 PRODUCTION OK`.

O smoke de draft comprovou persistência, refresh/navegação e revision. Antes da finalização, o cenário observado tinha 1 Encounter Record, 0 Evolutions, 0 payments e 0 financial exceptions.

**Não marcar a inspeção pós-finalização como executada sem evidência observada.** Essa leitura é uma pendência operacional curta neste snapshot.

## Critério de GREEN

Há dois níveis distintos:

### GREEN estrutural

- migrations/verifiers relevantes instalados e verdes;
- authorization/RLS/lifecycle íntegros;
- Encounter Record + Evolution + appointment possuem contrato transacional;
- regressões clínicas/financeiras críticas cobertas por CI/PostgreSQL.

### GREEN de UX/piloto

Somente após profissional real conseguir completar a jornada com dados realistas e fricção aceitável, incluindo desktop/mobile quando pertinente, estados de loading/erro/conflito e o privacy shell.

Enquanto essa observação não existir de forma suficiente, **UX permanece YELLOW**, mesmo com foundation técnica GREEN.