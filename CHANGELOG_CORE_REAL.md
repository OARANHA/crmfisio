# Core Real — release notes

- Remove seeds do núcleo operacional como fonte de verdade.
- Carrega pacientes, agenda, financeiro, perfis, evoluções, consentimentos, NPS e pacotes do Supabase.
- Persiste cadastro de pacientes, agendamentos, status de atendimento, financeiro, evolução, consentimento e NPS.
- Adiciona isolamento multi-tenant e RBAC via RLS sem recursão em `profiles`.
- Adiciona painel Revenue Recovery no Dashboard.
- Mantém unidades, salas, comissões e recorrências na camada legada até a próxima migração de schema.
