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
- finalização clínica × coverage exception (#388/#389).

## 0. Fechar evidências operacionais curtas

Antes de ampliar piloto:

1. **fechado em 2026-09-15:** inspeção read-only pós-finalização do smoke #394 observada em produção, com Record/Evolution/appointment/financeiro consistentes e sem exceção financeira;
2. **fechado tecnicamente em 2026-09-15:** `CHARGE` e `WAIVE` exercidos em produção com autenticação real dentro de transações revertidas, idempotência e ausência de resíduos; a exceção real continua decisão econômica;
3. **fechado em 2026-09-15:** revalidar a composição do verifier #388 com #389 em PostgreSQL 16; o gate passou antes e depois da migration #389, com controles negativos preservados;
4. executar smoke visual/uso real do privacy shell #396;
5. confirmar observabilidade suficiente para diagnosticar falhas de beta.

### Estado conhecido do #394

- migration `20260910_clinical_encounter_record_foundation.sql` aplicada em produção em 2026-09-10;
- verifier production-safe passou com `VERIFY #394 PRODUCTION OK`;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou.

**Não reaplicar a migration #394.**

Para inspeção do schema instalado, usar `supabase-verifiers/VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql`. O arquivo `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_FOUNDATION.sql` pertence ao harness comportamental de 34 casos e não é verifier direto de produção.

## 1. Pilotar o ciclo clínico atual

Fluxo a observar:

**Meu dia/Agenda → iniciar/continuar appointment → Encounter Record → revisão humana → Evolution oficial → appointment finalizado**

Validar:

- appointment/paciente/profissional corretos;
- `professional_id` canônico;
- draft persistente e revision/conflito;
- ausência de segunda Evolution universal;
- histórico finalizado read-only;
- outro profissional sem ato clínico indevido;
- owner/admin clínico sem bypass administrativo;
- Nexus somente quando todas as boundaries médicas autorizarem.

O smoke de draft do #394 comprovou persistência, refresh/navegação e estado pré-finalização (1 record, 0 Evolutions, 0 payments, 0 financial exceptions). Em 2026-09-15, leitura real e estritamente read-only fechou a outra metade: o único Record estava `finalized`, com Evolution única/ativa e corretamente vinculada, appointment `finalizado`, um único lançamento financeiro coerente e zero exceção financeira.

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

A #478 adicionou autoentrada somente após handoff explícito de iniciar/continuar o próprio Encounter; ela não é inferida por rota/query nem concede autorização.

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

## 4. Próximas slices de produto no piloto

Depois das evidências curtas acima:

1. Encounter UX / ergonomia observada com profissionais reais;
2. [x] correction/addendum auditável para Encounter Record finalizado (#481);
3. [x] histórico neutro de instrumentos clinician-assisted (#482);
4. **Instrument Delivery remota (`Enviar ao paciente`) — próxima slice;** `Aplicar agora` já está entregue;
5. documentos clínicos ainda ausentes conforme evidência;
6. Finance Configuration (solo/equipe, categorias, parceiro %/fixo com histórico/effective dates);
7. onboarding/pilot friction;
8. financeiro avançado/integracões conforme necessidade observada.

Cada slice precisa de PR, CI e rollout próprios quando alterar comportamento/schema.

## 5. Critério para ampliar o beta

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
- histórico clínico mutável indevidamente;
- duplicate Evolution/financial side effect;
- perda de finalização ou cobrança por erro inesperado;
- verifier vermelho que represente o schema/contrato atual;
- divergência de produção não compreendida.

Não “resolver” gate alterando fixture, verifier ou documentação para esconder um invariant real.
