# MedicsPro Beta — ordem controlada de rollout

**Estado em 2026-09-10.** Este documento organiza continuidade operacional. Ele não autoriza deploy ou alteração de produção por si só.

## Princípios

- inspecionar estado real antes de aplicar qualquer migration;
- nunca reaplicar migration já presente apenas porque um runbook antigo ainda a chama de futura;
- usar o verifier apropriado ao ambiente: comportamento isolado em CI ≠ verifier read-only de produção;
- executar uma mudança de produção por vez e guardar evidência observada;
- parar em qualquer falha de RLS/tenant, autorização, lifecycle, integridade financeira ou verifier;
- não transformar ausência de blocker técnico em UX/piloto validado.

## Foundations que já não são etapas de implantação nova

As foundations abaixo estão incorporadas ao estado canônico e não devem ser “reexecutadas como roteiro inicial” sem inspeção do ambiente:

- multi-tenant, roles e `platform_admin` separado;
- entitlements/configuração/autorização separados;
- Nexus C-01–C-06;
- Clinician Daily Home (#390);
- Agenda Role-Aware V4 (#391);
- Encounter UX (#392/#393);
- Encounter Clinical Record (#394);
- production-safe verifier (#395);
- Consultório / Gestão Privacy Shell (#396);
- Clinical Instrument Authorization Foundation (#399), com rollout de produção e smoke concluídos;
- Encounter Temporal Start Boundary (#400), com migration/verifier/smoke concluídos;
- finalização clínica × coverage exception (#388/#389).

## 0. Fechar evidências operacionais curtas

Antes de ampliar piloto:

1. reparar de forma separada e auditável o appointment future-active histórico `de857836-baa0-476f-bd7b-d6f52df33007`;
2. registrar a inspeção read-only pós-finalização do smoke #394, se ainda não houver evidência posterior;
3. executar/documentar smoke real `CHARGE` e `WAIVE` do #389, se pendente;
4. atualizar/versionar o verifier antigo #388 cuja assertion de ausência da RPC #389 ficou obsoleta;
5. executar smoke visual/uso real do privacy shell #396;
6. confirmar observabilidade suficiente para diagnosticar falhas de beta.

### Estado conhecido de produção

- migration `20260910_clinical_encounter_record_foundation.sql` (#394) aplicada em produção em 2026-09-10;
- verifier production-safe #394 passou com `VERIFY #394 PRODUCTION OK`;
- migration `20260910_clinical_instrument_encounter_authorization.sql` (#399) aplicada; verifier read-only, `admin-team`, frontend e smoke médico alinhados/validados;
- migration `20260910_encounter_temporal_start_boundary.sql` (#400) aplicada; verifier read-only e smoke real do bug passaram;
- o future-active histórico permanece fisicamente presente porque #400 não faz saneamento retroativo, mas o smoke provou que ele não autoriza Apply-in-Encounter e que uma nova tentativa futura é bloqueada;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou.

**Não reaplicar as migrations #394, #399 ou #400.**

Para inspeção do schema #394 instalado, usar `supabase-verifiers/VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql`. O arquivo `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_FOUNDATION.sql` pertence ao harness comportamental de 34 casos e não é verifier direto de produção.

O verifier #400 é read-only e valida contrato/guards; ele não deve ser usado como ferramenta de busca ou reparação de rows históricas.

## 1. Pilotar o ciclo clínico atual

Fluxo a observar:

**Meu dia/Agenda → iniciar/continuar appointment → Encounter Record → revisão humana → Evolution oficial → appointment finalizado**

Validar:

- appointment/paciente/profissional corretos;
- `professional_id` canônico;
- appointment futuro não consegue entrar em `em_atendimento` por ator normal;
- same-day continua permitido pelas demais boundaries clínicas;
- draft persistente e revision/conflito;
- ausência de segunda Evolution universal;
- histórico finalizado read-only;
- outro profissional sem ato clínico indevido;
- owner/admin clínico sem bypass administrativo;
- Nexus somente quando todas as boundaries médicas autorizarem.

O smoke de draft do #394 já comprovou persistência, refresh/navegação e estado pré-finalização (1 record, 0 Evolutions, 0 payments, 0 financial exceptions). Não declarar a inspeção pós-finalização como executada sem observação real.

## 2. Validar Consultório / Gestão em uso real

#396 é presentation/privacy shell, não autorização.

Validar:

- professional Consultório-only, sem ação de Gestão;
- owner/admin elegível alternando apenas quando identidade clínica válida + `clinical.attend`;
- owner/admin não clínico, recep e financeiro em Gestão-only;
- Financeiro global, CRM gerencial, Relatórios administrativos e Configurações ocultos em Consultório;
- URL direta continua sob guards reais e recebe privacy boundary;
- troca de contexto não altera role, JWT, tenant, RLS, capabilities, entitlements ou `canView`;
- preferência isolada por `user_id + clinic_id`;
- desktop/mobile e light/dark sem vazamento de chrome administrativo durante resolução.

Autoentrada automática no Consultório está fora do rollout atual.

## 3. Financeiro — semântica atual

Não usar mais “pacote esgotado/vencido bloqueia a finalização clínica” como cenário canônico.

Para `package_exhausted`, `package_expired` e `package_not_eligible`:

1. preservar a finalização clínica válida;
2. não consumir cobertura inválida gratuitamente;
3. registrar `appointment_financial_exception`;
4. resolver explicitamente conforme #389 quando necessário.

Resolução:

- owner/admin: `CHARGE|WAIVE`;
- financeiro: `CHARGE`;
- recep/professional: sem resolução.

Falhas financeiras inesperadas de integridade permanecem fail-closed e devem interromper o rollout.

## 4. Instrumentos clínicos — estado após #399/#400

A foundation de autorização já está em produção. Não reaplicar #399/#400 para começar a próxima slice.

Estado:

```text
[x] Clinical Instrument Authorization Foundation (#399)
[x] Encounter temporal defense (#400)
[ ] Clinician-Assisted Administration
[ ] Encounter Instrument UX
[ ] boundary remoto / Enviar ao paciente
```

`clinical.instrument.apply` não é `nexus.scales`; profissão/especialidade não fazem auto-grant. O próximo trabalho deve reutilizar a engine/versionamento/scoring existentes e criar a menor operação de administração assistida segura, sem relaxar C-01–C-06.

## 5. Próximas slices de produto no piloto

Depois das evidências curtas acima:

1. Encounter UX / physician ergonomics;
2. Cobertura deste atendimento;
3. Clinician-Assisted Administration → Encounter Instrument UX;
4. Prescription V1;
5. demais documentos médicos conforme evidência;
6. Finance Configuration (solo/equipe, categorias, parceiro %/fixo com histórico/effective dates);
7. onboarding/pilot friction;
8. financeiro avançado/integracões conforme necessidade observada.

Cada slice precisa de PR, CI e rollout próprios quando alterar comportamento/schema.

Timezone por tenant é follow-up obrigatório antes de expansão para clínicas fora do fuso operacional atual. `current_clinic_operational_date()` deve permanecer a abstração server-side dessa evolução.

## 6. Critério para ampliar o beta

Ampliar apenas quando:

- foundations críticas continuam verdes;
- smokes pendentes foram observados e registrados;
- não existem blockers P0/P1 de tenant/autorização/integridade;
- profissionais reais conseguem executar as jornadas principais com fricção aceitável;
- suporte/observabilidade permitem detectar e reverter problemas rapidamente.

## Critério de parada

Parar imediatamente diante de:

- cross-tenant leak;
- capability/identity bypass;
- início de Encounter futuro por ator normal;
- histórico clínico mutável indevidamente;
- duplicate Evolution/financial side effect;
- perda de finalização ou cobrança por erro inesperado;
- verifier vermelho que represente o schema/contrato atual;
- divergência de produção não compreendida.

Não “resolver” gate alterando fixture, verifier ou documentação para esconder um invariant real.
