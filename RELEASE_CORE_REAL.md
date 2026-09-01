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

## Ordem segura de implantação

1. Aplicar `supabase-migrations/20260831_core_rls.sql` no banco `postgres` do Supabase.
2. Validar que o usuário administrador consegue consultar `profiles`, `patients`, `appointments` e `payments` via API.
3. Fazer merge de `feature/real-supabase-core` em `main`.
4. O Portainer/GitOps fará o redeploy da aplicação a partir de `main`.
5. Fazer login e validar Dashboard, Pacientes, Agenda e Financeiro.

## Rollback

Em caso de erro de frontend, reverter o merge na `main`. A migração de RLS pode permanecer aplicada: ela é compatível com o modelo multi-tenant e não depende do frontend novo.

## Dados ainda temporários

`unidades`, `rooms`, `commissions` e regras de recorrência continuam na camada legada porque o schema atual ainda não possui tabelas próprias para todas essas entidades. Eles não alimentam os KPIs financeiros principais da nova camada de Revenue Recovery.

## Direção de produto

O dashboard passa a destacar Receita Recuperável com base em dados reais: cobranças atrasadas, pacientes inativos e pacientes ativos sem próxima sessão.
