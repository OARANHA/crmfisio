# Nexus C-06 — impacto de autorização antes da implementação

Auditoria em 2026-09-08 sobre `OARANHA/crmfisio@d474b3f4f05fbb9615f1f4bb18cd9cb77af434f1`.

## Escopo

Esta entrega trata somente C-06 e aplica o guardrail explícito da missão: se a correção atravessar mais de um helper ou puder alterar autorização fora do Nexus, a implementação deve parar e o impacto deve ser documentado antes de ampliar o escopo.

A condição de parada foi atingida. **Nenhuma migration, policy, função, role, RLS, Edge Function ou código de runtime foi alterado por esta entrega.**

## 1. Diagnóstico

O bloqueio do role canônico `professional` não está confinado às policies Nexus.

Há dois pontos independentes de compatibilidade legada envolvidos:

1. `public.can_access_patient_clinical_record(uuid)` rejeita qualquer role diferente de `owner`, `admin` ou `fisio` antes de avaliar vínculo de agenda/autoria;
2. `public.has_professional_capability(text)` mantém fallbacks literais para `fisio`, inclusive um fallback Nexus.

Além disso, `can_access_patient_clinical_record(uuid)` é o boundary compartilhado de leitura clínica geral. Alterá-lo para aceitar `professional` expande autorização também fora do Nexus. Por isso não é seguro fazer uma substituição local `fisio -> professional` em C-06 sem tratar explicitamente o efeito transversal.

## 2. Definições efetivas confirmadas

### 2.1 `can_access_patient_clinical_record(uuid)`

Última definição localizada: `supabase-migrations/20260907_clinical_care_relationship_read_boundary.sql`.

Comportamento atual:

- exige `auth.uid()`, `current_clinic_id()`, `current_app_role()` e paciente válido;
- exige paciente não excluído no mesmo tenant;
- `owner` e `admin` retornam `true` após o boundary de tenant/paciente;
- qualquer role diferente de `fisio` retorna `false`;
- somente então o helper avalia vínculo por:
  - `appointments.fisio_id`;
  - autoria em `physiotherapy_evaluations.professional_id`;
  - autoria em `physiotherapy_evolutions.professional_id`;
  - autoria em `clinical_assessments.professional_id`;
  - autoria em `nexus_clinical_results.professional_id`;
  - autoria em `nexus_self_assessment_invites.professional_id`.

Consequência: um médico com role `professional`, identidade CRM válida, entitlement, grants e appointment próprio é bloqueado antes de qualquer vínculo ser considerado.

### 2.2 `has_professional_capability(text)`

Última definição localizada: `supabase-migrations/20260905_nexus_doctor_entitlement_hardening.sql`.

Para qualquer capability `nexus.%`, antes de grant/fallback o helper exige:

- entitlement Nexus efetivo da clínica;
- identidade médica válida via `current_nexus_medical_identity_valid()`.

Depois disso:

- grant/deny explícito em `professional_capabilities` prevalece independentemente do role operacional;
- fallback clínico não-Nexus existe apenas para `role = 'fisio'`;
- fallback Nexus existe apenas para `role = 'fisio'`.

Portanto, **um `professional` médico com grants explícitos corretos já passa pelo resolver Nexus**. O bloqueio funcional desse cenário ocorre no vínculo assistencial compartilhado. Já um profissional que dependia do fallback legado não recebe fallback depois do cutover.

Não é seguro substituir o fallback Nexus por `professional` automaticamente: isso criaria autorização implícita por role e pode ampliar capability sem grant explícito. A missão exige preservar capability/grants e não afrouxar o boundary.

## 3. Role matrix efetiva

Considerando C-01 e os helpers acima:

| Ator | `can_access_patient_clinical_record` | `has_professional_capability('nexus.access')` | Nexus C-01 |
| --- | --- | --- | --- |
| `professional` médico + entitlement + grant + vínculo | **false por role** | true | bloqueado |
| `professional` médico + entitlement + grant sem vínculo | false | true | bloqueado, corretamente |
| `professional` médico sem entitlement | false | false | bloqueado, corretamente |
| `professional` não médico | false | false para Nexus | bloqueado, corretamente |
| `owner/admin` não médico | true no vínculo | false para Nexus | bloqueado pelas guards C-01 |
| `owner/admin` médico com grants explícitos | true no vínculo | pode ser true | permitido pelo desenho atual se demais requisitos forem válidos |
| `recep` | false | false no cenário normal | bloqueado |
| `financeiro` | false | false no cenário normal | bloqueado |
| usuário inativo | contexto de tenant/role falha | false | bloqueado |
| clínica suspensa | contexto de tenant/role falha | false | bloqueado |
| anônimo | contexto ausente / EXECUTE revogado | false | bloqueado |
| outro tenant | paciente/clinic mismatch | sem acesso ao tenant alvo | bloqueado |

