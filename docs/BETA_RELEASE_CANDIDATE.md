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
- Clinical Instrument Authorization Foundation (#399), já alinhada em produção;
- Encounter Temporal Start Boundary (#400), já validada em produção;
- finalização clínica separada de falha esperada de cobertura (#388);
- resolução explícita de exceção financeira (#389);
- assessment engine, CRM, financeiro, mensageria e automações no runtime canônico.

## Regras arquiteturais preservadas

`role != profession != capability != entitlement != clinic configuration`

Além disso:

- `PresentationContext != authorization`;
- `ENGINE != EXPOSURE != AUTHORIZATION != RELEVANCE` para instrumentos clínicos;
- `platform_admin` não é role de clínica;
- parceiro/repasse não é role;
- Nexus não é segundo runtime;
- Encounter Record é a unidade editável do novo atendimento;
- Evolution é materialização oficial após confirmação humana;
- appointment de data futura não entra em `em_atendimento` por ator normal;
- finalização clínica não depende de sucesso de cobertura esperada;
- histórico finalizado não é reescrito silenciosamente.

## Estado de produção conhecido

Em 2026-09-10:

- migration #394 foi aplicada em produção;
- `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql` passou com `VERIFY #394 PRODUCTION OK`;
- migration #399 foi aplicada em produção e seu verifier read-only passou;
- `admin-team` e frontend foram alinhados ao mesmo `main` para a capability `clinical.instrument.apply`;
- smoke #399 com médico piloto comprovou fail-closed sem composição completa, ALLOW somente com setting + capability + próprio Encounter e rollback sem resíduos;
- migration #400 foi aplicada em produção e seu verifier read-only passou;
- smoke #400 reproduziu a tentativa real de iniciar appointment futuro e confirmou `appointment_future_encounter_start_forbidden`;
- o mesmo smoke comprovou que um future-active legado permanece DENY para Apply-in-Encounter e terminou com rollback limpo;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou.

Essa evidência é estrutural/técnica. Não equivale automaticamente ao smoke funcional completo pós-finalização do #394 nem a UX validada por profissionais externos.

O draft smoke #394 observado comprovou persistência, refresh/navegação e revision; antes da finalização o cenário continha 1 Encounter Record, 0 Evolutions, 0 payments e 0 financial exceptions.

A comprovação read-only pós-finalização deve permanecer pendente até existir evidência registrada. O mesmo vale para smoke real `CHARGE`/`WAIVE` do #389.

## Estado histórico conhecido após #400

Existe um appointment criado antes da correção temporal:

```text
appointment_id = de857836-baa0-476f-bd7b-d6f52df33007
data           = 2026-09-23
status         = em_atendimento
```

A #400 não executa saneamento retroativo. O levantamento forense não encontrou Encounter Record, Evolution, package usage ou payment associados.

O smoke de produção provou que essa row não autoriza Apply-in-Encounter e que a mesma tentativa de início futuro é agora bloqueada. O repair real continua pendente e deve ser separado/auditável.

Esse residual é **YELLOW operacional**, não regressão do boundary #400.

## Instrumentos clínicos

Estado técnico atual:

```text
[x] Clinical Instrument Authorization Foundation (#399)
[x] temporal defense Apply-in-Encounter (#400)
[ ] Clinician-Assisted Administration
[ ] persistência multiprofissional nova, se necessária
[ ] Encounter Instrument UX
[ ] boundary remoto / Enviar ao paciente
```

PHQ-9/GAD-7 permanecem referenciando a engine/versionamento/scoring Nexus, mas `clinical.instrument.apply` é authorization boundary neutro separado de `nexus.*`.

Não considerar PHQ-9/GAD-7 “entregues na UI” apenas porque a foundation está em produção.

## Dívida de verifier conhecida

O verifier histórico #388 contém uma assertion sobre ausência da RPC que #389 criou posteriormente. Essa assertion é obsoleta para o schema atual.

Não usar essa checagem antiga como blocker sem versioná-la/atualizá-la. As demais invariantes de #388 continuam relevantes e não devem ser relaxadas.

## Gate clínico do beta

Antes de ampliar uso real:

- executar o roteiro atual de `CLINICAL_PILOT_ACCEPTANCE.md`;
- confirmar appointment/paciente/profissional exatos;
- confirmar que appointment futuro não inicia por ator normal e mesmo-dia continua sujeito às boundaries clínicas canônicas;
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

0. reparar auditavelmente o known future-active e fechar evidência operacional curta #394/#389/#396;
1. Encounter UX / physician ergonomics;
2. Cobertura deste atendimento;
3. Clinician-Assisted Administration → Encounter Instrument UX;
4. Prescription V1;
5. demais documentos médicos conforme piloto;
6. Finance Configuration com parceria/repasse como relação econômica, não role;
7. onboarding/pilot friction;
8. financeiro avançado/integracões conforme evidência.

Timezone por tenant permanece follow-up obrigatório antes de expansão para clínicas em outros fusos; `America/Sao_Paulo` é somente o fallback operacional vigente da #400.

## Critério para chamar de Beta Candidate

A composição pode ser tratada como **Beta Candidate técnico** quando:

- foundations críticas estão verdes;
- não há blocker estrutural conhecido;
- o HEAD efetivamente candidato passou seus gates;
- trabalho restante é explicitamente classificado como smoke/UX/operacional ou próxima slice de produto.

Isso não significa “beta validado por usuários”. UX permanece YELLOW até observação suficiente por profissionais reais.
