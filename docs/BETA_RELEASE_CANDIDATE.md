# MedicsPro Beta Release Candidate

Este documento consolida o estado de preparação da primeira composição beta visível do MedicsPro. Ele não autoriza merge, deploy ou alteração de produção.

## Produto visível incluído

- dashboard orientado ao profissional, com experiência Nexus-first para psiquiatria;
- entrada global Nexus dentro do MedicsPro;
- Nexus contextual no prontuário canônico do paciente;
- autoavaliações PHQ-9/GAD-7 com envio, status, resultado e red flags;
- EEM especializado canônico, preservando lógica clínica protegida e autoria do Dr. Adolfo Aranha;
- evolução longitudinal baseada em resultados clínicos finalizados/versionados;
- avaliações padrão / minhas avaliações e mapa corporal do engine genérico;
- Central do Platform Admin com governança, observabilidade, provisionamento e módulos por clínica;
- financeiro existente com gates e hardening preparados para piloto.

## Regras arquiteturais preservadas

`role != profession != capability != entitlement != clinic configuration`

- Platform Admin não é role de clínica;
- profissão personaliza UX, mas não concede autorização;
- entitlement não concede capability clínica;
- Nexus não cria paciente, prontuário, login ou mensageria paralelos;
- conteúdo clínico protegido não deve ser reescrito por integração visual;
- entitlements de runtime permanecem sem enforcement até seed e verifier por clínica.

## Gate técnico antes de merge

1. CI do HEAD final deve passar em testes, typecheck e build.
2. Não podem existir imports/rotas quebradas nas superfícies Nexus ou Platform Admin.
3. EEM deve continuar usando a implementação canônica e capability `nexus.eem`.
4. Longitudinal deve usar apenas resultados finalizados/versionados, sem reinterpretar histórico.
5. Nenhuma migration de produção deve ser aplicada durante a fase de preview.

## Gate Platform Admin para rollout

Aplicar em janela controlada e verificar, nesta ordem lógica:

1. governança de Platform Admin;
2. segurança/observabilidade das automações;
3. entitlements por clínica;
4. console de módulos por clínica;
5. contrato read-only de entitlement de runtime;
6. cadastro explícito do Platform Admin inicial;
7. seed explícito de entitlements da clínica piloto;
8. verifiers correspondentes;
9. somente depois disso considerar enforcement módulo a módulo.

## Gate Nexus para uso clínico real

- confirmar foundation Nexus já aplicada no ambiente alvo;
- aplicar/verificar evidence seed exigido pelo EEM quando necessário;
- confirmar capabilities profissionais esperadas;
- validar tenant boundary e acesso paciente A/B;
- validar PHQ-9/GAD-7 ponta a ponta incluindo processor e red flags;
- validar EEM, narrativa determinística e proposta ao SOAP sem sobrescrita silenciosa;
- validar longitudinal com dados reais versionados;
- manter itens da fila de revisão clínica bloqueados até revisão especialista.

## Gate financeiro para piloto

Arquivos consolidados nesta branch:

- `docs/FINANCIAL_PILOT_ACCEPTANCE.md`;
- `supabase-migrations/VERIFY_20260904_FINANCIAL_PILOT_READINESS.sql`;
- `supabase-migrations/AUDIT_PILOT_FINANCIAL_CONSISTENCY.sql`;
- `supabase-migrations/20260904_finalized_appointment_financial_source_lock.sql`;
- `supabase-migrations/VERIFY_20260904_FINALIZED_APPOINTMENT_FINANCIAL_SOURCE_LOCK.sql`.

Antes de liberar profissionais reais:

- aplicar o lock financeiro em janela controlada;
- rodar o verifier estrutural;
- executar as auditorias read-only;
- as consultas críticas devem retornar zero anomalias;
- executar os dez cenários manuais descritos no critério de aceite financeiro.

## Sequência recomendada de entrega

1. congelar o HEAD verde do preview beta;
2. revisar visualmente a composição;
3. obter autorização explícita de merge;
4. criar backup de produção;
5. aplicar migrations/verifiers necessárias em ordem controlada;
6. validar Platform Admin e clínica piloto;
7. validar Nexus e financeiro ponta a ponta;
8. fazer deploy do frontend aprovado;
9. smoke test por perfis: Platform Admin, owner/admin, recepção e profissional clínico;
10. somente então liberar o beta para profissionais convidados.

## Critério de Beta Candidate

A branch pode ser chamada de **Beta Candidate** quando o HEAD final estiver verde e todo trabalho restante depender apenas de autorização controlada de merge/deploy e validações de ambiente — não de nova arquitetura de produto.
