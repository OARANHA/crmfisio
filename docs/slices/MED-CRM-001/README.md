# MED-CRM-001 — Commercial Core

**Status:** APPROVED  
**Capability:** CRM commercial foundation  
**Execution:** not started  
**Created:** 2026-09-26  
**Last planning readback:** MedicsPro `main` on 2026-09-26; execution must resolve the then-current main again.

## Objective

Separar o domínio comercial do domínio clínico sem quebrar o CRM/patient journey existente.

Destino conceitual:

```text
Contact
   ↓
Lead
   ↓ explicit conversion
Patient
```

A slice deve preparar um Commercial Core tenant-scoped e auditável, mantendo Patient como identidade clínica.

## Non-goals

- não substituir Patient/EHR/Encounter;
- não migrar o runtime Deskcomm;
- não trocar Evolution API;
- não criar Inbox/social/agent platform nesta slice;
- não remover imediatamente `patients.funil_stage`;
- não implementar attribution completa;
- não alterar produção durante a fase de design.

## 1. REAL NOW

Evidência reconciliada durante o planejamento:

1. `supabase-schema.sql` ainda modela `patients.funil_stage` com valores `lead | avaliacao | tratamento | alta`.
2. `20260901_patient_journey.sql` cria `patient_journey_events` e `transition_patient_journey(...)`, ou seja, a “jornada/funil” atual é ligada diretamente ao Patient.
3. `20260907_crm_funnel_role_boundary.sql` protege mudança de `patients.funil_stage` por tenant, entitlement `crm.access` e roles `owner/admin/recep`.
4. `src/pages/Crm.tsx` apresenta o CRM atual como jornada do paciente, com lead/avaliação/tratamento/alta, retenção/NPS/risco de abandono.
5. A inspeção de base schema e dos nomes de migrations relevantes não encontrou uma foundation comercial dedicada `contacts/leads/lead_activities`. **Isso precisa ser reprovado contra a main atual antes de criar schema**, porque ausência em uma inspeção de planejamento não é prova eterna.
6. Comunicação/WhatsApp já possui outbox/worker/webhook e boundaries server-side; essa foundation não deve ser recriada pelo Commercial Core.

## 2. PROVEN EVIDENCE

| Evidência | O que prova | Limitação |
| --- | --- | --- |
| `patients.funil_stage` | CRM atual está acoplado ao Patient | base schema pode carregar compatibilidade histórica |
| `patient_journey_events` | há timeline/transição de jornada clínica/operacional | não é timeline comercial genérica |
| CRM funnel role boundary | write de funil já tem entitlement + role server-side | modelo é patient-centric |
| `Crm.tsx` | UX atual mistura aquisição e jornada assistencial | UI não define futuro schema |
| Deskcomm auditado em `77f0eb7652282acb90a3d1febe83e0c2de645691` | separação Contact/Lead/Pipeline/Activity é implementada em referência madura | tenancy/auth/runtime não são portáveis |

## 3. GAPS

- identidade de contato comercial sem criar Patient;
- oportunidade Lead separada de pessoa/contato;
- pipeline/stages configuráveis;
- timeline comercial separada da timeline clínica;
- motivos de perda;
- conversão explícita `Lead → Patient`;
- modelo pronto para attribution;
- boundary única para mutation por UI/API/IA/automação;
- estratégia de compatibilidade com `patients.funil_stage` atual;
- regras RLS/RBAC/entitlement para os novos objetos;
- deduplicação/identity resolution de telefone/e-mail/social sem colapsar Patient prematuramente.

## 4. CAPABILITY AUTHORITY / REUSE GATE

| Capability | Autoridade | Reuso |
| --- | --- | --- |
| tenant / `clinic_id` | MedicsPro | preservar |
| RBAC/RLS/entitlement `crm.access` | MedicsPro | preservar/estender |
| Patient / clinical identity | MedicsPro | preservar |
| Lead/Contact/Pipeline pattern | MedicsPro novo domínio | adaptar conceitos Deskcomm |
| timeline clínica | MedicsPro | não misturar |
| WhatsApp transport | MedicsPro + Evolution | fora desta slice |
| attribution | futura capability MedicsPro | apenas preparar extensibilidade |

### Reuse decision

`ADAPT` os invariantes de Contact/Lead/Pipeline/Activity do Deskcomm.

`REJECT` tenancy, auth/RBAC, Next.js e provider coupling Deskcomm.

## 5. DECISION

A direção aprovada é:

```text
Contact = identidade comercial/comunicacional tenant-scoped
Lead    = oportunidade comercial
Patient = identidade clínica
```

A criação de Patient deve acontecer por operação explícita de conversão; mensagem, clique, formulário ou social identity isolados não criam automaticamente prontuário/paciente.

### Compatibility

`patients.funil_stage` não será removido no primeiro passo. O design executável precisa definir:

- convivência temporária;
- migração dos dados atuais;
- consumidores existentes;
- momento de depreciação;
- semântica de `avaliacao/tratamento/alta` que pertence à jornada clínica e não ao pipeline comercial genérico.

## 6. SECOND ADVERSARIAL REVIEW

Riscos já identificados:

- duplicar identidade entre Contact e Patient;
- telefone/e-mail não serem identidade forte o suficiente;
- criar duas timelines concorrentes;
- converter todos os Patients atuais em Leads artificialmente;
- quebrar relatórios/NPS/churn ligados a `funil_stage`;
- permitir CRM write a role que ganhe autoridade clínica por acidente;
- bypass de `crm.access`;
- migration grande demais para rollback seguro;
- criar attribution antes de estabilizar o Commercial Core;
- mover Lead por IA/API sem gerar os mesmos side effects da UI.

### JEV

A organização documental/método foi submetida ao JEV em 2026-09-26 e recebeu `allow` com confiança 0.85. A decisão de schema/contratos deste Commercial Core ainda exige uma nova pergunta JEV depois do REAL NOW detalhado e antes da primeira migration.

## 7. EXECUTION

Não iniciada.

O primeiro subpasso executável deve ser **design-only**:

1. resolver a main atual;
2. inventariar todos os consumidores de `patients.funil_stage` e `patient_journey_events`;
3. inventariar RPC/RLS/tests/entitlement do CRM;
4. confirmar ausência/presença de contact/lead foundation;
5. desenhar schema + domain operations + migration compatibility;
6. executar SECOND ADVERSARIAL REVIEW/JEV;
7. só então abrir a primeira migration/código.

## 8. VALIDATION

Nesta preparação:

- código de produto alterado: **não**;
- migration aplicada: **não**;
- runtime/VPS alterado: **não**;
- validação de produto: **não aplicável ainda**.

A futura implementação deve incluir tenant isolation, roles, entitlement, migrations/verifiers, tests e compatibilidade de consumers existentes.

## 9. DOCUMENTATION

- método canônico: `docs/SLICE_EXECUTION_METHOD.md`;
- ledger: `docs/SLICE_LEDGER.md`;
- referência Deskcomm: `docs/DESKCOMM_ADOPTION_MATRIX.md`;
- handoff: `docs/slices/MED-CRM-001/HANDOFF.md`.

## Next exact step

Executar readback detalhado do CRM na **main atual**, mapear todos os consumers de `patients.funil_stage`/jornada e produzir o design do Commercial Core antes de tocar schema.
