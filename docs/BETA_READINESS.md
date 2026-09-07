# MedicsPro — Beta Readiness

Documento vivo para acompanhar a preparação do MedicsPro para uso por profissionais reais.

## Legenda

- 🟢 GREEN — gate validado e apto para piloto controlado.
- 🟡 YELLOW — fundação existe, mas ainda há riscos/pendências antes de ampliação.
- 🔴 RED — bloqueia piloto.

## Estado em 2026-09-07

| Gate | Status | Evidência / próxima ação |
|---|---|---|
| Multi-tenant / RLS | 🟢 | Preflight P1 em produção confirmou RLS crítico, ausência de órfãos e referências tenant-safe. |
| Papéis e identidade | 🟢 | `platform_admin` separado de papéis internos; Auth/Profile/Clinic íntegros e login canônico via RPC. |
| Provisionamento de clínicas | 🟢 | Fluxo idempotente e auditável validado com clínica piloto real. |
| Platform Admin | 🟢 | Sessão isolada do login das clínicas, seleção de clínica persistida e governança funcional validada. |
| Entitlements — UI/rotas | 🟢 | Rotas, menus, dashboards e superfícies indiretas respeitam decisões de módulo. |
| Entitlements — Financeiro | 🟢 | `finance.access` com enforcement server-side em pagamentos, histórico e operações de pacotes. |
| Entitlements — CRM | 🟢 | `crm.access` protege mutações e superfícies oficiais; papéis não autorizados ficam read-only. |
| Entitlements — WhatsApp | 🟢 | `whatsapp.access` protege outbox, templates, revisão humana e Evolution worker. |
| Entitlements — Avaliações customizadas | 🟢 | `assessments.custom` protege autoria/edição/publicação de templates próprios sem bloquear modelos padrão. |
| Relatórios | 🟢 | `reports.access` protege o módulo; NPS usa fórmula padrão, ausência de amostra não vira 100%, realizado/pipeline são separados e risco atual não é apresentado como retenção histórica ou causalidade comprovada. |
| Nexus Clinical Engine | 🟢 | Fail-closed, exige entitlement explícito + identidade médica válida + CRM. |
| Financeiro core | 🟢 | Ciclo canônico e cancelamento pré-pago com resolução financeira explícita validados em produção. |
| Agenda core | 🟢 | Transições, cancelamento/remarcação, concorrência de sessão e vínculo profissional protegidos. |
| Pacotes | 🟢 | Venda, saldo, consumo unitário, validade/esgotamento e bloqueio validados. |
| Atendimento clínico | 🟢 | Sessão, autoria, evolução e finalização possuem boundaries server-side; dashboard, `/hoje` e agenda completa convergem para o workspace clínico. Ver `CLINICAL_PILOT_ACCEPTANCE.md`. |
| Assessment Engine | 🟢 | Avaliações padrão + minhas avaliações + body map estruturado possuem boundary server-side e histórico versionado. |
| LGPD / portabilidade | 🟢 | Exportação `LGPD-portabilidade-v2` é server-authoritative, auditada na mesma transação e não depende do estado carregado no browser. |
| WhatsApp / Evolution operacional | 🟢 | Retry cego de entrega incerta é bloqueado, webhook reconcilia de forma fail-closed e a central expõe resultado incerto, falha definitiva, reconciliação, tentativas e timestamps operacionais. |
| UX / design system | 🟡 | Fundação visual V2.1 existe e a lista de Pacientes foi simplificada para superfície operacional; ainda falta passagem visual/uso real nas telas de maior frequência antes de ampliar o piloto. |
| Ajuda/manual dentro do painel | 🟢 | P0 + P1 implementados: ajuda por rota/papel para Agenda, Pacientes, Atendimento, Financeiro, CRM, WhatsApp e Relatórios, com orientação de Pacotes e Avaliações dentro dos contextos existentes. |

## P1 de estabilização — estado

O preflight read-only `VERIFY_20260907_P1_OPERATIONAL_PREFLIGHT.sql` foi executado no ambiente real e checks 1–13 ficaram GREEN. O ambiente possui três clínicas ativas e integridade tenant confirmada. Não havia, no momento da execução, clínica suspensa ou usuário inativo disponível como fixture; o cenário de usuário inativo já havia sido exercitado anteriormente. Não se deve suspender clínica produtiva apenas para cumprir checklist.

Frentes fechadas no P1:

1. mutações de equipe atômicas e unidades validadas antes de sincronização destrutiva;
2. exportação LGPD server-authoritative;
3. bootstrap de perfil autenticado por RPC canônico;
4. leitura clínica por relação assistencial;
5. proteção contra retry cego de entrega WhatsApp incerta + reconciliação fail-closed;
6. preflight operacional repetível e read-only;
7. semântica dos principais indicadores protegida contra leituras enganosas;
8. ajuda contextual ampliada para os módulos operacionais do piloto.

## Entitlements — semântica atual

Durante o rollout controlado, módulos comuns permanecem backward-compatible quando não existe linha física de entitlement. Uma linha explícita `enabled=false` bloqueia o recurso. Nexus é exceção: `nexus.access` é fail-closed e exige liberação explícita.

Chaves atuais:

- `finance.access`
- `crm.access`
- `whatsapp.access`
- `reports.access`
- `assessments.custom`
- `nexus.access`

## Atendimento clínico — estado do piloto

O fluxo clínico canônico converge para `ClinicalWorkspace`:

