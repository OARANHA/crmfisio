# MED-DOC-001 — Handoff

## Start here

Read:

1. `AGENTS.md`
2. `docs/doctrine/README.md`
3. `docs/SLICE_EXECUTION_METHOD.md`
4. `docs/DESKCOMM_ADOPTION_MATRIX.md`
5. `docs/slices/MED-DOC-001/README.md`
6. `docs/slices/MED-DOC-001/AUDIT-MATRIX.md`
7. `docs/slices/MED-DOC-001/NORMATIVE-REVIEW.md`
8. `docs/slices/MED-DOC-001/SPEC-ARCH-PROOF-REVIEW.md`
9. `docs/slices/MED-DOC-001/TESTING-OPERATIONS-REVIEW.md`
10. `docs/slices/MED-DOC-001/CROSS-CUTTING-LESSONS.md`
11. `docs/slices/MED-DOC-001/FINAL-ABSORPTION-SYNTHESIS.md`

## Slice

- ID: `MED-DOC-001`
- status: `PROVED`
- objective: deep systematic mining of Deskcomm documentation for MedicsPro discipline, architecture reuse and future manual;
- product/runtime changes: none;
- Deskcomm audit snapshot: `8e26e2fa763dc04a565742d52c36c8172bcab3a3`.

## Proven so far

- Deskcomm snapshot has 284 files under `docs/`, 222 Markdown.
- Documentation has distinct knowledge roles: doctrine, ADR, business rules, PRD, spec, architecture, research, evidence, tests/journeys, runbooks, snapshot/audit, handoff and reconciliation.
- Deskcomm's own audit demonstrates documentation drift is material; mutable claims need remeasurement.
- Business-rules catalog contains 62 rules but is not proof of implementation by itself.
- Doctrine is strongest where a mechanical property is enforced by lint/test/invariant.
- ADR structure includes rejected alternatives and reconsideration triggers.
- Research uses epistemic labels that are useful for MedicsPro.
- User-journey QA and runbooks connect claims to observable proof/readback.

## Decisions

- do not expand PR #519 into the full Deskcomm research corpus;
- run this as a separate dependent slice;
- do not copy Deskcomm document hierarchy wholesale;
- extract the problem/invariant before the implementation;
- revalidate every current-state claim against code/tests when it matters;
- clinical/tenant/authorization authority always stays with MedicsPro.

## Residual questions — deliberately not promoted to current architecture

- formal Business Rules Catalog: create only if real MedicsPro drift/scale justifies it;
- global Reconciliation Log: create only when cross-contract conflicts become recurrent;
- machine-readable architecture maps: adopt after a real slice proves the maintenance value;
- generic `Demand` entity: do not create without a cross-domain need;
- Deskcomm packaging/agency/runtime mechanics: remain reference-specific unless a MedicsPro operational problem requires them.

## Next exact step

Do not continue mining by default.

Use [`FINAL-ABSORPTION-SYNTHESIS.md`](FINAL-ABSORPTION-SYNTHESIS.md) when a MedicsPro capability is designed. Revalidate only the Deskcomm area relevant to that slice against the then-current Deskcomm main.

The next concrete MedicsPro product slice is `MED-CRM-001`, beginning with a fresh REAL NOW and design-only consumer/schema analysis.

## New-chat prompt

```text
MED-DOC-001 is PROVED as a documentation/research slice in OARANHA/crmfisio.

Do not reopen the full Deskcomm audit by default and do not rely on prior chat memory.

Read AGENTS.md, docs/doctrine/README.md, docs/SLICE_EXECUTION_METHOD.md,
docs/DESKCOMM_ADOPTION_MATRIX.md and docs/slices/MED-DOC-001/FINAL-ABSORPTION-SYNTHESIS.md.

Deskcomm audit snapshot:
melgarafael/DeskcommCRM@8e26e2fa763dc04a565742d52c36c8172bcab3a3.

If a product slice needs a Deskcomm pattern, revalidate only that relevant area against
the then-current Deskcomm main, distinguish external proof from MedicsPro proof, and continue
through the canonical slice method. No Deskcomm capability is automatically implemented or authoritative.
```
