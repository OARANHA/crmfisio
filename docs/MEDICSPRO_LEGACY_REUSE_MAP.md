# MedicsPro histórico — mapa de reaproveitamento seletivo

Auditoria documental iniciada em 2026-09-08 e reconciliada em 2026-09-09 contra o runtime canônico após #390–#392. Escopo: comparar `OARANHA/medicspro` com o produto canônico e identificar conceitos úteis para missões futuras. O histórico continua sendo **referência de produto/UX/workflow, nunca fonte arquitetural**.

## 1. Fontes fixadas, método e limites

| Fonte | Revisão auditada | Papel |
| --- | --- | --- |
| `OARANHA/crmfisio` | `537af24ebfc138a9b8e372f0c6659eaf1b08a803` | Produto/runtime canônico após o merge do #392; autoridade de implementação, schema, segurança e autorização |
| `OARANHA/medicspro` | `0fd709612598fa93a9cf0517b9ba924b1405ec83` | Referência histórica de UX e workflows |
| `docs/NEXUS_GAP_MAP.md` no canônico | Documento aprovado presente na base acima | Dependências C-01–C-06 e separação entre Nexus e atos clínicos |

Foram lidos `AGENTS.md`, `docs/WORK_CONTEXT.md`, `docs/WORK_MASTER_PROMPT.md`, `docs/ASSESSMENT_ENGINE.md` e o mapa Nexus. A reconciliação de 2026-09-09 também auditou o runtime real de `ClinicalEncounterWorkspaceV4`, `ClinicalWorkspaceV3`, `ClinicalWorkspace`, `ActiveEncounterClinicalTools`, Assessment Engine, Nexus patient surfaces, `Pacientes.tsx`, helpers de encounter e testes relacionados.

Referências **L:** usam caminhos relativos ao histórico; **C:** usam caminhos relativos ao canônico. A primeira auditoria preserva algumas evidências por SHA anterior; a fotografia de estado e as decisões abaixo foram revalidadas contra a revisão canônica fixada nesta seção.

Método: tela → ação → store/API → controller/modelo histórico, comparados com tela, contrato, persistência, capabilities, providers e migrations canônicos relevantes. A existência de aba, tipo ou botão não foi tratada como prova de fluxo completo. “Ausente” abaixo significa **não localizado nos caminhos canônicos de runtime, contratos e consumidores inspecionados**, não uma alegação sobre branches não auditadas.

Não foram executados o aplicativo histórico, seu MongoDB, testes ponta a ponta ou requisições de produção. Os problemas históricos abaixo são evidências estáticas, não incidentes reproduzidos em produção. Não se certificam validade clínica, assinatura digital ou conformidade legal de documentos por existir impressão HTML. Este mapa não substitui a revisão específica de segurança de cada implementação futura.

## 2. Decisão de produto

O maior valor do histórico está em **manter o profissional no contexto do paciente enquanto registra, consulta e prepara documentos**. O canônico já tem uma fundação mais apropriada: own active encounter fail-closed, Agenda role-aware, handoff por sessão, Assessment Engine versionado, Body Map estruturado, providers separados, capabilities, Supabase/RLS, consentimentos, Nexus contextual e ciclo clínico separado do financeiro.

Recomendação: aproveitar organização de experiência e conceitos de domínio que faltam; reconstruí-los em slices sobre o prontuário atual. Não copiar componentes Vue, stores Pinia, Mongo/Mongoose, Express/JWT, tenancy/autorização antigas, hardcodes de plano, nem abrir segunda engine ou segundo prontuário. Prescrição é documento/ato do MedicsPro; cálculo e suporte farmacológico pertencem a `Nexus Clinical Engine -> psychopharmacology`.

Os gates Nexus C-01–C-06 permanecem autoridade e **não são reabertos por UX**. A reconciliação clínica não autoriza flexibilizar entitlement, capabilities, identidade, vínculo assistencial, lifecycle, review/sign ou incorporação explícita.

### 2.1 Fotografia incremental após #390, #391 e #392

Esta tabela atualiza a fotografia canônica sem apagar a auditoria original abaixo.

