# Supabase / Nexus — Deployment Runbook

## Objetivo
Aplicar a nova stack clínica do MedicsPro/Nexus no Supabase sem depender da ordem alfabética dos arquivos e sem misturar deploy estrutural com seeds de evidência.

## Regra principal
**Não executar `supabase-migrations/*.sql` cegamente em ordem lexical.** Há migrations com a mesma data cujo nome não representa a dependência real.

Exemplo crítico: `20260903_canonical_clinical_soap.sql` depende de funções de identidade/capability e de `nexus_clinical_results`; portanto deve ser aplicada somente depois de Identity + Nexus Wave 0.

## Fase A — Preflight do ambiente existente
1. `VERIFY_CORE_REAL.sql`
2. confirmar existência/shape de `clinics`, `profiles`, `patients`, `appointments` e funções base;
3. confirmar extensão necessária para UUID/pgcrypto no ambiente;
4. snapshot/backup lógico antes de qualquer alteração clínica estrutural.

## Fase B — Identidade e isolamento
1. `20260903_identity_access_hardening.sql`
2. `VERIFY_20260903_IDENTITY_ACCESS_HARDENING.sql`

Gate: `current_clinic_id()` e `current_app_role()` devem existir e resolver somente perfil ativo.

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

## Política de rollout
1. ambiente controlado/staging;
2. rodar migration;
3. rodar `VERIFY_*` imediatamente;
4. smoke test da UI/RPC correspondente;
5. somente então avançar para a próxima fase;
6. produção apenas depois de repetir o conjunto de gates críticos.

## Estado atual
Este runbook organiza e endurece a stack no repositório. **Não prova que as migrations já foram executadas no Supabase real.** A aplicação e os testes reais devem ser registrados separadamente por ambiente.
