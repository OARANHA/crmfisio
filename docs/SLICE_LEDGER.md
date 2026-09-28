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
| `MED-CRM-006` | Contact Identity Resolution V1 — resolver reutilização explícita vs Contact distinto sem transformar phone/email em identidade | RELEASED | [evidence](slices/MED-CRM-006/EVIDENCE.md) | PR #548 final HEAD `d2c6356883...` passou 20/20 workflows, mergeou em `main@910dff50...`; Portainer serviu o novo CRM chunk com candidate/resolver/modes e sem os writers antigos; `/`, `/crm`, `/agenda`, `/pacientes` = HTTP 200 |
| `MED-CRM-007` | Commercial Lead Activity Timeline V1 — expor a timeline operacional já canônica por Lead sem criar nova authority | RELEASED | [evidence](slices/MED-CRM-007/EVIDENCE.md) | PR #551 exact HEAD `6714ed5672...` passou 20/20, mergeou em `main@7f1eda963...`; produção serviu `index-DLkUkW9i.js` → `CrmOperational-foLfVbZu.js` com activity RPC/timeline e rotas-base 200 |
| `MED-CRM-008` | Lead Commercial Details V1 — editar title/value/source do Lead pela boundary canônica sem alterar stage/Contact/Patient | DESIGNED | [slice](slices/MED-CRM-008/README.md) | integrar design docs; depois revalidar main/PRs e executar migration/RPC + verifier/behavior + UI em branch nova |
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