| Domínio | Estado após #390–#392 | Classificação | Decisão atual | Prioridade / próximo passo |
| --- | --- | --- | --- | --- |
| Atendimento contextual | `Pacientes.tsx` entrega o own active encounter ao `ClinicalEncounterWorkspaceV4`; sessão de outro profissional/histórica não vira modo editável | **Parcialmente absorvido** | **EVOLUIR** a experiência, preservar o resolver/guards atuais | #393 melhora workbench/navegação; sem novo backend |
| Ficha/navegação | Paciente e histórico longitudinal existem; V4 #392 ainda é uma sequência vertical numerada e o histórico fica no final | **Parcialmente absorvido** | **EVOLUIR** para navegação livre e contexto persistente, sem reproduzir dez abas legadas | #393 |
| Avaliações/anamnese | Assessment Engine canônico possui templates/versionamento, draft/finalized, autoria, appointment quando aplicável e histórico | **Absorvido com arquitetura superior** | **PRESERVAR** engine; conceitos de anamnese entram como templates/componentes | Ramificação/novos componentes só com necessidade comprovada |
| Modelos clínicos | Avaliações padrão e modelos reutilizáveis existem no engine atual | **Absorvido** | **PRESERVAR** | Curadoria de conteúdo pode seguir em slice própria |
| Autosave/status | Assessment tem rascunho real; evolução continua persistência explícita. O histórico tinha boa intenção de `salvando/salvo/erro`, mas H01 prova que o padrão antigo não é confiável | **Parcialmente absorvido** | **REJEITAR** autosave genérico; feedback “salvo” somente após confirmação real | Futuro apenas em superfície com DRAFT e proteção contra respostas antigas/context switch |
| Prescrição | Sem workflow canônico suficiente para emissão | **Gap maduro** | **REDESENHAR**, não criar botão morto | P1 conforme piloto médico; lifecycle/autoria/assinatura antes da UI |
| Exames | Sem pedido estruturado canônico | **Gap maduro** | **REDESENHAR** | P1 condicionado ao piloto; pedido antes de integração laboratorial |
| Laudos/resultados | Sem workflow equivalente; distinção histórica `recebido ≠ revisado` continua valiosa | **Gap maduro** | **REDESENHAR** | P1/P2; separar upload de terceiro de laudo autoral |
| Atestados | Sem fluxo específico canônico | **Gap maduro** | **REDESENHAR** | P1/P2; definir autoria, assinatura e correção |
| Documentos/termos | Consentimentos, templates e mutações protegidas por RPC já existem; V4 mostra estado resumido e histórico longitudinal | **Parcialmente absorvido** | **PRESERVAR/EVOLUIR** localização, sem segunda engine de termos | UX incremental apenas sobre dados reais |
| Ferramentas clínicas/Nexus | Ferramentas são entitlement/capability-driven e fail-closed; especialidade só ordena relevância | **Absorvido com arquitetura superior** | **PRESERVAR** boundaries; evoluir apenas contexto/navegação | #393 pode preservar `?session=` sem tocar C-01–C-06 |
| Evolução | V4 exige autoria atual + sessão exata; finalização depende de evolução vinculada | **Absorvido com arquitetura superior** | **PRESERVAR** | Só UX/feedback, sem mudar contrato |
| Encerramento | Usa boundary verificado; requisitos clínicos visíveis são derivados dos mesmos guards | **Absorvido com arquitetura superior** | **PRESERVAR** | UX mais clara, PostgreSQL continua autoridade |
| Checkout/financeiro | Canônico separa realidade clínica da projeção/liquidação financeira | **Legado rejeitado** | **REJEITAR** checkout como bloqueio clínico | Não reintroduzir #388/#389 |
| Procedimentos | Legado mistura registro com quantidade/preço/checkout; não há workflow encounter-scoped equivalente maduro | **Gap com parte do legado rejeitada** | **REDESENHAR** clínica separada do financeiro | Slice própria se piloto exigir |
| Anexos/imagens | Fundamentos documentais existem, mas não uma galeria/attachment encounter-scoped completa; histórico tem backend incompleto H03 | **Gap parcial** | **REDESENHAR** com storage privado, escopo e retenção | P2, conforme evidência do piloto |

## 3. Matriz diferencial de reaproveitamento

