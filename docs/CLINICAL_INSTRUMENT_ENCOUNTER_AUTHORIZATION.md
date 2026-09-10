# #399 — autorização multiprofissional de instrumentos clínicos no Encounter

## Escopo efetivamente implementado

A #399 cria a fundação de autorização para instrumentos clínicos multiprofissionais e implementa **somente o primeiro boundary contextual**: autorizar aplicação de um instrumento durante o Encounter ativo do profissional autenticado.

Ela não implementa administração de PHQ-9/GAD-7, envio remoto ao paciente, autoaplicação, protocolo assíncrono, persistência neutra de resultados nem nova UI de aplicação. Esses modos futuros devem compor a mesma autorização base com boundaries contextuais próprios.

## Separação arquitetural

A arquitetura preserva explicitamente:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

Nesta slice existe ainda uma quarta decisão de exposição controlada:

```text
ENGINE REGISTRY MEMBERSHIP != MULTIPROFESSIONAL CLINICAL EXPOSURE
```

A autorização é dividida em base authorization e contextual act boundary. A exposição multiprofissional é decidida antes deles por um catálogo clínico neutro explícito.

### Catálogo clínico neutro

`clinical_instrument_catalog` é a allowlist mínima de instrumentos aprovados para a superfície clínica multiprofissional.

Campos implementados:

- `instrument_key`;
- `engine_source`;
- `engine_module_key`;
- `engine_tool_key`;
- `engine_rule_key`;
- `engine_rule_version`;
- `active`;
- `created_at`.

A #399 insere somente:

- `phq9` → engine Nexus `scales / phq9 / nexus.phq9 / nexus-2026-09-03`;
- `gad7` → engine Nexus `scales / gad7 / nexus.gad7 / nexus-2026-09-03`.

O vínculo técnico é protegido por foreign key para o contrato versionado em `nexus_result_contracts`. Isso prova que PHQ-9/GAD-7 continuam usando a engine canônica atual sem copiar perguntas, validação ou scoring.

O sentido inverso não existe: uma nova row em `nexus_result_contracts`, mesmo que seja uma escala Nexus válida, **não** se torna instrumento clínico multiprofissional até existir aprovação explícita em `clinical_instrument_catalog`.

O catálogo não é uma ACL de usuário e não concede capability. Ele responde apenas quais instrumentos podem participar da superfície neutra.

### Base authorization

A base exige cumulativamente:

- sessão autenticada e clínica ativa derivada do usuário;
- identidade clínica canônica válida;
- grant explícito de `clinical.instrument.apply` em `professional_capabilities`;
- paciente existente, não excluído e pertencente à clínica atual;
- instrumento ativo no `clinical_instrument_catalog`;
- instrumento habilitado pela própria clínica.

Essa base é implementada por `clinical_instrument_base_authorized(patient_id, instrument_key)`, mas o helper é **interno**: `authenticated` e `anon` não possuem `EXECUTE`. Isso evita que uma resposta positiva seja confundida com autorização universal para qualquer futuro modo de Instrument Delivery.

O helper base e a configuração institucional consultam o catálogo neutro, não a mera presença em `nexus_result_contracts`.

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
- o instrumento está explicitamente no catálogo neutro e habilitado pela clínica;
- todas as demais condições de tenant/paciente estão satisfeitas.

O papel operacional sozinho nunca concede o ato.

## Capability

A capability adicionada é:

`clinical.instrument.apply`

Ela é clínica, ativa e neutra em relação à profissão. Não substitui:

- `clinical.assessment.apply`, que continua pertencendo ao Assessment Engine estruturado;
- `nexus.scales`, que continua pertencendo à autorização Nexus;
- qualquer capability `nexus.*`.

A migration não cria grants em `professional_capabilities`.

No `TeamAdmin`, a opção aparece como **Aplicar instrumentos clínicos** porque a tela já é dirigida por `CLINICAL_CAPABILITIES`. O `admin-team` aceita essa chave no allowlist server-side existente.

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

`instrument_key` possui foreign key para `clinical_instrument_catalog`. Ausência de linha, instrumento fora/inativo no catálogo ou `enabled=false` significam deny.

O browser autenticado possui somente leitura tenant-scoped. Alteração ocorre pela RPC:

`set_clinic_clinical_instrument_enabled(instrument_key, enabled)`

