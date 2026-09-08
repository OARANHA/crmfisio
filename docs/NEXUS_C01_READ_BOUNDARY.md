# Nexus C-01 — boundary de leitura e rollout

## Escopo e evidência

Base auditada: `OARANHA/crmfisio@ebaa7fe6bda0739f8dbbc9a338873394885cfac7`, incluindo o `NEXUS_GAP_MAP.md` aprovado. Esta entrega trata somente C-01. Nenhuma migration foi aplicada em produção e o estado real do servidor não foi consultado. “Efetiva” abaixo significa resultado da sequência SQL versionada, confirmado pela reprodução das policies e helpers em PostgreSQL descartável; o verifier confirma o ambiente real quando o operador o executar.

A migration de vínculo assistencial de 07/09 substituiu as leituras endurecidas de 05/09 e reintroduziu alternativas `owner/admin OR clinical.patient_timeline OR nexus.access` (convites: `owner/admin OR nexus.scales`). Um owner não médico com acesso assistencial lia resultados, flags e respostas. O teste antes da correção reproduz `expected 0, got 1` para esse ator.

A correção exige, em cada linha: **mesma clínica E vínculo assistencial canônico E capability Nexus**. `has_professional_capability('nexus.access')` compõe identidade médica cadastral, entitlement vigente e grant/fallback autorizado. Convites exigem também `nexus.scales`. Nunca há alternativa entre vínculo e autorização Nexus.

Cada tabela recebe uma policy SELECT permissiva corrigida e uma guarda SELECT **RESTRICTIVE TO PUBLIC** com a mesma conjunção. A guarda é necessária porque policies permissivas coexistentes se combinam por OR; uma policy adicional SELECT/ALL não pode reabrir a leitura. Não há grants novos, remoção de dados, alteração de contratos de escrita ou novos recursos Nexus. Leituras exigidas pelo PostgreSQL durante UPDATE também ficam sujeitas ao boundary.

## Inventário de todas as policies Nexus e metadados de autorização

Todas as permissivas abaixo são `TO authenticated`. As três guardas novas são `TO PUBLIC`, restritivas, apenas SELECT.

| Tabela | Policy efetiva após C-01 | Comando / condição relevante | Fonte da última definição |
| --- | --- | --- | --- |
| nexus_clinical_results | nexus_results_read_care_relationship | SELECT: clínica E vínculo E nexus.access | 20260908_nexus_c01_read_boundary.sql |
| nexus_clinical_results | nexus_results_read_guard | SELECT restritiva: mesma conjunção | C-01 |
| nexus_clinical_results | nexus_results_insert_author | INSERT: clínica, autor autenticado, draft, capability da linha | 20260903_nexus_wave0_foundation.sql |
| nexus_clinical_results | nexus_results_update_author | UPDATE: mesmo autor/clínica, draft na origem; draft/finalized no destino, capability da linha | foundation |
| nexus_red_flags | nexus_red_flags_read_care_relationship | SELECT: clínica E vínculo E nexus.access | C-01 |
| nexus_red_flags | nexus_red_flags_read_guard | SELECT restritiva: mesma conjunção | C-01 |
| nexus_red_flags | nexus_red_flags_insert_author | INSERT: clínica e resultado draft de autoria do usuário | foundation |
| nexus_red_flags | nexus_red_flags_acknowledge | UPDATE: clínica, não reconhecido, nexus.access; destino reconhecido pelo usuário atual | 20260905_nexus_doctor_entitlement_hardening.sql |
| nexus_self_assessment_invites | nexus_self_assessment_care_read | SELECT: clínica E vínculo E nexus.access E nexus.scales | C-01 |
| nexus_self_assessment_invites | nexus_self_assessment_read_guard | SELECT restritiva: mesma conjunção | C-01 |
| nexus_evidence_sources | nexus_evidence_read_authenticated | SELECT: ativo E nexus.evidence; catálogo global sem dados de paciente | doctor_entitlement_hardening |
| capability_catalog | capability_catalog_read_authenticated | SELECT: catálogo ativo; metadados, não prontuário | foundation |
| professional_capabilities | professional_capabilities_read_scope | SELECT: mesma clínica e próprio grant ou owner/admin; metadados, não autorização implícita de leitura Nexus | foundation |

Não há policy DELETE nessas tabelas nem policy de escrita de convites para authenticated. As antigas `nexus_results_read_clinical`, `nexus_red_flags_read_clinical` e `nexus_self_assessment_staff_read` são removidas explicitamente. O verifier lista **todas** as policies presentes, incluindo eventuais políticas extras do servidor; estas precisam de revisão para drift de escrita, embora não contornem as guardas SELECT.

## Dependências e acessos que não passam por SELECT RLS comum

