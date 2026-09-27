# MED-CRM-004 — Evidence

**Audited main:** `2bcadc00a730eb9a1c1c063a688ccebf8982ce35`  
**Branch:** `feat/med-crm-004-archived-pipeline-transition-guard`  
**Status:** IMPLEMENTING — validation pending

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

Pending. Do not mark PROVED until the current branch/PR head has mechanical PostgreSQL evidence plus the applicable repository checks.

A disposable PostgreSQL start attempt through the remote execution broker was blocked by the execution safety layer before any command ran. No lab or production mutation resulted from that attempt. GitHub Actions PostgreSQL 16/17 is the canonical behavioral proof path added by this slice.

## RELEASE

Not started. Production must not be changed before PROVED + merge. Because this slice changes the canonical production RPC, RELEASED requires controlled rollout and post-rollout readback.
