# MedicsPro — modelo canônico de perfis

O banco (`public.profiles.role`) é a fonte de verdade para autorização operacional da aplicação.

Perfis suportados:

- `owner`: proprietário da clínica. Gestão total, configurações, usuários, financeiro e leitura clínica conforme os boundaries aplicáveis; não assina atos clínicos apenas por ser proprietário.
- `admin`: gestão administrativa. Agenda, cadastro, financeiro, CRM, relatórios e leitura clínica conforme necessidade; o papel administrativo não concede autoria clínica.
- `professional`: papel operacional canônico do profissional assistencial. Ações clínicas dependem adicionalmente de identidade profissional válida, capability explícita/aplicável e autoria ou vínculo assistencial exigido pelo fluxo.
- `recep`: recepção. Cadastro, agenda, documentos/consentimentos e comunicação operacional; sem conteúdo clínico desnecessário.
- `financeiro`: financeiro. Cobrança, recebimentos, repasses e relatórios financeiros; sem conteúdo clínico desnecessário.

## Papel não é profissão

`public.profiles.role = 'professional'` não significa fisioterapeuta. A profissão é representada separadamente por `professional_type` e pelos dados de conselho/registro quando exigidos.

Exemplos atuais de `professional_type` incluem:

- `fisioterapeuta`;
- `medico`;
- `psicologo`;
- `quiropraxista`.

Owner/admin também podem possuir identidade clínica própria. Nesse caso, um ato clínico só é autorizado quando a mesma combinação exigida para qualquer profissional estiver satisfeita — identidade clínica válida, capability apropriada e autoria/vínculo. O role administrativo nunca é um bypass clínico.

## Princípios

1. Nunca mapear `owner` para `admin` nem `financeiro` para `recep` no frontend.
2. A UI apenas reflete permissões; decisões sensíveis devem ser validadas no PostgreSQL/RPC/RLS.
3. Decisões clínicas são capability-first e exigem identidade/autoria; `role` sozinho não autoriza atendimento, evolução ou alta.
4. Operação geral do CRM é separada de decisão clínica de jornada. `clinical.attend` não concede edição arbitrária do funil.
5. Correção administrativa não apaga histórico: deve preservar rastreabilidade e usar o fluxo canônico apropriado.
6. Contas de equipe devem ser usuários reais do Supabase Auth vinculados a `public.profiles` na mesma `clinic_id`.
7. Nomes físicos históricos como `appointments.fisio_id` e `physiotherapy_evolutions` podem permanecer temporariamente como aliases/compatibilidade de schema. Eles não definem profissão nem autorização; `appointments.professional_id` é a referência canônica de autoria assistencial.
