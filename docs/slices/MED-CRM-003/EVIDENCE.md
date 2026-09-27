# MED-CRM-003 — Design Evidence

**Evidence kind:** design baseline / source readback — NOT executable proof
**Audited against:** `main@7a8badf5ad81e92746e82bedd142ba75899a4080`
**Date:** 2026-09-26

## Source facts

- `/crm` already runs behind `crm.access` and the existing privacy/module shell.
- `Crm.tsx` groups Patient by `patient.funilStage` and moves via `setFunilStage`.
- Patient NPS/churn and Treatment Continuity are separable Patient-domain sections.
- Commercial Core exposes current-clinic pipeline/stage/lead/activity projections.
- MED-CRM-002 exposes the canonical same-pipeline stage transition command.
- `supabaseClient.ts` intentionally uses an untyped client; no new database-type authority is required merely to call existing RPCs.
- `permissions.ts` already has `isOperationalRole = owner|admin|recep` for presentation use.
- Reception/Patient Registry still creates Patient directly, proving pre-clinical intake is a separate gap.

## Adversarial trail

Combined board + new Lead creation:

```text
split_task: 0.83
confidence: 0.77
```

Narrow board initial review:

```text
deep_review: 0.57
confidence: 0.43
```

After deterministic client/permission/surface review:

```text
proceed_fast: 0.60
deep_review: 0.36
block: 0.03
split_task: 0.01
confidence: 0.46
```

JEV is advisory; deterministic repository evidence is authoritative.

## Non-proof

No MED-CRM-003 implementation branch/PR exists at this checkpoint. No UI code changed, no board tests ran, no production rollout was observed. Status remains DESIGNED.
