# Doutrina — Canais e Ações Externas

## Princípio

Canal é transporte. A regra de negócio pertence ao MedicsPro.

WhatsApp, Instagram, Messenger, e-mail e canais futuros devem convergir para contracts de domínio sem espalhar lógica de provider pelo produto.

## Provider seam

Features perguntam por capability, não por nome do provider.

Exemplos:

- suporta texto livre agora?
- exige template?
- suporta mídia?
- possui thread externa?
- possui read receipt?
- possui janela de resposta?
- retorna identificador confiável?

Provider desconhecido ou capability ausente deve falhar de forma explícita, não cair silenciosamente em comportamento de outro provider.

## Evolution

Evolution API continua sendo o provider WhatsApp atual do MedicsPro até existir decisão e migração explícitas.

Adicionar outros adapters não autoriza substituir a foundation existente.

## Outbound é efeito externo

Enviar mensagem é operação potencialmente irreversível.

Antes do envio, quando aplicável, validar:

- tenant;
- autorização do ator;
- entitlement/configuração;
- opt-in/opt-out/consentimento;
- finalidade;
- janela/regra do canal;
- pacing/cooldown;
- conteúdo proibido/sensível;
- idempotency/send ledger;
- estado de entrega anterior.

## Resultado incerto

Timeout ou ausência de confirmação não significa automaticamente "não enviou".

Quando existir possibilidade de aceitação pelo provider:

- registrar estado incerto;
- reconciliar;
- evitar retry automático cego;
- expor estado para operação quando necessário.

## Browser, worker e segredos

Browser pode solicitar/enfileirar trabalho dentro de sua authority.

Worker/service-role executa operações privilegiadas atrás de segredo/autenticação própria.

Credenciais de provider permanecem server-side e não são retornadas à UI.

## Webhooks

Webhook deve:

- autenticar/validar origem antes de aplicar efeito;
- ser idempotente;
- tolerar duplicação/ordem parcial quando o provider puder produzi-las;
- correlacionar tenant/conexão/thread explicitamente;
- minimizar dados persistidos/logados.

## Conteúdo clínico

Canal operacional não recebe conteúdo clínico sensível apenas porque o destinatário é o mesmo paciente.

A finalidade da mensagem e o mínimo necessário devem guiar payload, templates e logs.

## Novos canais

Novo canal só entra como "suportado" depois de provar:

1. conexão/auth;
2. inbound normalization;
3. outbound semantics;
4. idempotência;
5. erro/timeout/reconciliação;
6. permissions/tenant;
7. UI/health/configuração;
8. provider real quando necessário.

Código interno e mocks não equivalem a prova de provider.
