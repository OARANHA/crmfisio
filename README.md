# MedicsPro — SaaS multiprofissional para clínicas

MedicsPro integra **ERP + CRM + Agenda + EHR/Prontuário + Financeiro + Automação + relacionamento com paciente** em um único runtime orientado à operação real da clínica.

O fluxo central do produto é:

**Paciente → Agenda → Atendimento → Prontuário → Documentos → Financeiro → Comunicação**

O núcleo clínico é compartilhado entre profissões. Profissão, especialidade, identidade profissional, capabilities e entitlements compõem as ferramentas disponíveis sem transformar role em profissão.

---

## Estado atual do produto

A fundação técnica já cobre os principais ciclos que precisam existir antes de ampliar o catálogo de features:

- autenticação Supabase, multi-tenant e RLS;
- papéis operacionais `owner`, `admin`, `professional`, `recep` e `financeiro`;
- `platform_admin` em domínio separado da clínica;
- Agenda role-aware e Clinician Daily Home;
- atendimento clínico dedicado com Encounter UX;
- Encounter Clinical Record editável por atendimento;
- materialização determinística da Evolution oficial após confirmação humana;
- assessment engine com modelos estruturados e drafts reais;
- Nexus como engine clínica especializada integrada ao runtime MedicsPro;
- financeiro com separação explícita entre finalização clínica e falhas esperadas de cobertura;
- exceções financeiras auditáveis e resolução explícita;
- CRM, comunicação/WhatsApp, consentimentos, relatórios e configurações;
- Consultório / Gestão como contextos de apresentação, sem alterar autorização.

A existência técnica de uma feature não significa que sua UX esteja validada por profissionais externos. O estado de beta, os smokes pendentes e a sequência de produto ficam nos documentos de continuidade abaixo.

---

## Modelo clínico canônico

O novo atendimento usa um **Encounter Record** ligado ao appointment, paciente, clínica e `professional_id` canônico. O profissional registra uma vez:

- Motivo / demandas;
- História atual / HDA;
- Achados / exame;
- Avaliação clínica / problemas;
- Plano / conduta;
- Observações.

Após revisão e confirmação humana, o fluxo materializa a **Evolution oficial determinística** e finaliza o appointment na mesma boundary clínica. Não existe uma segunda Evolution universal obrigatória no novo fluxo.

Registros finalizados são históricos. Correção/adendo auditável de um Encounter Record finalizado ainda é uma slice futura; não há backfill fictício de atendimentos históricos.

---

## Papéis, profissão e autorização

Papéis operacionais da clínica:

| Papel | Função principal |
| --- | --- |
| `owner` | gestão da clínica; atos clínicos somente se também cumprir a boundary clínica |
| `admin` | administração; não recebe autoria clínica por ser admin |
| `professional` | papel operacional do profissional assistencial |
| `recep` | recepção, agenda, cadastro e operação compatível |
| `financeiro` | operação financeira compatível |

`role != profissão`.

A profissão/identidade clínica é modelada separadamente. `appointments.professional_id` é a referência clínica canônica. `fisio_id` e nomes físicos históricos relacionados a fisioterapia podem existir por compatibilidade, mas não devem ser usados como autorização nova nem como definição do produto.

`platform_admin` pertence ao domínio da plataforma SaaS e não é role interna de clínica.

Parceiro/sócio/repasse também não é role. Relações de parceria e remuneração são domínio econômico futuro e não devem ser usadas como atalho de autorização.

---

## Consultório / Gestão

`PresentationContext = 'clinical' | 'management'` é **estado de apresentação**, não autorização.

- `professional`: Consultório only;
- `owner/admin`: Consultório + Gestão somente com identidade clínica válida + `clinical.attend`;
- `recep/financeiro`: Gestão only.

Modo Consultório oculta visualmente Financeiro global, CRM gerencial, Relatórios administrativos e Configurações. URLs administrativas continuam submetidas aos guards reais e recebem privacy boundary quando apropriado.

Trocar contexto não muda role, JWT, tenant, RLS, capabilities, entitlements ou `canView`. A preferência local é isolada por `user_id + clinic_id`.

Autoentrada automática no Consultório após iniciar/continuar um atendimento ainda não foi implementada; aguarda um ponto canônico único de transição.

---

## Nexus

Nexus é uma **engine clínica especializada integrada ao runtime MedicsPro**.

A hierarquia é:

- `OARANHA/crmfisio` — produto/runtime canônico;
- `OARANHA/nexus` — upstream/laboratório de inteligência clínica;
- `OARANHA/medicspro` — referência histórica obrigatória de UX/workflow, nunca fonte de arquitetura, tenancy ou autorização atual.

Nexus permanece fail-closed e médico-only: entitlement da clínica + capability + identidade médica válida + relação assistencial + autorização server-side. Especialidade define relevância; não concede autorização isoladamente. Role sozinho também não libera Nexus.

---

## Financeiro e finalização clínica

A finalização clínica válida **não deve ser perdida** por uma falha esperada de cobertura.

Estados esperados como:

- `package_exhausted`;
- `package_expired`;
- `package_not_eligible`

são registrados como `appointment_financial_exception`, sem consumo gratuito silencioso.

A resolução explícita posterior segue o contrato atual:

- `owner/admin`: `CHARGE` ou `WAIVE`;
- `financeiro`: `CHARGE`;
- `recep/professional`: sem ação de resolução.

Falhas financeiras inesperadas de integridade continuam fail-closed e podem reverter a transação clínica, conforme os invariantes PostgreSQL existentes.

---

## Stack e arquitetura de alto nível

- **Frontend:** React 18, TypeScript, Vite, Tailwind, React Router;
- **Estado/domínios:** providers e hooks especializados, com fachadas de compatibilidade onde ainda existem — `store.tsx` não é a arquitetura monolítica canônica;
- **Backend:** Supabase self-hosted + PostgreSQL + Auth + RLS/RBAC + RPCs + Edge Functions;
- **Mensageria:** Evolution API integrada por outbox/worker/webhook;
- **Validação:** Vitest, TypeScript, ESLint, build e verificadores PostgreSQL dedicados.

Valores monetários de domínio são tratados em centavos inteiros quando aplicável.

---

## Desenvolvimento local

```bash
git clone https://github.com/OARANHA/crmfisio.git
cd crmfisio
npm ci
npm run dev
```

Validação ampla:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Consulte `DEPLOY.md` antes de qualquer ação de servidor ou produção.

---

## Documentos de continuidade

Leia nesta ordem ao assumir trabalho no projeto:

1. [`AGENTS.md`](AGENTS.md) — regras operacionais e invariantes;
2. [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — snapshot curto da continuidade atual;
3. [`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md) — sequência de produto;
4. [`TODO.md`](TODO.md) — pendências concretas;
5. [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md) — prontidão e gaps de piloto/beta.

Documentos especializados ficam em `docs/`, incluindo Encounter Record, Presentation Context, aceitação clínica/financeira e rollout.

---

## Segurança e LGPD

Dados de saúde são sensíveis. MedicsPro usa controles como autenticação, RLS, RBAC/capabilities, isolamento por clínica, consentimentos, auditoria e boundaries server-side. Esses controles apoiam segurança e conformidade, mas não equivalem por si só a uma declaração jurídica completa de conformidade LGPD.

A regra operacional é simples: **frontend visibility nunca substitui autorização de servidor**.

---

MedicsPro está em evolução contínua. Estado canônico atual, pendências e decisões devem ser atualizados sem transformar planos futuros em features concluídas.