`current_clinic_id()` e `current_app_role()` continuam exigindo perfil ativo, senha temporária resolvida, clínica não excluída e lifecycle `active`.

## 4. Por que o helper de vínculo é transversal

`can_access_patient_clinical_record(uuid)` não é Nexus-only. Na própria migration que o cria, ele governa:

- `list_patient_clinical_snapshot()`;
- SELECT de `physiotherapy_evaluations`;
- SELECT de `physiotherapy_evolutions`;
- SELECT de `clinical_assessments`;
- SELECT de `assessment_body_points` via assessment pai;
- posteriormente, as leituras Nexus do C-01.

`list_patient_clinical_snapshot()` possui ainda outro gate literal: aceita somente `owner`, `admin` e `fisio`. Assim, mudar apenas `can_access_patient_clinical_record()` deixaria a projeção clínica geral incoerente para `professional`.

Conclusão: corrigir o vínculo canônico para `professional` muda autorização fora do Nexus e exige uma slice transversal de autorização clínica, ainda que a motivação imediata seja C-06.

## 5. Dependências residuais de `fisio_id`

O cutover de role para `professional` já foi feito em `20260907_professional_role_cutover.sql`, que:

- converte perfis `fisio` para `professional`;
- restringe `profiles.role` a `owner`, `admin`, `professional`, `recep`, `financeiro`;
- reescreve o resolver clínico genérico para `professional`;
- mantém temporariamente referências estruturais a `appointments.fisio_id` em guards de appointment.

`20260908_multiprofessional_replay_canonicalization.sql` reasserta o runtime canônico depois de todas as migrations de 07/09, mas as guards de transição/finalização ainda comparam `OLD/NEW.fisio_id` com `auth.uid()`.

`20260908_appointment_professional_id_compatibility.sql` cria `appointments.professional_id` e um trigger bidirecional que mantém `professional_id` e `fisio_id` idênticos. Isso torna `fisio_id` um alias estrutural temporário, não um role canônico.

`20260908_recurrence_professional_id_compatibility.sql` faz o mesmo em `appointment_series`, usa `professional_id` internamente em conflitos/escritas e mantém `p_fisio_id` apenas como parâmetro RPC compatível durante rollout.

No frontend ainda há compatibilidade residual:

- `Appointment` e `RecurrenceRule` mantêm `fisioId` marcado como deprecated;
- `repository.ts` ainda mapeia/escreve appointments via `fisio_id`;
- `appointmentRecurrence.ts` isola `p_fisio_id` por compatibilidade de RPC, embora exponha `professionalId` para consumidores.

Isso confirma que **role `fisio` não deve voltar**, enquanto coluna/parâmetro legado ainda pode existir transitoriamente com sincronização explícita.

## 6. Impacto nas policies Nexus C-01

C-01 está corretamente composto como:

`mesma clínica AND vínculo assistencial AND capability Nexus`

para resultados e flags, e adiciona `nexus.scales` para convites. Cada tabela também possui guarda SELECT `RESTRICTIVE TO PUBLIC` com a mesma conjunção.

A correção C-06 **não precisa e não deve enfraquecer essas policies**. O problema está nos helpers chamados pelas policies.

Há, porém, uma consequência operacional importante: a migration/verifier C-01 registra fingerprints exatos de:

- `current_clinic_id()`;
- `current_app_role()`;
- `current_nexus_medical_identity_valid()`;
- `current_nexus_entitlement_allowed()`;
- `has_professional_capability(text)`;
- `can_access_patient_clinical_record(uuid)`.

Uma futura migration C-06 que redefina qualquer um dos dois últimos helpers tornará o verifier histórico C-01 incompatível por design. Isso não significa regressão das guards, mas exige um **novo verifier C-06** que prove simultaneamente:

- os novos fingerprints esperados;
- a permanência das policies permissivas C-01;
- a permanência das guards `RESTRICTIVE TO PUBLIC`;
- ausência das policies antigas com OR/bypass;
- a matriz comportamental completa.

Não reaplicar a migration C-01 depois de redefinir os helpers apenas para satisfazer o fingerprint antigo.

## 7. Comportamento de autoria/agendamento observado

