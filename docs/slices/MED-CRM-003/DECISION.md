# MED-CRM-003 — Decision

**Decision date:** 2026-09-27  
**Audited main:** `72a60262d09a14ce8382f3da9db12afcd15a8464`  
**Status:** ANALYZED / BLOCKED BEFORE EXECUTION

## Problem

The visible `/crm` board still treats `Patient.funil_stage` as commercial authority even though Contact/Lead/Pipeline/Stage and the canonical Commercial CRM commands are RELEASED.

The candidate was a frontend-only Board Cutover V1.

## Refined decision

Do **not** execute the frontend Board yet.

The deep review selected:

> **C — a prior contract/capability is still missing.**

The released transition command rejects archived target stages, but it does not reject an archived current pipeline when that pipeline still contains non-archived stages. Therefore a Board-only “legacy/archive = read-only” rule would be bypassable through the canonical browser RPC.

## Authority preserved

- tenant remains derived server-side;
- `crm.access` remains the entitlement;
- `owner | admin | recep` remain Commercial CRM writers;
- `professional | financeiro` remain read-only;
- Contact != Lead != Patient;
- Patient Journey remains separate;
- no raw browser DML;
- activity/audit remain server-side;
- no provider/automation/AI authority is introduced.

## Required prerequisite

Create a separate, narrowly gated prerequisite change to harden the canonical Commercial CRM transition contract for archived pipeline context.

The prerequisite must define and prove the server-side rule before MED-CRM-003 is reconsidered. It must not be smuggled into the frontend Board PR because backend/schema/RPC changes are explicit MED-CRM-003 non-goals.

## Alternatives rejected

### Frontend-only read-only guard

Rejected as the final authority because direct invocation of the canonical transition RPC would bypass it.

### Ignore archived pipeline and guard only archived stages

Rejected because the schema does not guarantee that archiving a pipeline archives every stage.

### Expand MED-CRM-003 to include backend hardening

Rejected because it violates the approved candidate boundary and would mix a server command-contract correction with the Board cutover.

## Reconsider MED-CRM-003 when

Re-run current-state reconstruction and all four pre-execution gates after the prerequisite server contract is PROVED/MERGED and, if production is affected, RELEASED.

The Board candidate may then reuse the frontend design findings documented in [EVIDENCE.md](EVIDENCE.md), but none of those findings pre-authorize implementation.
