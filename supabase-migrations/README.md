# Migrações do MedicsPro

Aplicar as migrações antes do frontend correspondente entrar em produção.

No servidor onde o Supabase self-hosted está rodando, a migração pode ser aplicada diretamente no container PostgreSQL:

```bash
docker exec -i supabase-db sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U postgres -d postgres' < supabase-migrations/20260831_core_rls.sql
```

`ON_ERROR_STOP=1` garante que o processo pare no primeiro erro em vez de continuar com uma migração parcial.
