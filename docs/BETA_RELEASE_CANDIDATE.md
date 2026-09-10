# MedicsPro Beta Release Candidate

**Snapshot em 2026-09-10.** Este documento descreve a composição beta atual e seus gates. Não autoriza deploy ou produção.

## Composição canônica atual

O candidato beta inclui, entre outras foundations já integradas:

- papéis/identidade multiprofissionais e `professional_id` canônico;
- Platform Admin separado do domínio de clínicas;
- entitlements/configuração/autorização separados;
- Nexus C-01–C-06 como engine clínica integrada, médico-only/fail-closed;
- Clinician Daily Home (#390);
- Agenda Role-Aware V4 (#391);
- Clinical Encounter UX + reconciliação histórica (#392/#393);
- Encounter Clinical Record (#394);
- production-safe verifier do Encounter Record (#395);
- Consultório / Gestão Privacy Shell (#396);
- finalização clínica separada de falha esperada de cobertura (#388);
- resolução explícita de exceção financeira (#389);
- assessment engine, CRM, financeiro, mensageria e automações no runtime canônico.

## Regras arquiteturais preservadas

`role != profession != capability != entitlement != clinic configuration`

Além disso:

- `PresentationContext != authorization`;
- `platform_admin` não é role de clínica;
- parceiro/repasse não é role;
- Nexus não é segundo runtime;
- Encounter Record é a unidade editável do novo atendimento;
- Evolution é materialização oficial após confirmação humana;
- finalização clínica não depende de sucesso de cobertura esperada;
- histórico finalizado não é reescrito silenciosamente.

## Estado de produção conhecido

Em 2026-09-10:

- migration #394 foi aplicada em produção;
- `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql` passou com `VERIFY #394 PRODUCTION OK`;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou.

Isso é evidência estrutural do rollout do #394. Não equivale automaticamente ao smoke funcional completo pós-finalização.

O draft smoke observado comprovou persistência, refresh/navegação e revision; antes da finalização o cenário continha 1 Encounter Record, 0 Evolutions, 0 payments e 0 financial exceptions.

A comprovação read-only pós-finalização deve permanecer pendente até existir evidência registrada. O mesmo vale para smoke real `CHARGE`/`WAIVE` do #389.

## Dívida de verifier conhecida

O verifier histórico #388 contém uma assertion sobre ausência da RPC que #389 criou posteriormente. Essa assertion é obsoleta para o schema atual.

Não usar essa checagem antiga como blocker sem versioná-la/atualizá-la. As demais invariantes de #388 continuam relevantes e não devem ser relaxadas.

## Gate clínico do beta

Antes de ampliar uso real:

- executar o roteiro atual de `CLINICAL_PILOT_ACCEPTANCE.md`;
- confirmar appointment/paciente/profissional exatos;
- validar draft/revision e conclusão Encounter Record → Evolution → appointment;
- confirmar outro profissional sem autoria indevida;
- confirmar owner/admin sem bypass de clinical identity/capability;
- validar Nexus somente quando todas as boundaries médicas autorizarem;
- observar profissionais reais e registrar fricção de UX.

## Gate financeiro do beta

Usar a semântica atual de `FINANCIAL_PILOT_ACCEPTANCE.md`.

Não esperar que pacote esgotado/vencido/não elegível bloqueie uma conclusão clínica válida. Esperar `appointment_financial_exception` sem consumo gratuito silencioso e resolução explícita posterior.

Validar `CHARGE`/`WAIVE` por smoke real antes de considerar essas ações operacionalmente fechadas.

## Gate Consultório / Gestão

Validar em uso real:

- professional Consultório-only;
- owner/admin alternando contextos somente se clinicamente elegíveis;
- recep/financeiro Gestão-only;
- ocultação visual das áreas administrativas em Consultório;
- URL direta ainda sob guards reais;
- nenhuma alteração de role/RLS/capabilities/entitlements/canView/JWT/tenant;
- isolamento local por `user_id + clinic_id`;
- desktop/mobile, light/dark e resolving fail-closed.

Autoentrada automática em Consultório permanece fora desta composição.

## Gate técnico de cada novo HEAD

Um novo candidato de código precisa, conforme os paths afetados:

1. `npm test`;
2. typecheck;
3. lint;
4. build;
5. dependency audit;
6. workflows PostgreSQL/clinical/financial/Nexus relevantes;
7. revisão de diff e boundaries afetadas.

Um snapshot documental não deve congelar para sempre um SHA técnico antigo como “o candidato”. O SHA real do HEAD validado deve ser registrado na evidência do PR/release correspondente.

## Sequência recomendada a partir daqui

0. fechar evidência operacional curta #394/#389/#396;
1. Encounter UX / physician ergonomics;
2. Cobertura deste atendimento;
3. Instrument Delivery (`Aplicar agora` + `Enviar ao paciente`);
4. Prescription V1;
5. demais documentos médicos conforme piloto;
6. Finance Configuration com parceria/repasse como relação econômica, não role;
7. onboarding/pilot friction;
8. financeiro avançado/integracões conforme evidência.

## Critério para chamar de Beta Candidate

A composição pode ser tratada como **Beta Candidate técnico** quando:

- foundations críticas estão verdes;
- não há blocker estrutural conhecido;
- o HEAD efetivamente candidato passou seus gates;
- trabalho restante é explicitamente classificado como smoke/UX/operacional ou próxima slice de produto.

Isso não significa “beta validado por usuários”. UX permanece YELLOW até observação suficiente por profissionais reais.