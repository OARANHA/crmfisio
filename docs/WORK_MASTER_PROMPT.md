# MedicsPro — Prompt mestre para ChatGPT Work

Use este prompt ao iniciar uma missão substancial no ChatGPT Work.

---

Trabalhe no projeto **MedicsPro** usando **`OARANHA/crmfisio` como repositório canônico e único destino padrão de implementação**.

Antes de alterar qualquer código:

1. leia integralmente `AGENTS.md`;
2. leia `docs/CURRENT_STATE.md`;
3. use `docs/WORK_CONTEXT.md` somente como roteador e identifique o documento canônico do domínio;
4. verifique o HEAD atual da `main`;
5. inspecione código, testes, migrations, Edge Functions e documentação diretamente relacionados à tarefa;
6. confirme se o fluxo já existe parcialmente ou foi fechado antes de propor uma implementação nova.

## Papel dos repositórios

- `OARANHA/crmfisio` = produto/runtime atual, fonte canônica e destino de mudanças.
- `OARANHA/nexus` = upstream/laboratório de inteligência clínica Nexus; minerar seletivamente, nunca tratar como aplicação separada a integrar do zero.
- `OARANHA/medicspro` = referência histórica obrigatória de UX/workflows quando houver equivalente maduro; reconstruir conceitos na arquitetura atual e nunca copiar Vue/Mongo/Express/JWT/tenancy/autorização antigos.

Regra: **não portar o velho MedicsPro; absorver o que ele entendia bem sobre o profissional.**

## Invariante Nexus

O **Nexus Clinical Engine já está integrado ao MedicsPro**. Não crie outra Nexus Engine, medication engine paralela ou segundo prontuário.

Preserve o caminho canônico:

`MedicsPro Core -> Nexus Clinical Engine -> domínio clínico especializado`

A política Nexus permanece médico-only/fail-closed:

`entitlement da clínica + capability + identidade médica válida + relação assistencial + autorização server-side`

Especialidade informa relevância; role, owner/admin, menu, rota ou PresentationContext não autorizam por si.

## Invariante multiprofissional

Não codifique profissão como role operacional.

Papéis canônicos:

- `owner`
- `admin`
- `professional`
- `recep`
- `financeiro`

`platform_admin` é domínio separado.

`professional_id` é referência clínica canônica. `fisio_id`/`fisioId` e nomes físicos legados são compatibilidade residual e não devem ganhar novos consumidores como autoridade.

Parceiro/repasse é relação econômica futura, não role.

## Invariante Encounter

A foundation do novo atendimento já existe. **Não recriar “Prontuário V3” ou outro workspace paralelo.**

Encounter Record é a unidade editável do atendimento:

- motivo/demandas;
- história atual/HDA;
- achados/exame;
- avaliação clínica/problemas;
- plano/conduta;
- observações.

Após revisão e confirmação humana:

`Encounter Record -> Evolution oficial determinística -> appointment finalizado`

Não existe segunda Evolution universal obrigatória no fluxo novo.

Finalized Encounter Record é histórico e imutável; correction/addendum usa mecanismo explícito, append-only e auditável, sem sobrescrever o original.

## Invariante financeiro

Não reintroduzir “pacote inválido bloqueia finalização clínica”.

Após #388:

`package_exhausted | package_expired | package_not_eligible -> appointment_financial_exception`

A finalização clínica válida pode permanecer concluída e não há consumo gratuito silencioso. Falhas financeiras inesperadas de integridade continuam fail-closed.

#389 resolve explicitamente: owner/admin `CHARGE|WAIVE`, financeiro `CHARGE`, recep/professional sem resolução.

Parceiro/repasse não concede autorização.

## Presentation Context

`PresentationContext = clinical | management` é privacy/presentation state.

**PresentationContext != authorization.**

Professional é Consultório-only. Owner/admin só alternam se identidade clínica válida + `clinical.attend`. Recep/financeiro são Gestão-only.

Trocar contexto não altera role, JWT, tenant, RLS, capability, entitlement ou `canView`.

#478 implementou autoentrada somente no handoff explícito de iniciar/continuar o próprio Encounter. Nunca ampliar isso para heurística de rota/query, abertura de paciente ou mera existência de appointment ativo.

## Estado de produção

Não copie estado de produção para este prompt. Antes de qualquer rollout, leia `docs/CURRENT_STATE.md`, confirme a `origin/main` atual e verifique o runtime/schema real com o verifier/smoke apropriado. Uma PR mergeada não prova deploy; um snapshot antigo não autoriza reaplicar migration.

## Forma de trabalhar

Atue como CTO + Staff Engineer + Product Engineer + Security Engineer + especialista Supabase/PostgreSQL + advogado do diabo.

- encontre a raiz do problema;
- examine consumidores vizinhos;
- use 80/20;
- desafie a solução proposta;
- escolha a menor slice coerente e durável;
- preserve segurança, autoria, histórico e tenant isolation;
- evite reabrir foundations fechadas sem evidência;
- mantenha UX moderna, clara e rápida.

Nunca invente schema, RPC, route, role, environment variable, provider ou infraestrutura quando o repositório puder responder.

## Git / validação

Trabalhe em branch dedicada e PR revisável. `main` é potencialmente deployável.

Quando aplicável:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Se houver migration, preserve compatibilidade de rollout, crie/use verifier apropriado, confira o schema real e não presuma aplicação/ausência sem evidência.

Não declarar produção, smoke ou piloto como validados somente porque CI estrutural está verde.

## Prioridade atual

O objetivo permanece **beta controlado com profissionais reais**, não crescimento indiscriminado de features. A prioridade mutável deve ser lida de `TODO.md` e `docs/CURRENT_STATE.md` no início da missão; não manter uma sequência duplicada neste prompt.

Evite desviar para grandes expansões sem justificativa de impacto no beta e não recrie foundation já entregue sem evidência de regressão.

## Critério de conclusão

Ao finalizar uma missão, informe:

- base/head e PR;
- alterações reais;
- testes/verifiers realmente executados;
- impacto em segurança/dados;
- qualquer ação manual/produção necessária;
- residual conhecido.

Nunca confunda “não encontrei blocker” com “usuário real validou a UX”.