- dashboard clínico abre a sessão correta por `session_id`;
- `/hoje` só oferece ações clínicas ao fisioterapeuta responsável e faz handoff ao prontuário;
- agenda completa não oferece transição clínica de sessão de colega e não finaliza atendimento diretamente no drawer;
- evolução compartilhada preserva `session_id`;
- o banco exige sessão ativa, vínculo exato e evolução antes da finalização.

O roteiro vivo está em `docs/CLINICAL_PILOT_ACCEPTANCE.md` e deve ser repetido no primeiro piloto real e após alterações relevantes do fluxo.

## Pacientes — superfície operacional

A listagem clinic-wide de Pacientes é deliberadamente operacional:

- pesquisa por nome, nome preferido, telefone, e-mail, convênio e CPF;
- exibe identificação, contato, convênio, jornada, última visita e status;
- queixa principal e CID-10 não aparecem como colunas do diretório;
- conteúdo clínico permanece dentro do prontuário e respeita o boundary de relação assistencial no backend.

Isso mantém a regra: paciente pertence à clínica; prontuário pertence ao contexto assistencial.

## Relatórios — semântica do piloto

Antes do piloto, os principais indicadores foram saneados para evitar interpretação incorreta:

- NPS usa promotores menos detratores em escala -100 a +100;
- média 0–10 permanece conceito separado de NPS;
- comparecimento sem amostra válida aparece como ausência de taxa, não como 100%;
- volume de sessões não é chamado de ocupação quando não existe capacidade no denominador;
- recuperação realizada e pipeline não são somados como receita;
- eventos de recuperação não são apresentados como causalidade exclusiva de automação quando o vínculo causal não é comprovado;
- risco atual de continuidade não é apresentado como retenção histórica.

Validação com dados reais de piloto continua recomendada para aferir utilidade dos indicadores, não para corrigir esses contratos semânticos.

## WhatsApp / Evolution — estado do piloto

O fluxo operacional está apto para piloto controlado porque separa segurança de entrega de experiência de operação:

- o worker interno exige segredo próprio e não pode ser disparado por sessão humana;
- linhas `enviando` que ficam antigas são quarentenadas como `DELIVERY_UNCERTAIN`, sem retry cego;
- falhas HTTP definitivas são registradas separadamente de resultados de transporte incertos;
- aceite conhecido pelo provedor é persistido sem repetir o envio (`ACCEPTED_RECOVERED`);
- o webhook tenta reconciliar eventos outbound sem `provider_message_id` local apenas quando há um único candidato; ambiguidade falha fechada;
- a central de Mensagens expõe resultado incerto, falha definitiva, reconciliação, tentativa, evento e timestamps quando disponíveis;
- não existe botão de retry automático para mensagens incertas.

Pendências daqui em diante são refinamentos de produto e operação assistida, não bloqueadores estruturais do piloto.

## Ajuda contextual — estado do piloto

A ajuda acompanha o usuário sem criar uma segunda fonte de permissões:

- conteúdo versionado em `src/lib/helpContent.ts`;
- resolução por rota atual e papel do usuário;
- botão `?` e drawer lateral reutilizável;
- Agenda e `/hoje` explicam o fluxo operacional e o handoff clínico;
- Pacientes separa cadastro operacional de prontuário;
- Atendimento orienta sessão, autoria, evolução e Avaliação padrão x Minhas avaliações;
- Financeiro diferencia consulta, baixa, pacotes e exceções conforme o papel;
- CRM diferencia operação de funil de consulta read-only e reforça que CRM não é prontuário;
- WhatsApp explica estados de entrega e proíbe retry automático de `DELIVERY_UNCERTAIN`;
- Relatórios explicam NPS, ausência de amostra, realizado x pipeline e risco atual;
- testes impedem instruções incompatíveis com o papel do usuário.

P2 continua como evolução de onboarding, descoberta e treinamento, não como bloqueador do piloto.

## Financeiro — estado do piloto

O cancelamento de atendimento com pagamento liquidado exige resolução financeira explícita e auditável (`refund_due`, `credit_due` ou `retained`), preservando o pagamento histórico e impedindo resolução duplicada.

Pendências financeiras restantes são evoluções de produto/UX, não bloqueadores do núcleo para piloto controlado:

1. UX própria para cobrança antecipada e resolução financeira de exceções;
2. pagamento parcial e múltiplos meios;
3. caixa, conciliação, repasses e documentos fiscais/recibos.

## Próximo foco recomendado

1. Executar `CLINICAL_PILOT_ACCEPTANCE.md` no primeiro profissional piloto e remover fricções observadas.
2. Fazer passagem visual/uso real de Agenda, Pacientes, Atendimento e Financeiro antes de marcar UX/design system como GREEN.
3. Validar utilidade dos relatórios com dados reais de piloto sem reabrir contratos semânticos já saneados.
4. Evoluir onboarding/checklist inicial somente a partir das dúvidas observadas no piloto.
5. Tratar evoluções financeiras avançadas conforme necessidade real do piloto.

## Regra de implantação

A branch `main` deve ser tratada como potencialmente produtiva. O ambiente Portainer acompanha o GitHub em ciclos curtos, portanto:

- nunca usar `main` como área de experimentação;
- PRs precisam estar deploy-safe antes do merge;
- alterações de schema devem ser compatíveis com a versão da aplicação em produção;
- preferir migrations versionadas, idempotentes e verificáveis;
- migrations de produção devem ser aplicadas a partir de commit de merge conhecido;
- validar com verifier canônico após aplicação;
- mudanças de segurança devem ter teste funcional negativo e, quando possível, positivo;
- mudanças que exigem ação no servidor devem ser explicitamente destacadas antes da execução em produção.
