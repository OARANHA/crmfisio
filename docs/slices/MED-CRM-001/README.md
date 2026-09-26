# MED-CRM-001 — Commercial Core

**Status:** DESIGNED  
**Capability:** CRM commercial foundation  
**Execution:** not started  
**Created:** 2026-09-26  
**Design readback:** `main@a0e8fd717302ddca3366d0fc6731a0ed2642269b`

## Objective

Separar o domínio comercial do domínio clínico sem quebrar a jornada Patient existente.

Destino:

```text
Contact
   ↓ 1:N
Lead
   ↓ explicit conversion/link
Patient
```

A slice cria a fundação para identidade pré-clínica/comunicacional, oportunidades comerciais e pipeline configurável, mantendo Patient como identidade clínica soberana.

## Non-goals

- não substituir Patient/EHR/Encounter;
- não trocar Evolution API;
- não alterar Appointment para aceitar Lead;
- não criar Unified Inbox/social/agent platform;
- não implementar attribution completa;
- não apagar `patients.funil_stage` ou `patient_journey_events` nesta primeira entrega;
- não fabricar histórico comercial para Patients existentes;
- não portar tenancy/auth/runtime Deskcomm.

## REAL NOW

O readback detalhado está em [`EVIDENCE.md`](EVIDENCE.md).

Conclusões principais:

1. `patients.funil_stage` ainda mistura um estado técnico legado `lead` com etapas assistenciais `avaliacao/tratamento/alta`.
2. `create_patient_registry_v2` cria todo Patient com `funil_stage='lead'`; portanto Patient em `lead` não prova que existiu uma oportunidade comercial.
3. `patient_journey_events` e `transition_patient_journey()` são parte da jornada Patient e contêm atos assistenciais.
4. migration `20260909_clinical_authorization_reconciliation.sql` protege transições clínicas com prova same-transaction.
5. `Crm.tsx` ainda move `patients.funil_stage` via UPDATE direto; `PatientJourneyControl` usa a RPC canônica. Há assimetria de side effects em transições não clínicas como `lead→avaliacao`.
6. `ReceptionPatients` possui cadastro rápido que cria Patient imediatamente, inclusive com `funilStage='lead'`.
7. `PatientCareCockpit` e `ReceptionPatients` usam `funil_stage` fora da tela CRM, então a coluna não pode ser simplesmente reinterpretada como pipeline comercial.
8. Appointment continua obrigatoriamente ligado a Patient.
9. nenhum domínio dedicado Contact/Lead/Pipeline/Activity foi encontrado no tree da main.
10. `TODO.md` já exige separar o funil comercial do prontuário clínico.

## Proven evidence

| Evidência | Prova | Limite |
| --- | --- | --- |
| `supabase-schema.sql` | Patient tem `funil_stage`; Appointment exige Patient | schema base inclui compatibilidade histórica |
| `20260903_patient_registry_v2_polish.sql` | cadastro Patient cria `funil_stage='lead'` | implementação final deve ser re-lida antes de modificar |
| `20260909_clinical_authorization_reconciliation.sql` | jornada clínica usa boundary própria e prova transacional | não cria Commercial Core |
| `Crm.tsx` + patientContext/repository | quadro atual opera sobre Patients | UI atual é compatibilidade, não modelo alvo |
| `PatientJourneyControl.tsx` | jornada Patient usa RPC + motivo/notas | só cobre essa superfície |
| `ReceptionPatients.tsx` | recepção cria Patient antes de existir entidade pré-clínica | oportunidade de absorção pelo Contact/Lead futuro |
| `TODO.md` | separação comercial/clínica é gap oficial | roadmap não prova implementação |
| MED-DOC-001 | Contact != Lead != Patient; same mutation same side effects | referência de disciplina, não código |

## Gaps

- identidade pré-clínica sem criar Patient;
- múltiplas oportunidades por Contact;
- pipeline/stages configuráveis;
- timeline comercial append-only;
- motivos de perda;
- conversão explícita e idempotente para Patient;
- RLS/RBAC/entitlement do novo domínio;
- LGPD/export/anonymization de Contact/Lead;
- paridade de mutation entre UI/API/IA/automação futuras;
- cutover da tela `/crm` sem remover a jornada Patient;
- eliminação futura do UPDATE direto de `patients.funil_stage` como operação comercial.

## Capability authority / reuse gate

| Capability | Autoridade | Decisão |
| --- | --- | --- |
| tenant / `clinic_id` | MedicsPro | preservar |
| Patient / prontuário | domínio clínico MedicsPro | preservar |
| Patient Journey | `transition_patient_journey` + Patient | preservar; não transformar em CRM comercial |
| Contact | novo identity substrate tenant-scoped | criar uma vez e reutilizar por CRM/Inbox/canais futuros |
| Lead/Pipeline/Stage/Activity | Commercial Core MedicsPro | construir/adaptar padrões Deskcomm |
| CRM entitlement | `crm.access` | preservar |
| WhatsApp transport | Evolution / communication domain | fora desta slice |
| Appointment | Agenda/Patient | preservar Patient-bound em V1 |
| Patient registry | boundary canônica MedicsPro | reutilizar/refatorar, nunca duplicar |

## Decision

A decisão detalhada está em [`DECISION.md`](DECISION.md).

Resumo:

