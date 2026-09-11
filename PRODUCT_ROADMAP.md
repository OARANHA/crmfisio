# MedicsPro — Product Roadmap

**Estado em 2026-09-10**

## North Star

**Receita protegida/recuperada + eficiência operacional + qualidade clínica por clínica/mês.**

MedicsPro deve provar valor financeiro e operacional sem abrir mão de segurança clínica, multi-tenant, auditabilidade e excelente UX.

O produto é um SaaS multiprofissional para clínicas: **ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente**.

Fluxo central:

**Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação**

O núcleo clínico é compartilhado. Profissão, especialidade, identidade e capabilities compõem ferramentas; role operacional não define profissão.

Para instrumentos clínicos, preservar a decisão canônica:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

A engine implementa o instrumento; capability/boundaries definem autorização; profissão, especialidade, protocolo/configuração e contexto do Encounter orientam disponibilidade/relevância/apresentação. Nenhuma dessas camadas concede silenciosamente outra.

Para exposição multiprofissional, preservar adicionalmente:

```text
Nexus engine registry membership != multiprofessional clinical exposure
```

---

## FOUNDATION DONE

Estas foundations não devem ser reabertas sem evidência concreta de regressão ou novo requisito incompatível.

### Identidade, tenant e autorização

- multi-tenant por clínica com Auth/RLS/RBAC;
- papéis canônicos `owner`, `admin`, `professional`, `recep`, `financeiro`;
- `platform_admin` separado do domínio interno da clínica;
- `professional_id` como referência clínica canônica, com `fisio_id` apenas como compatibilidade residual;
- entitlement da plataforma, configuração da clínica e autorização do usuário tratados como conceitos distintos;
- identidade/capability/autoria/relação assistencial como boundary de atos clínicos.

### Nexus C-01–C-06

- Nexus integrado ao runtime MedicsPro, com `OARANHA/nexus` apenas como upstream/lab;
- o **Nexus médico avançado** mantém os boundaries C-01–C-06 atuais e `nexus.*` fail-closed;
- entitlement + capability + identidade médica válida + relação assistencial + autorização server-side continuam sendo exigências onde o boundary Nexus atual as define;
- especialidade informa relevância, não concede autorização;
- o fato de PHQ-9/GAD-7 reutilizarem implementação/scoring do subsistema Nexus não transforma esses instrumentos em atos universalmente médico-only;
- não flexibilizar C-06 nem alterar o significado atual de `nexus.eem` para resolver multiprofissionalidade.

### Fluxo clínico #390–#396

- #390 — Clinician Daily Home;
- #391 — Agenda Role-Aware V4;
- #392 — Clinical Encounter UX V4;
- #393 — Legacy Clinical Reconciliation V4.1;
- #394 — Encounter Clinical Record Foundation;
- #395 — production-safe verifier read-only do #394;
- #396 — Consultório / Gestão Privacy Shell.

O Encounter Record é a unidade editável do novo atendimento. O profissional registra motivo/demandas, HDA/história atual, achados/exame, avaliação clínica/problemas, plano/conduta e observações uma única vez. Após confirmação humana, o registro gera determinísticamente a Evolution oficial e o appointment é finalizado.

### Clinical Instrument Authorization Foundation (#399)

Implementada no repositório e presente no stack efetivo de produção.

A foundation entrega:

- `clinical.instrument.apply` como capability neutra explícita e sem auto-grant;
- `clinical_instrument_catalog` como allowlist multiprofissional controlada, inicialmente somente `phq9` e `gad7`;
- referência técnica dos itens do catálogo aos contratos versionados da engine Nexus, sem duplicar perguntas, validação ou scoring;
- `clinic_clinical_instrument_settings` com default conservador `false`;
- `can_apply_clinical_instrument_in_encounter(...)` como primeiro boundary contextual, exigindo `appointments.professional_id = auth.uid()` e status `em_atendimento`;
- owner/admin sujeitos às mesmas boundaries clínicas, sem bypass;
- helper base não executável pelo browser.

Uma futura escala presente em `nexus_result_contracts` não é automaticamente exposta no catálogo clínico neutro.

A #399 **não** implementa administração assistida, persistência multiprofissional nova, UI PHQ/GAD nem entrega remota.

### Encounter Temporal Start Boundary (#400)

A #400 foi implementada, mergeada e aplicada/verificada em produção.

