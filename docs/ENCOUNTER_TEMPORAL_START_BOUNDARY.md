# #400 — Encounter Temporal Start Boundary

## Motivo da slice

A #400 fecha exclusivamente a integridade temporal de **entrada** de um appointment em `em_atendimento`.

Foi confirmado em produção um appointment real (`de857836-baa0-476f-bd7b-d6f52df33007`) com `data=2026-09-23` que nasceu `agendado` e foi iniciado em 2026-09-07 pelo próprio profissional autenticado e atribuído. `appointment_status_history.changed_by` e `audit_log.usuario_id` confirmam o mesmo ator normal da aplicação; não foi migration, postgres nem `service_role`.

O registro conhecido não possui `clinical_encounter_records`, `physiotherapy_evolutions`, `package_session_usage` nem `payments`. A causa estrutural é que os boundaries existentes verificavam role/identidade/capability/autoria/status, mas não impediam um profissional legitimamente atribuído de executar `agendado -> em_atendimento` quando `appointments.data` ainda era futura.

## Regra temporal canônica

Para atores normais autenticados da aplicação (`owner`, `admin` ou `professional` quando sujeitos aos demais boundaries clínicos):

```text
appointments.data > data operacional local atual
→ não pode ENTRAR em em_atendimento

appointments.data = data operacional local atual
→ pode seguir todas as regras clínicas já existentes
```

A #400 não adiciona comparação com `inicio`/`fim`: começar minutos ou horas antes no **mesmo dia** continua possível. A slice também não redefine a semântica de appointments de datas passadas.

Entrar em `em_atendimento` continua sendo ato clínico; owner/admin não recebem bypass temporal.

## Timezone escolhido

`clinics` não possui hoje timezone canônico por tenant. O projeto, porém, já possui convenção operacional explícita para appointment `data`/`hora`: `supabase-migrations/20260901_fix_message_selection_timezone.sql` documenta que esses campos são componentes locais e usa `timezone('America/Sao_Paulo', now())` como horário operacional da clínica.

A #400 reutiliza essa convenção existente através do helper interno:

`current_clinic_operational_date()`

que retorna:

```sql
timezone('America/Sao_Paulo', now())::date
```

A slice não cria configuração de timezone por clínica nem usa `current_date` dependente do timezone da sessão.

## Boundary PostgreSQL

A migration adiciona a função trigger dedicada:

`guard_appointment_encounter_temporal_start()`

com dois pontos de entrada:

- `BEFORE INSERT` — impede appointment futuro de nascer diretamente em `em_atendimento` por ator normal;
- `BEFORE UPDATE OF status` — impede transição de qualquer outro status para `em_atendimento` quando `data` é futura.

A função só age quando a row **entra** em `em_atendimento`; rows fisicamente já nesse status não são reescritas, reparadas ou recusadas retroativamente pela migration.

Os triggers usam prefixo `trg_h_...`, mantendo a nova invariável depois dos guards existentes de status/autoria/mutação na ordem normal dos BEFORE triggers. Nenhum guard existente é redesenhado.

## Bypass interno controlado

A #400 preserva o mesmo modelo de manutenção controlada do appointment mutation boundary existente:

- JWT `service_role`; ou
- sessão direta confiável `postgres` / `supabase_admin` sem JWT de aplicação.

Esses caminhos continuam podendo criar/reparar estado para migration/manutenção auditável. Usuários normais autenticados não obtêm esse bypass por role operacional.

## Defense in depth no boundary #399

`can_apply_clinical_instrument_in_encounter(appointment_id, instrument_key)` já exigia:

- tenant correto;
- `appointments.professional_id = auth.uid()`;
- `status='em_atendimento'`;
- base authorization #399.

A #400 adiciona ao mesmo helper:

```text
appointments.data <= current_clinic_operational_date()
```

Assim, um registro legado, corrompido ou criado por operação interna que permaneça fisicamente `em_atendimento` com data futura retorna `false` para **Apply in Encounter**, mesmo antes de o dado ser reparado.

A #400 não altera `clinical_instrument_base_authorized`, `clinical_instrument_catalog`, PHQ-9/GAD-7, `nexus.*`, C-01…C-06, entrega remota nem persistência de resultados.

## Known invalid state em produção

O appointment conhecido abaixo **não é corrigido pela migration #400**:

```text
appointment_id = de857836-baa0-476f-bd7b-d6f52df33007
data           = 2026-09-23
status         = em_atendimento
```