| ID / fluxo | Evidência histórica e comportamento observado | Estado canônico / gap real | Decisão e prioridade |
| --- | --- | --- | --- |
| L01 Login e recuperação | L:`app-agendadoutor/src/views/pages/autenticacao/LoginView.vue`: estados `login`, `forgot`, `reset`, `contact`; erro por campo, feedback, código e nova senha no mesmo card. L:`app-agendadoutor/src/stores/auth.js`: ações de recuperação próprias | C:`src/components/Shell.tsx`, `Login`, oferece email/senha e tema; C:`src/lib/useAuth.ts` usa Supabase Auth. Não localizado fluxo público de recuperação no runtime `src`; `MandatoryPasswordChange.tsx` e reset administrativo em `TeamAdmin.tsx` são outros casos de uso | **Redesenhar, P1:** recuperação coesa com Supabase, estados explícitos e retorno seguro. Reaproveitar intenção UX, não protocolo JWT/código antigo ou promessa de recuperação por telefone sem canal confirmado |
| L02 Onboarding | L:`app-agendadoutor/src/views/pages/onboarding/ClinicWizardView.vue`: dados, horário, concluído, indicação de primeiro paciente/agendamento. `StepCreateClinic.vue` cria clínica e aceita CNPJ opcional | C:`src/pages/ClinicAccessRequestPage.tsx`, `PlatformClinicProvisioningPage.tsx`, funções `request-clinic-access`/`provision-clinic`: solicitação, análise e provisionamento já existem. Gap é condução após acesso aprovado, não criar outro cadastro autônomo | **Redesenhar, P1:** checklist orientado a clínica, profissional, unidade, agenda, primeiro paciente e atendimento, reutilizando comandos atuais. Não bypassar aprovação da plataforma |
| L03 Atendimento médico contextual | L:`InProgressAppointmentView.vue`: ambiente dedicado, paciente sempre em contexto, abas de trabalho, cronômetro e estado de persistência; fechamento historicamente passava por checkout | C:#390–#392 consolidaram own active encounter, Agenda role-aware, handoff por `?session=` e Human Consultation Workspace V4 com evolução/finalização verificadas | **Evoluir o existente, P1:** absorção parcial forte. Melhorar workbench/contexto/navegação; rejeitar checkout bloqueante, reabertura de finalizado e qualquer arquitetura antiga |
| L04 Anamnese | L:`components/pages/appointments/AnamneseFormTab.vue`, `models/AnamnesisTemplate.js`, `models/AnamnesisResponse.js`: seleção de modelo, seções, questões, condicionais, histórico | C:`ClinicalAssessmentRunner.tsx`, `ClinicalAssessmentHistory.tsx`, `src/lib/assessmentEngine.ts`: template imutável por versão, resposta, draft/finalized, autoria e appointment contextual | **Preservar canônico, P1/P2:** a engine atual é superior; reaproveitar conceitos de template/seção/tipo de resposta. Não criar segunda anamnese nem permitir mutação silenciosa de finalizado |
| L05 Prescrição | L:`components/pages/appointments/PrescriptionTab.vue`, controllers/modelo: medicamentos estruturados, template, preview, salvar, imprimir e histórico | Não há workflow canônico suficiente de emissão de prescrição; Nexus farmacológico não substitui o ato/documento | **Redesenhar, P1 condicionado ao piloto médico:** autoria/lifecycle/assinatura/correção explícitos. Não mostrar botão no encounter até existir workflow real |
| L06 Solicitação de exames | L:`components/pages/appointments/ExamOrderTab.vue`, `models/ExamOrder.js`: itens/categoria, indicação, urgência, jejum, preparo e validade | Não localizado contrato canônico estruturado de pedido de exames | **Redesenhar, P1 condicionado:** pedido simples vinculado ao atendimento antes de workflow laboratorial amplo; sem botão morto no encounter |
| L07 Laudos e resultados de exames | L:`ExamReportTab.vue`, modelo/controller: parâmetros, laboratório, arquivo, estado pendente/recebido/revisado; impressão ainda incompleta | Não localizado workflow canônico equivalente | **Redesenhar, P1/P2:** preservar a distinção `recebido ≠ revisado`; separar resultado de terceiro de laudo autoral |
| L08 Atestados | L:`CertificateTab.vue`, modelo/controller: tipos, dias, data, CID opcional, texto, notas internas, histórico e impressão | Não localizado fluxo específico de atestado emitido | **Redesenhar, P1/P2:** definir autoria, assinatura e correção; notas internas nunca entram no documento; sem paridade visual fictícia |
| L09 Documentos e termos | L:`AttendanceConsentTermsTab.vue` e ficha do paciente mantêm termos próximos da consulta | C:`ConsentTemplatesAdmin.tsx`, `src/lib/consentDocument.ts`, Clinical providers e RPC-only mutation já oferecem fundação própria; V4 expõe contagem e histórico | **Preservar/evoluir, P2 de UX:** aproximar estado real da consulta quando útil. Não importar token/coletor/modelo de assinatura legado |
| L10 Templates clínicos/documentais | L: anamnese e prescrição usam templates; documento histórico injeta conteúdo para preview/print | C: Assessment Engine já distingue template/versão/origem; documentos futuros precisam contrato próprio | **Preservar engine + redesenhar documentos, P1 transversal:** congelar snapshot na emissão; não importar HTML livre |
| L11 Autosave | L:`InProgressAppointmentView.vue`: debounce 1,5 s e `saving/saved/error/lastSaved`; H01 mostra discrepância de payload | C: Assessment tem draft real; evolução é persistência explícita, vinculada à sessão | **Rejeitar cópia, P1 de UX quando houver DRAFT:** só afirmar salvo após confirmação; proteger autoria, contexto e ordenação de requests |
| L12 Ficha e navegação | L:`PatientDetailView.vue`: ficha ampla e consulta dedicada com navegação rápida | C:`Pacientes.tsx`, workspace longitudinal e V4 já separam consulta atual do histórico; V4 #392 ainda é longo/vertical | **Evoluir, P1:** contexto persistente e navegação livre entre superfícies reais; histórico secundário; não criar dez abas por paridade |
| L13 Galeria clínica | L:`PatientMediaGallery.vue`, modelos de pasta/arquivo; controller de upload retorna 501 | C: componente `attachment` do Assessment Engine não equivale a galeria/upload clínico completo | **Adiar/reconstruir, P2:** storage privado, vínculo, retenção, acesso e remoção auditável antes da UX |
| L14 Notas separadas de evolução | L:`PatientNotesTab.vue`: feed, autoria, pin, edição/exclusão fora do atendimento | C: evolução é vinculada à sessão; não localizado domínio equivalente de nota clínica fixa | **Redesenhar, P2:** definir finalidade/leitores; não copiar mutação/exclusão ampla de registro clínico |
| L15 Features, planos e overrides | L: feature service + planos/overrides e mapa hardcoded paralelo | C: entitlements e console de plataforma já existem; autorização de dados é separada | **Preservar arquitetura atual, P2 de clareza:** não portar resolver antigo nem misturar plano com RBAC/capability |

