# MedicsPro — modelo canônico de identidade e autorização

## Estado atual

O banco (`public.profiles.role`) continua sendo a fonte de verdade do **papel atual** do usuário na aplicação.

Papéis atualmente suportados:

- `owner`: proprietário da clínica. Gestão, configurações, usuários, financeiro e leitura clínica conforme autorização; não assina atos clínicos apenas por ser proprietário.
- `admin`: gestão administrativa. Agenda, cadastro, financeiro, CRM, relatórios e leitura clínica conforme necessidade; não concede autorização clínica de escrita.
- `fisio`: papel assistencial legado atualmente usado para fisioterapeutas e para autorização clínica no sistema existente.
- `recep`: recepção. Cadastro, agenda, documentos/consentimentos e comunicação operacional; sem conteúdo clínico desnecessário.
- `financeiro`: financeiro. Cobrança, recebimentos, repasses e relatórios financeiros; sem conteúdo clínico desnecessário.

## Direção multiprofissional

`fisio` não deve ser ampliado para significar genericamente qualquer profissional de saúde, nem devemos adicionar `medico`, `psicologo`, `nutricionista`, etc. como novos roles paralelos.

O modelo alvo separa:

1. **clinic role** — função organizacional/autorização ampla;
2. **profession** — profissão/atuação clínica;
3. **capability** — permissão funcional específica;
4. **entitlement** — módulo disponibilizado à clínica pela plataforma/plano.

Exemplo conceitual:

```text
role: professional
profession: physician
capabilities:
  - clinical.record.write
  - clinical.assessments.execute
  - nexus.access
  - nexus.eem
  - nexus.psychopharmacology
```

Essa estrutura ainda requer migração incremental. Enquanto não estiver implementada de ponta a ponta, as regras atuais permanecem válidas e não devem ser contornadas no frontend.

Consulte `docs/PROFESSIONAL_MODEL_MIGRATION.md` para a estratégia de transição.

## Princípios

1. Nunca mapear `owner` para `admin` nem `financeiro` para `recep` no frontend.
2. A UI apenas reflete permissões; decisões sensíveis devem ser validadas no PostgreSQL/RPC/RLS.
3. Propriedade/administração da clínica não concede autoria de ato clínico.
4. Profissão por si só não deve conceder acesso; recursos sensíveis dependem de capability e contexto.
5. Correção administrativa não apaga histórico: gera evento/adendo auditável conforme o domínio.
6. Contas de equipe devem ser usuários reais do Supabase Auth vinculados à mesma `clinic_id`.
7. `platform_admin` pertence ao domínio da plataforma e não é role interno de uma clínica.
8. Entitlement não substitui autorização: uma clínica possuir Nexus não significa que todo usuário da clínica possa usar todo módulo Nexus.
9. Mudanças de papel/profissão/capability devem preservar tenant isolation e histórico clínico.
