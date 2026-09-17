# #508/#509 — Plan Catalog + Clinic Plan Assignment V1 — rollout produtivo

Data: 2026-09-17

## Estado canônico

- #508 squash merge: `d9ec815d6450328ec7f4081067dc4dc041e0e302`
- #509 production-safe verifier squash merge: `51300dae05c0f90d03d6ed4e8790421037a6b009`
- árvore canônica no rollout: `d3a11e25afe4c7c3a8d4e079954f722c10d9a37f`
- PR CI #508: `9/9 PASS`
- PR CI #509: `9/9 PASS`
- PostgreSQL de produção: `17.6`

## Implementado

Plan Catalog versionado e imutável, assignment ativo/trial por clínica, baseline dos seis entitlements atuais, histórico/audit e UI mínima do Platform Admin.

Precedência efetiva: `override explícito → plano ativo/trial → rollout legado`.

`platform_clinic_entitlements` permanece camada de override. Plano/entitlement não concede role, capability, identidade clínica ou acesso a prontuário. Os predicados dedicados de Nexus e `assessments.custom` continuam fail-closed.

## Rolling deploy provado

O frontend #508 foi auto-promovido antes da migration e permaneceu saudável contra backend N. O bundle exibiu `Catálogo aguardando promoção do backend` e manteve ações de plano indisponíveis até os RPCs N+1 existirem. Após a migration, o mesmo frontend passou a encontrar o contrato novo sem redeploy manual.

## Rollout produtivo

- migration `20260917_platform_plan_catalog_assignment_v1.sql`: `COMMIT`;
- verifier #509: `SET TRANSACTION READ ONLY` / `ROLLBACK` e PASS;
- estado após migration: `plans=0`, `versions=0`, `assignments=0`;
- overrides preexistentes: `13 manual`, `0 plan`;
- hash lógico dos overrides antes/depois: `691ebb17dd4683a1dc699881cbf49ab6` — idêntico;
- Evolution worker: promovido por bind mount atômico, hash live/container/repo `7fc4b02a3c1bc229f45b98633e8e79fcf36bdebdbc1eaacddc36e293f1af334a`;
- worker sem segredo: HTTP `401`;
- fila elegível/stale durante smoke: `0/0`;
- Edge Runtime: healthy, `restarts=0`, `OOM=false`;
- frontend: `/`, `/platform`, `/agenda`, `/pacientes` HTTP `200`, `restarts=0`, `OOM=false`;
- actor-boundary read-only: Platform Admin lê catálogo + 6 entitlements; tenant normal é negado;
- `beta-operability-check.sh`: `RC=0`, `no_critical_failure`.

## Estado operacional

- IMPLEMENTADO: sim
- MERGEADO: sim
- DEPLOYADO: sim
- VALIDADO EM PRODUÇÃO: sim
- primeiro plano comercial criado: **não**
- primeiro assignment real criado: **não**

A ausência de planos é deliberada: nomes, preço e composição são decisão comercial de produto e não devem ser inventados por engenharia. Os 13 overrides manuais existentes continuam governando as clínicas exatamente como antes até assignment explícito.

## Próximo passo seguro

Definir pacotes comerciais conscientemente antes do primeiro assignment real. A próxima slice técnica canônica do programa é **Clinic Configuration Core V1**.
