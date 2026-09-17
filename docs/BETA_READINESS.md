# MedicsPro — Beta Readiness

Documento vivo para acompanhar a preparação do MedicsPro para uso por profissionais reais.

## Legenda

- 🟢 **GREEN** — foundation/gate técnico validado para piloto controlado.
- 🟡 **YELLOW** — foundation existe, mas ainda depende de smoke, UX real, observabilidade ou validação operacional antes de ampliação.
- 🔴 **RED** — blocker conhecido.

## Estado em 2026-09-17

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
| Finalização clínica × cobertura | 🟢 estrutural | #388 preserva finalização clínica diante de falhas esperadas de cobertura e registra `appointment_financial_exception`. |
| Resolução de exceção financeira | 🟢 estrutural | #389: owner/admin `CHARGE|WAIVE`; financeiro `CHARGE`; recep/professional sem resolução. |
| Verifier #388 × #389 | 🟢 técnico | Em 2026-09-15 o harness PostgreSQL 16 provou #388 antes e depois de #389; o mesmo verifier permanece verde na composição efetiva e os controles negativos continuam falhando como esperado. |
| Assessment Engine | 🟢 estrutural | Foundation de avaliações estruturadas, drafts/versionamento e integração ao atendimento já existe. |
| Consultório / Gestão | 🟢 operacional | #396 preserva presentation != authorization; smoke autenticado em produção fechado em 2026-09-17 para owner/admin elegível + professional clinical-only, desktop/mobile light-dark e URL administrativa protegida. |
| UX / design em uso real | 🟡 | Foundations visuais existem, mas ainda falta evidência suficiente de smoke visual e uso por profissionais reais para chamar UX de validada. |
| Smoke pós-finalização #394 | 🟢 operacional/read-only | Em 2026-09-15, produção confirmou Record `finalized`, `finalized_at`, Evolution única/ativa e vinculada, appointment `finalizado`, efeito financeiro unitário/coerente e zero exceção financeira. |
| Smoke CHARGE/WAIVE #389 | 🟢 runtime / 🟡 negócio | CHARGE e WAIVE foram exercidos em produção com autenticação real dentro de transações revertidas, provando idempotência e efeitos sem resíduos. A disposição da exceção real continua decisão econômica. |
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

## Evidência de produção do #394

Estado de produção conhecido em **2026-09-10**; compatibilidade do verifier revalidada em **2026-09-15**:

- migration `20260910_clinical_encounter_record_foundation.sql` aplicada em produção;
- verifier read-only de produção passou: `VERIFY #394 PRODUCTION OK`;
- Clinical Foundation passou;
- Clinical Authorization passou;
- Financial Exception Resolution #389 passou;
- o verifier #388 já é composition-aware: aceita a fundação histórica antes de #389 e, quando a RPC canônica existe, exige resolver auditado, `SECURITY DEFINER`, grants corretos e fila ainda sem mutação direta; o harness #389 reexecuta #388 após aplicar #389 e ficou verde em PostgreSQL 16 em 2026-09-15.

### Smoke observado antes da finalização

Foi observado no fluxo real:

- Encounter Record persistido;
- refresh/navegação preservaram o conteúdo;
- revisão do draft observada;
- antes da finalização havia **1 Encounter Record, 0 Evolutions, 0 payments e 0 financial exceptions** para o cenário exercitado.

### Smoke observado após a finalização — 2026-09-15

Uma inspeção estritamente read-only no banco vivo confirmou, sem ler texto clínico, nomes, IDs ou conteúdo do prontuário:

- existe exatamente **1 Encounter Record** em produção e ele está `finalized`;
- `finalized_at` está presente;
- o appointment vinculado está `finalizado`;
- existe exatamente **1 Evolution** pelo `evolution_id`, ativa (`deleted_at IS NULL`) e com `session_id` igual ao appointment;
- tenant, paciente e profissional coincidem entre Encounter Record, appointment e Evolution;
- existe exatamente **1** lançamento em `payments` para o appointment, do mesmo tenant/paciente;
- o lançamento está não pago e `atrasado`, coerente com `vencimento < CURRENT_DATE` no momento da leitura;
- existem **0** `appointment_financial_exceptions` para o appointment.

Isso fecha a evidência read-only pós-finalização do #394. Não transforma UX do piloto em GREEN e não prova `CHARGE`/`WAIVE` do #389.

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

O runtime real de `CHARGE`/`WAIVE` foi observado em produção dentro de transações revertidas, com autenticação, idempotência e ausência de resíduos. Isso fecha a dúvida técnica, mas não decide a disposição econômica da exceção real existente.

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

Desde a #478, a autoentrada existe somente no handoff explícito de iniciar/continuar o próprio Encounter e continua passando pelo `PresentationContextProvider`; rota/query, abertura de paciente e mera existência de appointment ativo não acionam mudança de contexto.

## Nexus — estado do piloto

Nexus é uma engine clínica especializada do runtime MedicsPro. `OARANHA/nexus` é upstream/laboratório, não segundo produto.

Autorização permanece médico-only e fail-closed:

1. entitlement da clínica;
2. capability necessária;
3. identidade médica válida;
4. relação assistencial/contexto permitido;
5. autorização server-side.

Especialidade informa relevância; não concede acesso por si. Role operacional também não basta.

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

1. usar o privacy shell #396 já verificado como baseline e executar piloto UX do Encounter/Consultório, removendo fricções observadas;
2. validar em uso real a ergonomia completa da jornada, sem confundir o P0 técnico fechado com validação externa de UX;
3. validar em uso real a **Cobertura deste atendimento** já entregue pela #479, sem expor Financeiro global;
4. validar em uso real a Patient Delivery V1 já entregue; expansão para novos instrumentos continua condicionada a contrato `patient_self`, revisão clínica, direitos/versão/população e safety específicos;
5. priorizar apenas documentos clínicos ainda ausentes conforme demanda do piloto;
6. evoluir configuração financeira/parcerias sem criar role econômica;
7. ampliar onboarding e integrações somente com evidência de necessidade.

A antiga dívida do verifier #388 não faz mais parte da fila: a composição #388 → #389 foi revalidada em PostgreSQL 16 em 2026-09-15.

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
