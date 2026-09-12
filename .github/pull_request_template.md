## Objetivo

Descreva a mudança e o problema de produto/engenharia que ela resolve.

## Escopo

- [ ] mudança funcional
- [ ] documentação
- [ ] migration / RLS / RPC / Edge Function
- [ ] frontend / UX visível
- [ ] produção / rollout necessário

## Continuidade canônica

Antes do merge, confirme:

- [ ] `AGENTS.md` foi lido;
- [ ] `docs/CURRENT_STATE.md` foi lido;
- [ ] o documento do domínio foi revisado;
- [ ] `docs/CURRENT_STATE.md` foi atualizado se esta PR muda estado atual relevante;
- [ ] `docs/MANUAL_SOURCE_MAP.md` foi atualizado se esta PR muda comportamento visível ao usuário;
- [ ] `TODO.md` / `PRODUCT_ROADMAP.md` foram atualizados quando a prioridade/estado do roadmap mudou;
- [ ] nenhum item foi marcado `VALIDADO EM PRODUÇÃO` sem evidência real de produção;
- [ ] se existe equivalente maduro no MedicsPro histórico, a comparação legado × runtime atual foi considerada;
- [ ] se a mudança toca Nexus/instrumentos, `ENGINE != AUTHORIZATION != RELEVANCE` permanece preservado.

Se algum item não se aplica, explique no corpo da PR em vez de marcar um estado fictício.

## Validação

Liste testes, verifiers, typecheck, lint, build e smokes executados.

## Produção

Informe explicitamente:

- migration a aplicar, se houver;
- verifier production-safe, se houver;
- redeploy/Edge Function necessária, se houver;
- estado real: `NÃO APLICADO`, `IMPLEMENTADO / AGUARDANDO PRODUÇÃO` ou `VALIDADO EM PRODUÇÃO`.
