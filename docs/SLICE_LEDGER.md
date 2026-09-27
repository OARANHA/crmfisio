# MedicsPro — Slice Ledger

> Índice de continuidade de slices. Não substitui `TODO.md`, `PRODUCT_ROADMAP.md` ou `docs/CURRENT_STATE.md`.
>
> O ledger diz **quais slices existem e em que estágio metodológico estão**. Prioridade global continua nos documentos canônicos de produto.

## Status permitidos

`DISCOVERED → ANALYZED → APPROVED → DESIGNED → IMPLEMENTING → PROVED → RELEASED`

## Slices ativas

| Slice | Capability | Status | Documento | Próximo gate |
| --- | --- | --- | --- | --- |
| `MED-CRM-001` | Commercial Core — separar Contact / Lead / Patient e preparar pipeline comercial | RELEASED | [slice](slices/MED-CRM-001/README.md) | produção `28server/supabase-db` verificada: Core aplicado e `COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED`; próxima feature exige novos gates |
| `MED-CRM-002` | Commercial Command Boundary — mutations canônicas de Contact/Lead/stage | RELEASED | [slice](slices/MED-CRM-002/README.md) | produção `28server/supabase-db` verificada: Command Boundary aplicada e ambos verifiers Core + Command passaram; reavaliar próximo conflito sem autoautorizar MED-CRM-003 |
| `MED-CRM-003` | Commercial Board Cutover V1 — retirar Patient.funil_stage da autoridade comercial visível em /crm | RELEASED | [evidence](slices/MED-CRM-003/EVIDENCE.md) | PR #536 mergeada em `main@9962a14c...`; auto-deploy do frontend observado, chunk CRM canônico ativo e rotas públicas saudáveis; próxima capability exige novos gates |
| `MED-CRM-004` | Archived Pipeline Transition Guard — fail closed para mudança de stage em pipeline arquivado | RELEASED | [slice](slices/MED-CRM-004/README.md) | PR #534 integrada; produção aplicada e verifier pinned read-only passou; próxima continuidade volta a MED-CRM-003 com quatro gates novos |
| `MED-CRM-005` | Prospect Intake V1 — criar Contact + Lead canônicos a partir do `/crm` sem criar Patient | RELEASED | [evidence](slices/MED-CRM-005/EVIDENCE.md) | PR #538 mergeada em `main@004fcb2c...`; auto-deploy observado, CRM chunk canônico com Prospect Intake ativo e rotas públicas saudáveis; próxima capability exige quatro gates novos |
| `MED-CRM-006` | Contact Identity Resolution V1 — resolver reutilização explícita vs Contact distinto sem transformar phone/email em identidade | BACKEND RELEASED / FRONTEND AUTHORIZED | [slice](slices/MED-CRM-006/README.md) | implementar/provar UX de candidate preview + explicit reuse/distinct sobre RPCs RELEASED; observar produção antes de fechar a slice |
| `MED-DOC-001` | Deskcomm documentation & architecture mining | PROVED | [slice](slices/MED-DOC-001/README.md) | usar a síntese por capability; revalidar só a área relevante quando uma slice de produto absorver um padrão |

## Regras do ledger

- só criar uma entrada quando houver uma slice identificável;
- não copiar backlog inteiro para cá;
- uma slice não avança de status por intenção;
- `PROVED` exige evidência registrada;
- `RELEASED` exige rollout observado quando houver produção;
- se a main avançar enquanto a slice está aberta, reconstruir o ESTADO ATUAL COMPROVADO antes de decidir ou executar;
- todo status deve apontar para evidência no documento da própria slice.

## Fonte de capacidades externas

A absorção seletiva do Deskcomm é acompanhada em [`DESKCOMM_ADOPTION_MATRIX.md`](DESKCOMM_ADOPTION_MATRIX.md). A matriz não cria prioridade automaticamente; cada capability aprovada precisa virar uma slice própria antes de execução.
