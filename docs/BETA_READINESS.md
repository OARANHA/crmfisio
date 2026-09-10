# MedicsPro — Beta Readiness

Documento vivo para acompanhar a preparação do MedicsPro para uso por profissionais reais.

## Legenda

- 🟢 **GREEN** — foundation/gate técnico validado para piloto controlado.
- 🟡 **YELLOW** — foundation existe, mas ainda depende de smoke, UX real, observabilidade ou validação operacional antes de ampliação.
- 🔴 **RED** — blocker conhecido.

## Estado em 2026-09-10

| Gate | Status | Evidência / próxima ação |
| --- | --- | --- |
| Multi-tenant / RLS | 🟢 | Isolamento por clínica e gates críticos verificados; manter auditoria contínua. |
| Papéis e identidade | 🟢 | `owner`, `admin`, `professional`, `recep`, `financeiro`; `platform_admin` separado; role != profissão; `professional_id` canônico. |
| Provisionamento / Platform Admin | 🟢 | Fluxos server-side e auditáveis já estabelecidos. |
| Entitlements / autorização | 🟢 | Entitlement, configuração e autorização permanecem conceitos separados; operações sensíveis continuam server-side. |
| Nexus C-01–C-06 | 🟢 | Engine integrada ao runtime, médico-only e fail-closed por entitlement + capability + identidade + relação assistencial + servidor. |
| Clinician Daily Home | 🟢 | #390 entregue. |
| Agenda role-aware | 🟢 | #391 entregue; comandos clínicos respeitam ator, appointment e boundaries existentes. |
| Encounter UX | 🟢 estrutural | #392/#393 entregaram workspace clínico dedicado e reconciliação do legado sem importar arquitetura/autorização antiga. |
| Encounter Clinical Record | 🟢 estrutural | #394 entregue: um registro editável por atendimento, revisão humana, Evolution oficial determinística e finalização transacional. |
| #394 rollout / verifier | 🟢 técnico | Migration #394 aplicada em produção em 2026-09-10; production-safe verifier passou com `VERIFY #394 PRODUCTION OK`. |
| Clinical Instrument Authorization #399 | 🟢 técnico | Migration/verifier em produção, `admin-team` e frontend alinhados, smoke médico real passou com fail-closed/ALLOW composto e rollback sem resíduos. |
| Encounter Temporal Start Boundary #400 | 🟢 técnico | Migration/verifier em produção; smoke reproduziu o bug real e confirmou `appointment_future_encounter_start_forbidden`; future-active legado também permanece DENY para #399. |
| Known future-active histórico | 🟡 operacional | Appointment `de857836-baa0-476f-bd7b-d6f52df33007` ainda precisa de reparação separada e auditável; não há artefatos clínicos/financeiros vinculados no levantamento forense. |
| Finalização clínica × cobertura | 🟢 estrutural | #388 preserva finalização clínica diante de falhas esperadas de cobertura e registra `appointment_financial_exception`. |
| Resolução de exceção financeira | 🟢 estrutural | #389: owner/admin `CHARGE|WAIVE`; financeiro `CHARGE`; recep/professional sem resolução. |
| Assessment Engine | 🟢 estrutural | Foundation de avaliações estruturadas, drafts/versionamento e integração ao atendimento já existe. |
| Consultório / Gestão | 🟢 estrutural | #396 entrega privacy/presentation shell sem alterar autorização. |
| UX / design em uso real | 🟡 | Foundations visuais existem, mas ainda falta evidência suficiente de smoke visual e uso por profissionais reais para chamar UX de validada. |
| Smoke pós-finalização #394 | 🟡 | Draft real foi comprovado; falta registrar a comprovação read-only pós-finalização se não houver evidência posterior no repositório. |
| Smoke CHARGE/WAIVE #389 | 🟡 | Contrato/verifier técnico existe; ação real deve ser documentada antes de tratá-la como smoke operacional concluído. |
| WhatsApp / Evolution operacional | 🟢 estrutural | Outbox/worker/webhook e reconciliação fail-closed existentes; observabilidade continua sendo trabalho contínuo. |
| LGPD / auditoria técnica | 🟢 estrutural | Controles técnicos existem; não equivalem por si só a declaração jurídica completa de conformidade. |

## Atendimento clínico — estado canônico

O fluxo novo não converge mais para um `ClinicalWorkspace` genérico como unidade de dados. O **Encounter Record** é a unidade editável do atendimento atual.

Modelo registrado uma única vez:

- Motivo / demandas;
- História atual / HDA;
- Achados / exame;
- Avaliação clínica / problemas;
- Plano / conduta;
- Observações.

Após revisão e confirmação humana:

**Encounter Record → Evolution oficial determinística → appointment finalizado**

Não existe uma segunda Evolution universal obrigatória no fluxo novo. A Evolution continua sendo o registro oficial materializado/longitudinal, não um segundo formulário para o profissional repetir o conteúdo.

Encounter Record finalizado é histórico. Correção/adendo auditável ainda não foi implementado e deve ser tratado como nova slice; não fazer backfill fictício de registros antigos.

## Evidência de produção — #394, #399 e #400

Estado conhecido em **2026-09-10**:

- migration `20260910_clinical_encounter_record_foundation.sql` (#394) aplicada em produção;
- verifier read-only de produção #394 passou: `VERIFY #394 PRODUCTION OK`;
- migration `20260910_clinical_instrument_encounter_authorization.sql` (#399) aplicada em produção;
- verifier read-only #399 passou; `admin-team` e frontend foram alinhados ao mesmo `main`;
- smoke #399 com Dr. Médico Nexus provou DENY sem composição completa, ALLOW somente com PHQ-9 enabled + `clinical.instrument.apply` + próprio Encounter e zero resíduos após rollback;
- migration `20260910_encounter_temporal_start_boundary.sql` (#400) aplicada em produção;
- verifier #400 passou em transação read-only;
- smoke #400 reproduziu o bug real de início futuro e confirmou o bloqueio `appointment_future_encounter_start_forbidden`;
- o mesmo smoke comprovou que um future-active legado não autoriza Apply-in-Encounter na #399 e terminou com rollback limpo;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou;
- o verifier antigo #388 contém uma assertion histórica de ausência da RPC de resolução que foi criada posteriormente pelo #389; essa assertion é obsoleta para o schema atual e precisa ser versionada/atualizada antes de reutilização direta.

### Smoke observado antes da finalização #394

Foi observado no fluxo real:

- Encounter Record persistido;
- refresh/navegação preservaram o conteúdo;
- revisão do draft observada;
- antes da finalização havia **1 Encounter Record, 0 Evolutions, 0 payments e 0 financial exceptions** para o cenário exercitado.

Não há, neste snapshot documental, evidência suficiente no repositório para declarar como observada a comprovação read-only **pós-finalização** desse mesmo smoke. A validação curta deve confirmar os artefatos finais sem inventar resultado.

### Estado histórico future-active conhecido

Permanece uma row criada antes da #400:

```text
appointment_id = de857836-baa0-476f-bd7b-d6f52df33007
data           = 2026-09-23
status         = em_atendimento
```

A #400 deliberadamente não faz saneamento retroativo. O smoke real confirmou que:

- esse future-active físico retorna DENY no boundary #399;
- uma nova tentativa do mesmo profissional de executar `agendado → em_atendimento` para a data futura é bloqueada;
- o smoke terminou em `ROLLBACK`, portanto a row histórica continua aguardando reparação explícita/auditável.

O levantamento forense não encontrou `clinical_encounter_records`, `physiotherapy_evolutions`, `package_session_usage` nem `payments` associados a esse appointment.

## Finalização clínica e semântica financeira

O contrato atual após #388 é:

> uma finalização clínica válida não deve ser perdida apenas porque a cobertura esperada não pode ser consumida.

Falhas esperadas:

- `package_exhausted`;
- `package_expired`;
- `package_not_eligible`.

Resultado: appointment clínico pode permanecer finalizado e a inconsistência de cobertura é registrada em `appointment_financial_exception`. Não há consumo gratuito silencioso.

#389 fornece resolução explícita e auditável:

- owner/admin: `CHARGE` ou `WAIVE`;
- financeiro: `CHARGE`;
- recep/professional: sem resolução.

Parceiro/repasse não é autorização.

Falhas financeiras inesperadas de integridade continuam fail-closed e podem reverter a transação conforme os guards existentes.

O smoke real de `CHARGE`/`WAIVE` deve continuar YELLOW até existir evidência observada/documentada.

## Consultório / Gestão — Presentation Privacy Shell

Decisão canônica do #396:

`PresentationContext = 'clinical' | 'management'`

**PresentationContext != authorization.**

- professional: Consultório only;
- owner/admin: Consultório + Gestão somente quando identidade clínica válida e `clinical.attend` forem confirmados;
- recep/financeiro: Gestão only.

Modo Consultório oculta visualmente:

- Financeiro global;
- CRM gerencial;
- Relatórios administrativos;
- Configurações.

Acesso por URL continua passando pelos guards reais e, quando o ator já é autorizado, recebe privacy boundary em Consultório. Trocar o modo não altera role, RLS, capability, entitlement, `canView`, JWT ou tenant.

A preferência local é isolada por `user_id + clinic_id`.

Residual conhecido: **autoentrada automática no Consultório ainda não implementada**. Ela deve ser ligada apenas a um ponto canônico único após iniciar/continuar o próprio Encounter, nunca inferida por rota ou mera existência de appointment ativo.

## Nexus — estado do piloto

Nexus é uma engine clínica especializada do runtime MedicsPro. `OARANHA/nexus` é upstream/laboratório, não segundo produto.

Autorização permanece médico-only e fail-closed:

1. entitlement da clínica;
2. capability necessária;
3. identidade médica válida;
4. relação assistencial/contexto permitido;
5. autorização server-side.

Especialidade informa relevância; não concede acesso por si. Role operacional também não basta.

A foundation #399 não concede `nexus.*`; o smoke de produção confirmou zero grants Nexus residuais. Instrumentos clínicos neutros e Nexus médico avançado continuam boundaries diferentes.

## Instrumentos clínicos — estado do piloto

A foundation #399 está verde em produção. O estado funcional é:

```text
[x] autorização base + Apply-in-Encounter boundary
[x] exposição neutra controlada de PHQ-9/GAD-7
[x] clinic settings fail-closed
[x] temporal defense #400 para future-active
[ ] Clinician-Assisted Administration
[ ] persistência multiprofissional nova, se necessária
[ ] Encounter Instrument UX
[ ] Enviar ao paciente / boundary remoto
```

Não interpretar foundation verde como instrumento já administrável na UI.

## UX / design — por que permanece YELLOW

A arquitetura e as boundaries principais estão maduras o suficiente para piloto controlado, mas isso não demonstra que a experiência já foi validada por profissionais externos.

Antes de mudar UX/design para GREEN:

- executar smoke visual das telas de maior frequência;
- observar profissional real usando Agenda → Encounter → revisão → finalização;
- testar owner/admin alternando Consultório/Gestão e professional clinical-only;
- conferir desktop/mobile, light/dark, loading, empty, error e success;
- registrar fricções concretas e corrigi-las por impacto.

Ausência de blocker estrutural não é evidência de ótima ergonomia.

## Pacientes e prontuário

A listagem clinic-wide de pacientes deve permanecer operacional, enquanto conteúdo clínico detalhado segue boundaries assistenciais. Paciente pertence ao contexto da clínica; prontuário exige o contexto/autorização clínica apropriados.

`professional_id` é a referência clínica canônica. `fisio_id` pode existir em compatibilidade física, mas não deve voltar a ser autoridade de autorização.

## Próximo foco recomendado

1. reparar de forma auditável o appointment future-active conhecido e fechar evidência operacional curta do smoke #394 pós-finalização e smoke #389 CHARGE/WAIVE;
2. corrigir/versionar a assertion obsoleta do verifier #388;
3. executar piloto UX do Encounter/Consultório e remover fricções observadas;
4. evoluir **Cobertura deste atendimento** sem expor Financeiro global;
5. evoluir Instrument Delivery a partir da foundation já em produção: Clinician-Assisted Administration → Encounter Instrument UX → boundary remoto quando desenhado;
6. construir Prescription V1 e demais documentos apenas conforme demanda do piloto;
7. evoluir configuração financeira/parcerias sem criar role econômica;
8. ampliar onboarding e integrações somente com evidência de necessidade.

Timezone por tenant permanece follow-up obrigatório antes de expansão para clínicas em outros fusos; `America/Sao_Paulo` é somente o fallback operacional atual da #400.

## Regra de implantação

`main` é potencialmente produtiva. Portanto:

- nunca usar `main` como área de experimentação;
- PRs precisam estar deploy-safe antes do merge;
- migrations devem ser compatíveis, versionadas e verificáveis;
- migration já aplicada não deve ser reaplicada por documentação desatualizada;
- verifier de produção deve ser apropriado para banco real/read-only quando esse for o contrato;
- mudanças de segurança precisam de testes negativos e positivos quando aplicável;
- qualquer ação de servidor/produção deve ser explicitamente destacada;
- nunca declarar smoke/piloto concluído sem evidência observada.
