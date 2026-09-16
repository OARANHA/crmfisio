# MedicsPro — Current State

> Snapshot operacional de continuidade. `AGENTS.md` contém as regras de execução. Código, schema e runtime reais prevalecem se este arquivo envelhecer; detalhes ficam nos documentos de domínio.

**Regra de continuidade:** antes de encerrar uma slice significativa, atualizar este snapshot e o documento do domínio com base/branch/PR/head, validações concluídas, estado de produção, riscos pendentes e próximo passo seguro. Outro chat/agente deve começar por este arquivo para evitar reconstrução ou duplicação de trabalho.

**Data do snapshot:** 2026-09-16
**Base canônica funcional:** `main@44e392ef2df7e5b1fca1cf373246fb500eb7254b`

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
PCL-5 Clinician-Assisted V1 #491                                 MERGED / MAIN VALIDATED / NOT PROD
```

## Main validada — PCL-5 Clinician-Assisted V1

**Status:** #491 mergeada por squash; `main@44e392ef2df7e5b1fca1cf373246fb500eb7254b`; árvore da main idêntica ao head final revisado `58ebddb1d9cb69d9993adfb14898756b40ee4e63`; produção ainda não alterada.

PCL-5 foi escolhido após nova revisão dos instrumentos Nexus restantes: ISI permanece dependente de licença do titular/Mapi e os instrumentos WHO da Wave 1 continuam exigindo revisão de permissão comercial. PCL-5 é public domain via VA e possui adaptação/validação brasileira publicada.

A V1 é somente `Aplicar agora`, exige 20 respostas `0..4`, usa regra versionada `nexus-pcl5-br-2026-09-16` com cutoff operacional `>=36` da validação brasileira, não infere diagnóstico, não auto-habilita clínicas e não cria contrato `patient_self`.

Gates aprovados: testes focados 29/29; PostgreSQL 16 e PostgreSQL 17.6 (behavior + replay + authorization + writer + forged-version negative control + verifier); full suite 116 arquivos / 634 testes; typecheck, lint, build e dependency audit com 0 vulnerabilidades; PR CI 51/51; pós-merge 6/6 workflows de push concluídos sem falha. Próximo passo seguro: rollout produtivo separado e controlado. Produção permanece intocada.

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