Nos caminhos abreviados da tabela, `components/...` usa o prefixo histórico `app-agendadoutor/src/`; `controllers/...`, `models/...` e `services/...` usam `api-agendadoutor/src/`.

## 4. Armadilhas concretas: o que não copiar

| ID | Evidência estática | Consequência |
| --- | --- | --- |
| H01 Feedback de autosave não prova persistência | L:`InProgressAppointmentView.vue`, `autoSave`, envia `content`; store/API repassam payload, enquanto controller/modelo leem outros campos | Sucesso HTTP pode coexistir com texto não salvo. Reaproveitar o indicador UX somente sobre contrato canônico confirmado e testar leitura após salvar |
| H02 Histórico editável não é prontuário imutável | `recordsController.js`, `updateRecord`, aceita alteração de campos/status sem guarda de finalizado naquele handler; `createOrUpdateRecord` reassocia `doctor` ao usuário que salva | Não copiar update genérico para atos finalizados. Preservar autor original, lifecycle e adendo/versionamento canônicos |
| H03 Galeria incompleta | `galleryController.js`, `uploadFile`, contém TODO e resposta HTTP 501; há caminho separado de anexos de Record | UI/modelo de galeria não garantem upload operacional. Avaliar anexos e galeria como fluxos distintos |
| H04 Laudo não tem impressão pronta | `ExamReportTab.vue`, `printReport`, apenas mostra “Impressão em desenvolvimento” | Não listar geração de laudo/PDF como entrega comprovada; resultado estruturado e emissão documental são capacidades separadas |
| H05 URLs públicas de arquivos | `recordsController.js`, `addAttachment`, constrói URL `/uploads/`; app registra `express.static` nessa rota | Não portar entrega de mídia clínica por URL estática. Storage/acesso atual precisam ser projetados sobre boundaries canônicos |
| H06 Fronteiras e autoria não são exportáveis | Controllers históricos aceitam referências/body/query e atribuem autor atual de modos incompatíveis com o boundary canônico | Não reutilizar controllers como regra de autorização. Resolver tenant/autoria no servidor e validar referências |
| H07 Número de receita sujeito a concorrência | `Prescription.js` usa count + 1 com uniqueness problemática | Futuro identificador deve ter escopo e geração atômica definidos |
| H08 Notas com mutação ampla | `patientNotesController.js` aplica `$set: req.body`; delete remove documento | Allowlist, autor imutável, finalidade e histórico/RLS próprios são obrigatórios |
| H09 Dois sistemas de plano | `featureService.js` e `usePlanAccess.js` divergem em catálogo/fallback | Entitlement, configuração, capability e autorização continuam separados no canônico |
| H10 Conteúdo HTML dinâmico | Prescrição/atestado históricos montam HTML para preview/print | Reaproveitar estrutura de preview, não interpolação sem sanitização. Impressão não é assinatura digital |

