# P0 — #394 Post-Finalization Read-Only Evidence — 2026-09-15

## Status

**CLOSED BY OBSERVED PRODUCTION READ / NO PRODUCTION MUTATION.**

Base reviewed: `main@16cb7c048f177f2f61c2ea744eb3e31504c42103`

## Purpose

Close the remaining evidence gap for the real #394 smoke after finalization without reopening the clinical lifecycle and without reading patient-facing or clinical content.

The earlier smoke had already observed one draft Encounter Record with persistence across refresh/navigation and, before finalization, zero Evolutions, zero payments and zero financial exceptions.

## Decision → second review → execution

**Decision:** inspect only the final state of the already-existing smoke record in production.

**Second review:** restrict evidence to counts/status/linkage booleans. Do not select names, UUIDs, free text, clinical fields or other patient data. Run all SQL inside `BEGIN READ ONLY ... ROLLBACK`.

**Execution:** query the live PostgreSQL schema on 2026-09-15 and compare Encounter Record, appointment, linked Evolution and financial effects by internal joins only.

## Observed evidence

The production database contained exactly one `clinical_encounter_records` row. The inspection observed:

```text
encounter_count_exactly_one=true
encounter_finalized=true
encounter_has_finalized_at=true
appointment_finalized=true
appointment_tenant_matches=true
appointment_patient_matches=true
appointment_professional_matches=true
evolution_link_present=true
session_evolution_count_exactly_one=true
session_active_evolution_count_exactly_one=true
linked_evolution_is_session_evolution=true
evolution_session_matches_appointment=true
evolution_tenant_matches=true
evolution_patient_matches=true
evolution_professional_matches=true
evolution_active=true
payment_count_exactly_one=true
payment_tenant_matches=true
payment_patient_matches=true
payment_unpaid=true
payment_overdue_state_coherent=true
financial_exception_count_zero=true
```

A prior aggregate read additionally observed `revision=3`, one linked Evolution and one payment row. A dedicated second-review query then confirmed there is exactly one Evolution for the entire session, and it is the same Evolution linked by the Encounter Record. The payment was `atrasado`; the final qualified check confirmed that this state matched an unpaid row with `vencimento < CURRENT_DATE` at inspection time.

## Privacy and safety

No clinical text, patient name, document content or raw identifier was selected into the evidence output. No `INSERT`, `UPDATE`, `DELETE`, DDL, RPC mutation or application action was executed.

One preliminary read-only composition referenced a nonexistent `physiotherapy_evolutions.appointment_id` column and failed before producing the joined evidence. The schema was then inspected read-only, revealing the canonical linkage through `physiotherapy_evolutions.session_id`. A later adversarial query also exposed an ambiguous unqualified `appointment_id` inside financial subqueries; that result was rejected and the final proof was rerun with every correlated identifier fully qualified. This is why only the final qualified result above is accepted as evidence.

## Conclusion

The real #394 smoke now has observed post-finalization evidence for the intended chain:

```text
Encounter Record finalized
→ exactly one active linked Evolution
→ appointment finalized
→ exactly one coherent financial row
→ zero appointment_financial_exception
```

This closes the #394 read-only P0 evidence gap. It does **not** validate general pilot UX, does not prove #389 `CHARGE`/`WAIVE`, and does not authorize any new production mutation.
