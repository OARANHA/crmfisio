# #399 — autorização multiprofissional de instrumentos clínicos no Encounter

## Escopo efetivamente implementado

A #399 cria a fundação de autorização para instrumentos clínicos multiprofissionais e implementa **somente o primeiro boundary contextual**: aplicar um instrumento durante o Encounter ativo do profissional autenticado.

Ela não implementa envio remoto ao paciente, autoaplicação, protocolo assíncrono, persistência neutra de resultados nem nova UI de aplicação. Esses modos futuros devem compor a mesma autorização base com boundaries contextuais próprios.

## Separação arquitetural

A autorização foi dividida em duas camadas deliberadamente distintas.

### Base authorization

A base exige cumulativamente:

- sessão autenticada e clínica ativa derivada do usuário;
- identidade clínica canônica válida;
- grant explícito de `clinical.instrument.apply` em `professional_capabilities`;
- paciente existente, não excluído e pertencente à clínica atual;
- instrumento habilitado pela própria clínica.

Essa base é implementada por `clinical_instrument_base_authorized(patient_id, instrument_key)`, mas o helper é **interno**: `authenticated` e `anon` não possuem `EXECUTE`. Isso evita que uma resposta positiva seja confundida com autorização universal para qualquer futuro modo de Instrument Delivery.

### Contextual act boundary — Apply in Encounter

O único boundary de ato público desta slice é:

`can_apply_clinical_instrument_in_encounter(appointment_id, instrument_key)`

Além da base, ele exige:

- appointment pertencente à clínica autenticada;
- `appointments.professional_id = auth.uid()`;
- appointment no estado clínico canônico `em_atendimento`;
- paciente derivado do próprio appointment.

O browser não informa `clinic_id`, `patient_id` nem `professional_id` como autoridade. Esses valores são derivados do contexto autenticado e do appointment.

`agendado`, `confirmado` e `finalizado` não representam Encounter ativo para **Apply now** no workflow atual e, portanto, falham fechado.

## Owner/admin e fronteira entre leitura e ato

`can_access_patient_clinical_record(patient_id)` continua sendo a fronteira histórica de leitura. Owner/admin possuem leitura clínica legítima dentro do tenant, então esse helper **não** é usado para autorizar aplicação de instrumentos.

Owner/admin só podem obter `true` no boundary de Encounter quando, independentemente do papel operacional:

- possuem identidade clínica válida;
- receberam `clinical.instrument.apply` explicitamente;
- são o `appointments.professional_id` do atendimento;
- o atendimento está `em_atendimento`;
- todas as demais condições de tenant/paciente/instrumento estão satisfeitas.

O papel operacional sozinho nunca concede o ato.

## Capability

A capability adicionada é:

`clinical.instrument.apply`

Ela é clínica, ativa e neutra em relação à profissão. Não substitui:

- `clinical.assessment.apply`, que continua pertencendo ao Assessment Engine estruturado;
- `nexus.scales`, que continua pertencendo à autorização Nexus;
- qualquer capability `nexus.*`.

A migration não cria grants em `professional_capabilities`.

No `TeamAdmin`, a opção aparece como **Aplicar instrumentos clínicos** porque a tela já é dirigida por `CLINICAL_CAPABILITIES`. O `admin-team` passa a aceitar essa chave no allowlist server-side existente.

A capability é explicitamente removida de todos os defaults de profissão. Selecionar Fisioterapia, Medicina, Psicologia, Quiropraxia ou uma especialidade não a concede automaticamente.

Enfermagem/COREN não foram adicionados nesta slice porque ainda não constituem uma identidade profissional canônica suportada pelo produto.

## Configuração institucional

A tabela aditiva:

`clinic_clinical_instrument_settings`

mantém apenas:

- `clinic_id`;
- `instrument_key`;
- `enabled`, com default `false`;
- `configured_by` e timestamps de auditoria mínima.

Ausência de linha e `enabled=false` significam deny.

O browser autenticado possui somente leitura tenant-scoped. Alteração ocorre pela RPC:

`set_clinic_clinical_instrument_enabled(instrument_key, enabled)`

