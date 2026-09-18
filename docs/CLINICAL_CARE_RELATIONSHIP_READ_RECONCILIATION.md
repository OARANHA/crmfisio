# MedicsPro — Clinical Care Relationship Read Reconciliation

> Registro canônico da reconciliação de leitura clínica pós-cutover multiprofissional.

**PR:** #426  
**Merge em main:** `1d02be1e4230ca1ab92aeaf2db237d5193ffbd3d`  
**Estado:** VALIDADO EM PRODUÇÃO  
**Validação de produção:** `CLINICAL CARE RELATIONSHIP READ RECONCILIATION VERIFY PASSED`

## Problema corrigido

Após o cutover operacional `fisio -> professional`, o boundary de leitura clínica ainda podia divergir do contrato canônico: a relação de agenda precisava ser derivada de `appointments.fisio_id`, o caminho de `professional` precisava exigir identidade clínica válida + `clinical.timeline.read`, e `list_patient_clinical_snapshot()` ainda mantinha uma enumeração local de roles.

## Contrato canônico atual

`public.can_access_patient_clinical_record(uuid)`:

- `owner/admin` ativos preservam leitura clínica no próprio tenant;
- `professional` exige identidade clínica válida;
- `professional` exige `clinical.timeline.read`;
- `professional` exige relação assistencial concreta;
- relação de agenda canônica usa `appointments.fisio_id`;
- autoria clínica existente continua podendo estabelecer relação assistencial;
- cross-tenant, usuário inativo, recepção, financeiro e contexto sem profile clínico falham fechado;
- `platform_admin` não recebe acesso clínico implícito.

`public.list_patient_clinical_snapshot()` não mantém whitelist própria de roles. Ele preserva somente contexto/tenant/paciente e delega a decisão de visibilidade ao helper canônico.

## Provas comportamentais

A matriz PostgreSQL 16 provou, entre outros cenários:

- `fisio_id = professional A` e `professional_id != A` => ALLOW quando os demais requisitos são válidos;
- presença somente em `professional_id`, sem `fisio_id` ou outra relação => DENY;
- ausência de `clinical.timeline.read` => DENY;
- ausência de relação assistencial => DENY;
- owner/admin ativos no mesmo tenant => ALLOW;
- recepção/financeiro => DENY e snapshot vazio;
- cross-tenant/inativo/contexto sem profile => DENY;
- leituras dependentes de avaliação, evolução, assessments, Body Map e Nexus permaneceram verdes.

## Continuidade

Esta reconciliação é prerequisite da D2-A / Clinical Documents Foundation. Novos domínios de leitura clínica devem reutilizar `can_access_patient_clinical_record()` em vez de recriar enumerações locais de role ou care relationship.

Não reintroduzir `professional_id` como relação de agenda canônica enquanto o schema/runtime de appointments mantiver `fisio_id` como vínculo operacional vigente.
