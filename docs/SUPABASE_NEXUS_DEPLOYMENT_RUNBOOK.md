# Supabase self-hosted / Nexus — Deployment Runbook

## Objetivo
Aplicar a nova stack clínica do MedicsPro/Nexus no **Supabase self-hosted** sem depender da ordem alfabética dos arquivos, sem misturar deploy estrutural com seeds de evidência e sem executar mudanças clínicas sem gates verificáveis.

## Ambiente alvo MedicsPro
O Supabase do MedicsPro é self-hosted em Docker. O diretório operacional usado no servidor é:

```bash
cd /opt/supabase-medicspro/docker
```

Antes de qualquer execução, confirmar a composição real do ambiente em vez de assumir nomes de serviço/credenciais:

```bash
docker compose ps
docker compose config --services
```

O stack padrão costuma expor o banco como serviço `db`, mas o runbook **não trata isso como premissa**. Confirme o nome retornado por `docker compose config --services`.

Também confirme as variáveis do Postgres usadas pelo compose sem imprimir segredos em logs compartilhados. Quando necessário, consulte `.env` localmente no servidor.

## Regra principal
**Não executar `supabase-migrations/*.sql` cegamente em ordem lexical.** Há migrations com a mesma data cujo nome não representa a dependência real.

Exemplo crítico: `20260903_canonical_clinical_soap.sql` depende de funções de identidade/capability e de `nexus_clinical_results`; portanto deve ser aplicada somente depois de Identity + Nexus Wave 0.

## Convenção de execução self-hosted
Depois de confirmar serviço, usuário e database, defina variáveis locais somente na sessão administrativa. Exemplo quando o serviço for `db` e o database operacional for `postgres`:

```bash
DB_SERVICE=db
DB_USER=postgres
DB_NAME=postgres
```

Teste conectividade antes de qualquer DDL:

```bash
docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c 'select current_database(), current_user, version();'
```

Para aplicar um arquivo presente no host:

```bash
docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < /CAMINHO/arquivo.sql
```

`ON_ERROR_STOP=1` é obrigatório. Se uma instrução falhar, o rollout deve parar naquele gate.

> Importante: as migrations estão no repositório da aplicação, não necessariamente dentro de `/opt/supabase-medicspro/docker`. Antes do rollout, use o checkout/artefato revisado da branch aprovada e confirme o caminho absoluto dos arquivos SQL.

## Fase A — Preflight do ambiente existente
1. identificar o checkout exato/commit que será aplicado;
2. confirmar `docker compose ps` saudável;
3. executar `VERIFY_CORE_REAL.sql`;
4. confirmar existência/shape de `clinics`, `profiles`, `patients`, `appointments` e funções base;
5. confirmar `pgcrypto`/UUID necessários;
6. verificar espaço em disco e saúde do Postgres;
7. gerar backup lógico antes de qualquer alteração clínica estrutural.

### Backup mínimo antes do rollout
Após confirmar usuário/database:

```bash
BACKUP="/root/medicspro-pre-nexus-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T "$DB_SERVICE" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP"
ls -lh "$BACKUP"
```

Não avançar se o `pg_dump` falhar ou o arquivo resultar vazio.

### Preflight SQL
Exemplo:

```bash
docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < /CAMINHO/supabase-migrations/VERIFY_CORE_REAL.sql
```

## Fase B — Identidade e isolamento
1. `20260903_identity_access_hardening.sql`
2. `VERIFY_20260903_IDENTITY_ACCESS_HARDENING.sql`

Gate: `current_clinic_id()` e `current_app_role()` devem existir e resolver somente perfil ativo.

Aplicação:

```bash
docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < /CAMINHO/supabase-migrations/20260903_identity_access_hardening.sql
docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < /CAMINHO/supabase-migrations/VERIFY_20260903_IDENTITY_ACCESS_HARDENING.sql
```

## Fase C — Nexus Wave 0
1. `20260903_nexus_wave0_foundation.sql`
2. `20260903_nexus_wave0_hardening.sql`
3. `VERIFY_20260903_NEXUS_WAVE0_FOUNDATION.sql`

Gate obrigatório:
- capabilities disponíveis;
- `nexus_clinical_results`, `nexus_red_flags` e `nexus_evidence_sources` com RLS ativo;
- resultado finalizado imutável;
- red flag reconhecida imutável;
- teste Clinic A x Clinic B sem vazamento.

