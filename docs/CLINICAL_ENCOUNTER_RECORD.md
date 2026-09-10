# Clinical Encounter Record

**Status em 2026-09-10:** foundation canônica entregue em #394, verifier production-safe entregue em #395 e migration #394 aplicada em produção. Este documento registra o contrato que não deve regredir e separa evidência técnica de smoke operacional ainda pendente.

## Purpose

O profissional registra a consulta uma única vez. Durante o atendimento, `clinical_encounter_records` é o working draft mutável do appointment atual. Após revisão e confirmação humana explícita, PostgreSQL materializa deterministicamente esse conteúdo na Evolution oficial existente e finaliza o appointment na mesma transação clínica.

Encounter Record não é um segundo prontuário final, não é SOAP obrigatório e não substitui o histórico de Evolution. A Evolution continua sendo o artefato oficial longitudinal materializado após confirmação.

## Domain model

Existe no máximo um Encounter Record canônico por appointment.

Campos principais:

- `id`
- `clinic_id`
- `appointment_id`
- `patient_id`
- `professional_id`
- `reason`
- `history`
- `findings`
- `assessment`
- `plan`
- `additional_notes`
- `status` (`draft` / `finalized`)
- `revision`
- `evolution_id`
- `created_at`
- `updated_at`
- `finalized_at`

Vínculos de clínica, appointment, paciente e profissional são derivados/validados server-side. `professional_id` é a referência clínica canônica; `fisio_id` não é autoridade de autorização do #394.

### Semântica clínica

- `reason` — motivo / demandas;
- `history` — história atual / HDA;
- `findings` — achados / exame;
- `assessment` — avaliação clínica / problemas;
- `plan` — plano / conduta;
- `additional_notes` — observações opcionais.

Campos vazios podem ser omitidos. A materialização final não inventa diagnóstico, resumo por IA, `N/A`, `Não informado` ou placeholders.

## Lifecycle canônico

### Draft

Um draft só pode ser criado/alterado quando o ator autenticado satisfaz as boundaries clínicas existentes, incluindo:

- perfil ativo na clínica atual;
- identidade clínica válida;
- appointment próprio via `appointments.professional_id`;
- appointment correto ainda `em_atendimento`;
- `clinical.attend` permitido;
- `clinical.evolution.write` permitido;
- ausência de Evolution canônica legada preexistente para um novo Record.

A autorização é fail-closed: helpers booleanos precisam retornar `TRUE`; `NULL` não autoriza.

Writes de browser são RPC-only. INSERT/UPDATE/DELETE direto por `authenticated` não faz parte do contrato.

### Optimistic concurrency

`revision` é a versão do draft. Cada save informa `expected_revision`; stale revision é recusada e não sobrescreve trabalho mais novo.

### Finalization

A finalização canônica executa em uma transação PostgreSQL:

1. lock/revalidação de actor, clinic, appointment, ownership, capabilities, status e revision;
2. materialização da Evolution enquanto o appointment ainda está `em_atendimento`;
3. vínculo/congelamento do Encounter Record como `finalized`;
4. atualização do appointment para `finalizado`;
5. execução da cadeia clínica/financeira já existente;
6. commit somente se os invariantes inesperados permanecerem íntegros.

Um Encounter Record finalizado é histórico. Ele não volta a draft e não é reescrito silenciosamente. **Correction/addendum auditável ainda não está implementado** e deve ser uma slice própria.

## Evolution materialization

A Evolution oficial é determinística e contém apenas seções não vazias, na ordem clínica definida pelo #394:

```text
Motivo / demandas
<reason>

História atual
<history>

Achados / exame
<findings>

Avaliação clínica / problemas
<assessment>

Plano / conduta
<plan>

Observações
<additional_notes>
```

Não existe um segundo textarea universal de Evolution no novo fluxo.

`physiotherapy_evolutions.created_at` usa o tempo real de criação do banco (`now()`/default canônico); não é fabricado a partir da data do appointment. A temporalidade da sessão continua em `Appointment.data`, `inicio` e `fim`.

## Idempotency e concorrência

Finalização é segura contra double-click/retry: uma conclusão lógica já realizada não cria segunda Evolution nem repete a transição.

Encounter Record e inserção de Evolution ligada ao mesmo appointment usam serialização/advisory lock. Uma Evolution legada concorrente pode vencer primeiro; o finalizer do #394 então deve observar o conflito e falhar explicitamente sem escolher silenciosamente um vencedor ou duplicar artefatos.

## Compatibilidade com Evolutions legadas

Não existe backfill clínico fictício.

- appointment ativo com Evolution canônica existente e sem Encounter Record: preservar fluxo legado e não criar Record retroativo;
- appointment ativo sem Evolution: Encounter Record pode ser fonte do ato clínico final;
- draft Encounter Record seguido por Evolution externa/legada concorrente: falhar fechado como conflito recuperável.