A RPC é exclusiva de owner/admin ativos, deriva `clinic_id` da sessão e não recebe tenant fornecido pelo cliente.

Nesta foundation, os instrumentos reconhecidos são as escalas que já possuem contrato canônico confiável no registry C-02 (`nexus_result_contracts`, `module_key='scales'`). Na baseline atual isso corresponde a PHQ-9 e GAD-7. EEM não é tratado como escala por essa configuração.

## Relação com Nexus

A #399 reutiliza somente a **identidade canônica de ferramenta/regra/versão já existente** para PHQ-9 e GAD-7. Ela não reutiliza a autorização Nexus como autorização multiprofissional.

Permanecem invariantes:

- PHQ-9: `scales / phq9 / nexus.phq9 / nexus-2026-09-03`;
- GAD-7: `scales / gad7 / nexus.gad7 / nexus-2026-09-03`;
- os contratos C-02 continuam resolvendo `nexus.scales` para writers Nexus;
- C-01 continua sendo a fronteira de leitura Nexus;
- C-03 continua separando processamento, revisão e assinatura;
- C-04 continua exigindo incorporação explícita ao prontuário;
- C-05 continua sendo a projeção longitudinal comparável;
- C-06 continua exigindo identidade médica + entitlement + grant explícito para capabilities `nexus.*`.

Nenhuma policy Nexus, helper C-06, tabela de resultado Nexus ou grant `nexus.*` é ampliado pela #399.

Um fisioterapeuta com `clinical.instrument.apply`, por exemplo, pode satisfazer o boundary neutro de Apply in Encounter, mas continua sem `nexus.access`, `nexus.scales` ou `nexus.eem` se não satisfizer separadamente o contrato Nexus — e C-06 impede que uma identidade não médica adquira essa autoridade.

## Persistência e scoring

A #399 não cria tabela de resultados multiprofissionais e não grava respostas/escores.

Definition/version/validation/scoring de PHQ-9 e GAD-7 permanecem no engine canônico já existente. Quando a próxima slice implementar a operação de aplicação, ela deverá reutilizar esse engine sem relaxar a persistência doctor-only Nexus. Se a persistência Nexus não puder ser reutilizada mantendo C-01/C-06 intactos, o caminho previsto é uma persistência clínica neutra própria.

## Verificação

O gate dedicado usa PostgreSQL 16 e monta a baseline efetiva C-01/C-06/C-02 antes de aplicar a migration #399 duas vezes.

A matriz comportamental possui 38 casos, incluindo:

- default sem grant e sem instrumento habilitado;
- configuração owner/admin server-side e ausência de DML direto do browser;
- médico e fisioterapeuta suportados no próprio Encounter;
- `agendado`, `confirmado` e `finalizado` negados para Apply now;
- appointment de outro profissional negado;
- owner/admin com leitura mas sem atribuição negados;
- owner/admin clínicos atribuídos sujeitos à mesma regra e permitidos somente quando tudo coincide;
- capability sem appointment sem autoridade genérica;
- especialidade Psiquiatria sem capability negada;
- usuário inativo, paciente excluído e cross-tenant negados;
- não médico com capability neutra sem qualquer `nexus.*`;
- disable/revoke fechando autorização imediatamente;
- snapshots garantindo que policies C-01, helpers C-06 e registry C-02 não foram alterados.

O verifier instalado é read-only:

`supabase-verifiers/VERIFY_20260910_CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.sql`

Ele valida shape, RLS, ACLs, funções e composição das boundaries sem criar fixtures ou alterar dados.

## Rollout

Migration:

`supabase-migrations/20260910_clinical_instrument_encounter_authorization.sql`

Gate local/CI isolado:

`bash scripts/test-clinical-instrument-encounter-authorization.sh`

A migration é aditiva e foi desenhada para replay seguro. Ela falha fechado se os contratos canônicos PHQ-9/GAD-7 esperados ou os helpers clínicos de fundação não estiverem presentes.

**Este PR não aplica a migration em produção.** Aplicação em produção só deve ser considerada após revisão, merge explícito e gates requeridos verdes.