| Dependência | Definição efetiva auditada | Efeito |
| --- | --- | --- |
| current_clinic_id / current_app_role | 20260906_temporary_password_domain_boundary.sql | Perfil ativo, senha temporária resolvida, clínica não excluída e lifecycle active |
| current_nexus_medical_identity_valid | 20260905_nexus_doctor_entitlement_hardening.sql | Profissão médica, CRM, UF e registro presentes na clínica atual; validação cadastral, não consulta externa ao conselho |
| current_nexus_entitlement_allowed | mesmo arquivo | Entitlement explícito nexus.access habilitado e dentro de starts_at/expires_at |
| has_professional_capability | mesmo arquivo | Identidade e entitlement precedem grant/deny explícito; fallback legado continua inalterado |
| can_access_patient_clinical_record | 20260907_clinical_care_relationship_read_boundary.sql | Paciente não excluído na clínica; owner/admin aceitos pelo helper ou vínculo de agenda/autoria para fisio |

Os seis helpers são reutilizados sem reescrita. Migration e verifier comparam fingerprints exatos dos corpos auditados e conferem SECURITY DEFINER, STABLE, search_path fixo e EXECUTE. Um helper ausente, antigo ou customizado aborta a migration antes de alterar policies; não se deve remover essa checagem para “fazer passar”. Até diferença de comentário no corpo pede revisão explícita. O fingerprint detecta divergência, não substitui revisão de segurança. Roles de navegador com SUPERUSER/BYPASSRLS também são rejeitados.

C-06 permanece: o helper de vínculo retorna false para `professional`, mesmo com CRM, grants Nexus e agenda; o fallback de capability também ainda contém `fisio`. O teste documenta esse bloqueio, sem introduzir novo consumer legado no produto. Os positivos cobrem médicos legados com vínculo e médicos owner/admin com grants explícitos. Owner/admin sem identidade médica são sempre bloqueados. Corrigir a compatibilidade `professional` é missão separada, com impacto alto, esforço médio e risco médio; não converter usuários de volta a fisio para contornar o bloqueio.

Consumidores diretos: `src/lib/nexusClinical.ts` lê resultados/flags por `.from(...)`; histórico e contexto do paciente herdam o bloqueio no banco. O fluxo de convites lê `nexus_self_assessment_invites`. Menu/rota não são fronteira de segurança.

RPCs SECURITY DEFINER conservam sua autorização própria: `create_nexus_self_assessment_invite` e `validate_nexus_result_context` têm última definição em `20260906_nexus_appointment_authorship_boundary.sql`; `finalize_nexus_eem_result` em `20260906_nexus_eem_atomic_finalization.sql`; resolve/submit públicos e claim/complete internos em `20260906_nexus_clinic_lifecycle_boundary.sql`; release de claim em `20260904_nexus_self_assessment_processor.sql`. Resolve retorna apenas metadados do convite via token opaco; submit recebe respostas. Não são um SELECT público do prontuário. Claim/complete/release são reservados ao service_role. Essas funções e triggers de autoria/imutabilidade não são modificados nem considerados validados integralmente por esta suite de leitura. Service role e proprietários/superusuários do banco continuam fora de RLS comum; nunca são identidades de navegador.

## Testes reproduzíveis e limites

`build-nexus-c01-sql-test.py` extrai do repositório o DDL Nexus, as últimas definições dos seis helpers e todos os CREATE/DROP POLICY nas seis tabelas auditadas. Dependências externas têm schema reduzido; auth.uid lê um subject sintético. Não há mock booleano de autorização. As consultas rodam com SET ROLE authenticated/anon e SECURITY INVOKER. Não é um replay completo do Supabase nem teste E2E de Auth/PostgREST, token RPCs ou escrita.

| Cenário | Resultados / flags / convites |
| --- | --- |
| Médico cadastralmente válido, entitlement, capability e vínculo | 1 / 1 / 1 do tenant correto |
| Médico owner e médico admin, ambos com grants explícitos | 1 / 1 / 1 |
| Médico com vínculo, entitlement ausente, desabilitado, futuro ou expirado | 0 / 0 / 0; restauração volta a permitir |
| Não médico com vínculo, timeline e grants Nexus | 0 / 0 / 0 |
| Owner/admin não médicos com grants | 0 / 0 / 0 |
| Recepção e financeiro com grants | 0 / 0 / 0 |
| Médico inativo, senha temporária pendente ou registro CRM vazio | 0 / 0 / 0 |
| Clínica suspensa | 0 / 0 / 0 |
| Médico sem vínculo, mesmo com entitlement e grants | 0 / 0 / 0 |
| Deny explícito nexus.access | 0 / 0 / 0 |
| Deny explícito nexus.scales | 1 / 1 / 0 |
| Outro tenant autorizado | Somente suas próprias linhas; zero IDs da clínica alvo |
| Anônimo, inclusive com SELECT concedido na fixture | Zero linhas ou insufficient_privilege; nunca dados |
| Authenticated sem subject | 0 / 0 / 0 |
| Policy adicional ALL USING(true) TO PUBLIC | Negativos continuam bloqueados; positivos e isolamento preservados |
| professional médico com grant e agenda | 0 / 0 / 0: limitação C-06 preservada |

