# Nexus C-03 — correção aditiva do guard de lifecycle

Esta slice corrige exclusivamente o drift de rollout entre a migration histórica C-03 já aplicada e o verifier posterior.

## Migration histórica

Não editar nem reaplicar como correção:

`supabase-migrations/20260908_nexus_c03_clinical_lifecycle.sql`

## Migration corretiva

Aplicar somente após merge, pinando o commit da `main` aprovado pelos cinco gates:

`supabase-migrations/20260908_nexus_c03_lifecycle_guard_rollout_correction.sql`

Ela executa somente `CREATE OR REPLACE FUNCTION public.validate_nexus_result_clinical_lifecycle()` com a guarda terminal canônica:

`IF TG_OP = 'UPDATE' AND OLD.signed_at IS NOT NULL THEN`

Nenhuma tabela, constraint, trigger, RLS, ACL, role, dado, writer, backfill ou rollback é alterado.

## Verifier posterior reutilizado explicitamente

`supabase-migrations/20260908_verify_nexus_c03_clinical_lifecycle.sql`

O verifier continua sendo a autoridade pós-correção e exige a precedência da guarda terminal, ausência de `NEW IS DISTINCT FROM OLD`, monotonicidade e os contratos C-01/C-06/C-02 preservados.

## Comandos pós-merge pináveis

Substitua `<MERGE_SHA>` pelo SHA exato da `main` após o merge deste PR. No servidor, use um checkout limpo e pinado nesse SHA antes de executar qualquer SQL.

```bash
git fetch origin main
git checkout --detach <MERGE_SHA>
git rev-parse HEAD
sha256sum \
  supabase-migrations/20260908_nexus_c03_lifecycle_guard_rollout_correction.sql \
  supabase-migrations/20260908_verify_nexus_c03_clinical_lifecycle.sql
```

Aplicação corretiva:

```bash
docker exec -i supabase-db \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase-migrations/20260908_nexus_c03_lifecycle_guard_rollout_correction.sql
```

Verifier C-03 posterior:

```bash
docker exec -i supabase-db \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase-migrations/20260908_verify_nexus_c03_clinical_lifecycle.sql
```

Não há rollback, backfill, Edge Function ou redeploy nesta slice.
