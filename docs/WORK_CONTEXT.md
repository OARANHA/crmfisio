# MedicsPro — Work Context

Snapshot de handoff para execução assistida por ChatGPT Work.

> **Leia `AGENTS.md` primeiro e `docs/CURRENT_STATE.md` em seguida.** Este arquivo não substitui código, schema ou o banco real. Quando houver divergência, inspecione a implementação atual e corrija a documentação — não force o produto a obedecer um snapshot envelhecido.

## Fonte canônica

- **`OARANHA/crmfisio`** — runtime/produto canônico e único destino de implementação.
- **`OARANHA/nexus`** — upstream/laboratório de inteligência clínica; não é segundo runtime.
- **`OARANHA/medicspro`** — referência histórica obrigatória de UX/workflow para domínios equivalentes, nunca arquitetura/autorização atual.

Regra: **não portar o velho MedicsPro; absorver o que ele entendia bem sobre o profissional.**

## Produto atual

MedicsPro é SaaS multiprofissional para clínicas: ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente.

Fluxo central:

**Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação**

Papéis operacionais:

- `owner`
- `admin`
- `professional`
- `recep`
- `financeiro`

`platform_admin` é domínio separado. Role não é profissão. `professional_id` é referência clínica canônica; `fisio_id` é compatibilidade residual onde ainda existir.

Parceiro/repasse é relação econômica futura, não role/autorização.

## Foundations clínicas já fechadas

- #390 — Clinician Daily Home;
- #391 — Agenda Role-Aware V4;
- #392 — Clinical Encounter UX V4;
- #393 — Legacy Clinical Reconciliation V4.1;
- #394 — Encounter Clinical Record Foundation;
- #395 — production-safe verifier;
- #396 — Consultório / Gestão Privacy Shell;
- Nexus C-01–C-06.

Não descrever essas foundations como backlog a recriar sem evidência real de regressão.

## Encounter canônico

O Encounter Record é a unidade editável do novo atendimento.

Conteúdo:

- motivo/demandas;
- HDA/história atual;
- achados/exame;
- avaliação clínica/problemas;
- plano/conduta;
- observações.

Após revisão/confirmacão humana:

**Encounter Record → Evolution oficial determinística → appointment finalizado**

Não existe segunda Evolution universal obrigatória no fluxo novo. Finalized Encounter Record é histórico. Correction/addendum auditável ainda é futuro. Não criar backfill fictício.

## Produção #394

Em 2026-09-10:

- migration #394 aplicada em produção;
- production-safe verifier passou: `VERIFY #394 PRODUCTION OK`;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou.

O smoke de draft comprovou persistência, refresh/navegação e revision; antes da finalização havia 1 record, 0 Evolutions, 0 payments e 0 financial exceptions.

A prova read-only pós-finalização desse mesmo smoke não deve ser declarada concluída sem evidência posterior registrada.

## Financeiro

A afirmação antiga “pacote inválido bloqueia finalização clínica” está obsoleta.

Após #388:

- `package_exhausted`, `package_expired`, `package_not_eligible` são falhas esperadas de cobertura;
- uma finalização clínica válida pode permanecer concluída;
- registrar `appointment_financial_exception`;
- não consumir cobertura gratuitamente/silenciosamente.

#389 resolve explicitamente:

- owner/admin: `CHARGE|WAIVE`;
- financeiro: `CHARGE`;
- recep/professional: sem resolução.

O verifier antigo #388 possui uma assertion obsoleta sobre ausência da RPC criada depois pelo #389. Corrigir/versionar o verifier em slice própria; não enfraquecer a regra de negócio.

Smoke real CHARGE/WAIVE permanece pendente se não houver evidência posterior.

## Presentation Context

`PresentationContext = clinical | management` é presentation/privacy state.

**PresentationContext != authorization.**

- professional: Consultório-only;
- owner/admin: Consultório + Gestão apenas com identidade clínica válida + `clinical.attend`;
- recep/financeiro: Gestão-only.

Consultório oculta Financeiro global, CRM gerencial, Relatórios administrativos e Configurações. URL direta continua sob guards reais e recebe privacy boundary.

Trocar contexto não muda role, JWT, tenant, RLS, capability, entitlement ou `canView`. Preferência local isolada por `user_id + clinic_id`.

Autoentrada automática no Consultório ainda não existe.

## Nexus

Nexus já está integrado ao runtime MedicsPro. Não “integrar um produto Nexus separado”.

Boundary médico-only/fail-closed:

**entitlement + capability + identidade médica válida + relação assistencial + autorização server-side**

Especialidade informa relevância, não autorização. Não liberar por role.

Prescrição é workflow/documento MedicsPro; suporte de decisão medicamentosa pode pertencer ao domínio Nexus quando priorizado.

## Assessment

Assessment Engine já possui foundation estruturada. Avaliações padrão, modelos próprios e componentes como body map devem continuar no mesmo engine/versionamento/autoria, não virar prontuários paralelos por profissão.

## Próxima sequência recomendada

0. fechar smokes/observabilidade pendentes #394/#389/#396;
1. Encounter UX / physician ergonomics;
2. Cobertura deste atendimento;
3. Instrument Delivery (`Aplicar agora` + `Enviar ao paciente`);
4. Prescription V1;
5. demais documentos médicos conforme piloto;
6. Finance Configuration: solo/team, categorias, parceiro %/fixo com history/effective dates;
7. onboarding/pilot friction;
8. financeiro avançado/integracões conforme evidência.

## Protocolo para novo trabalho

1. ler `AGENTS.md`;
2. ler `docs/CURRENT_STATE.md`;
3. verificar `main` real;
4. inspecionar código/schema/testes relevantes;
5. comparar com histórico/upstream somente quando aplicável;
6. não criar caminho paralelo ao canônico;
7. implementar a menor slice segura;
8. validar e reportar apenas evidência realmente observada.

`main` é potencialmente deployável. Migrations/Edge Functions/produção exigem rollout explícito e autorização correspondente.