Esses achados fundamentam a decisão de **reconstruir conceitos**, não corrigir o histórico. Não copiar logs de payload clínico presentes nos callbacks do atendimento antigo.

## 5. Destino canônico e invariantes para futuras slices

| Necessidade | Destino a evoluir | Invariante |
| --- | --- | --- |
| Entrada e recuperação | `src/components/Shell.tsx`, `src/lib/useAuth.ts`, roteamento Auth existente | Supabase Auth; retorno local validado, sessão recente preservada, sem tenant selecionado pelo browser |
| Primeiros passos | Solicitação/provisionamento existentes + configurações/equipe/agenda atuais | Aprovação de plataforma antes do acesso; idempotência; owner não é automaticamente profissional nem platform_admin |
| Atendimento atual | `ClinicalEncounterWorkspaceV4`, `ClinicalWorkspaceV3`, helpers de active encounter | Somente own active encounter é editável; patient/appointment/professional exatos; histórico não vira encounter |
| Anamnese e modelos | `src/lib/assessmentEngine.ts`, `ClinicalAssessmentRunner`, `AssessmentTemplatesAdmin`, `ClinicalAssessmentHistory` | Uma engine multiprofissional; versão exata; draft distinto de finalizado; Body Map estruturado |
| Documentos médicos | Workspace/paciente/atendimento atuais; contrato documental a definir em missão própria | Identidade profissional e capability do ato; autor/tenant/contexto no servidor; snapshots e correções rastreáveis |
| Ajuda farmacológica | `src/lib/nexus/`, `src/lib/nexusClinical.ts`, contrato Nexus existente | Vínculo assistencial **E** boundary Nexus; regra/evidência versionadas; decisão humana; nenhuma medication engine paralela |
| Notas e anexos | Contexto do paciente existente, com escopo persistente a definir | Separação clínica/operacional, acesso direto protegido e minimização; não armazenar dados clínicos em cache global descontextualizado |
| Módulos comerciais | Entitlements/console de plataforma atuais | Plano não concede acesso ao paciente; owner/admin não médico não ganha Nexus por gestão; ausência/erro de configuração Nexus bloqueia |

Nenhuma nova tabela/RPC/capability é declarada como existente ou prescrita por este mapa. Dados de motivo/HDA/achados/hipótese/plano desta consulta exigem modelagem encounter-scoped explícita; nunca devem ser “resolvidos” escrevendo em campos longitudinais do paciente.

## 6. Prioridade 80/20 após a fundação clínica atual

| Ordem | Slice sugerida | Impacto / esforço / risco | Dependências e teste de saída | Banco / servidor potencial |
| --- | --- | --- | --- | --- |
| 0 | Encounter UX V4.1 / reconciliação de experiência | Alto / pequeno-médio / baixo-médio | Contexto persistente; sessão preservada; avaliação opcional; evolução/encerramento coerentes; sem botões falsos | **Nenhum** se limitada à apresentação e navegação atuais |
| 1 | Schema encounter-scoped para motivo/HDA/achados/hipótese/plano, somente após decisão explícita | Alto / médio-grande / alto | autoria, lifecycle, histórico, RLS, troca de contexto, verifier e rollout | Migration/verifier próprios; não incidental em UX |
| 2 | Primeiro documento médico L05 ou L08, escolhido pelo piloto | Alto / médio-grande / alto, P1 | Autor/CRM/capability; preview = emissão persistida; duplicate submit; lifecycle/adendo; histórico após template | Provável modelo/migration/verifier próprios |
| 3 | Pedido + resultado de exame L06/L07 | Médio-alto / grande / alto | referências cruzadas rejeitadas; recebido ≠ revisado; arquivo/preview corretos | Provável extensão aditiva + storage privado se necessário |
| 4 | Recuperação de acesso L01 | Alto / médio / médio | token/retorno/falha/sessão/teclado/mobile | Configuração Auth; sem migration inerente à UI |
| 5 | Onboarding pós-aprovação L02 | Alto / médio / médio | retomar etapa, refresh, idempotência, owner sem identidade profissional | Progresso persistido só com decisão explícita |
| 6 | Notas ou galeria L13/L14, somente com evidência do piloto | Médio / médio-grande / alto | matriz de leitores, outro tenant, revogação, histórico | Modelo/policies/storage prováveis |
| 7 | Clareza de módulos/templates L09/L15 | Médio / pequeno-médio / médio | origem/vigência/revogação/erro de carregamento | Preferir contratos atuais |