A RPC é exclusiva de owner/admin ativos, deriva `clinic_id` da sessão, não recebe tenant fornecido pelo cliente e valida `instrument_key` contra o catálogo clínico neutro ativo.

## Relação com Nexus

A #399 reutiliza somente a **engine canônica** já existente para PHQ-9/GAD-7. O catálogo neutro referencia o contrato Nexus versionado para garantir integridade técnica, mas a autorização multiprofissional não usa `nexus.scales` e a exposição não é inferida a partir de todo `module_key='scales'`.

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

Um fisioterapeuta com `clinical.instrument.apply`, por exemplo, pode satisfazer o boundary neutro de Apply in Encounter para um instrumento explicitamente catalogado/habilitado, mas continua sem `nexus.access`, `nexus.scales` ou `nexus.eem` se não satisfizer separadamente o contrato Nexus — e C-06 impede que uma identidade não médica adquira essa autoridade.

## Persistência, administração e scoring

A #399 não cria tabela de resultados multiprofissionais e não grava respostas/escores.

Também não implementa a operação de administrar PHQ-9/GAD-7; implementa somente a foundation que poderá autorizar esse ato em uma próxima slice.

Definition/version/validation/scoring de PHQ-9 e GAD-7 permanecem na engine canônica já existente. Quando a próxima slice implementar Clinician-Assisted Administration, ela deverá reutilizar essa engine sem relaxar a persistência doctor-only Nexus. Se a persistência Nexus não puder ser reutilizada mantendo C-01/C-06 intactos, o caminho previsto é uma persistência clínica neutra própria.

`Enviar ao paciente` permanece fora desta slice e terá boundary contextual próprio quando desenhado; appointment ativo não foi transformado em requisito universal de Instrument Delivery.

## Verificação

O gate dedicado usa PostgreSQL 16 e monta a baseline efetiva C-01/C-06/C-02 antes de aplicar a migration #399 duas vezes.

A matriz aprovada permanece com 38 casos comportamentais, incluindo:

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

O blocker de exposição adiciona mais 4 negative controls com `nexus_only_scale`:

1. a escala fictícia existe como contrato Nexus válido;
2. ela não aparece em `clinical_instrument_catalog`;
3. owner/admin não conseguem habilitá-la institucionalmente;
4. um ator com `clinical.instrument.apply` não consegue obter Apply-in-Encounter para ela.

O verifier instalado é read-only:

`supabase-verifiers/VERIFY_20260910_CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.sql`

Ele valida shape, RLS, ACLs, foreign keys, catálogo neutro, funções e composição das boundaries sem criar fixtures ou alterar dados. Como verifier histórico da #399, exige os mappings canônicos ativos de PHQ-9/GAD-7, mas não limita o catálogo a exatamente dois itens; futuras expansões explícitas podem coexistir sem transformar este verifier em falso vermelho.

## Rollout

Migration:

`supabase-migrations/20260910_clinical_instrument_encounter_authorization.sql`

Gate local/CI isolado:

`bash scripts/test-clinical-instrument-encounter-authorization.sh`

A migration é aditiva e desenhada para replay seguro. Ela falha fechado se os contratos canônicos PHQ-9/GAD-7 esperados, helpers clínicos de fundação ou mappings pré-existentes incompatíveis não estiverem presentes.

O rollout de produção deve ser coordenado nesta ordem:

```text
merge
→ migration #399
→ verifier read-only #399
→ deploy admin-team
→ frontend do mesmo main
→ smoke
```

A migration deve estar aplicada e o verifier read-only deve passar antes de considerar o contrato server-side disponível. Depois disso, `admin-team` e o frontend devem vir do mesmo `main`, evitando drift entre capability/configuração exposta na UI e a autoridade instalada no backend.

Se o deploy automático do frontend aparecer antes dessa sequência estar completa, a funcionalidade deve continuar indisponível/fail-closed e **não deve ser usada** até que migration #399, verifier read-only e `admin-team` estejam alinhados. A presença antecipada de frontend não é evidência de rollout concluído nem autoriza contornar a ordem acima.

O smoke é a última etapa e deve validar o fluxo já instalado/alinhado; não substitui migration, verifier ou deploy coordenado da Edge Function.

**Estado do repositório:** foundation implementada no PR #399.

**Estado de produção:** migration #399 ainda não aplicada.

Aplicação em produção só deve ser considerada após revisão, merge explícito e gates requeridos verdes.
