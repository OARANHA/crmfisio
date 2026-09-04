# MedicsPro Beta — ordem controlada de rollout

Este documento prepara o rollout do Beta Candidate. Ele não autoriza merge, deploy ou alteração de produção.

## Princípios

- fazer backup antes de qualquer alteração de banco;
- validar o estado atual antes de reaplicar migrations já presentes no ambiente;
- executar uma etapa por vez e só prosseguir após o verifier correspondente;
- não ativar enforcement de entitlements nesta entrega;
- não alterar conteúdo clínico protegido durante rollout;
- parar imediatamente em qualquer verifier vermelho ou anomalia financeira crítica.

## 1. Nexus — fundação antes das superfícies clínicas

A ordem canônica é:

1. `supabase-migrations/20260903_nexus_wave0_foundation.sql`
2. `supabase-migrations/20260903_nexus_wave0_hardening.sql`
3. `supabase-migrations/VERIFY_20260903_NEXUS_WAVE0_FOUNDATION.sql`
4. `supabase-migrations/20260903_nexus_eem_evidence.sql`

O Wave0 cria/garante os contratos que o frontend usa: `professional_type`, catálogo de capabilities, `professional_capabilities`, `nexus_evidence_sources`, `nexus_clinical_results`, `nexus_red_flags`, RLS e helpers server-side. O hardening torna o conteúdo/origem das red flags imutável após criação.

Antes de liberar uso clínico real, validar ainda:

- `nexus.eem` disponível para o profissional esperado;
- tenant A não acessa paciente/resultados de tenant B;
- resultado finalizado é imutável;
- red flag só pode ser reconhecida sem reescrever origem/conteúdo;
- seed EEM presente com `nexus-eem-2026-09-03`;
- PHQ-9/GAD-7, processor e red flags ponta a ponta;
- EEM e longitudinal com dados reais versionados.

## 2. Platform Admin — control-plane antes de runtime

Executar nesta ordem:

1. `supabase-migrations/20260904_platform_admin_governance.sql`
2. `supabase-migrations/VERIFY_20260904_PLATFORM_ADMIN_GOVERNANCE.sql`
3. `supabase-migrations/20260904_platform_automation_observability_security.sql`
4. `supabase-migrations/VERIFY_20260904_PLATFORM_AUTOMATION_OBSERVABILITY_SECURITY.sql`
5. `supabase-migrations/20260904_platform_clinic_entitlements.sql`
6. `supabase-migrations/VERIFY_20260904_PLATFORM_CLINIC_ENTITLEMENTS.sql`
7. `supabase-migrations/20260904_platform_entitlements_console.sql`
8. `supabase-migrations/20260904_clinic_entitlement_runtime_contract.sql`
9. `supabase-migrations/VERIFY_20260904_CLINIC_ENTITLEMENT_RUNTIME_CONTRACT.sql`

Depois:

- confirmar explicitamente o Platform Admin inicial;
- validar `/#/platform` sem vínculo clínico automático;
- seedar entitlements somente da clínica piloto;
- conferir `configured`, `enabled` e `effective` pela RPC read-only;
- manter enforcement desligado até verificação por clínica.

A função `medicspro-automation` só deve ser atualizada após governança/observabilidade existirem e os verifiers estarem verdes.

## 3. Financeiro — gate do piloto

Ordem:

1. executar `supabase-migrations/VERIFY_20260904_FINANCIAL_PILOT_READINESS.sql` como diagnóstico inicial;
2. executar `supabase-migrations/AUDIT_PILOT_FINANCIAL_CONSISTENCY.sql` e guardar o resultado;
3. se os dados estiverem consistentes, aplicar `supabase-migrations/20260904_finalized_appointment_financial_source_lock.sql`;
4. executar `supabase-migrations/VERIFY_20260904_FINALIZED_APPOINTMENT_FINANCIAL_SOURCE_LOCK.sql`;
5. repetir auditoria financeira;
6. executar os 10 cenários manuais de `docs/FINANCIAL_PILOT_ACCEPTANCE.md`.

Não liberar piloto se houver, entre outros, cobrança duplicada, atendimento finalizado sem origem financeira coerente, pacote consumido de forma incompatível, pagamento marcado como pago sem dados mínimos ou quebra de vínculo tenant/paciente.

## 4. Frontend e smoke test

Somente depois dos gates de ambiente:

1. deploy do frontend aprovado;
2. smoke test como Platform Admin;
3. smoke test como owner/admin de clínica;
4. smoke test como recepção;
5. smoke test como profissional clínico não psiquiatra;
6. smoke test como médico/psiquiatra com Nexus;
7. paciente real de teste: prontuário → Nexus → autoavaliação → EEM → longitudinal;
8. confirmar que finance/admin continuam respeitando permissões e não dominam a experiência clínica.

## Critério de parada

Qualquer falha em RLS/tenant boundary, capability clínica, imutabilidade de resultado, red flag, auditoria financeira ou verifier interrompe o rollout. Corrigir antes de avançar para a etapa seguinte.
