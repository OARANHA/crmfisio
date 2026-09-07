# MedicsPro — P1 Operational Preflight

## Objetivo

Este preflight fecha a etapa de estabilizacao antes do piloto com profissionais reais sem criar dados artificiais nem alterar estado produtivo.

O verifier canonico e:

`supabase-migrations/VERIFY_20260907_P1_OPERATIONAL_PREFLIGHT.sql`

Ele e deliberadamente **read-only**.

## O que ele valida

1. RPCs canonicos de sessao/tenant existem.
2. RPCs sensiveis usam `SECURITY DEFINER` e `search_path` fixo quando aplicavel.
3. `profiles.role` contem apenas os cinco papeis canonicos de clinica e nunca `platform_admin`.
4. Perfis possuem usuario Auth e clinica validos.
5. Inventario de usuarios ativos/inativos e usuarios em clinicas suspensas.
6. Existencia de pelo menos duas clinicas nao excluidas para smoke multi-tenant real.
7. RLS nas tabelas tenant criticas.
8. Boundary clinico por relacao assistencial.
9. Exportacao LGPD server-authoritative e grant autenticado correto.
10. Mutacoes atomicas de equipe restritas a `service_role`.
11. Protecao contra retry cego e reconciliacao do WhatsApp restritas a `service_role`.
12. Ausencia de linhas core orfas de clinica.
13. Ausencia de referencias paciente/operacao cruzando `clinic_id`.
14. Inventario de massa para smoke negativo sem exibir PII.

## Criterio de GREEN

As secoes 1 a 13 devem retornar apenas invariantes verdadeiros.

As secoes 6 e 14 sao tambem um inventario de fixtures reais. Se nao houver duas clinicas ou uma clinica suspensa, isso nao significa falha arquitetural; significa apenas que o smoke vivo correspondente ainda precisa de uma fixture controlada antes de ser executado.

## Smoke vivo final

Quando houver massa segura disponivel, validar sem alterar dados clinicos:

- usuario ativo de Clinica A autentica e recebe somente contexto de A;
- usuario ativo de Clinica B autentica e recebe somente contexto de B;
- usuario inativo autentica no Auth, mas a aplicacao nega o perfil operacional;
- usuario ativo de clinica suspensa recebe estado `suspended` e nao dados tenant;
- fisio da Clinica A localiza cadastro operacional do paciente permitido, mas nao recebe prontuario de paciente sem relacao assistencial;
- owner/admin da propria clinica mantem leitura administrativa prevista;
- nenhuma sessao ou chamada browser adquire `service_role` ou identidade de `platform_admin` por meio de `profiles`.

## Regra operacional

Nao usar pacientes reais como fixture destrutiva. Nao suspender clinica produtiva apenas para cumprir smoke. Se a massa necessaria nao existir, criar fixture controlada somente quando houver uma janela de teste explicita.

O objetivo deste preflight e tornar a verificacao repetivel e comparavel entre deployments, sem transformar producao em ambiente de testes.