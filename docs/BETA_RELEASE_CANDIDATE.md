# MedicsPro Beta Release Candidate

**Reconciliado em 2026-09-17.** Este documento descreve a composição beta e seus gates. Não autoriza deploy ou produção; estado vivo continua em `docs/CURRENT_STATE.md`.

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

Em 2026-09-15, a comprovação read-only pós-finalização foi registrada: o único Encounter Record estava `finalized`, com Evolution única/ativa corretamente vinculada, appointment `finalizado`, um único lançamento financeiro coerente e zero exceção financeira. No mesmo fechamento operacional, `CHARGE` e `WAIVE` do #389 foram exercidos com autenticação real dentro de transações revertidas, provando idempotência e ausência de resíduos.

## Verifier #388 × #389 — dívida fechada

Em 2026-09-15, o harness PostgreSQL 16 confirmou que o verifier #388 é composition-aware: passa no estado histórico antes de #389 e volta a passar após a migration #389, exigindo a superfície canônica de resolução sem liberar mutação direta da fila.

O verifier #389 também passou e os controles negativos de autorização, mutabilidade, materialização, duplicidade e cross-tenant falharam como esperado. Isso fecha a dívida técnica do verifier; **não** substitui o smoke operacional real de `CHARGE`/`WAIVE` em produção.

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

O gate técnico de `CHARGE`/`WAIVE` foi fechado por smoke autenticado em produção com rollback; a disposição econômica de exceções reais continua decisão da clínica.

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

**P0 #396 fechado em 2026-09-17:** o smoke autenticado em produção validou owner/admin clinicamente elegível, professional Consultório-only, desktop/mobile light-dark, privacy boundary de URL administrativa e ausência de overflow após #504/#505. O achado de telemetria `automation_runs` durante a revisão foi tratado separadamente pela #506 e não alterou autorização.

A autoentrada contextual entregue pela #478 ocorre somente após handoff explícito de iniciar/continuar o próprio Encounter; rota/query ou mera existência de appointment ativo não concedem nem forçam Consultório.

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

0. **fechado:** evidências operacionais curtas #394/#389/#396;
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
