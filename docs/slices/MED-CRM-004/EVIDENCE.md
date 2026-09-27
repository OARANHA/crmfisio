# MED-CRM-004 — Evidence

**Audited main:** `2bcadc00a730eb9a1c1c063a688ccebf8982ce35`  
**Branch:** `feat/med-crm-004-archived-pipeline-transition-guard`  
**Status:** PROVED — merge/release pending

## REAL NOW

- PR #533 is MERGED and its squash commit is the audited base above.
- MED-CRM-001 = RELEASED.
- MED-CRM-002 = RELEASED.
- MED-CRM-003 = ANALYZED / BLOCKED before EXECUTION.
- No current PR/slice owned the archived-pipeline transition prerequisite before this slice was created.
- PR #525 remains historical input only.

## PROVEN GAP

The RELEASED Core schema permits:

```text
crm_pipelines.archived_at IS NOT NULL
+
crm_stages.archived_at IS NULL
```

The RELEASED `transition_current_clinic_crm_lead_stage(...)`:

- derives tenant via the canonical mutator guard;
- locks the Lead `FOR UPDATE`;
- checks the target stage is same-pipeline and not archived;
- preserves lost-reason invariants;
- emits activity + audit for valid changes;
- does not read or lock `crm_pipelines`.

Existing MED-CRM-002 behavior/verifier coverage did not include archived-pipeline immutability.

## IMPLEMENTATION

Added:

- `supabase-migrations/20260927_commercial_crm_archived_pipeline_transition_guard.sql`
- `supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_ARCHIVED_PIPELINE_TRANSITION_GUARD.sql`
- `tests/sql/commercial_crm_archived_pipeline_transition_guard_cases.sql`
- `scripts/test-commercial-crm-archived-pipeline-transition-guard.sh`
- `.github/workflows/commercial-crm-archived-pipeline-transition-guard.yml`

The migration redefines only the existing transition RPC. For state-changing transitions it requires and locks the active current pipeline before updating `crm_leads`. Exact same-stage side-effect-free retries remain before that guard.

The harness replays the new migration twice, runs Core + MED-CRM-002 verifiers and all existing MED-CRM-002 behavior cases, then runs the new verifier and new behavioral cases.

The dedicated workflow runs the harness on PostgreSQL 16 and 17.

## NEW BEHAVIORAL PROOF DEFINED

The new cases require:

- archived target stage is still rejected;
- archiving a pipeline does not implicitly archive its stages in the fixture;
- an exact same-stage replay remains idempotent after pipeline archive;
- an actual stage change returns `crm_current_pipeline_archived`;
- rejection does not change Lead stage or emit `stage_changed` / `CRM_LEAD_STAGE_CHANGED`;
- Patient and Patient Journey remain untouched.

## VALIDATION

Proof head:

```text
PR #534 head = 2e783c08363e6922804bf6e96d377125778c0499
base = main@2bcadc00a730eb9a1c1c063a688ccebf8982ce35
behind = 0
```

GitHub Actions on that exact head:

```text
workflow runs = 21
completed = 21
success = 21
failed = 0

Commercial CRM Archived Pipeline Transition Guard:
PostgreSQL 16 = SUCCESS
PostgreSQL 17 = SUCCESS
```

The dedicated PostgreSQL jobs executed the full harness, including:

- migration replay;
- Core verifier;
- MED-CRM-002 Command Boundary verifier;
- MED-CRM-004 verifier;
- all existing MED-CRM-002 behavior cases;
- new archived-target / archived-pipeline behavior cases.

Independent workspace validation on the same head:

```text
bash -n harness = PASS
malformed DO blocks = 0
git diff --check = PASS

Vitest:
125 files passed
668 tests passed

typecheck = PASS
lint = PASS
build = PASS
```

The Vite build emitted only the existing non-fatal chunk-size warning. No production mutation occurred during validation.

An earlier attempt to start a disposable PostgreSQL cluster through the execution broker was blocked by the executor safety layer before execution; it produced no lab or production mutation and is not used as proof.

## RELEASE

Not started. MED-CRM-004 is PROVED, not MERGED and not RELEASED at this checkpoint. Because this slice changes the canonical production RPC, RELEASED requires merge plus controlled production rollout and post-rollout readback.
