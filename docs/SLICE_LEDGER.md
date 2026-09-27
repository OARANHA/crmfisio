# MedicsPro — Slice Ledger

> Índice de continuidade de slices. Não substitui `TODO.md`, `PRODUCT_ROADMAP.md` ou `docs/CURRENT_STATE.md`.
>
> O ledger diz **quais slices existem e em que estágio metodológico estão**. Prioridade global continua nos documentos canônicos de produto.

## Status permitidos

`DISCOVERED → ANALYZED → APPROVED → DESIGNED → IMPLEMENTING → PROVED → RELEASED`

## Slices ativas

| Slice | Capability | Status | Documento | Próximo gate |
| --- | --- | --- | --- | --- |
| `MED-CRM-001` | Commercial Core — separar Contact / Lead / Patient e preparar pipeline comercial | PROVED | [slice](slices/MED-CRM-001/README.md) | MERGED em #522; não declarar RELEASED sem rollout; capability map pós-foundation concluído |
| `MED-CRM-002` | Commercial Command Boundary — mutations canônicas de Contact/Lead/stage | PROVED | [slice](slices/MED-CRM-002/README.md) | merge decision separada na PR #524; após merge confirmar `main`; sem RELEASED antes de rollout |
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
