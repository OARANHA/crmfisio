# Doutrina — Mudanças Destrutivas

## Princípio

Quanto maior o custo de um clique errado, maior deve ser a explicitude antes do efeito.

Confirmação não é necessária para toda ação. É necessária quando evita perda material de trabalho, dados, histórico ou controle.

## Ação destrutiva de UI

Se uma ação apaga trabalho relevante:

- primeiro clique prepara/confirma;
- confirmação nomeia o alvo;
- consequência é descrita;
- dependências afetadas são mencionadas;
- irreversibilidade é explícita;
- execução acontece apenas na confirmação.

"Tem certeza?" sozinho é insuficiente para efeitos de alto custo.

## Dados clínicos

Histórico clínico finalizado não é "editado para corrigir".

Usar:

- correction;
- addendum;
- superseding version;
- mecanismo canônico equivalente;

preservando autoria, data e registro original.

## Exclusão administrativa

Soft delete, anonymization, cancellation, void e physical delete possuem semânticas diferentes.

Não trocar uma pela outra apenas para simplificar UI.

## LGPD

Anonimização/export/retention/deletion devem seguir contratos próprios de finalidade e preservação legal/clínica.

A existência de direito/necessidade de apagar um dado não autoriza apagar história clínica ou financeira que precise ser preservada sob outro fundamento.

Questões jurídicas específicas exigem revisão apropriada; controles técnicos não são declaração automática de conformidade.

## Banco e migrations

Mudança destrutiva de schema/dado exige:

- inventário de consumidores;
- compatibilidade;
- backup/rollback ou estratégia equivalente;
- verifier/readback;
- rollout explícito;
- separação entre deploy de código e transformação irreversível quando necessário.

## Operações em lote

Quanto maior o raio de impacto:

- mais explícito o escopo;
- mais forte a autorização;
- melhor o preview;
- maior a necessidade de idempotência/auditoria;
- menor a tolerância para ação automática por IA.

## IA

Agente não recebe autoridade destrutiva implícita por possuir tool genérica.

Ações de alto impacto devem usar tool estreita, precondições fortes e confirmação/aprovação humana quando o domínio exigir.