A migration é aplicada duas vezes na suite. O harness exige que o teste antes da correção falhe especificamente no owner não médico. O verifier precisa falhar se a guarda for removida; a migration precisa falhar se um helper divergir. O workflow `.github/workflows/nexus-c01-rls.yml` executa o harness em PostgreSQL 16 descartável. Para repetir localmente, criar um banco vazio `nexus_c01_test` em PostgreSQL local e usar:

```bash
PGHOST=127.0.0.1 PGDATABASE=nexus_c01_test PGUSER=postgres bash scripts/test-nexus-c01.sh
```

Usar a autenticação configurada para esse banco local. Nunca apontar fixtures/testes para o banco do produto.

Validação local: reprodução SQL antes/depois e verifier aprovados em PGlite (PostgreSQL WASM); o ambiente local não possui servidor PostgreSQL/psql/Docker. O job de CI usa PostgreSQL 16 nativo e é o gate adicional do PR. Os resultados do CI são informados no PR, sem confundir execução local com servidor real. Também passaram localmente `npm ci --no-audit --no-fund`, `npm test` (39 arquivos / 166 testes), `npm run typecheck`, `npm run lint` e `npm run build`; permanece o aviso preexistente de chunk grande. Os testes adversariais locais confirmaram rejeição de guarda ausente e helper alterado pelo verifier, além de abortar a migration com helper divergente.

## Comandos exatos no servidor, somente após o merge

Executar como operador com acesso Docker ao Supabase self-hosted já descrito em DEPLOY.md. O bloco obtém uma única revisão da main, baixa somente os dois SQL e confere os bytes desta entrega antes de executar. Requer git, curl e sha256sum no host. Não executar todas as migrations por glob.

```bash
set -euo pipefail
NEXUS_C01_DIR="$(mktemp -d /tmp/medicspro-nexus-c01.XXXXXX)"
NEXUS_C01_REV="$(git ls-remote https://github.com/OARANHA/crmfisio.git refs/heads/main | awk '{print $1}')"
test "${#NEXUS_C01_REV}" -eq 40
curl -fLsS "https://raw.githubusercontent.com/OARANHA/crmfisio/${NEXUS_C01_REV}/supabase-migrations/20260908_nexus_c01_read_boundary.sql" -o "${NEXUS_C01_DIR}/20260908_nexus_c01_read_boundary.sql"
curl -fLsS "https://raw.githubusercontent.com/OARANHA/crmfisio/${NEXUS_C01_REV}/supabase-migrations/20260908_verify_nexus_c01_read_boundary.sql" -o "${NEXUS_C01_DIR}/20260908_verify_nexus_c01_read_boundary.sql"
cd "${NEXUS_C01_DIR}"
sha256sum -c <<'CHECKSUMS'
faf2ef152fc617d7ae4477b34e5aa6a603134e6c419c793f4f1852be672b2569  20260908_nexus_c01_read_boundary.sql
772f3faad67ec6cb25e14209d8f8b15c1bcad769cfa96b741e926d0900dfa47d  20260908_verify_nexus_c01_read_boundary.sql
CHECKSUMS
docker exec -i supabase-db psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < 20260908_nexus_c01_read_boundary.sql
docker exec -i supabase-db psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < 20260908_verify_nexus_c01_read_boundary.sql
```

Sucesso exige ambos os comandos terminarem com código zero e o verifier imprimir `NEXUS_C01_VERIFIED`. Guardar o inventário de policies sem dados clínicos no registro operacional. Não há Edge Function a publicar, frontend a recompilar ou cache de schema a recarregar para efetivar RLS. O redeploy automático da aplicação não aplica esse SQL.

Em `nexus_c01_helper_drift`/`missing_helper`, a transação aborta sem alterar policies: comparar o helper citado com as migrations de origem acima e revisar as pendências do ambiente. Não reaplicar migrations antigas em massa nem remover a proteção. Em lock timeout, a transação também aborta; repetir o mesmo arquivo em janela apropriada. Uma falha do verifier após COMMIT exige investigar o drift e manter o Nexus indisponível para o piloto até correção. Não reverter às policies com OR: isso reabre o incidente. A estratégia é correção aditiva para frente; dados e snapshots permanecem intactos.