Contrato fechado:

- fluxo normal não pode iniciar `em_atendimento` para appointment futuro;
- `current_clinic_operational_date()` é a abstração canônica de data operacional;
- o guard temporal protege somente a entrada em `em_atendimento`;
- manutenção confiável possui bypass explícito controlado;
- `can_apply_clinical_instrument_in_encounter(...)` também exige data do appointment não futura como defesa em profundidade;
- o verifier histórico não congela a implementação de timezone e deve permanecer future-compatible.

O fallback atual é `America/Sao_Paulo`. Timezone por clínica é evolução futura necessária antes de expansão geográfica relevante, não motivo para reabrir #400 agora.

### Repair histórico pós-#400 (#402)

O appointment futuro histórico conhecido que havia sido deixado em `em_atendimento` antes da #400 foi reparado em produção com preconditions fail-closed, audit trail canônico e verifier read-only.

Resultado validado:

- restore `em_atendimento → agendado`;
- predecessor `agendado` comprovado pelo `appointment_status_history`;
- assessment relacionado permaneceu `draft`, vazio e inalterado;
- nenhuma dependência clínica/financeira/material apareceu;
- verifier pós-repair passou.

O repair está encerrado. Não repetir o script após o estado final validado.

### Assessment Engine

A foundation de Assessment permanece multiprofissional e reutilizável para avaliações estruturadas. Ela serve como referência arquitetural de templates/versionamento/autoria/lifecycle, mas **não deve receber uma segunda implementação de PHQ-9/GAD-7 apenas para contornar o boundary Nexus atual**.

Preservar definição/versão/scoring validados existentes de PHQ-9/GAD-7 na engine canônica. O catálogo neutro #399 aponta para essa engine em vez de duplicá-la.

### Finalização clínica × financeiro

Após #388, falhas esperadas de cobertura não devem apagar uma finalização clínica válida. `package_exhausted`, `package_expired` e `package_not_eligible` geram `appointment_financial_exception`, sem consumo gratuito silencioso.

#389 adiciona resolução explícita:

- owner/admin: `CHARGE` ou `WAIVE`;
- financeiro: `CHARGE`;
- recep/professional: sem resolução.

Parceiro/repasse não é autorização.

---

## PILOT HARDENING

Fundação técnica pronta não equivale a UX validada por profissionais externos.

### 0. Fechar smoke e observabilidade pendentes

Antes de ampliar o piloto:

- registrar a comprovação read-only pós-finalização do smoke real #394, se não houver evidência posterior no repositório;
- registrar smoke real de `CHARGE` e `WAIVE` do #389, se ainda pendente;
- atualizar/versionar o verifier antigo #388 cuja assertion sobre ausência da RPC #389 ficou obsoleta;
- fazer smoke visual/uso real do Consultório/Gestão #396;
- garantir observabilidade suficiente para distinguir erro clínico, financeiro, entitlement e UX.

#399, #400 e o repair #402 não permanecem como rollout pendente neste estágio.

### Validação UX

- medir tempo/cliques do fluxo agenda → atendimento → registro → conclusão;
- testar owner/admin clínico, professional clinical-only, recepção e financeiro com dados realistas;
- validar desktop/mobile e light/dark nos fluxos principais;
- tratar loading/empty/error/success como parte do produto;
- registrar fricções observadas, não apenas preferências subjetivas.

---

## NEXT PRODUCT SLICES

### 1. Clinician-Assisted Administration — PHQ-9 / GAD-7

Esta é a próxima slice funcional do eixo de instrumentos após a foundation #399.

Objetivo: permitir administração presencial/assistida do mesmo instrumento durante o atendimento, sem depender de celular/WhatsApp e sem duplicar definição/scoring.

Contrato esperado:

- respostas pertencem ao paciente;
- profissional administra/registra as respostas;
- `appointment_id` quando houver Encounter;
- instrumento e versão explícitos;
- mesmo scoring validado do self-assessment;
- provenance diferenciada, conceitualmente `patient_self` ou `clinician_assisted`;
- autoria do ato profissional preservada;
- resultado não equivale a diagnóstico automático;
- persistência canônica definida antes da UI;
- nenhuma flexibilização da persistência doctor-only Nexus apenas para obter multiprofissionalidade.

