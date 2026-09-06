# Patient data boundary — execution status

- [x] Canonical clinical snapshot RPC prepared (`list_patient_clinical_snapshot`).
- [x] RPC requires canonical active tenant context and clinical role (`owner`, `admin`, `fisio`).
- [x] Anonymous execution revoked; authenticated execution granted and guarded server-side.
- [x] Read-only production verifier added.
- [ ] Frontend bootstrap changed from `patients.select('*')` to explicit operational projection.
- [ ] Clinical roles consume the clinical snapshot RPC; operational roles never receive clinical fields.
- [ ] Table-wide `SELECT` revoked from `authenticated`; only operational patient columns granted directly.
- [ ] Patient mutation contracts audited so operational roles cannot mutate clinical columns.

The remaining items are intentionally sequenced after the RPC is present in production to keep rollout backward-compatible with the auto-deployed frontend.
