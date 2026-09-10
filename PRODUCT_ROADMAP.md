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

Implementada no repositório, com rollout de migration ainda pendente em produção.

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
- aplicar/verificar a migration #399 em produção somente após aprovação/merge explícitos;
- garantir observabilidade suficiente para distinguir erro clínico, financeiro, entitlement e UX.

### Validação UX

- medir tempo/cliques do fluxo agenda → atendimento → registro → conclusão;
- testar owner/admin clínico, professional clinical-only, recepção e financeiro com dados realistas;
- validar desktop/mobile e light/dark nos fluxos principais;
- tratar loading/empty/error/success como parte do produto;
- registrar fricções observadas, não apenas preferências subjetivas.

---

## NEXT PRODUCT SLICES

### 1. Encounter UX / clinical-professional ergonomics

Aprimorar o ambiente de atendimento com evidência de profissionais reais, sem trocar o lifecycle já fechado.

Prioridades:

- menos navegação e contexto persistente do paciente/appointment;
- leitura longitudinal eficiente;
- correção/adendo auditável de Encounter Record finalizado;
- linguagem e ergonomia adequadas a diferentes profissionais;
- autoentrada em Consultório apenas quando houver callback canônico único pós-início/continuação do Encounter.

### 2. Cobertura deste atendimento

Adicionar informação financeira **contextual ao Encounter**, não o Financeiro global.

Mostrar somente o necessário ao atendimento atual, como particular/pacote e estado de cobertura permitido. Preservar #388/#389 e o privacy shell: saldo global, faturamento, lucro, repasse de outros profissionais e caixa da clínica continuam fora do Consultório.

### 3. Clinical Instruments — PHQ-9 / GAD-7

Instrumentos como PHQ-9/GAD-7 são potencialmente multiprofissionais conforme finalidade clínica, protocolo/configuração e contexto. Exemplos de contextos relevantes incluem Psiquiatria, Medicina de Família/APS, Clínica Médica, equipes de saúde mental, Enfermagem em APS/Saúde da Família e outros profissionais quando houver indicação/protocolo apropriado.

Esses exemplos orientam relevância; **não são ACL e não fazem auto-grant**. Enfermagem ainda não foi adicionada à identidade profissional suportada pelo runtime nesta slice.

Estado canônico deste eixo:

```text
[x] Clinical Instrument Authorization Foundation (#399)
[ ] Clinician-Assisted Administration
[ ] Encounter Instrument UX
[ ] Consultório V5 integration/polish
```

A foundation #399 está implementada no repositório, mas sua migration ainda não foi aplicada em produção. Nenhuma administração de PHQ/GAD, persistência multiprofissional nova ou entrega remota foi implementada.

#### 3.1 Clinical Instrument Authorization Foundation — entregue no repositório

A autoridade clínica neutra e o primeiro boundary contextual foram implementados separadamente do namespace `nexus.*`.

Contrato preservado:

- C-01…C-06 intactos;
- nenhum `nexus.*` concedido apenas para aplicação de PHQ-9/GAD-7;
- profissão/especialidade continuam identidade/relevância, nunca grant;
- `clinical_instrument_catalog` controla exposição multiprofissional explícita e não infere exposição do registry Nexus;
- configuração da clínica controla disponibilidade institucional via `clinic_clinical_instrument_settings`;
- `clinical.instrument.apply` controla autorização base;
- Apply in Encounter exige profissional atribuído + `em_atendimento`;
- entitlement comercial continua conceito separado da autorização clínica.

A engine Nexus permanece a fonte técnica de definição/versionamento/scoring de PHQ-9/GAD-7. O catálogo neutro referencia esses contratos; não os reimplementa.

#### 3.2 Clinician-Assisted Administration

Próxima slice deste eixo: permitir a administração presencial do mesmo instrumento durante o atendimento, sem depender de celular/WhatsApp.

Contrato de produto esperado:

- respostas pertencem ao paciente;
- profissional administra/registra as respostas;
- `appointment_id` quando houver Encounter;
- instrumento e versão explícitos;
- mesmo scoring validado do self-assessment;
- provenance diferenciada, conceitualmente `patient_self` ou `clinician_assisted`;
- autoria do ato profissional preservada;
- resultado não equivale a diagnóstico automático;
- nenhuma flexibilização da persistência doctor-only Nexus apenas para obter multiprofissionalidade; se necessário, persistência clínica neutra será uma slice própria.

#### 3.3 Encounter Instrument UX

Depois da operação canônica existir, expor no atendimento o instrumento com UX adequada. A direção continua:

```text
PHQ-9
[Aplicar agora] [Enviar ao paciente]

GAD-7
[Aplicar agora] [Enviar ao paciente]
```

`Enviar ao paciente` ainda não possui boundary nesta roadmap slice implementada e não deve herdar automaticamente o requisito de appointment ativo do Apply in Encounter.

O modo de aplicação não muda identidade, versão nem scoring do instrumento. A UI deve diferenciar autorização de relevância e não deve duplicar PHQ-9/GAD-7 dentro do Assessment Engine.

Requisito futuro de segurança do PHQ-9: resposta positiva ao item 9 deve permanecer visível e gerar destaque para avaliação clínica, sem equivaler isoladamente a diagnóstico e sem gerar conduta/prescrição automática.

#### 3.4 Consultório V5 integration/polish

Direção de UX futura, não implementação atual:

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

### 4. Prescription V1

Implementar a primeira fatia de prescrição com contrato canônico, autoria, emitente, lifecycle/histórico e regras server-side adequadas. UX histórica pode inspirar ergonomia; arquitetura e autorização atuais prevalecem.

### 5. Demais documentos médicos conforme piloto

Priorizar atestado/declaração, solicitação de exames, relatório/laudo e outros documentos somente conforme demanda observada e requisitos aplicáveis. Evitar vários módulos superficiais ao mesmo tempo.

### 6. Finance Configuration

Evoluir configuração financeira sem transformar relação econômica em role:

- operação solo/equipe;
- categorias;
- parceiro/repasse em percentual ou valor fixo;
- histórico e effective dates;
- regras por profissional/procedimento quando justificadas.

Não assumir comissão fixa canônica.

### 7. Onboarding e pilot friction

Reduzir tempo de setup e suporte para a primeira clínica/profissional. Tratar as maiores fricções encontradas no piloto antes de ampliar integrações secundárias.

### 8. Financeiro avançado e integrações por evidência

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