O caso comportamental 23 do harness #394 prova compatibilidade legada usando fixture próprio do #394, sem depender do appointment financeiro #388.

## Assessment e Nexus

Clinical Assessment continua um artefato estruturado/versionado separado; #394 não copia automaticamente respostas para campos do Encounter Record.

Nexus C-01–C-06 permanecem independentes. Resultados Nexus não populam Encounter Record/Evolution automaticamente. Entitlement, capability, identidade médica, relação assistencial, lifecycle e incorporação explícita continuam autoritativos.

## Relationship with Finance

Encounter Record não faz checkout nem cria cobrança por conta própria. A finalização atualiza o appointment e deixa os triggers financeiros canônicos decidirem efeitos.

Contrato após #388:

- `package_exhausted`, `package_expired` e `package_not_eligible` são falhas esperadas de cobertura;
- uma finalização clínica válida não é perdida por esses estados;
- `appointment_financial_exception` registra a inconsistência;
- não há consumo gratuito silencioso.

Falhas financeiras inesperadas de integridade continuam propagando exception e revertendo atomicamente Appointment + Encounter Record + Evolution.

#389 resolve exceções de forma explícita: owner/admin `CHARGE|WAIVE`, financeiro `CHARGE`, recep/professional sem resolução.

## UX contract mínimo

No próprio atendimento ativo:

- um único formulário de consulta para as seis seções;
- preenchimento livre, sem wizard obrigatório;
- persistence states verdadeiros (`Não salvo`, `Salvando...`, `Rascunho salvo`, conflito/erro);
- sem autosave genérico;
- revisão read-only antes da conclusão;
- confirmação humana antes de tornar o registro definitivo.

## Verification evidence

### Behavior verifier / CI

`supabase-verifiers/VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_FOUNDATION.sql` pertence ao **harness comportamental** e depende do estado criado pelos casos 1–34, incluindo `_clinical_encounter_394_results`.

Ele **não é verifier pós-migration para banco real**.

Os 34 casos PostgreSQL 16 cobrem cardinalidade, linkage, authorization, stale revision, finalized immutability, materialização determinística, idempotência, legacy Evolution, concorrência, expected coverage exception, unexpected rollback, RLS isolation, fail-closed NULL helpers, `professional_id` canônico, `created_at` real e browser mutation denial.

A migration é replayed no harness e os triggers críticos são verificados sem duplicação.

### Production-safe verifier / #395

`supabase-verifiers/VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql` é o verifier apropriado para banco real logo após a migration.

Ele:

- começa com `BEGIN` + `SET TRANSACTION READ ONLY`;
- inspeciona schema/constraints/FKs/RLS/policies/grants/functions/triggers/índices;
- não cria fixtures;
- não usa IDs clínicos sintéticos;
- não chama RPC mutante;
- não depende de `_clinical_encounter_394_results`;
- termina em `ROLLBACK`.

O CI #395 também provou que ele roda isoladamente sobre PostgreSQL 16 sem carregar os casos comportamentais.

## Production rollout status — 2026-09-10

O runbook deixou de ser apenas futuro.

### Observado

- migration `20260910_clinical_encounter_record_foundation.sql` **aplicada em produção em 2026-09-10**;
- `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql` passou com **`VERIFY #394 PRODUCTION OK`**;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou;
- migration #394 não deve ser reaplicada por causa de documentação antiga.

O verifier antigo #388 contém uma assertion histórica de ausência da RPC criada posteriormente pelo #389. Essa assertion é obsoleta no schema atual e deve ser atualizada/versionada antes de reutilização contra produção; isso não é defeito do #394.

### Smoke real observado antes da finalização

Foi comprovado:

- Encounter Record persistido;
- refresh/navegação preservaram conteúdo;
- draft revision observada;
- antes da finalização: **1 Encounter Record, 0 Evolutions, 0 payments e 0 financial exceptions** no cenário exercitado.

### Pendência operacional curta

Este documento **não possui evidência suficiente** para afirmar que a inspeção read-only pós-finalização desse mesmo smoke foi formalmente observada. Antes de tratar o rollout funcional como completamente evidenciado, registrar o estado final esperado por leitura real.

Da mesma forma, não declarar smoke real de `CHARGE`/`WAIVE` como concluído sem evidência posterior.

## Deliberately deferred

Não fazem parte da foundation #394:

- correction/addendum de registro finalizado;
- problem list/diagnosis engine amplo;
- Prescription V1 e demais documentos médicos;
- instrument delivery unificado;
- cobertura contextual do Encounter;
- autosave genérico;
- IA escrevendo o registro canônico;
- novo lifecycle Nexus;
- redesign amplo do financeiro.

Essas evoluções devem ser slices separadas e preservar os invariantes acima.