Requisito de segurança PHQ-9: resposta positiva ao item 9 deve permanecer visível e gerar destaque para avaliação clínica, sem equivaler isoladamente a diagnóstico e sem gerar conduta/prescrição automática.

### 2. Encounter Instrument UX

Depois da operação canônica existir, expor no atendimento o instrumento com UX adequada:

```text
PHQ-9
[Aplicar agora] [Enviar ao paciente]

GAD-7
[Aplicar agora] [Enviar ao paciente]
```

`Aplicar agora` usa o boundary do Encounter. `Enviar ao paciente` ainda deve nascer como boundary contextual separado; não herdar automaticamente appointment ativo como requisito universal.

A UI deve distinguir autorização de relevância e não duplicar PHQ-9/GAD-7 dentro do Assessment Engine.

### 3. Encounter UX / clinical-professional ergonomics

Aprimorar o ambiente de atendimento com evidência de profissionais reais, sem trocar o lifecycle já fechado.

Prioridades:

- menos navegação e contexto persistente do paciente/appointment;
- leitura longitudinal eficiente;
- correção/adendo auditável de Encounter Record finalizado;
- linguagem e ergonomia adequadas a diferentes profissionais;
- autoentrada em Consultório apenas quando houver callback canônico único pós-início/continuação do Encounter;
- antes de expansão fora do timezone atual, evoluir data operacional para timezone por clínica sem regredir #400.

### 4. Cobertura deste atendimento

Adicionar informação financeira **contextual ao Encounter**, não o Financeiro global.

Mostrar somente o necessário ao atendimento atual, como particular/pacote e estado de cobertura permitido. Preservar #388/#389 e o privacy shell: saldo global, faturamento, lucro, repasse de outros profissionais e caixa da clínica continuam fora do Consultório.

### 5. Consultório V5 integration/polish

Direção de UX futura:

```text
um Encounter
├─ Registro
├─ Avaliações
├─ Instrumentos
├─ Prescrição
├─ Exames
├─ Documentos
└─ Nexus
```

Absorver ergonomia do MedicsPro histórico sem portar Vue/Pinia/Mongo, autorização antiga, autosave antigo, checkout ou outros contratos legados.

### 6. Prescription V1

Implementar a primeira fatia de prescrição com contrato canônico, autoria, emitente, lifecycle/histórico e regras server-side adequadas. UX histórica pode inspirar ergonomia; arquitetura e autorização atuais prevalecem.

### 7. Demais documentos médicos conforme piloto

Priorizar atestado/declaração, solicitação de exames, relatório/laudo e outros documentos somente conforme demanda observada e requisitos aplicáveis. Evitar vários módulos superficiais ao mesmo tempo.

### 8. Finance Configuration

Evoluir configuração financeira sem transformar relação econômica em role:

- operação solo/equipe;
- categorias;
- parceiro/repasse em percentual ou valor fixo;
- histórico e effective dates;
- regras por profissional/procedimento quando justificadas.

Não assumir comissão fixa canônica.

### 9. Onboarding e pilot friction

Reduzir tempo de setup e suporte para a primeira clínica/profissional. Tratar as maiores fricções encontradas no piloto antes de ampliar integrações secundárias.

### 10. Financeiro avançado e integrações por evidência

Somente depois do núcleo acima e com demanda do piloto:

- pagamento parcial/múltiplos meios;
- caixa/conciliação;
- recibos/NFS-e;
- integrações de pagamento;
- automações e relatórios avançados.

---

## Princípios de priorização

Cada entrega deve melhorar materialmente pelo menos um destes eixos:

- receita protegida/recuperada;
- ocupação da agenda;
- retenção e continuidade;
- qualidade/segurança clínica;
- eficiência de profissional/recepção/gestão;
- onboarding/time-to-value;
- privacidade e auditabilidade;
- percepção de produto moderno e confiável.

Não usar feature count como objetivo. Preferir poucas jornadas de alta frequência claramente melhores.

---

## Regra de continuidade

Código/schema atuais prevalecem sobre documentação envelhecida. Use [`AGENTS.md`](AGENTS.md) como autoridade operacional, [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) como snapshot e [`TODO.md`](TODO.md) para pendências concretas.

`main` é potencialmente deployável. Mudanças de banco exigem rollout/verifier explícitos; nenhum documento deve converter plano, smoke parcial ou ausência de blocker em validação que não foi observada.
