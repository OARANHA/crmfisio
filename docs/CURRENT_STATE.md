# MedicsPro — Current State

> Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução. Código, schema e runtime reais prevalecem se este arquivo envelhecer; detalhes ficam nos documentos de domínio.

**Regra de continuidade:** antes de encerrar uma slice significativa, atualizar este snapshot e o documento do domínio com base/branch/PR/head, validações concluídas, estado de produção, riscos pendentes e próximo passo seguro. Outro chat/agente deve começar por este arquivo para evitar reconstrução ou duplicação de trabalho.

**Data do snapshot:** 2026-09-18
**Regra de base:** todo novo trabalho deve resolver a `origin/main` atual antes de decidir ou implementar; não usar um SHA deste snapshot como instrução de checkout.
**Último SHA funcional com rollout registrado nesta sequência:** `47f9b1e1f6f509fe8f72641e2aad91f7350e23ae` (#516 Message Template Admin Boundary V1), após #515 e sobre a configuração de Comunicação #512/#513.ning #513), sobre a foundation de Clinic Configuration #406/#407/#408 e Plan Catalog #508/#509.

## Estado clínico resumido

```text
Clinical Documents D2-A                                      PROD
Prescription D2-B / B.1 / B.2A / B.2B / B.2C               PROD
Therapeutic Guidance D2-C / D2-C.1                           PROD
Exam Order D2-D0 / D2-D1 / D2-D2                             PROD
Referral D2-E0 / D2-E1 / D2-E2 / D2-E3 / D2-E3.1            PROD
Clinical Encounter visual                                     PROD
Assessment Library V1                                         PROD
D2-E4 Referral Operational Continuity                         PROD
Clinic Referral Authoring Policy V1                           PROD
PHQ-15 Clinician-Assisted V1                                  PROD BACKEND / FAIL-CLOSED VALIDATED
Encounter Auto-Entry / Presentation handoff #478                PROD
Encounter Coverage Context V1 #479                              PROD / VERIFIED
Encounter Record Correction/Addendum V1 #481                   PROD / VERIFIED
Neutral Clinician-Assisted Instrument History V1 #482           PROD / VERIFIED
Clinical Instrument Patient Delivery V1                         PROD / VERIFIED
CAGE Clinician-Assisted V1 #488                                 PROD / VERIFIED / TENANT ENABLEMENT REQUIRED
PCL-5 Clinician-Assisted V1 #491                                 PROD / VERIFIED / TENANT ENABLEMENT REQUIRED
PC-PTSD-5 Clinician-Assisted V1 #495                              PROD / VERIFIED / TENANT ENABLEMENT REQUIRED
Authorization/config tri-state UX hardening #498                PROD / VERIFIED
Platform Admin access tri-state hardening #500                  PROD / VERIFIED
PresentationContext eligibility error hardening #502              PROD / VERIFIED
Consultório / Gestão authenticated P0 #396/#504/#505                PROD / VERIFIED
Tenant automation telemetry boundary #506                           PROD / VERIFIED
Plan Catalog + Clinic Plan Assignment V1 #508/#509                   PROD / VERIFIED
Clinic Communication Configuration V1 #512/#513                        PROD / VERIFIED
```


## Produção — Message Template Admin Boundary V1 #516 + worker browser boundary #515

**Status técnico:** #515 squash-mergeada em `main@5eabf39a4c180837ff35cd572cf508b35aae7325` e observada no frontend produtivo. #516 squash-mergeada em `main@47f9b1e1f6f509fe8f72641e2aad91f7350e23ae`; frontend promovido e migration aplicada/verificada no PostgreSQL 17.6 em 2026-09-18. O smoke autenticado humano do editor em Configurações → Comunicação permanece como validação de UX, não como blocker estrutural do contrato instalado.

#515 removeu o dispatch global do Evolution worker pelo browser no fluxo de lista de espera. A UI apenas enfileira a oferta e o envio permanece atrás da cadeia server-side `medicspro-automation → evolution-worker` com segredo interno.

#516 moveu a edição de templates de comunicação da Central operacional de Mensagens para **Configurações → Comunicação** e fechou o acesso direto à tabela `message_templates` para `anon/authenticated`. Owner/admin com `whatsapp.access` usam agora as RPCs current-clinic `list_current_clinic_message_templates()` e `update_current_clinic_message_template(uuid,text)`; recepção/profissional não recebem autoridade administrativa por esse caminho. Alterações gravam `MESSAGE_TEMPLATE_UPDATED` no audit trail.

**Evidência de rollout:** os 13 arquivos da #516 no source do Portainer foram comparados byte a byte com a main antes da promoção. O frontend novo ficou ativo com um único container `crmfisio-crmfisio-1`, `restarts=0`, `OOM=false`, e `/`, `/config`, `/mensagens`, `/agenda`, `/pacientes` responderam HTTP 200. A migration deu COMMIT e o production-safe verifier retornou `MESSAGE TEMPLATE ADMIN BOUNDARY V1 PRODUCTION VERIFY PASSED`. As 8 linhas de templates de 2 clínicas mantiveram o mesmo hash lógico `d9102eaa762af274221c59df742b8b49` antes/depois.

**Boundary preservado:** operação diária de Mensagens não administra configuração; templates são configuração tenant administrativa; entitlement da plataforma, configuração da clínica e autorização do usuário continuam separados.

**Próximo passo seguro:** não recriar templates/outbox. Completar o smoke autenticado do editor quando houver sessão de owner/admin disponível e continuar a auditoria de Comunicação pelos gaps ainda abertos: conexão/provider, opt-in/NPS e health/observabilidade adequados ao tenant.

---

## Produção — Clinic Communication Configuration V1 #512 + ACL hardening #513

**Status:** #512 squash-mergeada em `main@47dd1c24dd7ec4f255bff5df921a1b17782d2928`; #513 squash-mergeada em `main@28a79a795e3adb3e081aa2cb7dd2d7b8895b097b`. Frontend, policy e ACL hardening estão implantados e validados em produção em 2026-09-17.

A #512 reorganizou a configuração tenant de comunicação sem criar nova foundation: `AutomationControlPanel` saiu da tela operacional `/mensagens` e passou para `Configurações → Comunicação`. A UI valida `whatsapp.access`, distingue negação contratual de falha técnica e o client de `automation_settings` exige retorno real da linha atualizada para não produzir sucesso falso quando RLS filtra uma mutação.

No PostgreSQL, `automation_settings_write_admin` continua tenant-scoped e owner/admin-only, agora também exige `current_clinic_entitlement_allowed('whatsapp.access')`. A primeira execução do verifier production-safe da #512 encontrou um drift preexistente: os default privileges do Supabase self-hosted haviam deixado `anon` e `authenticated` com grants amplos na tabela. O verifier bloqueou a validação; nenhum dado foi alterado. A #513 corrigiu o ACL explicitamente: `anon` sem grants; `authenticated` somente `SELECT, INSERT, UPDATE`; `DELETE=false`; `service_role` preservado.

Após o hotfix, `VERIFY_20260917_CLINIC_COMMUNICATION_CONFIGURATION_V1_PRODUCTION.sql` passou integralmente em PostgreSQL 17.6. As 3 linhas de `automation_settings` permaneceram com o mesmo hash lógico antes/depois: `7890b62aca7862e2eb767fecec5a5418`. Produção final: frontend e banco `running`, `restarts=0`, `OOM=false`; `/`, `/config`, `/mensagens`, `/agenda` e `/pacientes` HTTP 200; bundle ativo contém os marcadores da nova configuração.

**Boundary preservado:** `PLATFORM ENTITLEMENT → CLINIC CONFIGURATION → USER AUTHORIZATION`. A configuração da clínica não habilita o produto contratado e o módulo bloqueado não perde seu histórico/configuração persistida.

**Próximo passo seguro:** Comunicação permanece um domínio parcialmente aberto. Não recriar automação nem entitlement. Auditar primeiro os contratos já existentes para conexão/provider WhatsApp, templates, opt-in/NPS e health antes de escolher a próxima micro-slice.

---

## Produção — Plan Catalog + Clinic Plan Assignment V1 #508 + verifier hardening #509

**Status:** #508 squash-mergeada em `main@d9ec815d6450328ec7f4081067dc4dc041e0e302`; #509 production-safe verifier squash-mergeada em `main@51300dae05c0f90d03d6ed4e8790421037a6b009`. Rollout produtivo verificado em 2026-09-17 sobre PostgreSQL 17.6; checkpoint documental consolidado pela #510.

A migration `20260917_platform_plan_catalog_assignment_v1.sql` foi aplicada com COMMIT e o verifier #509 passou em transação estritamente READ ONLY. Estado após rollout: `plans=0`, `versions=0`, `assignments=0`, 13 overrides manuais preservados e zero linhas `source='plan'`. O hash lógico dos overrides permaneceu idêntico antes/depois. O Evolution worker foi promovido para o resolver canônico; Edge Runtime e frontend permaneceram healthy, sem restart/OOM, e as rotas principais responderam HTTP 200.

Boundary confirmado com atores reais: Platform Admin consegue ler catálogo e os seis entitlements efetivos; usuário normal de clínica é negado no Control Plane. O catálogo vazio é deliberado: nomes, preço e composição de pacotes são decisão comercial e não foram inventados por engenharia.

**Continuidade:** a reauditoria posterior confirmou que `Clinic Configuration Core V1` já existia e estava em produção via #406/#407/#408. A evolução seguinte foi registrada em #512/#513 na seção acima; não recriar essa foundation.

---

## Produção — Consultório / Gestão authenticated P0 closure + tenant automation telemetry boundary #506

**Status:** o P0 autenticado do Consultório / Gestão (#396) foi fechado em produção em 2026-09-17 após os hardenings #502, #504 e #505. O smoke foi executado contra `app.medicspro.com.br` com owner/admin clinicamente elegível e `professional` clinical-only, em desktop e viewport mobile de 390 px, nos temas light/dark. Resultado final: `P0_396_SMOKE=PASS` e `SMOKE_EXIT=0`.

A prova confirmou: owner/admin com `current_user_has_valid_clinical_identity=true` + `clinical.attend=true` alterna Consultório/Gestão; Consultório oculta Financeiro global, CRM gerencial, Relatórios e Configurações; URL administrativa direta recebe o privacy boundary; `professional` permanece Consultório-only sem ação de Gestão; o estado `Modo Consultório` continua perceptível no drawer mobile; e não houve overflow horizontal após #504/#505. As credenciais temporárias do harness foram removidas ao final da execução.

A segunda revisão adversarial do mesmo smoke encontrou um débito **independente do #396**: o owner/admin recebia `403` ao tentar ler `public.automation_runs` diretamente pelo browser. O banco estava correto: `20260904_platform_automation_observability_security.sql` já havia tornado essa tabela telemetria global exclusiva do Platform Admin e revogado `SELECT` de `authenticated`. A #506 removeu os consumidores tenant de `automation_runs`, preservou `automation_settings` clinic-scoped e manteve a telemetria global exclusivamente em `platform_get_automation_runs(integer)`. Nenhum grant, RLS, RPC, migration, Edge Function, role, capability ou entitlement foi ampliado.

#506: PR CI `9/9` PASS; lab `120 arquivos / 651 testes` PASS, typecheck/lint/build/diff-check PASS e dependency audit sem vulnerabilidade high/critical. Squash merge em `main@392fade1bec14e6767ad5578426c1ed606f0dc7c`. Auto-deploy observado: frontend recriado às `2026-09-17T07:06:19Z`, `restarts=0`, `OOM=false`, `/`, `/agenda`, `/pacientes`, `/mensagens` e `/platform` HTTP `200`, zero HTTP 5xx/erros desde o start. No bundle ativo, `automation_runs` aparece somente no chunk de Platform Admin junto de `platform_get_automation_runs`; o chunk tenant de Mensagens contém apenas a nova cópia de configuração/telemetria separadas.

**Próximo passo seguro:** tratar o privacy shell #396 como baseline verificado e avançar para observação de ergonomia/jornada clínica no piloto. Não repetir o smoke autenticado apenas por continuidade de chat; repetir somente diante de regressão ou mudança relevante no shell.

---


## Produção — PresentationContext eligibility error hardening #502

**Status:** #502 mergeada por squash em `main@41dcb6addf3d8fc3482766829a6d1e8d2e74d569`; frontend promovido automaticamente e observado em produção em 2026-09-17. Frontend-only: nenhuma migration, RLS/RPC, grant, capability, entitlement ou Edge Function foi alterada.

Durante o P0 de smoke do Consultório / Gestão (#396), foi reproduzido um drift semântico: falha técnica nos RPCs que verificam identidade clínica + `clinical.attend` de owner/admin permanecia fail-closed, porém era apresentada silenciosamente como Gestão-only. A #502 preserva `loading | allowed | denied | error` até o shell, mantém Consultório bloqueado em erro e expõe aviso + retry sem transformar PresentationContext em autorização.

Gates: testes focados `30/30` PASS; full suite `118 arquivos / 646 testes` PASS; typecheck, lint, build e `git diff --check` PASS; PR CI `8/8` workflows PASS. Produção: auto-deploy concluído, bundle contém aviso/fail-closed/retry, `/`, `/platform`, `/agenda` e `/pacientes` HTTP `200`, container com `restarts=0`, `OOM=false` e `0` HTTP 5xx reais.

**P0 #396 fechado em 2026-09-17:** a evidência visual/autenticada foi executada após #504/#505 e está registrada na seção de fechamento acima. #502 continua sendo o hardening do estado de erro; o smoke posterior validou a composição real em produção.

---

## Produção — Platform Admin access tri-state hardening #500

**Status:** #500 mergeada por squash em `main@a5fd2d8afe198bf3386add5e25fcfeb454b72d54`; frontend promovido automaticamente e observado em produção em 2026-09-16. Nenhuma migration, RLS/RPC, grant, capability, entitlement ou Edge Function foi alterada.

A slice fecha a auditoria residual do frontend Platform Admin sem ampliar autoridade: o acesso agora preserva explicitamente `checking / allowed / denied / error`. Falha técnica de sessão/RPC/rede permanece fail-closed, mas é apresentada como **verificação indisponível** com retry, em vez de ser convertida falsamente em `Acesso negado`. A decisão efetiva continua server-side por `isPlatformAdmin()`; o browser não escolhe `clinic_id`, não promove usuário e não recebe bypass clínico/financeiro.

Gates locais antes do merge: testes focados `6/6` PASS, typecheck, lint, build e `git diff --check` PASS. PR #500 fechou com os workflows aplicáveis verdes e sem threads/reviews pendentes. Pós-merge, `origin/main` e o lab convergiram para o mesmo SHA.

Produção: os 10 arquivos alterados pela #500 foram comprovados byte a byte contra a `main`; bundle ativo contém o tri-state e a cópia de erro; `/`, `/platform`, `/agenda` e `/pacientes` retornaram HTTP `200`; container novo observado com `restarts=0`, `OOM=false` e zero HTTP 5xx desde o start. O auto-update do Portainer concluiu sozinho, portanto nenhum deploy manual foi necessário.

**Próximo passo seguro:** o P0 #396 já está fechado. Retomar o Control Plane mínimo ou a próxima slice indicada por `TODO.md`, sem reabrir #500/#502/#504/#505/#506 sem evidência de regressão.

---

## Produção — Authorization/config tri-state UX hardening #498

**Status:** #498 mergeada por squash em `main@a88bb8ac0f14d5b67222da6b42bdabea27269ac2`; PR CI `11/11` verde; frontend promovido e observado em produção em 2026-09-16. Nenhuma migration, RLS/RPC, grant, capability ou Edge Function foi alterada nesta slice.

O hardening não cria nem amplia autorização. Ele preserva explicitamente `loading / allowed / denied / error` nos consumidores clínicos/Nexus que antes colapsavam erro técnico em negação silenciosa. Em falha de verificação, ferramentas, rotas e ações Nexus permanecem fail-closed, mas a UI informa que a autorização não pôde ser confirmada em vez de afirmar que o recurso está simplesmente indisponível.

A mesma regra foi aplicada à navegação por entitlement: módulos sujeitos a entitlement não são mais tratados como visíveis quando o lookup está `unknown`/não resolvido; módulos sem boundary de entitlement continuam visíveis normalmente. O `ClinicEntitlementGate`, os RPCs, RLS, C-06 e demais boundaries server-side não foram alterados. Platform Admin permanece fora deste recorte e continua coberto pela auditoria residual separada de autorização/configuração.

Gates locais: boundaries focados `73/73` PASS; menu entitlement `20/20` PASS; full suite `116 arquivos / 639 testes` PASS; typecheck, lint, build e `git diff --check` PASS. PR: `11/11` workflows PASS, mergeable e sem threads pendentes antes do squash. O merge SHA não gerou workflow `push` associado; a promoção foi comprovada diretamente no runtime.

Produção: container frontend recriado após o merge; `/`, `/dashboard`, `/pacientes` e `/nexus` HTTP `200`; chunks lazy com os novos estados de erro tri-state servidos com HTTP `200`; `restart_count=0`, processo `running` e `OOM=false`. O warning de chunks grandes do Vite permanece débito pré-existente e não foi misturado nesta slice.

**Próximo passo seguro:** manter a auditoria residual de `entitlement × clinic configuration × user authorization`, tratando Platform Admin separadamente e sem reabrir #498 sem evidência de regressão.

---

## Produção — PC-PTSD-5 Clinician-Assisted V1

**Status:** #495 mergeada por squash em `main@f62b221d05a568f363595e93ad945f4e1df84c5c`; rollout técnico verificado em produção em 2026-09-16 a partir de `main@b7c6877f510fb9744c4cc29b1a998ab564b3547f`; nenhuma clínica foi habilitada permanentemente.

A V1 adiciona somente `Aplicar agora` pelo boundary neutro existente: `clinical.instrument.apply` + enablement explícito da clínica + próprio Encounter ativo. Não concede `nexus.*`, não altera `professional_capabilities`, não auto-habilita clínica e não cria contrato `patient_self`.

Contrato versionado: `nexus-pcptsd5-ptbr-ops-2026-09-16`. Há gate de exposição traumática (`q0`) seguido de cinco itens binários `q1..q5` quando o gate é positivo. Gate negativo encerra em `0/5` e persiste somente `q0`; gate positivo persiste exatamente `q0..q5`. A UI limpa respostas sintomáticas anteriores quando o gate muda para a resposta de parada, evitando reaproveitamento silencioso se o gate for reaberto depois.

A redação PT-BR é explicitamente **tradução operacional**, não “versão brasileira validada”. Nesta revisão não foi identificada validação brasileira publicada nem tradução oficial PT-BR do VA. O cutoff operacional `>=4` é congelado com base em evidência externa; o resultado permanece rastreio e nunca produz diagnóstico, prescrição, encaminhamento ou conduta automática.

Gates de engenharia: PostgreSQL 16/17.6 PASS; migration replay/default-deny/enable-disable/idempotência/forged-version/snapshots canônicos PASS; full suite 116 arquivos / 638 testes PASS; typecheck/lint/build/diff-check PASS; PR CI 24/24 e pós-merge 7/7 PASS. Em produção, migration deu COMMIT; verifiers base, CAGE, PCL-5 e PC-PTSD-5 passaram; shared Edge engine e writer clinician-assisted foram promovidos e permaneceram healthy; endpoints anônimos continuaram 401; frontend HTTP 200 contém chave/nome/versão PC-PTSD-5; smoke transacional real do writer/replay/forged-version passou com ROLLBACK. Estado final: `contract=1`, `catalog=1`, `settings=0`, `administrations=0`, `patient_self=0`.

**Próximo passo seguro:** tenant enablement somente por decisão explícita de `owner/admin` e após revisão clínica/local apropriada. O rollout técnico não habilitou nenhuma clínica e não executou aplicação real em paciente.

---

## Produção — PCL-5 Clinician-Assisted V1

**Status:** #491 mergeada por squash e rollout produtivo verificado em 2026-09-16; runtime funcional `44e392ef2df7e5b1fca1cf373246fb500eb7254b`; nenhuma clínica foi habilitada permanentemente.

PCL-5 foi escolhido após nova revisão dos instrumentos Nexus restantes: ISI permanece dependente de licença do titular/Mapi e os instrumentos WHO da Wave 1 continuam exigindo revisão de permissão comercial. PCL-5 é public domain via VA e possui adaptação/validação brasileira publicada.

A V1 é somente `Aplicar agora`, exige 20 respostas `0..4`, usa regra versionada `nexus-pcl5-br-2026-09-16` com cutoff operacional `>=36` da validação brasileira, não infere diagnóstico, não auto-habilita clínicas e não cria contrato `patient_self`.

Gates aprovados: testes focados 29/29; PostgreSQL 16 e PostgreSQL 17.6; full suite 116 arquivos / 634 testes; typecheck, lint, build e dependency audit com 0 vulnerabilidades; PR CI 51/51; pós-merge 6/6 workflows de push. Em produção, migration e verifiers base/CAGE/PCL-5 passaram; shared Edge engine foi promovido e voltou healthy; frontend já estava auto-promovido com marcadores PCL-5; smoke transacional do writer/replay/forged-version passou com ROLLBACK. Estado final: `contract=1`, `catalog=1`, `settings=0`, `administrations=0`, `patient_self=0`.

---

## Produção — CAGE Clinician-Assisted V1

**Status:** #488 mergeada e rollout produtivo verificado em 2026-09-16; migration aplicada, shared Edge engine pinado à `main@28bc2eab26edf33672e2509f0ec64503f9d05047`, frontend com bundle CAGE ativo e nenhuma clínica habilitada permanentemente.

CAGE foi selecionado como primeira ferramenta nova da expansão Nexus restante após revisão de direitos/proveniência. A V1 usa somente `Aplicar agora`, exige quatro respostas binárias explícitas, mantém cutoff canônico `>=2` como **rastreio** e não como diagnóstico, não auto-habilita clínicas e não cria contrato `patient_self`.

Gates aprovados: PostgreSQL 16 e PostgreSQL 17.6, testes focados 26/26, full suite 116 arquivos / 631 testes, typecheck, lint, build, dependency audit, PR CI 50/50 e 5/5 workflows pós-merge. Em produção, verifier formal e smoke transacional de writer/idempotência passaram; o ROLLBACK deixou `0` settings CAGE, `0` administrações CAGE e `0` contratos `patient_self`.

---

## Produção — Clinical Instrument Patient Delivery V1

**Status:** PRODUÇÃO / VERIFIED — #484 mergeada; rollout técnico concluído após hotfix #486 do `wa_logs_template_check`.

```text
previous main:                   8b1bdbb3856f9d2c320e9dc737f4ec1263090095
PR:                              #484 MERGED
merge SHA / main:                dc6ab7da99a022a76c305c1a45e4e3e907eec525
PR final head:                   920a649474d3273036398c74539056d33567d7f6
PR CI:                           49/49 PASS
post-merge push workflows:       4/4 PASS
PostgreSQL 16 behavior/replay:  PASS
production-safe verifier:       PASS no banco descartável
Patient Delivery boundary tests: 8/8 PASS
full frontend suite:             116 files / 628 tests PASS
typecheck/lint/build:            PASS
dependency audit:               0 vulnerabilities
production:                     PROD / VERIFIED
hotfix:                         #486 MERGED / APPLIED
production verifier:            PASS
transactional smoke:            PASS / ROLLBACK / 0 residue
patient_self registry:          PHQ-9/GAD-7 active; clinic enablement remains explicit
```

A árvore do squash em `main@dc6ab7d` é idêntica à árvore final revisada da PR. O gate final local passou, o CI da PR fechou 49/49 verde e os quatro workflows disparados pelo push pós-merge também concluíram com sucesso.

A V1 cria um registry versionado `patient_self`, mantém convites Nexus históricos como `authority_source='nexus'` e usa `authority_source='clinical_instrument'` para a fachada neutra. O mesmo transporte de token/página pública/WhatsApp é reutilizado, mas claims/writers são separados por autoridade e o ledger clínico neutro recebe `provenance='patient_self'`.

A UI de `Instrumentos` passa a compor `Aplicar agora -> Enviar ao paciente -> Histórico`, sem conceder `nexus.*`. O histórico neutro evolui para `clinician_assisted + patient_self` e continua sem expor respostas, snapshots, SOAP ou evidence.

**Próximo passo seguro:** observar uso real no piloto e manter novos instrumentos `patient_self` fail-closed até contrato/versionamento/revisão clínica explícitos; não ampliar a lista remota por mera presença no Nexus.

---

## Último rollout — Neutral Clinician-Assisted Instrument History V1

**Status:** PRODUÇÃO — #482 mergeada, migration aplicada, verifier aprovado e frontend observado.

```text
#482 Neutral Instrument History: PROD
main canônica:                  830743de877e89577d266d5f9cc4bd33e1d3bbff
DB migration:                   APPLIED / COMMIT
production verifier:            PASSED
real administrations created:   0
public routes:                  HTTP 200
HTTP 5xx / Nginx errors:        0 / 0
```

`list_patient_clinician_assisted_instrument_history(uuid)` projeta somente histórico longitudinal neutro para quem já pode ler o prontuário via `can_access_patient_clinical_record()`. A leitura não exige `clinical.instrument.apply` nem `nexus.access`, e o browser continua sem SELECT/INSERT direto em `clinical_instrument_administrations`.

A UI mostra histórico em `Instrumentos` e no prontuário longitudinal, preservando separação entre **aplicar instrumento** e **ler resultado histórico**. Respostas, snapshots brutos, evidence, SOAP e internals Nexus não são expostos.

O ciclo normal de engenharia do MedicsPro também foi consolidado em `/opt/medicspro-lab` no `28server`: workspace Node/Git isolado + PostgreSQL 16 efêmero em rede Docker própria, sem Docker socket, sem volumes/env de produção e com GitHub `repo + workflow`. O Wandora deixa de ser a bancada normal do MedicsPro.

**Próximo gap clínico escolhido:** `Enviar ao paciente` V1 já está em produção e verificado; próximos instrumentos remotos dependem de contrato explícito e revisão de segurança/direitos/população.

---

## Rollout anterior — Encounter Record Correction/Addendum V1

**Status:** PRODUÇÃO — #481 mergeada, migration aplicada, verifier e smoke de imutabilidade aprovados, frontend observado.

```text
#481 Correction/Addendum: PROD
main canônica:           84446b68f4f195ca0441bf341c28a517b773d438
DB migration:            APPLIED / COMMIT
production verifier:     PASSED
immutability smoke:      PASS / ROLLBACK
real addenda created:    0
frontend webroot:        50/50 files byte-identical
HTTP 5xx / Nginx errors: 0 / 0
```

`clinical_encounter_record_addenda` é append-only. Browser autenticado possui leitura sujeita a RLS, mas nenhum INSERT/UPDATE/DELETE direto; escrita ocorre somente por `create_clinical_encounter_record_addendum(...)`. A V1 exige autor original + identidade clínica válida + `clinical.attend` + `clinical.evolution.write`, sem bypass de owner/admin.

A Evolution oficial vinculada a Encounter Record finalizado passou a ser estruturalmente imutável. O smoke produtivo provou essa negação dentro de transação revertida, sem criar retificação/adendo real e sem tocar appointment, pacote, payment ou fila financeira.

No prontuário longitudinal, Retificações e adendos aparecem como atos posteriores vinculados ao atendimento finalizado; o original permanece preservado.

**Gap seguinte após #481:** fechado pela #482 e pela entrega produtiva da Patient Delivery V1 (#484 + hotfix #486).

---

## Rollout anterior — Encounter Auto-Entry + Coverage Context

**Status:** PRODUÇÃO — #478 e #479 mergeadas, RPC aplicada e frontend observado.

```text
#478 Auto-Entry:          PROD
#479 Coverage Context:    PROD
main canônica:            46ef897461fe813f8b2c2f75507a8f919019fcb1
RPC production verifier: PASSED
frontend public smoke:    8/8 PASS
HTTP 5xx / Nginx errors:  0 / 0
```

#478 centraliza a entrada em Consultório no handoff explícito de **Iniciar/Continuar atendimento**. O `PresentationContextProvider` continua decidindo se `clinical` está disponível; rota/query, abertura de paciente, histórico e mera existência de appointment ativo não mudam o contexto.

#479 adiciona `public.get_encounter_coverage_context(uuid)` como leitura contextual do próprio Encounter `em_atendimento`. A função exige identidade clínica válida + `clinical.attend` + `professional_id = auth.uid()`, não exige `finance.access`, não executa mutation e não retorna valores, IDs de pagamento, histórico financeiro ou fila global.

Smoke real de produção confirmou `private_planned` para o profissional atribuído e negação para outro ator da mesma clínica, dentro de transação revertida. O frontend ativo é byte a byte equivalente ao candidato validado e contém a rail:

```text
Paciente em contexto
→ Encerramento
→ Cobertura deste atendimento
```

O card de Encerramento é resumo/atalho; não cria um segundo caminho de finalização. A conclusão clínica continua independente do acerto administrativo.

**Gap seguinte após #478/#479:** #481/#482 e Patient Delivery V1 (#484 + #486) estão em produção e verificadas.

---

## Último rollout — PHQ-15 Clinician-Assisted V1

Estado em **2026-09-14 (America/Sao_Paulo)** / 2026-09-15 UTC:

```text
PR:                    #461 — MERGED
merge SHA:             7bcf7b109b661e4c0ee4b7c4eada4097210edc0a
current main:          5220747eb1673a34aeecd73eedbc9e768a2f044f
DB migration:          APPLIED
production verifier:   PASSED (read-only)
Edge shared engine:    DEPLOYED
public processor:      DEPLOYED with PHQ-9/GAD-7 allowlist
clinic settings PHQ15: 0
persisted PHQ15 rows:  0
```

Produção contém o contrato versionado `nexus.phq15 / nexus-phq15-2026-09-13` e o mapeamento clínico neutro `phq15`, sem auto-grant e sem habilitar nenhuma clínica. O frontend já contém a UI clinician-assisted, mas `clinical_instrument_base_authorized()` permanece deny-by-default enquanto não houver setting explícito da clínica.

Validação real executada no `28server / 158.220.97.145`:

- migration `20260913_phq15_clinician_assisted_v1.sql` aplicada com COMMIT;
- verifier `VERIFY_20260913_PHQ15_CLINICIAN_ASSISTED_V1.sql` passou integralmente em transação read-only;
- shared engine e `nexus-self-assessment-processor` publicados com hashes pinados ao código mergeado;
- self-assessment público rejeita `phq15` com HTTP 400;
- clinician-assisted sem sessão permanece HTTP 401;
- resolver do contrato retorna `nexus.scales` apenas como metadado/proveniência da engine;
- `settings=0` e `ledger=0` após o rollout;
- smoke positivo DB em Encounter real ativo executado somente dentro de `BEGIN ... ROLLBACK`: identidade/capability válidas, setting temporário, writer positivo, replay idempotente, snapshot versionado e imutabilidade comprovados;
- pós-rollback: zero setting PHQ-15 e zero administração PHQ-15 persistidos.

Invariantes preservadas:

```text
ENGINE != AUTHORIZATION != RELEVANCE
nexus.scales = metadado/proveniência da engine, não autorização do ato
clinical.instrument.apply + clinic setting explícito + Encounter próprio ativo = boundary clínico
migration não concede capability
migration não habilita PHQ-15 automaticamente em nenhuma clínica
PHQ-15 não vira diagnóstico, etiologia, prescrição ou encaminhamento automático
```

Próximo passo seguro: **não habilitar automaticamente nenhuma clínica**. Quando owner/admin de uma clínica escolher habilitar PHQ-15, executar um smoke E2E autenticado de `Aplicar agora` com sessão humana válida, confirmar snapshot real no ledger e então registrar a clínica como operacionalmente validada para PHQ-15.

Documento de domínio: `docs/PHQ15_CLINICIAN_ASSISTED_V1.md`.

---

## Consultório V5 — composição + hierarquia visual

**Status:** PRODUÇÃO — RUNTIME VALIDATED.

```text
Navigation Composition:   #469 MERGED → main@233b6cb30e4f6943d1ede28acceafe2e08d18284
Visual Hierarchy V1:      #470 MERGED → main@ea5f982f556b1723c2b036bff961c1f7bb2cdbbe
runtime backend:          INALTERADO
migration/schema/RLS:     NENHUMA ALTERAÇÃO
produção frontend:        DEPLOYED / HTTP 200
```

Composição canônica em produção:

```text
um Encounter
├─ Registro
├─ Avaliações
├─ Instrumentos
├─ Prescrição        (quando relevante)
├─ Exames            (quando relevante)
├─ Documentos
│  ├─ Orientação terapêutica
│  └─ Encaminhamento
└─ Nexus
```

Visual Hierarchy V1 reforça contraste e hierarquia sem transformar o produto em dashboard decorativo:

- aqua/azul = contexto, foco e referência;
- mint/verde = ação/estado ativo ou confirmado;
- amber/laranja = atenção/pendência;
- pulse/vermelho = erro/bloqueio;
- hero, tabs, seções e rail de contexto ganharam presença visual controlada;
- sidebar ganhou marcador ativo discreto;
- `Prontuário longitudinal e histórico` deixou o rodapé e passou para drawer lateral aberto por `Paciente em contexto`, usando o mesmo `historicalWorkspace` canônico.

Invariantes preservadas:

- `Assessment Engine` continua separado de `Clinician-Assisted Administration`;
- `Instrumentos` não herda `clinical.assessment.apply`;
- profissão/especialidade seguem apenas como relevância de apresentação;
- Prescrição/Exames e Clinical Documents mantêm autorização server-side própria;
- histórico longitudinal não vira oitava aba nem outra engine;
- Encounter lifecycle, RLS/RPC, capabilities, autoria e care relationship não mudam.

Evidência:

- Navigation Composition: `105/105` arquivos e `572/572` testes antes do merge; PR #469 com `22/22` workflows verdes;
- Visual Hierarchy V1: `106/106` arquivos e `576/576` testes, TypeScript, lint, build e diff-check verdes; PR #470 com `11/11` workflows verdes;
- produção #470: container novo, `restarts=0`, `OOM=false`, bundle com `clinical-history-drawer`/`medicspro-nav-item`, rotas `/`, `/agenda`, `/pacientes`, `/nexus`, `/mensagens` HTTP 200 e sem 4xx/5xx nos logs observados.

Documentos: `docs/CONSULTORIO_V5_NAVIGATION_COMPOSITION_V1.md` e `docs/CONSULTORIO_V5_VISUAL_HIERARCHY_V1.md`.

---

## P0 beta hardening — verifier #388 × #389

**Status:** DÍVIDA TÉCNICA FECHADA NO REPOSITÓRIO. Nenhuma mutation de produção foi executada nesta reconciliação.

Em 2026-09-15, sobre `main@16cb7c048f177f2f61c2ea744eb3e31504c42103`, `scripts/test-financial-exception-resolution.sh` foi executado em PostgreSQL 16 isolado e passou integralmente.

Evidência:

- verifier #388 passou no estado histórico pré-#389;
- migration #389 foi aplicada duas vezes no harness, preservando idempotência de rollout;
- o mesmo verifier #388 passou novamente no stack efetivo pós-#389;
- verifier #389 passou integralmente;
- casos `CHARGE`/`WAIVE`, autorização por role, idempotência e concorrência ficaram verdes;
- controles negativos de recepção, `financeiro` tentando `WAIVE`, materialização ausente, mutabilidade, duplicidade de pagamento e cross-tenant falharam como esperado.

Conclusão: documentos que ainda diziam que #388 exigia ausência da RPC de #389 estavam desatualizados. O verifier atual é composition-aware e mantém a fila `appointment_financial_exceptions` sem mutação direta enquanto admite somente a resolução canônica auditada.

A prova técnica do harness foi complementada em 2026-09-15 por runtime real de `CHARGE` e `WAIVE` em produção dentro de transações revertidas, com autenticação, idempotência e ausência de resíduos. A exceção real `package_exhausted` continua sem disposição porque isso é decisão econômica da clínica. Permanecem como gaps de evidência: owner/admin clínico e mobile autenticados no privacy shell, além do piloto humano prolongado.

Documento de apoio: `docs/P0_388_389_VERIFIER_RECONCILIATION_20260915.md`.

---

## P0 beta hardening — #394 pós-finalização

**Status:** EVIDÊNCIA READ-ONLY DE PRODUÇÃO FECHADA EM 2026-09-15. Nenhuma mutation foi executada.

A inspeção do único Encounter Record existente em produção confirmou:

- `status = finalized` e `finalized_at` presente;
- appointment correspondente `finalizado`;
- `evolution_id` presente, apontando para exatamente uma Evolution ativa;
- Evolution vinculada à mesma sessão e alinhada ao mesmo tenant/paciente/profissional;
- exatamente um lançamento em `payments` para o appointment, alinhado ao mesmo tenant/paciente;
- lançamento não pago e `atrasado`, coerente com o vencimento no momento da leitura;
- zero `appointment_financial_exceptions`.

A leitura ocorreu dentro de transação `READ ONLY` e não consultou conteúdo clínico, nomes ou identificadores em saída. Isso fecha o gap de evidência pós-finalização do #394; não equivale a validação UX do piloto nem prova `CHARGE`/`WAIVE` do #389.

Documento de apoio: `docs/P0_394_POST_FINALIZATION_READONLY_20260915.md`.

---

## Leitura obrigatória

1. `AGENTS.md`
2. este arquivo
3. documento do domínio da tarefa
4. `docs/MANUAL_SOURCE_MAP.md` para mudanças visíveis
5. `docs/CLINICAL_DOCUMENTS_ROADMAP.md` para continuidade documental
6. `docs/CLINICAL_TOOLING_REUSE_PLAN.md` para Nexus/reuso clínico

Referências Referral:

- `docs/CLINICAL_REFERRAL_FOUNDATION.md`
- `docs/CLINICAL_REFERRAL_ENCOUNTER_V1.md`
- `docs/CLINICAL_REFERRAL_RENDERER_V1.md`
- `docs/CLINICAL_REFERRAL_INTERNAL_V1.md`
- `docs/CLINIC_CLINICAL_FLOW_SETTINGS_V1.md`

Institucionalmente:

```text
OARANHA/crmfisio = runtime canônico
OARANHA/medicspro = referência histórica de produto/UX/workflow
OARANHA/nexus = upstream/laboratório de inteligência clínica
```

---

# Regras arquiteturais que não podem regredir

Papéis operacionais: `owner`, `admin`, `professional`, `recep`, `financeiro`.

`platform_admin` é domínio separado e não recebe acesso implícito aos dados do tenant.

`role` não é profissão. Autorização clínica combina tenant, profile ativo, identidade profissional, conselho/registro quando aplicável, capability e autoria/relação assistencial.

```text
ENGINE != AUTHORIZATION != RELEVANCE
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
PREVIEW == PRINT CONTRACT
ISSUED DOCUMENT != CURRENT TEMPLATE
DOCUMENT LIFECYCLE != OPERATIONAL REFERRAL WORKFLOW
```

Especialidade/profissão podem orientar relevância, filtro e roteamento; nunca viram ACL implícita.

Nexus apoia decisão; não prescreve, pede exame ou encaminha automaticamente.

---

# Clinical Cockpit / Encounter

Workspaces canônicos validados em produção atualmente:

```text
Registro
Avaliações
Instrumentos
Prescrição        (quando relevante)
Exames            (quando relevante)
Documentos
Nexus
```

A composição V5 já foi mergeada/deployada e validada estruturalmente em produção; ela altera navegação/apresentação, não os contratos server-side de cada ferramenta.

Prescrição, Pedido de Exames, Orientações e Encaminhamento pertencem ao mesmo Encounter e não criam segundo prontuário.

No boundary D2-A atualmente testado para autoria documental, `appointments.fisio_id` permanece referência vigente. `professional_id` existe como direção canônica/staged compatibility, mas não deve substituir silenciosamente o boundary existente sem reconciliação dedicada.

O guard temporal #399/#400 continua vigente.

---

# Assessment Engine

**VALIDADO EM PRODUÇÃO.**

Fundação única para anamneses/avaliações estruturadas, com templates platform/clinic, versões imutáveis, draft/resume, finalização e histórico.

Biblioteca V1 validada:

- Anamnese Médica Geral
- Anamnese Psiquiátrica

Diretriz UX: `click-first, prose-when-needed`.

---

# Nexus

Nexus permanece domínio especializado de instrumentos, cálculo, evidência, farmacologia e apoio à decisão.

- hardening C-01–C-06 integrado;
- PHQ-9/GAD-7 preservam identidade/versionamento/scoring;
- `nexus.*` fail-closed;
- resultado Nexus não gera ato documental automaticamente.

---

# Clinical Documents

## D2-A — Foundation

**VALIDADO EM PRODUÇÃO.**

Lifecycle canônico:

```text
draft → issued → canceled
```

Templates publicados são versionados; emissão congela payload, contexto e definição visual; histórico emitido é imutável.

## D2-B — Prescrição

**VALIDADO EM PRODUÇÃO.**

Marcos: #429–#433. Preview/print versionado, presets seguros, Template Admin e imutabilidade visual histórica confirmados.

## D2-C — Orientações terapêuticas

**VALIDADO EM PRODUÇÃO.**

Fluxo estruturado, revisão humana, emissão e renderer A4 profissional confirmados. `therapeutic_guidance` não aparece como rótulo para paciente.

## D2-D — Pedido de Exames

**VALIDADO EM PRODUÇÃO.**

`exam_order` próprio, autoria V1 médico/CRM conservadora, Encounter UX, preview A4, emissão e impressão histórica por snapshot confirmados.

## D2-E0 — Referral Foundation

**VALIDADO EM PRODUÇÃO.**

`referral` é documento canônico próprio, multiprofissional, sem reutilizar `therapeutic_guidance`. Emissão exige identidade clínica elegível + `clinical.documents` + próprio Encounter ativo. Owner/admin/platform não recebem bypass.

## D2-E1 — Referral Encounter UX

**VALIDADO EM PRODUÇÃO.**

Aba `Encaminhamento` no Clinical Cockpit com draft/save/resume, motivo/contexto, revisão humana, emissão e histórico.

## D2-E2 — Referral Professional Print Renderer V1

**VALIDADO EM PRODUÇÃO.**

Layout `clinical-document/referral-v1`. Preview A4 e impressão emitida compartilham renderer seguro. Histórico legado permanece no snapshot/layout original.

## D2-E3 / D2-E3.1 — Encaminhamento Interno V1 + Hardening

**VALIDADO EM PRODUÇÃO.**

Modos:

```text
Profissional da clínica
Especialidade / serviço
Destino externo
```

O diretório interno é server-governed, mesmo tenant, perfil ativo, self-excluded e limitado ao catálogo clínico canônico atual:

```text
medico
fisioterapeuta
psicologo
quiropraxista
```

Não existe acoplamento `role='professional'`. Perfis administrativos com `professional_type` legado ficam fail-closed.

Smoke real de produção confirmou:

- isolamento entre tenants;
- destino interno real `Dr. Aranha · Médico da Família`;
- preview mantém `Destino não informado` até uma escolha real;
- emissão e impressão A4 em uma página;
- documento mostra somente rótulos humanos;
- UUID, `target_profile_id` e `destination_scope` não aparecem para o paciente.

O roteamento interno **não concede acesso ao prontuário nem care relationship automaticamente**.

---

# D2-E4 — Referral Operational Continuity

**VALIDADO EM PRODUÇÃO.**

A implementação não altera o lifecycle do documento emitido. O workflow operacional é separado e vinculado ao `clinical_documents.id` emitido:

```text
referral emitido e imutável
→ recebido
→ aceito / recusado
→ agendamento vinculado
→ atendimento
→ conclusão
```

Invariantes preservadas:

- mesmo tenant sempre;
- documento emitido permanece imutável;
- estados operacionais vivem fora de `clinical_documents.status`;
- destino/aceite não concedem automaticamente leitura de prontuário;
- agendamento reutiliza Agenda/Appointment canônicos;
- handoff para atendimento continua sujeito a autorização clínica e guard temporal existentes;
- especialidade/profissão continuam roteamento/relevância, nunca ACL;
- agendamento cross-professional pelo emissor só existe para o destino interno exato congelado no referral e mediante prova transacional same-transaction.

V1 mantém uma única operação por referral interno em `clinical_referral_operations`, auditável e tenant-scoped. A Agenda continua dona de data/hora, status, remarcação e atendimento; `schedule_clinical_referral_operation(...)` revalida tenant, paciente, documento emitido, destino imutável, profissional ativo e appointment boundary antes de criar ou retornar idempotentemente o vínculo canônico.

Produção validou a stack final após #450–#453:

- migration e verifier da continuidade operacional aplicados com sucesso;
- handoff da UI usa o `clinical_documents.id` correto;
- profissional destinatário congelado é preservado no modal;
- o guard global de Appointment aceita apenas o cross-target exato sustentado pela prova transacional criada no mesmo RPC/transaction;
- tentativa direta de agendar outro colega continua bloqueada;
- referral snapshot permanece imutável;
- smoke real criou exatamente um appointment para o profissional alvo e vinculou a operação como `scheduled`;
- retry do mesmo referral retornou `Este encaminhamento já possui um agendamento vinculado.` sem criar segundo appointment.

O D2-E4 está encerrado como funcionalmente validado; mudanças futuras de política/configuração da clínica devem compor essa autorização sem enfraquecer suas invariantes.

---

# Clinic Clinical Flow Settings

## Referral Authoring Policy V1

**VALIDADO EM PRODUÇÃO.**

A #454 adiciona em `Configurações → Fluxos clínicos` a política institucional:

```text
Permitir que profissionais emitam encaminhamentos
```

O default é `true`, preservando o comportamento atual. Quando `false`, PostgreSQL bloqueia criação, edição de draft e emissão de novos `referral`, sem alterar histórico emitido, snapshots, leitura já autorizada, cancelamento lifecycle, D2-E4 já materializado ou outros Clinical Documents.

A configuração pode restringir o fluxo, mas nunca concede identidade, capability, care relationship ou acesso clínico. Somente owner/admin alteram a policy da própria clínica; usuários autenticados não possuem escrita direta na tabela.

Produção confirmou em 2026-09-13:

- migration e verifier aplicados sobre a release mergeada da #454;
- `CLINIC REFERRAL AUTHORING POLICY V1 VERIFY PASSED`;
- settings presentes para as clínicas existentes com default preservado no rollout;
- trigger de enforcement ativo e tabela sem acesso direto indevido por `authenticated`;
- replay da migration sem resetar configuração explícita;
- owner/admin visualiza e salva a policy em `Configurações → Fluxos clínicos`;
- desligar a policy bloqueia profissional no fluxo de novo encaminhamento pelo boundary server-side;
- religar restaura o fluxo normal;
- smoke repetido sem regressão observada.

O toggle de agendamento direto pelo encaminhador **não entrou nesta V1** porque ainda não existe uma rota operacional alternativa equivalente para recepção/destinatário assumir o agendamento. Desativá-lo agora criaria risco de dead-end. Essa decisão fica separada do D2-E4 validado.

---

# Plataforma / tenants

```text
PLATFORM ENTITLEMENT
→ CLINIC CONFIGURATION
→ USER AUTHORIZATION / CAPABILITY
→ RESOURCE / ENCOUNTER CONTEXT
```

Platform Admin administra o SaaS; owner/admin administram o tenant; nenhuma dessas funções cria autoria clínica implicitamente.

---

# Financeiro

Direção preservada:

```text
Atendimento finalizado
→ pacote/cobrança
→ contas a receber / pagamentos
→ baixa / resolução
→ relatórios
```
