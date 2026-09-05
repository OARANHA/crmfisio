# MedicsPro — Deployment Guide

## Estado atual

O frontend MedicsPro é publicado em container Docker e operado pelo **Portainer**.

- App: `https://app.medicspro.com.br`
- Supabase self-hosted: `https://supabase.medicspro.com.br`
- Supabase Studio: `https://studio.medicspro.com.br`
- Repositório: `OARANHA/crmfisio`
- Branch potencialmente produtiva: `main`
- O stack Portainer atual acompanha o GitHub em ciclos curtos, aproximadamente a cada 5 minutos.

> **Regra crítica:** trate qualquer merge em `main` como potencial deploy. Não use `main` para experimentação.

## Arquitetura de deploy

### Aplicação

- React + TypeScript + Vite.
- Build em Docker.
- Container servido por Nginx.
- Stack gerenciado no Portainer.

### Backend / dados

- Supabase self-hosted em stack própria.
- PostgreSQL, Auth, PostgREST, Edge Functions e demais serviços separados da aplicação frontend.
- Migrations do MedicsPro ficam versionadas em `supabase-migrations/`.
- Edge Functions relevantes ficam versionadas no repositório e precisam ser implantadas na stack Supabase de forma controlada.

## Variáveis de ambiente do frontend

O frontend precisa, no mínimo, de:

```text
VITE_SUPABASE_URL=https://supabase.medicspro.com.br
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Nunca colocar `service_role` no frontend ou no repositório.

## Regra de compatibilidade para deploy automático

Como o Portainer pode atualizar a aplicação poucos minutos após um merge em `main`:

1. mudanças de frontend em `main` devem estar prontas para produção;
2. migrations incompatíveis não podem depender de um frontend ainda não publicado;
3. preferir rollout backward-compatible: banco primeiro quando seguro, aplicação depois;
4. mudanças de banco devem ser versionadas, idempotentes quando possível e acompanhadas de verifier;
5. Edge Functions devem ser implantadas com paridade de versão quando a mudança depender delas;
6. mudanças documentais também podem provocar rebuild/redeploy dependendo da configuração atual do stack.

## Fluxo recomendado para mudanças

1. Criar branch a partir de `main`.
2. Implementar a menor alteração coerente.
3. Rodar o gate local/CI aplicável:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

4. Abrir PR para `main`.
5. Revisar efeitos em banco, Edge Functions, RLS/RPCs e compatibilidade de deploy.
6. Aplicar migrations/Edge Functions em ordem segura quando necessário.
7. Fazer merge apenas quando a revisão estiver deploy-safe.
8. Acompanhar atualização do Portainer e validar app/logs.

## Migrations no Supabase self-hosted

Não tratar `supabase-schema.sql` como mecanismo de atualização contínua de produção. Para mudanças incrementais, usar as migrations versionadas em `supabase-migrations/`.

Boas práticas:

- inspecionar o schema real antes de aplicar alterações;
- fazer backup antes de migrations de risco;
- preferir migration pinada a commit/hash quando executada manualmente;
- executar verifier após a migration;
- preservar compatibilidade com a aplicação já publicada;
- não executar comandos destrutivos sem plano explícito de recuperação.

## Provisionamento de clínicas e usuários

Não inserir identidades diretamente em `auth.users`.

- Bootstrap e regras de Platform Admin: documentação em `docs/`.
- Nova clínica + primeiro owner: Edge Function `provision-clinic`.
- Usuários adicionais: Edge Function `admin-team` por owner/admin autenticado.
- `platform_admin` é domínio separado e não implica acesso aos dados clínicos/financeiros das clínicas.
- Credenciais `service_role` permanecem server-side.

## Estado de readiness

Consultar:

- `docs/BETA_READINESS.md`
- `docs/FINANCIAL_PILOT_ACCEPTANCE.md`
- `PRODUCT_ROADMAP.md`
- `AGENTS.md`

Em 2026-09-05 o núcleo financeiro está GREEN para piloto controlado; o próximo gate é Configurações / Entitlements / governança por clínica.

## Validação pós-deploy

Após atualização da aplicação:

1. abrir `https://app.medicspro.com.br`;
2. validar login;
3. validar que o tenant e papel corretos foram carregados;
4. validar navegação/entitlements do usuário;
5. fazer smoke do fluxo alterado;
6. conferir erros no console e logs do container;
7. em mudanças financeiras ou de autorização, rodar os verificadores canônicos correspondentes.

## Segurança

- RLS é boundary de segurança; menu escondido não é autorização.
- Não expor secrets em commits, logs ou comandos compartilhados.
- Usar tokens/senhas apenas em variáveis temporárias e limpá-las após uso.
- Dados clínicos e financeiros devem permanecer isolados por clínica.
- Ações sensíveis devem ser server-side, auditáveis e deny-by-default.
