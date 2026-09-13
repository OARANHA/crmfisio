# Clinician-Assisted Clinical Instruments V1

## Status

**BACKEND VALIDADO EM PRODUÇÃO EM 2026-09-13. UI `Aplicar agora` IMPLEMENTADA NESTA SLICE E AGUARDANDO MERGE/ROLLOUT.**

Backend canônico mergeado em `main@95736a85b04149ebb691d6f60205459269059405` pela PR #458.

Esta linha de produto permite administração assistida pelo profissional dos instrumentos neutros PHQ-9 e GAD-7 dentro do próprio Encounter, sem transformar o acesso multiprofissional em acesso Nexus avançado.

## Princípio canônico

```text
ENGINE != AUTHORIZATION != RELEVANCE
Nexus engine registry membership != multiprofessional clinical exposure
```

PHQ-9/GAD-7 usam a definição, versão e scoring canônicos do Nexus, mas a autoridade para um profissional aplicá-los presencialmente vem do domínio clínico neutro da #399:

```text
clinical.instrument.apply
+ identidade clínica válida
+ instrumento ativo no clinical_instrument_catalog
+ instrumento habilitado pela clínica
+ próprio Encounter em_atendimento
= pode aplicar agora
```

`nexus.scales` não é exigido nem concedido por esta operação.

## Fluxo V1

```text
browser autenticado
→ resolve can_apply_clinical_instrument_in_encounter(...)
→ apresenta apenas instrumentos autorizados
→ profissional responde em UI click-first dentro do Encounter
→ Edge clinical-instrument-clinician-assisted
→ valida JWT real do profissional
→ shared clinical-instrument-engine
→ calcula PHQ-9/GAD-7 no servidor
→ service-only RPC record_clinician_assisted_clinical_instrument(...)
→ reinstala o ator autenticado como contexto transacional
→ revalida can_apply_clinical_instrument_in_encounter(...)
→ deriva clinic/patient do Encounter
→ confere mapping/versionamento no clinical_instrument_catalog
→ grava snapshot imutável em clinical_instrument_administrations
→ devolve score/classificação/interpretação/safety signals para a UI
```

Nenhum `clinic_id`, `patient_id`, autoria, versão da engine ou score é aceito do browser como fonte de verdade.

## Engine compartilhada

A regra PHQ-9/GAD-7 foi extraída para:

`supabase/functions/_shared/clinical-instrument-engine.ts`

O mesmo módulo é consumido por:

- `nexus-self-assessment-processor` (`patient_self`);
- `clinical-instrument-clinician-assisted` (`clinician_assisted`).

Assim, modo de administração não cria segunda definição, corte, versão ou regra de item 9.

PHQ-9 preserva `nexus.phq9 / nexus-2026-09-03` e o safety signal canônico `phq9.item9.positive` quando `q9 > 0`. Esse sinal exige avaliação clínica de segurança/risco; não equivale isoladamente a diagnóstico e não dispara prescrição, encaminhamento ou conduta automática.

GAD-7 preserva `nexus.gad7 / nexus-2026-09-03`.

## Persistência neutra

Tabela canônica:

`clinical_instrument_administrations`

Ela não substitui nem enfraquece `nexus_clinical_results`. O resultado multiprofissional assistido não entra na tabela Nexus porque C-02/C-06 mantêm essa superfície presa às capabilities e identidade do domínio Nexus especializado.

Snapshot persistido:

- tenant/paciente/Encounter/profissional derivados server-side;
- `instrument_key` neutro;
- identidade/versionamento da engine;
- provenance `clinician_assisted`;
- answers snapshot;
- output snapshot;
- score/max score;
- classificação/severidade/interpretação;
- texto SOAP produzido pela engine como conteúdo auxiliar;
- evidence snapshot;
- safety signals;
- timestamp de conclusão.

A administração é terminal/imutável. Não existe UPDATE/DELETE clínico. Correção futura exige contrato explícito de correção/addendum; não deve sobrescrever o ato original.

## Idempotência

O browser gera um `request_id` UUID no início de cada aplicação e o preserva durante retries da mesma tentativa.

Chave:

```text
(professional_id, appointment_id, request_id)
```

Replay com o mesmo request e mesmas respostas devolve a administração original. Reutilizar a mesma chave com respostas diferentes falha fechado.

## Segurança do browser

O browser:

- não possui INSERT/UPDATE/DELETE/SELECT direto na nova tabela;
- não executa a RPC de persistência diretamente;
- não calcula score;
- não escolhe capability Nexus;
- não fornece tenant/paciente/autor/versionamento/score como autoridade;
- envia somente `appointmentId`, `instrumentKey`, `requestId` e `answers` para a Edge.

A Edge autentica o Bearer token via `auth.getUser()` antes de chamar a RPC service-only. A RPC reexecuta o boundary #399 sob o ator autenticado e valida novamente Encounter ativo próprio + catálogo/versionamento.

Owner/admin não recebem bypass clínico. Profissão/especialidade continuam sem auto-grant.

## UI `Aplicar agora`

A UI vive em **Anamneses & Avaliações** no Encounter ativo e não no workspace Nexus. Isso é deliberado: o instrumento é clínico neutro; Nexus fornece a engine, não a autorização nem a navegação.

A disponibilidade é resolvida instrumento a instrumento por `can_apply_clinical_instrument_in_encounter(...)`. Falha na resolução fecha a superfície; não existe fallback por role, profissão, specialty ou capability inferida no browser.

Características:

- cards somente para instrumentos efetivamente autorizados;
- perguntas com opções 0–3 click-first;
- request UUID estável durante retry;
- uma única submissão para a Edge;
- resultado exibido somente a partir da resposta server-side;
- safety signals exibidos somente a partir de `safetySignals` devolvido pelo servidor;
- item 9 não dispara inferência local;
- nenhuma decisão automática de diagnóstico, prescrição ou encaminhamento;
- sem leitura direta do ledger para contornar RLS.

A UI reaproveita `publicSelfAssessmentCatalog.ts` apenas como conteúdo de apresentação das perguntas/opções já existentes. `ruleVersion` ou capability daquele catálogo não são usados como autoridade para o modo assistido.

## Comparação histórica de UX

O MedicsPro histórico foi revisado no commit `0fd709612598fa93a9cf0517b9ba924b1405ec83`.

Referências principais:

- `app-agendadoutor/src/views/pages/atendimentos/InProgressAppointmentView.vue`;
- `app-agendadoutor/src/components/pages/appointments/AnamneseFormTab.vue`.

Não foi identificado um fluxo histórico PHQ-9/GAD-7 equivalente que devesse ser portado literalmente. O que foi absorvido foi o entendimento de produto:

- **preservar:** formulários clínicos dentro do atendimento em andamento, sem troca de contexto desnecessária;
- **preservar:** escolhas estruturadas por clique para perguntas de opção única/múltipla;
- **evoluir:** separar visualmente instrumentos clínicos autorizados da biblioteca ampla de anamneses;
- **redesenhar:** autorização deve vir do boundary canônico server-side, não de menus/stores legados;
- **rejeitar:** Vue/Pinia/Mongo/Express, tenancy antiga, hardcodes de profissão/plano e qualquer autorização frontend.

## Provas automatizadas do backend

O gate PostgreSQL cobre:

- replay da migration;
- browser sem acesso direto;
- profissional autorizado + próprio Encounter ativo;
- profissional multiprofissional autorizado sem `nexus.scales`;
- ator sem `clinical.instrument.apply` negado;
- cross-professional negado;
- cross-tenant negado;
- appointment não ativo negado;
- mapping/versionamento de engine não forjável pela chamada;
- replay idempotente;
- conflito de idempotência detectado;
- snapshot imutável;
- verifier histórico #399 verde;
- verifier V1 read-only verde.

A suíte TypeScript/JS trava a paridade do scorer compartilhado e a separação entre autenticação Edge, engine e persistência. A slice de UI acrescenta uma prova do payload mínimo do browser, sem tenant/paciente/ator/engine/score.

## Validação de produção — 2026-09-13

Backend mergeado: `95736a85b04149ebb691d6f60205459269059405`.

Banco:

- PostgreSQL 17.6;
- migration `20260913_clinician_assisted_clinical_instruments_v1.sql` aplicada com COMMIT;
- verifier `VERIFY_20260913_CLINICIAN_ASSISTED_CLINICAL_INSTRUMENTS_V1.sql` encerrou com `CLINICIAN ASSISTED INSTRUMENT V1 VERIFY PASSED`.

Edge Runtime:

- shared engine blob `de76af22dcdac363046840784f30116c76b9c240`;
- `nexus-self-assessment-processor` blob `a842964693ff01aa7ab7407aa8dbdab89bebc9ce`;
- `clinical-instrument-clinician-assisted` blob `24780819d5a16b6bab24736515654637c11b4af5`;
- container `supabase-edge-functions` saudável;
- chamadas sem credencial rejeitadas com 401 em ambas as funções.

Smoke autenticado não persistente:

- sessão real da conta profissional de teste validada por Auth;
- GAD-7 configurado como disabled → 403;
- PHQ-9 incompleto → 400 no scorer;
- PHQ-9 válido com appointment inexistente → 403 no boundary;
- ledger antes/depois = 0.

Prova positiva transacional do writer:

- PHQ-9 item 9 positivo gravado temporariamente com score 1/27;
- clinic/patient/professional derivados corretamente;
- `phq9.item9.positive` persistido com severidade `critical`;
- replay idempotente retornou `replayed=true` e manteve uma linha;
- mesmo request com respostas diferentes foi bloqueado;
- UPDATE da linha terminal foi bloqueado pelo guard de imutabilidade;
- ROLLBACK restaurou ledger para zero;
- `ZERO_RESIDUE_OK`.

Foi deliberadamente evitado um POST HTTP positivo contra um prontuário real somente para obter um smoke verde. A canonicalização de chaves extras do browser permanece coberta pelo código/testes/CI; a prova de produção não justificava contaminar prontuário com resposta clínica fictícia.

## Configuração observada no smoke

Na clínica escolhida para a prova, PHQ-9 foi habilitado pela RPC canônica de owner e GAD-7 permaneceu fail-closed. Isso foi configuração explícita de tenant, não auto-grant por migration.

## Fora de escopo

- novo `Enviar ao paciente` — o self-assessment remoto continua um boundary distinto;
- expansão além de PHQ-9/GAD-7;
- novo grant `nexus.*`;
- Enfermagem como nova identidade suportada;
- diagnóstico automático;
- prescrição/encaminhamento automático;
- incorporação automática em Evolution/Encounter Record;
- correção/addendum de administração já concluída;
- histórico completo de administrações no browser enquanto não houver endpoint de leitura neutro próprio.

## Próximos passos após rollout da UI

1. validar visualmente `Aplicar agora` no Encounter de teste;
2. confirmar que PHQ-9 aparece quando autorizado e GAD-7 permanece oculto quando disabled;
3. não criar resultado clínico fictício em prontuário real apenas para smoke;
4. remover o token temporário usado na prova backend;
5. só então seguir para a próxima evolução do Consultório, mantendo esta superfície neutra separada do Nexus avançado.