Catálogo de medicamentos, equivalências, switching e novas escalas continuam seguindo `NEXUS_GAP_MAP.md`; não entram por uma porta lateral em “prescrição”.

Matriz transversal para novas slices sensíveis: ator autorizado, sem capability, sem entitlement quando exigido, identidade inválida, perfil inativo, clínica suspensa, anônimo e outro tenant. Incluir acesso direto a RPC/tabela/arquivo, não apenas menu.

## 7. Evidências principais e rastreabilidade

| Grupo | Caminhos históricos lidos | Caminhos canônicos comparados |
| --- | --- | --- |
| Acesso | `app-agendadoutor/src/views/pages/autenticacao/LoginView.vue`; stores/controllers/middleware Auth | `src/components/Shell.tsx`; `src/lib/useAuth.ts`; `MandatoryPasswordChange.tsx`; `TeamAdmin.tsx` |
| Onboarding | `ClinicWizardView.vue`; `StepCreateClinic.vue` | `ClinicAccessRequestPage.tsx`; `PlatformClinicProvisioningPage.tsx`; migration de provisionamento |
| Atendimento/registro/autosave | `InProgressAppointmentView.vue`; `SaveStatusIndicator.vue`; records store/API/controller/model | `ClinicalEncounterWorkspaceV4.tsx`; `ClinicalWorkspaceV3.tsx`; `ClinicalWorkspace.tsx`; `activeClinicalEncounter.ts`; `clinicalEncounterUx.ts`; `ClinicalAssessmentRunner.tsx` |
| Documentos médicos | `PrescriptionTab.vue`; `ExamOrderTab.vue`; `ExamReportTab.vue`; `CertificateTab.vue`; modelos/controllers correspondentes | `src/lib/types.ts`; repository; workspace clínico; consentimentos; `docs/NEXUS_GAP_MAP.md` |
| Anamnese/modelos | `AnamneseFormTab.vue`; `AnamnesisTemplate.js`; `AnamnesisResponse.js` | `assessmentEngine.ts`; `ClinicalAssessmentRunner.tsx`; `ClinicalAssessmentHistory.tsx`; `AssessmentTemplatesAdmin.tsx` |
| Procedimentos/termos | `AttendanceProceduresTab.vue`; `AttendanceConsentTermsTab.vue` | providers clínicos, consentimentos/RPCs, financeiro e boundary de finalização atual |
| Paciente/mídia/notas | `PatientDetailView.vue`; `PatientMediaGallery.vue`; `PatientNotesTab.vue` | `Pacientes.tsx`; workspace longitudinal; Assessment Engine; contratos atuais |
| Nexus | Fluxo histórico não é boundary reutilizável | `ActiveEncounterClinicalTools.tsx`; `NexusPatientContextHub.tsx`; Nexus pages/providers; C-01–C-06 |
| Planos | `featureService.js`; modelos Feature/Plan/Clinic; `usePlanAccess.js` | `clinicEntitlement.ts`; console de plataforma; migrations de entitlements |

## 8. Validação e operação desta atualização

- Evidências históricas permanecem fixadas por SHA; componentes com TODO/501 e contratos divergentes continuam diferenciados de recursos completos.
- A fotografia canônica foi revalidada contra `537af24ebfc138a9b8e372f0c6659eaf1b08a803`, após #390–#392.
- Esta atualização documental não declara prescrição, exames, laudos, atestados, procedimentos ou galeria como implementados.
- Nenhuma dependência, tabela, RPC, Edge Function ou configuração é criada por este documento.
- **Este mapa não requer comando no servidor, migration, Edge Function ou redeploy.**