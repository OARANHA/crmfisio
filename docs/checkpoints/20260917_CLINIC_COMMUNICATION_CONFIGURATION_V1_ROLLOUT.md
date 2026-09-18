# MEDICSPRO — Clinic Communication Configuration V1 Production Checkpoint

> Data: 2026-09-17  
> Runtime canônico final: `main@28a79a795e3adb3e081aa2cb7dd2d7b8895b097b`  
> PRs: #512 (feature) + #513 (ACL hardening)

## Resultado

Clinic Communication Configuration V1 está **IMPLEMENTADO, MERGEADO, DEPLOYADO e VALIDADO EM PRODUÇÃO**.

## O que mudou

- `Configurações → Comunicação` passou a hospedar o painel clinic-scoped de automações;
- `/mensagens` ficou operacional, sem painel administrativo de automação;
- frontend valida `whatsapp.access` antes de expor controles;
- falha técnica permanece distinta de negação contratual;
- update de `automation_settings` exige retorno da linha realmente alterada, evitando sucesso falso sob RLS;
- policy `automation_settings_write_admin` exige:
  - mesma clínica;
  - role `owner|admin`;
  - `current_clinic_entitlement_allowed('whatsapp.access')`;
- ACL final da tabela:
  - `anon`: sem grants;
  - `authenticated`: `SELECT, INSERT, UPDATE`;
  - `authenticated DELETE=false`;
  - `service_role`: preservado.

## Evidência de validação

Feature #512:
- full suite local: 123 arquivos / 662 testes PASS;
- typecheck, lint, build, diff-check PASS;
- PG16 PASS;
- PG17.6 PASS;
- migration replay PASS;
- PR CI verde.

Hotfix #513:
- fixture passou a reproduzir os default privileges reais do Supabase self-hosted;
- PG16: ACL amplo reproduzido antes do hardening e verifier PASS depois;
- PG17.6 PASS;
- migration replay PASS;
- PR CI: 9 workflows PASS, incluindo workflow dedicado frontend + postgres-16.

## Rollout de produção

1. migration #512 aplicada com COMMIT;
2. primeiro production-safe verifier detectou `anon_automation_settings_privilege_leaked`;
3. investigação read-only confirmou default ACL amplo em `public`;
4. os 3 registros de `automation_settings` permaneceram intactos;
5. #513 foi implementada, validada, mergeada e aplicada;
6. production-safe verifier passou integralmente após #513.

Hash lógico de `automation_settings` antes e depois:

`7890b62aca7862e2eb767fecec5a5418`

Contagem final: 3 linhas.

## Runtime final

- frontend: running, restarts=0, OOM=false;
- banco: running, restarts=0, OOM=false;
- `/`: HTTP 200;
- `/config`: HTTP 200;
- `/mensagens`: HTTP 200;
- `/agenda`: HTTP 200;
- `/pacientes`: HTTP 200;
- bundle ativo contém os marcadores `Regras de comunicação da clínica` e `A configuração não pôde ser alterada com o acesso atual.`.

## Invariante

```text
PLATFORM ENTITLEMENT
        ↓
CLINIC CONFIGURATION
        ↓
USER AUTHORIZATION
```

Nenhuma camada concede silenciosamente a outra.

## Próximo passo seguro

O domínio Comunicação continua parcial. Antes de nova implementação, reauditar contratos reais para:

- conexão/configuração do provider WhatsApp;
- templates de comunicação;
- opt-in;
- NPS;
- provider/tenant health.

Não recriar `automation_settings`, entitlement ou um segundo configuration core.
