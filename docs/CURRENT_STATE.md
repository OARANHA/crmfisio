# MedicsPro — Current State

> **Este arquivo é um snapshot de continuidade. AGENTS.md contém as regras operacionais. Código/schema atuais prevalecem quando o snapshot envelhecer.**

**Data do snapshot:** 2026-09-10  
**Main no início desta sincronização:** `477cc0016235a2e440889a919854b08aa38e1d94`

## Produto e arquitetura em poucas linhas

MedicsPro é um SaaS multiprofissional para clínicas.

Combina ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente.

O fluxo central é **Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação**.

O núcleo clínico é compartilhado entre profissões.

`role` operacional não é profissão.

Papéis canônicos: `owner`, `admin`, `professional`, `recep`, `financeiro`.

`platform_admin` pertence a um domínio separado da clínica.

`professional_id` é a referência clínica canônica; `fisio_id` é compatibilidade residual onde ainda existir.

Atos clínicos exigem identidade/capability/autoria ou relação assistencial adequadas, não apenas role.

O novo atendimento usa um Encounter Record editável por appointment.

O profissional registra uma vez motivo/demandas, HDA, achados, avaliação, plano/conduta e observações.

Após revisão e confirmação humana, o Encounter Record materializa a Evolution oficial determinística e o appointment é finalizado.

Não existe uma segunda Evolution universal obrigatória no novo fluxo.

Encounter Record finalizado é histórico; correction/addendum auditável ainda não está implementado.

A finalização clínica não depende de sucesso de cobertura esperada.

`package_exhausted`, `package_expired` e `package_not_eligible` geram `appointment_financial_exception` sem consumo gratuito silencioso.

#389 resolve a exceção explicitamente: owner/admin `CHARGE|WAIVE`, financeiro `CHARGE`.

`PresentationContext = clinical | management` é apresentação/privacy shell, nunca autorização.

Professional é Consultório-only; owner/admin só alternam com identidade clínica válida + `clinical.attend`; recep/financeiro são Gestão-only.

Nexus é engine clínica especializada dentro do runtime MedicsPro e permanece médico-only/fail-closed.

`OARANHA/crmfisio` é o runtime/produto canônico.

`OARANHA/nexus` é upstream/laboratório de inteligência clínica.

`OARANHA/medicspro` é referência histórica obrigatória de UX/workflow, nunca fonte de arquitetura/autorização atual.

Regra institucional: **não portar o velho MedicsPro; absorver o que ele entendia bem sobre o profissional.**

## Marcos recentemente fechados

- #390 — Clinician Daily Home.
- #391 — Agenda Role-Aware V4.
- #392 — Clinical Encounter UX V4.
- #393 — Legacy Clinical Reconciliation V4.1.
- #394 — Encounter Clinical Record Foundation.
- #395 — Production-safe verifier read-only para #394.
- #396 — Consultório / Gestão Privacy Shell.
- Nexus C-01–C-06 hardening.
- #388 — separação finalização clínica × falha esperada de cobertura.
- #389 — resolução explícita de exceção financeira.

## Produção / migrations relevantes

### Confirmado em 2026-09-10

- `20260910_clinical_encounter_record_foundation.sql` (#394) **já foi aplicada em produção**.
- O verifier production-safe passou com `VERIFY #394 PRODUCTION OK`.
- Clinical Foundation passou.
- Clinical Authorization passou.
- Financial Exception Resolution #389 passou no ambiente verificado.

### Não reaplicar por causa deste snapshot

- não reaplicar a migration #394 apenas porque um documento antigo a descreva como futura;
- não executar o verifier comportamental `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_FOUNDATION.sql` como verifier direto de produção: ele depende do harness/fixtures;
- em produção, para inspeção read-only do #394, usar `VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_PRODUCTION.sql`;
- não usar a assertion histórica do verifier #388 que espera ausência da RPC criada posteriormente pelo #389 como verdade do schema atual.

O ledger/schema real de produção continua sendo autoridade para migrations anteriores; este snapshot não substitui uma inspeção de migration history.

## Evidência operacional conhecida

O smoke real do draft #394 comprovou:

- Encounter Record persistido;
- refresh/navegação preservaram conteúdo;
- revision do draft observada;
- antes da finalização: **1 record, 0 Evolutions, 0 payments, 0 financial exceptions** no cenário exercitado.

Não há evidência documental suficiente neste snapshot para afirmar a comprovação read-only pós-finalização desse mesmo smoke. Tratar isso como pendência curta até haver observação registrada.

Também não declarar smoke real de `CHARGE`/`WAIVE` como concluído sem evidência posterior.

## Pendências operacionais abertas

- prova read-only pós-finalização do smoke #394;
- smoke real das ações #389 `CHARGE` e `WAIVE`, se ainda não registrado;
- atualizar/versionar a assertion obsoleta do verifier #388;
- smoke visual/uso real de #396 e Encounter com profissionais reais;
- observabilidade suficiente para ampliar piloto com segurança.

## Decisões canônicas que não devem regredir

1. Encounter Record é a unidade editável do novo atendimento.
2. Evolution é a materialização oficial após confirmação humana.
3. Finalização clínica ≠ sucesso financeiro de cobertura.
4. PresentationContext ≠ autorização.
5. Parceiro/repasse ≠ role.
6. Consultório é privacy/presentation shell.
7. `professional_id` é a referência clínica canônica.
8. Nexus não é um segundo runtime e não é liberado por role/especialidade isolados.
9. Histórico finalizado não é reaberto/reescrito silenciosamente.
10. Foundations fechadas não devem ser reabertas sem evidência real.

## Próximos passos recomendados

1. fechar as evidências operacionais curtas #394/#389/#396;
2. pilotar e polir ergonomia do Encounter com profissionais reais;
3. construir **Cobertura deste atendimento** sem expor Financeiro global;
4. unificar Instrument Delivery para `Aplicar agora` + `Enviar ao paciente`;
5. entregar Prescription V1;
6. priorizar demais documentos médicos conforme piloto;
7. evoluir Finance Configuration para solo/equipe, categorias e parceiro %/fixo com histórico/effective dates;
8. remover fricção de onboarding e só então ampliar financeiro/integracões conforme evidência.

## Documentos especializados

- [`../AGENTS.md`](../AGENTS.md) — autoridade operacional.
- [`../PRODUCT_ROADMAP.md`](../PRODUCT_ROADMAP.md) — sequência estratégica.
- [`../TODO.md`](../TODO.md) — trabalho aberto.
- [`BETA_READINESS.md`](BETA_READINESS.md) — gates de beta.
- [`CLINICAL_ENCOUNTER_RECORD.md`](CLINICAL_ENCOUNTER_RECORD.md) — contrato do Encounter Record.
- [`PRESENTATION_CONTEXT.md`](PRESENTATION_CONTEXT.md) — Consultório/Gestão.
- [`CLINICAL_PILOT_ACCEPTANCE.md`](CLINICAL_PILOT_ACCEPTANCE.md) — aceite clínico.
- [`FINANCIAL_PILOT_ACCEPTANCE.md`](FINANCIAL_PILOT_ACCEPTANCE.md) — aceite financeiro.
- [`BETA_ROLLOUT_ORDER.md`](BETA_ROLLOUT_ORDER.md) — ordem operacional.
- [`BETA_RELEASE_CANDIDATE.md`](BETA_RELEASE_CANDIDATE.md) — release candidate/pilot evidence.
- [`../DEPLOY.md`](../DEPLOY.md) — implantação e rollout.

Quando este arquivo divergir do código/schema atuais, **não force o sistema a caber no snapshot**. Atualize o snapshot após verificar a fonte canônica.