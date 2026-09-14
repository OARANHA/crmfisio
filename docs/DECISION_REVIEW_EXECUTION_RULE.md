# MedicsPro — Decision → Second Review → Execution

## Status

**CANONICAL OPERATING RULE.**

This rule applies to meaningful MedicsPro decisions across product, architecture, UX, dependencies, data, authorization, migrations, deployment, operations and documentation.

## Canonical sequence

```text
DECISION
→ SECOND REVIEW
→ EXECUTION
```

### 1. Decision

Form the best current decision from repository evidence, product context, constraints, risk and expected durable impact.

Do not execute merely because an implementation is technically possible.

The decision should state, at least internally:

- what problem is being solved;
- why this option is preferred;
- which invariants must remain true;
- the smallest coherent scope;
- the main failure modes and rollback posture.

### 2. Second review

Before execution, independently challenge the decision once more.

The second review is **not a ceremonial reread and not confirmation bias**. It must actively search for a reason the first decision may be wrong, premature, oversized, unsafe or inconsistent with MedicsPro.

Review at minimum, as applicable:

- whether the repository already contains a better canonical solution;
- whether the change widens authorization, tenant scope or clinical access;
- whether UX convenience is being confused with authorization;
- whether the change creates a parallel architecture;
- whether a smaller slice provides the same durable benefit;
- whether tests/verifiers still cover the real boundary after refactors;
- whether a new dependency is paying for itself in the current slice;
- whether compatibility, rollback and production rollout remain safe;
- whether documentation/handoff will still describe the real state.

If the second review invalidates the first decision, **change the decision before executing**.

### 3. Execution

Only after the second review agrees with the decision should implementation proceed.

Execution must then follow the normal MedicsPro rules:

- minimum coherent change;
- applicable automated gates;
- adversarial verification;
- PR/CI discipline;
- explicit production boundary;
- documentation continuity.

## Production boundary

This rule does not authorize production by itself.

For production, the sequence is:

```text
DECISION
→ SECOND REVIEW
→ PRECHECK
→ USER EXECUTES ON 158.220.97.145
→ OUTPUT REVIEW
→ NEXT CONTROLLED STEP
→ VERIFIER / SMOKE
→ ONLY THEN PRODUCTION VALIDATED
```

The Wandora `/tmp` workspaces remain disposable engineering/test environments and never substitute for evidence from real MedicsPro production.

## Dependency and UI example

A dependency should not be adopted because it is fashionable or technically attractive.

Example used by the UI Foundation spike:

```text
Decision: evaluate TanStack Query + Table.
Second review: Query adds bundle/runtime cost without replacing server-state yet.
Execution: keep TanStack Table for the real table problem; defer Query until a slice where it replaces existing fetch/state complexity.
```

This is the intended behavior of the rule: the second review may narrow or reverse the initial decision.

## Institutional shorthand

When another chat/agent resumes MedicsPro work, interpret:

> **decision → second review → execution**

as a mandatory operating discipline for meaningful changes, not as optional style guidance.