```text
contacts
  └─ 1:N crm_leads
          └─ crm_stages → crm_pipelines
          └─ crm_lead_activities

contacts.patient_id             -- opcional, vínculo com Patient
crm_leads.converted_patient_id  -- resultado da conversão
```

Invariantes:

- Contact != Lead != Patient;
- Patient nunca depende da existência de Contact;
- telefone/e-mail são sinais de matching, não identidade única;
- um Contact pode ter vários Leads;
- nenhuma migration cria Leads retroativamente para Patients;
- `crm_stages.stage_kind` é a única fonte de `open|won|lost`; não haverá coluna `lead.status` concorrente;
- toda mutation comercial relevante passa por uma única operação server-side e registra activity/audit;
- direct writes autenticados nas tabelas de mutation são negados;
- pipeline/stage config: owner/admin;
- lead mutation: owner/admin/recep com `crm.access`;
- professional/financeiro permanecem read-only onde o produto já permite CRM read;
- CRM não recebe EHR/CID/evolution/documentos clínicos;
- Appointment continua Patient-bound;
- conversão Lead→Patient é explícita, atômica e idempotente.

## Compatibility strategy

### Phase 0 — prove current boundaries

Antes da primeira migration:

- re-read função final de Patient Registry no replay atual;
- confirmar audit helpers atuais;
- fechar verifier de tenant/RLS/ACL para novas tabelas.

### Phase 1 — schema comercial vazio

Criar Contact + CRM tables/RLS/RPCs e pipeline default configurável.

**Não fazer backfill de Lead.**

### Phase 2 — Commercial UI

`/crm` passa a operar `crm_leads`.

A antiga jornada Patient permanece nas superfícies do Patient.

### Phase 3 — reception pre-clinical flow

Cadastro rápido de prospect passa a poder criar Contact/Lead sem Patient.

Cadastro clínico formal continua no Patient Registry.

### Phase 4 — explicit conversion

Lead pode:

- vincular a Patient existente; ou
- criar Patient pelo mesmo core de Patient Registry.

A operação atualiza Contact/Lead + activity/audit na mesma transaction.

### Phase 5 — patient journey cleanup

Retirar `patientContext.setFunilStage` da semântica comercial e impedir writers paralelos.

`patients.funil_stage` permanece apenas como compatibilidade/jornada Patient até uma slice própria decidir sua evolução.

## LGPD / data lifecycle contract

Contact contém PII e deve ter lifecycle próprio.

A implementação só pode ser liberada quando:

1. Contact tiver soft-delete/anonymization explícitos;
2. export/anonymization Patient incluir ou reconciliar Contact/Lead vinculados;
3. a anonimização remover sinais de reidentificação comercial permitidos pelo contrato aplicável;
4. audit operacional mínimo possa permanecer sem payload pessoal;
5. nenhuma rotina trate `patient_id` como justificativa para copiar dado clínico para CRM.

Esse contrato é gate de implementação, não débito opcional.

## MEDICSPRO DOCTRINE GATE

| Pergunta | Resposta concreta |
| --- | --- |
| Quem alimenta? | recepção, formulário/API futura, canais futuros e criação manual autorizada |
| Quem consome? | CRM; futuro Inbox/Acquisition; conversão explícita para Patient |
| Que registro emite? | `crm_lead_activities` + audit; eventos de domínio depois pelo mesmo writer |
| Onde fica visível? | CRM commercial timeline; não prontuário |
| Qual porta? | RPC/domain operation + projections autorizadas |
| Anti-morte? | next step/lost/won/converted; follow-up só em slice futura |
| Configuração? | pipelines/stages owner/admin |
| IA↔humano? | futuro agente usa as mesmas domain operations; nenhum writer paralelo |
| Retorno? | stage/outcome/conversion/appointment/revenue em slices subsequentes |
| Autoridade reutilizada? | clinic_id, crm.access, RBAC/RLS, Patient Registry |
| Autoridade que NÃO ganha? | CRM não ganha acesso clínico; provider não ganha domínio; Lead não cria Patient implicitamente |
| Gates mecânicos? | tenant isolation, direct-write revoke, stage_kind consistency, append-only activity, conversion idempotency, no clinical columns in CRM projections |

## Second adversarial review

JEV 2026-09-26:

- primeira rota: `deep_review`, probabilidade 0.80;
- após refinamento de identity/LGPD/status/conversion: `allow`, probabilidade 0.56, confiança 0.42.

A confiança moderada é registrada deliberadamente. Implementação deve manter os gates acima e não ampliar escopo por inferência.

## Execution

**Não iniciada.**

A próxima slice de execução deve ser uma micro-slice de schema/boundaries, não a UI completa.

## Validation required before IMPLEMENTING

- fresh replay PostgreSQL;
- upgrade replay;
- cross-clinic RLS;
- entitlement `crm.access`;
- role matrix;
- authenticated direct-write denial;
- server-derived clinic_id;
- Contact patient-link uniqueness;
- stage_kind/source-of-truth invariant;
- lost reason enforcement;
- activity append-only;
- conversion retry/idempotency/conflict;
- Patient Registry reuse;
- LGPD linked-data behavior;
- final tree tests/typecheck/lint/build as applicable.

## Next exact step

Abrir a primeira micro-slice de implementação para **schema + authorization boundaries only**.

Não construir board/Inbox/automação na mesma mudança.
