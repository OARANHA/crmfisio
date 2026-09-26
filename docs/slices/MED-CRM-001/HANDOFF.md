# MED-CRM-001 — Handoff

## Start here

Leia:

1. `AGENTS.md`
2. `docs/SLICE_EXECUTION_METHOD.md`
3. `docs/CURRENT_STATE.md`
4. `docs/SLICE_LEDGER.md`
5. `docs/DESKCOMM_ADOPTION_MATRIX.md`
6. `docs/slices/MED-CRM-001/README.md`

Depois resolva a `origin/main` atual e repita REAL NOW.

## Slice

- ID: `MED-CRM-001`
- status: `APPROVED`
- objective: separar Commercial Contact/Lead de Patient com conversão explícita;
- execution: **não iniciada**;
- branch de organização inicial: `docs/canonical-slice-method`.

## Proven

- o CRM atual é patient-centric e usa `patients.funil_stage`;
- existe `patient_journey_events`;
- mudança de funil possui boundary tenant + `crm.access` + roles server-side;
- comunicação Evolution/outbox/worker já existe e não deve ser recriada;
- Deskcomm tem uma referência madura para Contact/Lead/Pipeline/Activity, mas não é autoridade MedicsPro.

## Decisions locked unless stronger evidence appears

- `OARANHA/crmfisio` permanece único runtime canônico;
- `clinic_id`, Supabase, RLS/RBAC/capabilities/entitlements permanecem;
- Patient continua identidade clínica;
- Lead não cria Patient implicitamente;
- Evolution não será substituída para copiar Deskcomm;
- Deskcomm tenancy/auth/Next.js não serão portados.

## Do not change/reopen

- Encounter/EHR;
- clinical authorization;
- Nexus;
- Evolution worker/outbox;
- Plan/entitlement foundation;
- patient clinical history.

## Open gaps

- full consumer map de `patients.funil_stage`;
- schema final Contact/Lead/Pipeline/Stage/Activity;
- identity-resolution rules;
- RLS/RBAC/RPC contract;
- compatibility/migration strategy;
- event strategy/parity de mutation;
- exact lead→patient conversion contract.

## Next exact step

Na main atual:

1. localizar todos os consumers de `patients.funil_stage`, `patient_journey_events` e `transition_patient_journey`;
2. localizar todos os tests/verifiers/RLS/RPCs do `crm.access`;
3. confirmar se existe qualquer contact/lead foundation adicionada depois deste handoff;
4. desenhar o schema e as domain operations sem escrever migration;
5. submeter o design ao SECOND ADVERSARIAL REVIEW + JEV;
6. atualizar a slice para `DESIGNED` somente se os boundaries estiverem fechados.

## Validation still required

Tudo da implementação. Ainda não há código ou schema novo para validar.

## JEV state

- revisão do método documental: `allow`, confidence `0.85`;
- revisão do Commercial Core schema: **pendente**.

## VPS/runtime

- required now: **no**;
- MCP_WANDORA_VPS só será usado quando uma futura etapa precisar provar schema/deploy/worker/runtime real.

## Copy-paste prompt for a new chat

```text
Continue MED-CRM-001 in OARANHA/crmfisio.

Do not rely on prior chat memory.

Read AGENTS.md, docs/SLICE_EXECUTION_METHOD.md, docs/CURRENT_STATE.md,
docs/SLICE_LEDGER.md, docs/DESKCOMM_ADOPTION_MATRIX.md,
docs/slices/MED-CRM-001/README.md and HANDOFF.md.

Resolve current origin/main and repeat REAL NOW before changing anything.
The next step is design-only: map all current patient CRM consumers and produce
the Contact/Lead/Pipeline/Stage/Activity + Lead→Patient contract without writing
a migration yet. Preserve clinic_id, Supabase, RLS/RBAC/capabilities/entitlements
and the existing clinical/WhatsApp foundations.

Use JEV for the SECOND ADVERSARIAL REVIEW of the proposed schema/boundaries.
Do not use MCP_WANDORA_VPS unless runtime/VPS evidence becomes necessary.
```
