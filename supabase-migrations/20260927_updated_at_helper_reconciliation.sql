-- MEDICSPRO — baseline reconciliation for public.update_updated_at_column()
-- Canonical repair for production environments created before this helper was versioned.
-- Additive only: creates the helper only when it is absent.
-- Does not modify CRM tables, patients, leads, RLS policies or application data.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $reconcile$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION public.update_updated_at_column()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $fn$
    $sql$;
  END IF;
END
$reconcile$;

COMMIT;
