# MedicsPro — Product Roadmap

**Estado em 2026-09-10**

## North Star

**Receita protegida/recuperada + eficiência operacional + qualidade clínica por clínica/mês.**

MedicsPro deve provar valor financeiro e operacional sem abrir mão de segurança clínica, multi-tenant, auditabilidade e excelente UX.

O produto é um SaaS multiprofissional para clínicas: **ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente**.

Fluxo central:

**Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação**

O núcleo clínico é compartilhado. Profissão, especialidade, identidade e capabilities compõem ferramentas; role operacional não define profissão.

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
- médico-only e fail-closed;
- entitlement + capability + identidade médica válida + relação assistencial + autorização server-side;
- especialidade informa relevância, não concede autorização.

### Fluxo clínico #390–#396

- #390 — Clinician Daily Home;
- #391 — Agenda Role-Aware V4;
- #392 — Clinical Encounter UX V4;
- #393 — Legacy Clinical Reconciliation V4.1;
- #394 — Encounter Clinical Record Foundation;
- #395 — production-safe verifier read-only do #394;
- #396 — Consultório / Gestão Privacy Shell.

O Encounter Record é a unidade editável do novo atendimento. O profissional registra motivo/demandas, HDA/história atual, achados/exame, avaliação clínica/problemas, plano/conduta e observações uma única vez. Após confirmação humana, o registro gera determinísticamente a Evolution oficial e o appointment é finalizado.

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

### Validação UX

- medir tempo/cliques do fluxo agenda → atendimento → registro → conclusão;
- testar owner/admin clínico, professional clinical-only, recepção e financeiro com dados realistas;
- validar desktop/mobile e light/dark nos fluxos principais;
- tratar loading/empty/error/success como parte do produto;
- registrar fricções observadas, não apenas preferências subjetivas.

---

## NEXT PRODUCT SLICES

### 1. Encounter UX / physician ergonomics

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

### 3. Instrument Delivery — PHQ-9 / GAD-7

Unificar a entrega de instrumentos validados em dois caminhos explícitos:

- **Aplicar agora**;
- **Enviar ao paciente**.

O resultado deve voltar ao prontuário com autoria, contexto e lifecycle verificáveis. Não criar um segundo motor clínico.

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