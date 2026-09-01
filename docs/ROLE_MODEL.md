# MedicsPro — modelo canônico de perfis

O banco (`public.profiles.role`) é a fonte de verdade para autorização de aplicação.

Perfis suportados:

- `owner`: proprietário da clínica. Gestão total, configurações, usuários, financeiro e leitura clínica; não assina atos clínicos apenas por ser proprietário.
- `admin`: gestão administrativa. Agenda, cadastro, financeiro, CRM, relatórios e leitura clínica conforme necessidade; não concede alta clínica.
- `fisio`: profissional assistencial. Agenda própria, avaliação, plano terapêutico, evolução, reavaliação, alta e reabertura clínica.
- `recep`: recepção. Cadastro, agenda, documentos/consentimentos e comunicação operacional; sem conteúdo clínico.
- `financeiro`: financeiro. Cobrança, recebimentos, repasses e relatórios financeiros; sem conteúdo clínico.

## Princípios

1. Nunca mapear `owner` para `admin` nem `financeiro` para `recep` no frontend.
2. A UI apenas reflete permissões; decisões sensíveis devem ser validadas no PostgreSQL/RPC/RLS.
3. Alta clínica é ato do profissional assistencial (`fisio`).
4. Correção administrativa não apaga histórico: gera novo evento auditável.
5. Contas de equipe devem ser usuários reais do Supabase Auth vinculados a `public.profiles` na mesma `clinic_id`.
