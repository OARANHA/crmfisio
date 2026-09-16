# Encounter Record Correction/Addendum V1

**Status desta revisão:** implementação de repositório validada; rollout de produção ainda não executado.

## Objetivo

Permitir que um profissional registre uma informação posterior sobre um Encounter Record já finalizado sem reabrir o atendimento e sem sobrescrever o ato clínico original.

O contrato é deliberadamente append-only:

```text
Encounter Record finalizado
→ Evolution oficial imutável
→ zero ou mais Retificações/Adendos imutáveis
```

A Retificação/Adendo não é uma segunda Evolution, não muda o appointment e não executa checkout, pacote ou cobrança.

## Problema estrutural fechado

A foundation #394 já congelava `clinical_encounter_records` finalizado. A auditoria desta slice confirmou que a Evolution oficial vinculada ainda podia alcançar UPDATE pelo autor autenticado.

V1 adiciona um guard específico: quando uma `physiotherapy_evolutions.id` está vinculada como `evolution_id` de um Encounter Record `finalized`, UPDATE e DELETE são recusados.

Evolutions legadas não vinculadas a um Encounter Record finalizado não são congeladas incidentalmente por esta slice.
## Ledger canônico

Nova tabela:

`public.clinical_encounter_record_addenda`

Cada linha preserva:

- clínica;
- Encounter Record original;
- appointment original;
- paciente;
- Evolution oficial original;
- profissional original;
- autor do ato posterior;
- `request_id` idempotente;
- tipo `addendum | correction`;
- motivo;
- conteúdo;
- timestamp real de criação.

Na V1, `author_id = original_professional_id` é invariável de schema e também revalidado pelo RPC.

A tabela é append-only: browser possui SELECT autorizado por prontuário; não possui INSERT/UPDATE/DELETE direto. UPDATE/DELETE também são bloqueados por trigger de integridade.
## Autorização de escrita

`public.create_clinical_encounter_record_addendum(...)` é o único writer de aplicação.

Exige cumulativamente:

- usuário autenticado;
- perfil ativo em clínica ativa;
- tenant atual igual ao Record;
- identidade clínica válida;
- `clinical.attend = true`;
- `clinical.evolution.write = true`;
- Encounter Record `finalized` com Evolution vinculada;
- appointment original ainda `finalizado` e com proveniência consistente;
- Evolution original existente, ativa e com proveniência consistente;
- ator igual ao `professional_id` original.

Owner/admin não recebem bypass. Se um owner/admin foi de fato o autor clínico original e continua satisfazendo identidade/capabilities, ele age como autor — não por ser administrador.

Correção por outro profissional quando o autor original estiver indisponível exige workflow de governança próprio e está fora da V1.

## Idempotência

`request_id` é único por clínica. Retry com mesmo request e payload retorna o mesmo ato. Reuso do mesmo request com payload divergente falha explicitamente.
## UX longitudinal

A ação vive no **prontuário longitudinal**, em uma seção própria de Retificações e adendos, agrupada pelo Encounter Record original finalizado.

O registro original permanece na linha do tempo de Evolutions; a seção de atos posteriores referencia o atendimento finalizado sem duplicar nem reescrever esse conteúdo. Para cada ato posterior a UI mostra:

- `Retificação` ou `Adendo`;
- data/hora;
- autor;
- motivo;
- conteúdo;
- aviso de que o original foi preservado.

O formulário exige tipo, motivo e conteúdo. Antes do envio informa explicitamente que o registro original não será alterado.

Somente o autor elegível vê a ação de escrita. Leitores autorizados do prontuário podem visualizar atos existentes, mas a autorização efetiva permanece server-side.

Falha ao carregar o ledger não esconde as Evolutions originais; a UI informa indisponibilidade dos atos posteriores sem inventar estado.

## Efeitos deliberadamente ausentes

Retificação/Adendo não:

- reabre appointment;
- muda status de Encounter Record;
- cria outra Evolution;
- altera a Evolution original;
- consome pacote;
- cria ou altera `payments`;
- resolve `appointment_financial_exceptions`;
- concede nova relação assistencial ou autorização.
## Verificação

O gate PostgreSQL 16 reutiliza primeiro a stack efetiva do #394 e depois aplica a migration V1 duas vezes para provar idempotência de rollout.

Os 14 cenários cobrem:

1. autor cria adendo sem substituir original;
2. retry idempotente;
3. request divergente rejeitado;
4. múltiplos atos append-only;
5. draft não aceita adendo;
6. outro profissional capaz é negado;
7. owner clínico sem autoria é negado;
8. cross-tenant é negado;
9. autor autenticado não reescreve Evolution oficial finalizada;
10. Evolution legada não é congelada incidentalmente;
11. ledger é imutável;
12. zero efeitos em appointment/Evolution/financeiro;
13. browser escreve somente por RPC;
14. RLS bloqueia cross-tenant e recepção.

O verifier `VERIFY_20260915_CLINICAL_ENCOUNTER_RECORD_ADDENDUM_V1.sql` é read-only e apropriado para produção após a migration.

Frontend validado localmente com testes focados, suíte completa, typecheck, lint e build. Evidência de produção só pode ser registrada após merge, migration/verifier e smoke reais.
