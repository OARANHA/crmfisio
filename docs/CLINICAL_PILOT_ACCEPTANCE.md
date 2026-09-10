# MedicsPro — Clinical Pilot Acceptance

Checklist canônico para validar o fluxo multiprofissional de atendimento sem criar caminhos paralelos.

## Estado técnico

A **foundation clínica está GREEN estruturalmente** para piloto controlado. Isso não significa que a ergonomia já foi validada por profissionais externos.

Contratos atuais:

- `professional_id` identifica o profissional canônico do appointment;
- role operacional não substitui profissão/identidade clínica;
- somente ator que satisfaz identidade, capability e vínculo/autoria necessários executa atos clínicos;
- appointment de data futura não pode entrar em `em_atendimento` por ator normal (#400); mesmo-dia continua sujeito às regras clínicas existentes;
- `resolveOwnActiveEncounter()` identifica o próprio atendimento editável `em_atendimento`;
- o novo fluxo usa um único Encounter Record por appointment;
- draft usa revision/concorrência e não depende de autosave genérico;
- após confirmação humana, Encounter Record materializa a Evolution oficial determinística e o appointment é finalizado;
- não existe segunda Evolution universal obrigatória no novo fluxo;
- histórico finalizado é read-only; correction/addendum ainda não existe;
- leitura clínica continua sob relação assistencial/authorization server-side;
- owner/admin não recebem autoria clínica implícita;
- a foundation #399 de instrumentos está em produção, mas administração PHQ-9/GAD-7 e UX de Instrumentos continuam futuras.

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
3. Para um appointment futuro controlado, confirmar que uma tentativa normal de iniciar atendimento não consegue produzir `em_atendimento`; o backend é a autoridade, mesmo que alguma UI antiga ainda apresente a ação.
4. Em appointment do dia atual, iniciar/continuar o atendimento pelo comando permitido.
5. Confirmar paciente, appointment, horário e profissional corretos no Encounter.
6. Confirmar que o Encounter Record atual é o único registro editável do atendimento.
7. Preencher parcialmente, salvar draft e observar revision/estado de persistência real.
8. Navegar/atualizar a página e confirmar que o draft persistido reaparece sem perda.
9. Completar apenas as seções clinicamente pertinentes: motivo/demandas, HDA, achados/exame, avaliação/problemas, plano/conduta e observações.
10. Usar Assessment estruturada somente quando pertinente; não duplicar conteúdo artificialmente.
11. Revisar o registro final em modo read-only e confirmar conscientemente a conclusão.
12. Após finalização, verificar por leitura que o Encounter Record ficou `finalized`, existe exatamente uma Evolution oficial vinculada e o appointment ficou `finalizado`.
13. Confirmar que o novo fluxo não pede uma segunda Evolution universal.
14. Entrar como outro profissional da mesma clínica e confirmar ausência de ação clínica indevida sobre o atendimento alheio.
15. Exercitar owner/admin clínico e professional clinical-only no privacy shell sem transformar apresentação em autorização.

## Instrumentos clínicos durante o piloto

A fundação #399 está instalada e validada em produção, endurecida temporalmente pela #400.

Contrato atual:

```text
clinical.instrument.apply
+ identidade clínica válida
+ instrumento exposto no catálogo neutro
+ instrumento habilitado pela clínica
+ próprio Encounter em_atendimento temporalmente válido
→ authorization boundary de Apply-in-Encounter
```

Isso **não** significa que já exista operação de administração ou UI PHQ-9/GAD-7. Até a Clinician-Assisted Administration ser implementada, não criar fluxo paralelo/manual para simular uma feature inexistente.

Também preservar:

- `clinical.instrument.apply` != `nexus.scales`;
- profissão/especialidade informam relevância, nunca auto-grant;
- future-active legado retorna DENY para Apply-in-Encounter após #400;
- `Enviar ao paciente` terá boundary contextual próprio e não deve herdar automaticamente active Encounter.

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

A #399 não concede `nexus.*`; o smoke de instrumentos em produção confirmou separação entre a capability clínica neutra e o domínio Nexus avançado.

## Evidência já conhecida

### #394

Em produção, a migration #394 foi aplicada em 2026-09-10 e o verifier read-only passou com `VERIFY #394 PRODUCTION OK`.

O smoke de draft comprovou persistência, refresh/navegação e revision. Antes da finalização, o cenário observado tinha 1 Encounter Record, 0 Evolutions, 0 payments e 0 financial exceptions.

**Não marcar a inspeção pós-finalização como executada sem evidência observada.** Essa leitura é uma pendência operacional curta neste snapshot.

### #399 / #400

Em produção:

- migration/verifier #399 concluídos;
- `admin-team` e frontend alinhados;
- smoke médico #399 passou e terminou com rollback limpo;
- migration/verifier #400 concluídos;
- smoke #400 reproduziu o bug real de início futuro e recebeu `appointment_future_encounter_start_forbidden`;
- future-active histórico foi confirmado DENY para Apply-in-Encounter;
- rollback deixou zero capability/settings temporários.

O appointment histórico usado como controle (`de857836-baa0-476f-bd7b-d6f52df33007`) permanece aguardando reparação separada/auditável; isso não é tarefa para o profissional durante o piloto.

## Critério de GREEN

Há dois níveis distintos:

### GREEN estrutural

- migrations/verifiers relevantes instalados e verdes;
- authorization/RLS/lifecycle íntegros;
- future appointment não entra em Encounter ativo por ator normal;
- Encounter Record + Evolution + appointment possuem contrato transacional;
- regressões clínicas/financeiras críticas cobertas por CI/PostgreSQL.

### GREEN de UX/piloto

Somente após profissional real conseguir completar a jornada com dados realistas e fricção aceitável, incluindo desktop/mobile quando pertinente, estados de loading/erro/conflito e o privacy shell.

Enquanto essa observação não existir de forma suficiente, **UX permanece YELLOW**, mesmo com foundation técnica GREEN.
