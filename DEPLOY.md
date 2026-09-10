# MedicsPro — Deployment Guide

## Estado atual

O frontend MedicsPro é publicado em container Docker e operado pelo **Portainer**.

- App: `https://app.medicspro.com.br`
- Supabase self-hosted: `https://supabase.medicspro.com.br`
- Supabase Studio: `https://studio.medicspro.com.br`
- Repositório canônico: `OARANHA/crmfisio`
- Branch potencialmente produtiva: `main`

> **Regra crítica:** trate qualquer merge em `main` como potencial deploy. Não use `main` para experimentação.

O estado de continuidade atualizado fica em `docs/CURRENT_STATE.md` e `docs/BETA_READINESS.md`.

## Arquitetura de deploy

### Aplicação

- React + TypeScript + Vite;
- build Docker;
- container servido por Nginx;
- stack operado via Portainer.

### Backend / dados

- Supabase self-hosted em stack própria;
- PostgreSQL, Auth, PostgREST e Edge Functions separados do frontend;
- migrations versionadas em `supabase-migrations/`;
- verifiers de rollout/contrato em `supabase-verifiers/` e scripts históricos onde ainda existirem;
- Edge Functions versionadas no repositório e implantadas de forma controlada.

## Variáveis de ambiente do frontend

No mínimo:

```text
VITE_SUPABASE_URL=https://supabase.medicspro.com.br
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Nunca colocar `service_role` no frontend, bundle ou repositório.

## Compatibilidade de rollout

Como o frontend pode ser atualizado pouco depois de um merge:

1. todo merge de código em `main` precisa estar deploy-safe;
2. migration incompatível não pode depender de frontend ainda não publicado;
3. preferir mudanças aditivas/backward-compatible e ordem explícita banco → verifier → app quando apropriado;
4. migrations devem ser versionadas e acompanhadas de verifier coerente com o ambiente;
5. Edge Functions precisam de paridade de versão quando o fluxo depender delas;
6. documentação pode acionar rebuild dependendo da configuração do stack, mas não deve alterar comportamento do produto.

## Fluxo recomendado

1. criar branch a partir do SHA conhecido de `main`;
2. implementar a menor slice coerente;
3. rodar os gates aplicáveis;
4. abrir PR;
5. revisar frontend, banco, Edge Functions, RLS/RPC, compatibilidade e rollback;
6. obter autorização explícita para mudanças de produção quando necessário;
7. aplicar banco/Edge Functions na ordem aprovada;
8. rodar verifier correto;
9. fazer merge/deploy somente quando a composição estiver segura;
10. observar app/logs e executar o smoke realmente necessário.

Validação comum de frontend:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

## Migrations no Supabase self-hosted

Não tratar `supabase-schema.sql` como mecanismo contínuo de atualização de produção.

Boas práticas:

- inspecionar schema/migration history real antes de aplicar;
- não reaplicar migration já instalada porque um documento antigo a chama de futura;
- fazer backup/confirmar restore posture conforme risco;
- usar migration pinada a commit/hash quando a execução for manual;
- executar com parada em erro;
- rodar verifier apropriado imediatamente após mudança;
- preservar compatibilidade com frontend/runtime;
- não executar DDL/DML destrutivo sem plano explícito de recuperação.

### #394 — Encounter Clinical Record

Estado confirmado em **2026-09-10**:

- `supabase-migrations/20260910_clinical_encounter_record_foundation.sql` **já foi aplicada em produção**;
- o verifier production-safe passou com `VERIFY #394 PRODUCTION OK`;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou.

**Não reaplicar a migration #394.**

Existem dois verifiers com papéis diferentes:

- `supabase-verifiers/VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_FOUNDATION.sql` — behavior verifier do harness/CI, depende dos casos 1–34 e não deve ser executado diretamente em produção;
- `supabase-verifiers/VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql` — verifier read-only para inspeção do schema instalado em banco real.

O smoke de draft observou persistência, refresh/navegação e revision. Antes da finalização o cenário tinha 1 Encounter Record, 0 Evolutions, 0 payments e 0 financial exceptions.

A documentação atual **não declara** como concluída a inspeção read-only pós-finalização desse mesmo smoke sem evidência posterior. Registrar essa leitura quando executada.

### #388 / #389 — atenção ao verifier histórico

#388 definiu a separação entre finalização clínica e falhas esperadas de cobertura. #389 criou a resolução explícita de `appointment_financial_exception`.

O verifier antigo #388 possui uma assertion histórica esperando ausência da RPC que #389 adicionou depois. Essa assertion é obsoleta para o schema atual e deve ser atualizada/versionada antes de reutilização contra produção.

Não enfraquecer as demais invariantes de #388 para corrigir essa dívida do verifier.

## Finalização clínica × cobertura

Não usar runbooks antigos que esperam `package_exhausted`/`package_expired` bloquear a conclusão clínica.

Contrato atual:

- `package_exhausted`, `package_expired`, `package_not_eligible` → `appointment_financial_exception`;
- finalização clínica válida pode permanecer concluída;
- sem consumo gratuito silencioso;
- falha financeira inesperada de integridade permanece fail-closed.

Resolução #389:

- owner/admin: `CHARGE|WAIVE`;
- financeiro: `CHARGE`;
- recep/professional: sem resolução.

Smoke real CHARGE/WAIVE permanece pendente se não houver evidência posterior registrada.

## Consultório / Gestão (#396)

`PresentationContext` é frontend presentation/privacy state. Não requer migration e não altera role, RLS, capabilities, entitlements, JWT, tenant ou `canView`.

Após frontend que contenha #396, o smoke deve verificar:

- professional Consultório-only;
- owner/admin elegível alternando Consultório/Gestão;
- owner/admin não clínico, recep e financeiro Gestão-only;
- URL administrativa protegida pelos guards reais;
- nenhum chrome administrativo durante resolução fail-closed;
- preferência isolada por `user_id + clinic_id`.

Autoentrada automática no Consultório não faz parte do rollout atual.

## Provisionamento de clínicas e usuários

Não inserir identidades diretamente em `auth.users`.

- nova clínica + primeiro owner: fluxo server-side canônico de provisionamento;
- usuários adicionais: fluxo `admin-team` autorizado;
- `platform_admin` é domínio separado e não implica acesso aos dados clínicos/financeiros das clínicas;
- credenciais `service_role` permanecem server-side.

## Validação pós-deploy

Após atualização de comportamento:

1. abrir a aplicação;
2. validar login e tenant corretos;
3. validar role/identidade/entitlements esperados;
4. executar somente o smoke do fluxo alterado e dependências críticas;
5. conferir console e logs relevantes;
6. em mudança de banco/autorização/financeiro, rodar o verifier canônico apropriado;
7. registrar o que foi **realmente observado**.

## Segurança

- RLS/server authorization são boundaries; menu escondido ou PresentationContext não são autorização;
- não expor secrets em commits, logs ou comandos compartilhados;
- usar tokens/senhas somente em variáveis seguras/temporárias;
- dados clínicos e financeiros permanecem isolados por clínica;
- ações sensíveis são server-side, auditáveis e deny-by-default.

## Documentos relacionados

- `AGENTS.md`
- `docs/CURRENT_STATE.md`
- `docs/BETA_READINESS.md`
- `docs/BETA_ROLLOUT_ORDER.md`
- `docs/CLINICAL_ENCOUNTER_RECORD.md`
- `docs/CLINICAL_PILOT_ACCEPTANCE.md`
- `docs/FINANCIAL_PILOT_ACCEPTANCE.md`
- `PRODUCT_ROADMAP.md`
