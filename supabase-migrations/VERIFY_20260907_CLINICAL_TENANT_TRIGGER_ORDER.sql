\echo '1) tenant-context triggers use the explicit first-order prefix'
SELECT
  to_regclass('public.physiotherapy_evaluations') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.physiotherapy_evaluations'::regclass
      AND tgname = 'trg_00_evaluations_tenant_context'
      AND NOT tgisinternal
  ) AS evaluations_tenant_first,
  to_regclass('public.physiotherapy_evolutions') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.physiotherapy_evolutions'::regclass
      AND tgname = 'trg_00_evolutions_tenant_context'
      AND NOT tgisinternal
  ) AS evolutions_tenant_first;

\echo '2) legacy late-order tenant trigger names are gone'
SELECT
  NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.physiotherapy_evaluations'::regclass
      AND tgname = 'trg_evaluations_tenant_context'
      AND NOT tgisinternal
  ) AS old_evaluations_trigger_gone,
  NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.physiotherapy_evolutions'::regclass
      AND tgname = 'trg_evolutions_tenant_context'
      AND NOT tgisinternal
  ) AS old_evolutions_trigger_gone;

\echo '3) tenant trigger sorts before clinical write guards'
WITH ordered AS (
  SELECT tgrelid, tgname,
         row_number() OVER (PARTITION BY tgrelid ORDER BY tgname) AS trigger_order
  FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgrelid IN (
      'public.physiotherapy_evaluations'::regclass,
      'public.physiotherapy_evolutions'::regclass
    )
    AND tgname IN (
      'trg_00_evaluations_tenant_context',
      'trg_evaluations_self_authorship',
      'trg_00_evolutions_tenant_context',
      'trg_evolutions_self_authorship',
      'trg_evolutions_session_linkage'
    )
)
SELECT
  (SELECT trigger_order FROM ordered WHERE tgname = 'trg_00_evaluations_tenant_context')
    < (SELECT trigger_order FROM ordered WHERE tgname = 'trg_evaluations_self_authorship')
    AS evaluation_tenant_before_authorship,
  (SELECT trigger_order FROM ordered WHERE tgname = 'trg_00_evolutions_tenant_context')
    < (SELECT trigger_order FROM ordered WHERE tgname = 'trg_evolutions_self_authorship')
    AS evolution_tenant_before_authorship,
  (SELECT trigger_order FROM ordered WHERE tgname = 'trg_00_evolutions_tenant_context')
    < (SELECT trigger_order FROM ordered WHERE tgname = 'trg_evolutions_session_linkage')
    AS evolution_tenant_before_session_guard;

\echo '4) tenant autofill function still exists'
SELECT to_regprocedure('public.fill_clinical_tenant_context()') IS NOT NULL AS ok;
