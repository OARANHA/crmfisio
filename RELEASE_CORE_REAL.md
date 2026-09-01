# MedicsPro — Core Real release

Esta release remove os dados simulados do núcleo operacional e passa a usar o Supabase como fonte de verdade para:

- perfis/profissionais;
- pacientes;
- agenda/atendimentos;
- financeiro;
- evoluções clínicas;
- consentimentos;
- NPS;
- pacotes já existentes;
- logs de comunicação e auditoria.

## Implantação

O frontend continua sendo implantado exclusivamente pelo Portainer/GitOps a partir da branch `main`.
A stack do CRM recebe apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; ela não recebe credenciais administrativas do PostgreSQL e não executa DDL.

A camada de dados foi preparada para tratar Pacientes, Agenda e Financeiro como núcleo obrigatório e carregar módulos acessórios de forma tolerante caso uma política RLS ainda não os disponibilize.

A migração `supabase-migrations/20260831_core_rls.sql` permanece versionada como hardening recomendado da infraestrutura Supabase. Ela padroniza as políticas multi-tenant e elimina dependência de políticas recursivas, mas não é executada pelo container web.

## Validação pós-deploy

1. Login deve continuar autenticando via Supabase Auth.
2. O dashboard deve deixar de exibir os pacientes e valores de `seed.ts`.
3. Em banco vazio, KPIs operacionais devem aparecer zerados, não preenchidos com dados de demonstração.
4. Cadastrar paciente deve persistir após recarregar a página.
5. Agenda e Financeiro devem ler/escrever no Supabase.
6. Revenue Recovery deve ser calculado somente a partir dos dados reais carregados.

## Rollback

Em caso de erro de frontend, reverter o merge na `main`. Nenhuma credencial administrativa do banco é armazenada na stack do CRM.

## Dados ainda temporários

`unidades`, `rooms`, `commissions` e regras de recorrência continuam na camada legada porque o schema atual ainda não possui tabelas próprias para todas essas entidades. Eles não alimentam os KPIs financeiros principais da nova camada de Revenue Recovery.

## Direção de produto

O dashboard passa a destacar Receita Recuperável com base em dados reais: cobranças atrasadas, pacientes inativos e pacientes ativos sem próxima sessão.