A autorização clínica genérica já foi migrada para `current_user_has_clinical_capability(...)`, e o role canônico de care professional é `professional`.

Ainda assim, a atribuição de appointment continua em rollout estrutural:

- guards usam `fisio_id` como alias sincronizado;
- `appointments.professional_id` já existe como referência canônica;
- recurrence mantém parâmetro `p_fisio_id` apenas por compatibilidade de assinatura;
- código de repository ainda escreve `fisio_id`.

Esses consumidores não devem ser corrigidos incidentalmente no PR C-06. Eles confirmam uma dívida de cutover já documentada, mas não justificam reintroduzir o role `fisio` nem um big-bang de rename.

## 8. Por que a implementação foi interrompida

Duas condições explícitas da missão são verdadeiras:

1. C-06 envolve mais de um helper (`can_access_patient_clinical_record` e o resolver Nexus com fallback legado);
2. a alteração do helper de vínculo modifica autorização clínica fora do Nexus.

Prosseguir agora violaria o guardrail do próprio escopo.

Também não foi criado um helper Nexus paralelo de vínculo assistencial, porque isso duplicaria a regra canônica de care relationship e abriria espaço para drift futuro entre prontuário e Nexus.

## 9. Slice recomendada após autorização explícita de escopo transversal

A menor correção durável deve ser uma migration aditiva própria de C-06, sem tocar C-02, com estes princípios:

1. evoluir o **helper canônico compartilhado** de vínculo para reconhecer `professional`, usando `appointments.professional_id` como referência canônica e preservando autoria por `professional_id`;
2. alinhar `list_patient_clinical_snapshot()` ao role canônico, porque hoje ele mantém gate `fisio` independente;
3. não conceder Nexus por role; `has_professional_capability` deve continuar exigindo identidade médica + entitlement + grant/deny;
4. decidir explicitamente o destino do fallback Nexus legado, preferindo não criar fallback implícito para `professional` sem necessidade comprovada;
5. não alterar as guards C-01, apenas provar que continuam efetivas;
6. não converter usuários para `fisio` e não criar exceção de UI/menu/rota;
7. não aproveitar a missão para completar todos os consumers `fisio_id`.

Essa slice é transversal de autorização clínica e, por isso, deve ser assumida como tal antes de escrever SQL.

## 10. Matriz mínima de testes para a futura implementação

PostgreSQL 16 deve provar por acesso direto:

- médico `professional` autorizado + vínculo: permitido apenas no próprio paciente/tenant;
- médico `professional` autorizado sem vínculo: bloqueado;
- médico `professional` sem entitlement: bloqueado;
- médico `professional` com deny explícito de `nexus.access`: bloqueado;
- não médico `professional`: bloqueado no Nexus;
- owner/admin não médicos, inclusive com grants: bloqueados no Nexus;
- recep e financeiro: bloqueados;
- usuário inativo: bloqueado;
- clínica suspensa: bloqueado;
- anônimo: bloqueado;
- outro tenant: bloqueado para o tenant alvo;
- ausência de vínculo: bloqueada mesmo com entitlement/grants;
- `nexus.scales` negado: resultados/flags podem seguir `nexus.access`, convite não;
- policy permissiva acidental `USING(true)`: guards RESTRICTIVE continuam fechando os negativos;
- vínculo por appointment canônico `professional_id`;
- vínculo por autoria clínica `professional_id`;
- ausência de perfil persistido com role `fisio` após o cutover;
- compatibilidade estrutural `fisio_id`/`professional_id` enquanto o bridge existir, sem transformar `fisio` em role canônico.

Além do Nexus, a futura mudança precisa testar a superfície transversal de `can_access_patient_clinical_record`: snapshot clínico, avaliações, evoluções, assessments e body map para `professional`, owner/admin, recep, financeiro, inativo e cross-tenant.

## 11. Estado operacional desta entrega

- Branch dedicada: `docs/nexus-c06-authorization-impact`.
- Mudança funcional: nenhuma.
- Migration: nenhuma.
- Verifier novo: nenhum, porque nenhum contrato de autorização foi alterado.
- Produção: nada aplicado.
- Comandos pós-merge no servidor: **nenhum**.
- O verifier C-01 existente permanece válido enquanto os helpers permanecerem inalterados.

Próximo passo recomendado: somente após aceitar explicitamente que C-06 precisa de uma slice transversal de autorização clínica, implementar migration + verifier C-06 + harness PostgreSQL 16 em PR funcional separado.