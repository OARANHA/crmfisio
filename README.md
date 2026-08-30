# 🫀 Coração — ERP + CRM + Prontuário Eletrônico para Fisioterapia

> O cérebro da operação de uma clínica de fisioterapia: **Agenda Inteligente**, **PEP**, **Financeiro**, **CRM**, **Mensageria** e **Conformidade LGPD** — em um único sistema web responsivo.

![React](https://img.shields.io/badge/React_18-61dafb?logo=react&logoColor=000&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178c6?logo=typescript&logoColor=fff&style=flat-square)
![Vite](https://img.shields.io/badge/Vite_6-646cff?logo=vite&logoColor=fff&style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind_4-38bdf8?logo=tailwindcss&logoColor=000&style=flat-square)
![React Router](https://img.shields.io/badge/React_Router_6-f44250?logo=reactrouter&logoColor=fff&style=flat-square)
![LGPD](https://img.shields.io/badge/LGPD-by_design-f2545b?style=flat-square)

---

## ✨ O que está implementado

### Fase 1 — MVP (operação real, sem planilha)

| Módulo | Destaques |
|---|---|
| 🗓 **Agenda Inteligente** | Visões **dia / semana / mês**, grade 7h–19h, salas e equipamentos, status visual (Agendado → Confirmado → Em atendimento → Finalizado / Faltou / Cancelado), clique no horário vazio para agendar |
| 🩺 **Prontuário Eletrônico (PEP)** | Cadastro completo, **anamnese**, **CID-10**, evolução clínica sessão a sessão com anexos, histórico de sessões e pacotes |
| 💰 **Financeiro** | Contas a receber/pagar com baixa (Pix/Boleto), fluxo de caixa, **pacotes de sessões com saldo**, cobrança via WhatsApp |
| 🎯 **CRM** | Funil kanban (Lead → Avaliação → Tratamento → Alta) com drag & drop, **NPS** com promotores/neutros/detratores, **alerta de pacientes inativos** |
| 📊 **Dashboard do Gestor** | Produção mensal, a receber, taxa de comparecimento (no-show), novos pacientes, NPS, receita 7 dias, produtividade por fisioterapeuta, pendências que exigem ação |
| 🔐 **RBAC** | 3 perfis — **Administrador**, **Fisioterapeuta** e **Recepcionista** — filtrando sidebar, abas e ações |

### Fase 2 — Automação & conformidade

- 📲 **Central de Mensagens**: fila WhatsApp com status em tempo real (`enviando → enviado → entregue ✓ → lido ✓✓`), gatilhos de automação (confirmação 48h, NPS pós-atendimento, reativação de inativos), modelos editáveis, respeito ao **opt-in LGPD**
- 🔁 **Recorrência editável**: séries "2x por semana × 2 meses" com **edição e cancelamento** (passado preservado) e preview de datas
- ✍️ **Assinatura digital em canvas**: termos de consentimento com **hash do conteúdo + IP + timestamp + imagem** da assinatura
- 💸 **Fechamento de repasse**: competência mensal, base calculada das sessões finalizadas, comissão de 40%, "marcar pago"

### Fase 3 — Escala & LGPD self-service

- 🏢 **Multi-unidade**: seletor global (Sede Centro / Savassi) filtrando Agenda, Dashboard e Relatórios; salas e sessões vinculadas por unidade
- 📦 **Portabilidade (art. 18, V)**: exportação JSON completa do titular com 1 clique
- 🕳 **Direito ao esquecimento (art. 18, VI)**: anonimização irreversível com confirmação dupla (retenção clínica anônima de 20 anos — CFM)
- 🧾 **Trilha de auditoria** `audit_log` append-only: cada login, assinatura, exportação, anonimização e repasse gera entrada imutável
- 📈 **Relatórios de produção**: competência selecionável, produção por profissional, ocupação por dia, receita por categoria, **exportação CSV real** (padrão Excel pt-BR)

---

## 🚀 Rodando localmente

```bash
git clone https://github.com/OARANHA/crmfisio.git
cd crmfisio
npm install
npm run dev        # http://localhost:5173
```

Build de produção:

```bash
npm run build      # gera dist/ (estático, pronto para CDN)
npm run preview
```

## 👤 Perfis de demonstração

| Perfil | Acesso | O que observar |
|---|---|---|
| **Dra. Helena Duarte** · Administrador | total | Relatórios + CSV, LGPD self-service, auditoria, repasse |
| **Dr. Caio Monteiro** · Fisioterapeuta | clínico completo | Assinatura digital no PEP, financeiro somente leitura |
| **Rafael Nogueira** · Recepcionista | operacional | Sem acesso clínico; dispara automações de WhatsApp |

---

## 🧱 Stack & arquitetura

| Camada | Escolha | Por quê |
|---|---|---|
| Front-end | **React 18 + Vite + TypeScript + Tailwind 4** | Tipagem compartilhada, build estático leve, PWA-ready |
| Estado | **Context + hooks** (`src/lib/store.tsx`) | Camada única de domínio — trocável por TanStack Query + API sem tocar nas páginas |
| Roteamento | **React Router 6** (HashRouter) | Funciona em hospedagem estática sem rewrite de servidor |
| Back-end (próximo) | **NestJS + Prisma + PostgreSQL 16 + Redis** | Monólito modular espelhando os domínios; *exclusion constraints* anti-choque de agenda no banco |
| Auth/Segurança | **JWT curto + refresh httpOnly + RBAC + AES-256-GCM** | Dados sensíveis criptografados, audit log append-only |

> Os tipos em `src/lib/types.ts` **espelham 1:1 o esquema relacional aprovado** (14 tabelas, 19 relacionamentos). Valores monetários em **centavos** (inteiros), nunca float.

## 📁 Estrutura

```
src/
├── components/       # Shell (login/sidebar/topbar), ECG, Reveal/CountUp, ícones SVG
├── lib/
│   ├── types.ts      # domínio = espelho do ERD + metadados de UI
│   ├── seed.ts       # dados de demonstração (datas relativas à semana atual)
│   ├── store.tsx     # estado global, RBAC, automações, ações LGPD
│   └── ui.tsx        # design system: Card, Btn, Modal, Chip, KPI…
└── pages/            # Dashboard, Agenda, Pacientes(PEP), Financeiro, Crm,
                      # Mensagens, Relatorios, Config
```

---

## 🌐 Publicando

- **Vercel / Netlify / Cloudflare Pages**: suba a pasta `dist/` após `npm run build` — funciona como está, sem configuração.
- **GitHub Pages**: por usar `HashRouter`, as rotas funcionam; ajuste `base: './'` no `vite.config.ts` antes do build para o caminho `/crmfisio/`.

## 🗺 Roadmap

- [ ] **Back-end** NestJS + Prisma (API REST + WebSockets, BullMQ para lembretes)
- [ ] Integração real: WhatsApp (Evolution API/Meta), pagamentos (Asaas/Mercado Pago com split), Clicksign
- [ ] 2FA para administradores · criptografia de campo via KMS
- [ ] PWA offline de leitura para o tablet da sala

## ⚖️ LGPD

Dados de saúde são **dados sensíveis** (art. 5º, II). O sistema trata como fundação: CPF mascarado na UI, opt-in explícito para WhatsApp, consentimentos versionados com hash/IP/timestamp, portabilidade e esquecimento self-service, e auditoria imutável. Base legal primária: tutela da saúde (art. 7º, VIII).

---

Feito como blueprint vivo do **Projeto Coração** — passos 1 (arquitetura), 2 (banco de dados) e 3 (roadmap) aprovados e implementados. 🫀
