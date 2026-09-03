# Administração da plataforma e provisionamento

`platform_admin` é uma identidade de plataforma, não um papel da clínica. Ela vive em
`public.platform_admins` e não concede acesso implícito a pacientes, prontuários ou
financeiro de nenhum tenant.

## Bootstrap inicial

1. Crie ou escolha um usuário no Supabase Auth pelo Studio.
2. Aplique `20260903_platform_provisioning.sql`.
3. Em ambiente seguro, com service role apenas no servidor, execute:

```bash
SUPABASE_URL=https://supabase.medicspro.com.br \
SUPABASE_SERVICE_ROLE_KEY='<service-role>' \
PLATFORM_ADMIN_EMAIL='<email-existente-no-auth>' \
node scripts/bootstrap-platform-admin.js
```

O mesmo usuário pode ter um `profile` de clínica independente. Ser administrador da
plataforma não cria esse vínculo nem altera suas permissões dentro de uma clínica.

## Provisionar uma clínica

Faça login com o usuário cadastrado em `platform_admins` e chame a Edge Function com o
JWT dessa sessão:

```bash
curl -X POST 'https://supabase.medicspro.com.br/functions/v1/provision-clinic' \
  -H 'Authorization: Bearer <JWT_DO_PLATFORM_ADMIN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "idempotency_key": "cliente-2026-09-chave-unica",
    "clinic": { "name": "Clínica Exemplo", "cnpj": "" },
    "owner": {
      "email": "owner@clinica.com.br",
      "name": "Responsável da Clínica",
      "temporary_password": "SenhaTemporariaForte!"
    }
  }'
```

A chave de idempotência deve ser única por tentativa de onboarding. Repetir a mesma
requisição retorna os mesmos IDs sem criar outra clínica.

## Garantias e limite transacional

- a Edge Function valida o JWT e consulta `platform_admins.ativo` no servidor;
- o browser nunca envia `clinic_id` nem escolhe o papel do primeiro usuário;
- clínica e primeiro `owner` são gravados juntos pela RPC PostgreSQL;
- o usuário Auth é criado antes da transação PostgreSQL porque GoTrue e PostgreSQL não
  compartilham uma transação distribuída;
- em falha, a função remove o usuário Auth recém-criado e registra a tentativa;
- uma retomada reconhece apenas usuário Auth marcado com o mesmo request de
  provisionamento, nunca adota uma conta existente arbitrária;
- `anon` e `authenticated` não acessam tabelas ou RPCs internas de plataforma.

## Rollback operacional

Desabilite ou remova o deploy de `provision-clinic` e revogue `EXECUTE` da RPC para
`service_role`. As tabelas são aditivas e podem permanecer sem afetar tenants existentes.
Não exclua clínicas concluídas automaticamente: onboarding concluído exige decisão e
auditoria de negócio.