## Fase D — SOAP canônico
1. `20260903_canonical_clinical_soap.sql`
2. `20260903_canonical_clinical_soap_hardening.sql`
3. `VERIFY_20260903_CANONICAL_CLINICAL_SOAP.sql`

Gate obrigatório:
- somente autor com `clinical.soap` cria/assina;
- `signed_at` e `signed_by` definidos pelo servidor;
- nota assinada imutável;
- adendo referencia nota assinada do mesmo paciente/clínica;
- import Nexus -> SOAP exige resultado finalizado e revisão explícita.

## Fase E — Seeds de evidência Nexus
Somente depois da tabela `nexus_evidence_sources` existir:
1. `20260903_nexus_phq9_seed.sql`
2. `20260903_nexus_cssrs_evidence.sql`
3. `20260903_nexus_gad7_evidence.sql`
4. `20260903_nexus_hcl32_evidence.sql`
5. `20260903_nexus_alcohol_scales_evidence.sql`
6. `20260903_nexus_mental_health_batch2_evidence.sql`
7. `20260903_nexus_runtime_final_scales_evidence.sql`
8. `20260903_nexus_eem_evidence.sql`
9. `20260904_nexus_meem_evidence.sql`
10. `20260904_nexus_egfr_evidence.sql`
11. `20260904_nexus_cv_risk_evidence.sql`
12. `20260904_nexus_antidepressant_switch_evidence.sql`

Gate: seeds devem ser aditivos/idempotentes e não alterar resultados clínicos históricos.

## Fase F — Autoaplicação segura
1. `20260904_nexus_self_assessment_secure.sql`
2. `20260904_nexus_self_assessment_hardening.sql`
3. `VERIFY_20260904_NEXUS_SELF_ASSESSMENT.sql`

Gate obrigatório:
- banco armazena somente hash do token;
- link expirado/revogado/submetido não pode ser reutilizado;
- `scaleKey` e `ruleVersion` do payload devem corresponder ao convite;
- payload precisa conter `answers` objeto + `selectedOptions` array;
- paciente deletado/anonimizado não recebe convite;
- submissão pública não cria `nexus_clinical_results` diretamente.

### Limite conhecido antes do processador server-side
A RPC de criação ainda recebe `scale_key`/`rule_version` do cliente autenticado. Ela não cria resultado clínico e a submissão exige correspondência com o convite, mas o processamento final **deve validar novamente** instrumento e versão contra o catálogo clínico server-side antes de materializar `nexus_clinical_results`. Não promover autoaplicação a fluxo clínico final até esse processador existir.

## Fase G — Platform Admin e módulos não clínicos
`20260903_platform_provisioning.sql`, financeiro, assessment engine e demais migrations devem ter rollout próprio, com seus respectivos `VERIFY_*` e smoke tests. Não são pré-requisito para a fundação Nexus, embora façam parte do MVD.

## Testes adversariais obrigatórios antes de piloto
- Clinic A não lê/escreve paciente, resultado, SOAP ou red flag da Clinic B.
- Owner/admin sem capability clínica não assina SOAP nem cria resultado clínico.
- Profissional de uma clínica não pode forjar `professional_id`, `clinic_id` ou `appointment_id` de outra clínica.
- Resultado Nexus finalizado não pode ser editado.
- SOAP assinado não pode ser editado; correção somente por adendo.
- Red flag reconhecida não pode ter origem/conteúdo reescrito.
- Token público inválido/expirado/revogado/reutilizado não revela contexto clínico.

## Rollback
As migrations clínicas estruturais criam tabelas/funções e podem coexistir com o legado. O rollback preferencial durante staging é **restaurar o backup lógico em ambiente descartável** ou corrigir por migration forward; não executar `DROP` manual improvisado em produção.

Antes de produção, registrar:
- commit aplicado;
- backup criado;
- horário de início/fim;
- output dos `VERIFY_*`;
- smoke tests executados;
- decisão de prosseguir/parar em cada gate.

## Política de rollout
1. ambiente controlado/staging self-hosted;
2. backup;
3. rodar uma migration por vez;
4. rodar `VERIFY_*` imediatamente após cada bloco;
5. executar smoke test da UI/RPC correspondente;
6. parar no primeiro gate com falha;
7. produção apenas depois de repetir o conjunto de gates críticos.

## Estado atual
Este runbook organiza e endurece a stack no repositório. **Não prova que as migrations já foram executadas no Supabase self-hosted real.** A aplicação e os testes reais devem ser registrados separadamente por ambiente.
