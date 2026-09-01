# MedicsPro — Revenue-first roadmap

## North Star

**Receita recuperada pelo MedicsPro por clínica/mês.**

O produto deve provar valor financeiro, não apenas organizar a operação.

## Core agora

1. Dados reais no Supabase para Pacientes, Agenda e Financeiro.
2. RLS multi-tenant por `clinic_id` e RBAC por perfil.
3. Dashboard sem números mockados no núcleo financeiro.
4. Revenue Recovery: inadimplência, inativos e ativos sem próxima sessão.

## Próxima etapa

1. Persistir unidades, salas, comissões e recorrências.
2. Registrar eventos de receita recuperada (`recovery_events`).
3. Automação de no-show e confirmação de agenda.
4. Reativação 30/60/90 dias.
5. Conversão CRM: lead -> avaliação -> tratamento -> pacote.
6. Renovação de pacotes e previsão de churn.
7. Relatório mensal de ROI do MedicsPro.

## Regra de produto

Nenhuma feature entra por estética. Cada entrega deve melhorar pelo menos um destes indicadores:

- receita;
- ocupação da agenda;
- retenção;
- eficiência operacional.
