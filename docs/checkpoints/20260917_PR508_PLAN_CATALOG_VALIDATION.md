# PR #508 — Plan Catalog + Clinic Plan Assignment V1 — checkpoint de validação

Data: 2026-09-17

## Estado canônico

- Base: `main@6796269d9372ecbc65f8a526550767c72a33e042`
- Branch: `feat/platform-plan-catalog-assignment-v1`
- PR: `#508`
- Head funcional remoto: `3ebcf3e3c3eee559fae7d2db0fdb684953e33144`
- Árvore funcional: `7802e9f55eefb8bbbe0066876b71f6f8c0916aaf`
- CI final do head funcional: `9/9 PASS`

## Implementado

Plan Catalog versionado e imutável, assignment ativo/trial por clínica, baseline dos seis entitlements atuais, histórico/audit e UI mínima do Platform Admin.

Precedência efetiva: `override explícito → plano ativo/trial → rollout legado`.

`platform_clinic_entitlements` permanece a camada de override. Plano/entitlement não concede role, capability, identidade clínica ou acesso a prontuário.

Os predicados dedicados de Nexus e `assessments.custom` continuam fail-closed. Nexus continua dependendo separadamente de identidade médica e capability; custom assessment continua sem rollout legado.

## Segunda revisão adversarial

O frontend ficou compatível com backend N/N+1 para evitar quebra caso o auto-deploy do frontend anteceda a migration manual:

- V3 cai para V2 somente quando o RPC V3 está explicitamente ausente;
- erros de autorização/rede não são mascarados;
- ações de Plan Catalog permanecem indisponíveis até os RPCs N+1 existirem;
- Nexus e custom assessment sem baseline aparecem bloqueados.

## Evidência

- PostgreSQL 16 migration replay + verifier: PASS
- hardening Nexus/custom assessment: PASS
- Evolution worker boundary: PASS
- rolling-deploy boundary: `3/3 PASS`
- full suite: `121 arquivos / 654 testes PASS`
- typecheck/lint/build/diff-check: PASS
- GitHub Actions: `9/9 PASS`

## Estado operacional

- IMPLEMENTADO: sim
- MERGEADO: não
- DEPLOYADO: não
- VALIDADO EM PRODUÇÃO: não
- migration de Plan Catalog: não aplicada em produção
- Evolution worker deste slice: não promovido

## Próximo passo seguro

Revisar threads/reviews/mergeability e o contrato real de deploy. Merge e rollout são etapas distintas. A migration continua manual/controlada após merge; não aplicar produção antes do precheck operacional.