O production verifier #400 valida somente o contrato instalado. Ele deliberadamente não consulta nem exige ausência de rows históricas futuras já em `em_atendimento`, portanto esse estado conhecido não transforma o verifier histórico em falso vermelho.

A reparação desse appointment deve ocorrer depois do rollout em uma operação separada, explícita e auditável, após confirmar o estado funcional esperado e preservar histórico/auditoria. A #400 não executa `UPDATE` corretivo de dados existentes.

## Auditoria de superfícies que tratam `em_atendimento` como Encounter ativo

### `guard_appointment_status_transition()`

Arquivo de origem efetiva: `supabase-migrations/20260909_clinical_authorization_reconciliation.sql`.

Usa `em_atendimento` como destino/origem do workflow e valida `clinical.attend` + autoria para início/finalização. A nova prevenção temporal roda na mesma mutação e impede novas entradas futuras. Um estado legado já fisicamente ativo não é saneado por esse guard; isso é intencional nesta slice.

### `assert_clinical_encounter_394_context()`

Arquivo: `supabase-migrations/20260910_clinical_encounter_record_foundation.sql`.

O boundary do Encounter Record considera próprio appointment `em_atendimento` + tenant + identidade/capabilities como contexto ativo. A prevenção #400 bloqueia novas entradas futuras, mas esse helper continua aceitando um estado legado futuro já fisicamente inválido. Não foi alterado porque a missão exige defense-in-depth especificamente no helper #399 e não autoriza redesenhar #394; o risco residual deve ser considerado na operação de reparação e em uma hardening slice própria se necessário.

### `can_apply_clinical_instrument_in_encounter()`

Arquivo original: `supabase-migrations/20260910_clinical_instrument_encounter_authorization.sql`; endurecido pela migration #400.

Era status-only em relação ao tempo. A #400 adiciona explicitamente a data operacional e, portanto, **não** aceita future-dated legacy `em_atendimento`.

### `require_evolution_before_appointment_finalize()` / finalização clínica

Origem efetiva: `supabase-migrations/20260909_clinical_authorization_reconciliation.sql`, além do fluxo canônico de Encounter Record #394.

Essas superfícies usam `OLD.status='em_atendimento'` como parte do contexto de finalização. A prevenção temporal protege novos estados, mas um legado futuro já ativo pode continuar alcançando guards posteriores se satisfizer os demais requisitos. A #400 não amplia escopo para reescrever finalização/histórico.

## UI — “Iniciar atendimento”

`src/components/AppointmentActionModal.tsx` expõe a ação a partir de `clinical.attend`, identidade do profissional atribuído e `canTransitionAppointmentStatus(...)`, mas não possui hoje check da data operacional.

`src/lib/appointmentWorkflow.ts` modela transições, não uma fonte canônica de timezone/data local. A auditoria não encontrou helper frontend existente que represente a convenção operacional `America/Sao_Paulo` de forma reutilizável.

Por isso a #400 **não cria uma segunda semântica temporal no browser**. A autoridade obrigatória fica no PostgreSQL. O alinhamento visual de “Iniciar atendimento” deve ser feito em slice de UX pequena depois que houver um helper frontend canônico compartilhado ou uma fonte server-derived adequada; não exige redesign da Agenda.

## Verificação

O gate dedicado PostgreSQL 16 cobre:

1. professional atribuído + `clinical.attend` + amanhã: deny;
2. professional atribuído + hoje: allow;
3. INSERT futuro direto em `em_atendimento` por ator normal: deny;
4. owner clínico atribuído: sem bypass temporal;
5. admin clínico atribuído: sem bypass temporal;
6. `service_role`: bypass de manutenção preservado;
7. postgres direto: bypass de manutenção preservado;
8. future physical `em_atendimento` + requisitos #399: `false`;
9. today active Encounter + requisitos #399: `true`;
10. cross-tenant: `false`;
11. outro profissional: `false`;
12. data passada: sem mudança de semântica.

A migration é aplicada duas vezes no mesmo banco descartável para provar replay-safety.

O production verifier é read-only:

```sql
BEGIN;
SET TRANSACTION READ ONLY;
...
ROLLBACK;
```

Ele valida helper de data operacional, trigger function, ambos os triggers e o defense-in-depth #399 sem exigir reparação de dados históricos.

## Rollout futuro

Somente após revisão e merge explícitos:

```text
merge
→ migration #400
→ verifier read-only #400
→ smoke de início no mesmo dia + bloqueio de data futura
→ reparação separada/auditável do known invalid state, se aprovada
```

A migration e a reparação do dado real são operações distintas. Este PR não toca produção.
