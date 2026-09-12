# MedicsPro — Clinical Documents Roadmap

> Documento de continuidade para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Main canônica:** `15692b47fc5bca577948a03de2a686f58d5c7dd9`  
**Estado:** D1 CONCLUÍDO / D2-A VALIDADO EM PRODUÇÃO / D2-B MERGEADO E NÃO VALIDADO EM PRODUÇÃO / D2-B.1 PR #430 EM VALIDAÇÃO

---

## Princípio arquitetural

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

`clinical.documents` é gate-base clínico. Ele não concede automaticamente prescrição ou qualquer outro ato documental específico.

Profissão/especialidade podem influenciar eligibility/relevância quando houver contrato explícito, mas nunca funcionam como bypass textual de autorização.

---

## D1 — inventário e decisão arquitetural

D1 concluiu que o MedicsPro precisava de uma Clinical Documents Foundation transversal antes de UI real de prescrição.

Primitives aproveitadas:

- Clinical Encounter e appointment ativo;
- identidade clínica e conselho/registro;
- `clinical.documents`;
- care relationship / tenant boundaries;
- lifecycle protegido via RPC;
- versionamento/imutabilidade;
- snapshot/auditoria;
- histórico longitudinal.

Do MedicsPro histórico, reaproveitar produto/UX — templates, medicamentos estruturados, observações, preview, impressão e histórico — nunca sua arquitetura Vue/Pinia/Mongo/Express ou ACL antiga.

Decisão:

```text
Clinical Documents Foundation pequena
+
contratos tipados por document_type
```

Não criar Prescription Engine isolado e não usar HTML/CSS arbitrário como fonte clínica.

---

## Document types atuais

D2-A contém somente:

- `medication_prescription`
- `therapeutic_guidance`

Fases posteriores, somente após estabilização real dos fluxos V1:

- `exam_order`
- `referral`
- `attendance_declaration`
- `medical_certificate` / variantes aprovadas
- `clinical_report`

Não misturar resultado externo de exame com laudo autoral sem contrato próprio.

---

## Lifecycle canônico D2-A

```text
published template
→ document draft
→ validated payload
→ explicit human confirmation
→ issued snapshot
→ longitudinal history
→ optional audited cancellation
```

Estados:

```text
draft → issued → canceled
```

Regras:

- versão emitida é imutável;
- sem hard delete pós-emissão;
- cancelamento exige motivo/auditoria;
- correções futuras devem ser append-only/supersession;
- impressão histórica usa snapshot emitido, nunca template atual.

Snapshot preserva payload, paciente, clínica, emissor, identidade profissional, Encounter, template/version, definição/rendered snapshot, renderer version e `issued_at`.

---

## Authorization / eligibility

Gate-base:

- authenticated;
- active profile;
- tenant correto;
- identidade clínica válida;
- `clinical.documents = true`;
- contexto assistencial válido.

### `medication_prescription`

Contrato V1:

- identidade profissional médica válida;
- CRM + UF + registro válidos;
- profissional responsável pelo próprio Encounter ativo;
- eligibility server-side do `document_type`.

Essa whitelist V1 não é regra legal universal para todas as profissões. Ampliações futuras exigem policy explícita.

### `therapeutic_guidance`

- identidade clínica válida;
- `clinical.documents = true`;
- próprio Encounter ativo;
- eligibility específica do tipo.

`platform_admin` não recebe acesso clínico implícito e administrar templates é boundary separado de emitir documento.

---

# D2-A — Clinical Documents Foundation

**Estado: VALIDADO EM PRODUÇÃO.**

PR #425 → main:

```text
0459e5908c942ac63c0dec87d517aa2131936204
```

Produção em 2026-09-12:

```text
20260912_clinical_documents_foundation.sql
→ COMMIT
→ MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql
→ CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED
→ ROLLBACK
→ VERIFIER_EXIT=0
```

O `ROLLBACK` é apenas o envelope read-only do verifier.

D2-A permanece autoridade backend de lifecycle, autorização, persistência e snapshots.

---

# D2-B — Prescription V1

**Estado: MERGEADO / NÃO VALIDADO EM PRODUÇÃO.**

PR #429 foi validada e mergeada por squash:

```text
main@15692b47fc5bca577948a03de2a686f58d5c7dd9
```

Arquitetura:

```text
Encounter ativo
→ Prescrição
→ template elegível
→ draft D2-A
→ medicamentos estruturados
→ save explícito
→ revisão humana
→ issue_clinical_document
→ snapshot imutável
→ histórico / impressão
```

Entregue:

- workspace `Prescrição` no mesmo Encounter;
- apresentação médica sem transformar profissão em autorização;
- eligibility server-side por D2-A;
- editor de medicamento, dose, via, frequência, duração e instruções;
- observações;
- draft/resume do próprio emissor no Encounter atual;
- estado local isolado por paciente + Encounter + usuário;
- save explícito, sem autosave genérico;
- revisão humana obrigatória;
- emissão por RPC;
- documento emitido read-only;
- impressão somente de `payload_snapshot` + `context_snapshot`;
- histórico do Encounter separado do histórico anterior.

Não criou migration, RPC, RLS, grant, capability, novo `document_type`, engine paralela ou integração Nexus.

CI final da #429: 420/420 testes + typecheck/lint/build + dependency audit + 10/10 workflows clínicos/Nexus verdes.

Ainda falta deploy/smoke real registrado antes de promover D2-B para `VALIDADO EM PRODUÇÃO`.

Documento: `docs/CLINICAL_PRESCRIPTION_V1.md`.

---

# D2-B.1 — Prescription Live Preview

**Estado: IMPLEMENTADO NA PR #430 / NÃO VALIDADO EM PRODUÇÃO.**

Base:

```text
main@15692b47fc5bca577948a03de2a686f58d5c7dd9
```

Objetivo: recuperar a área de `Visualização` do MedicsPro histórico com arquitetura moderna e segura.

UX:

```text
Desktop largo:
Editor estruturado | Folha de receita ao vivo

Viewport menor:
Editor
↓
Folha de receita
```

A prévia reflete o payload local do rascunho e mostra:

- profissional autenticado / CRM disponível na sessão;
- paciente;
- data de nascimento;
- data da prévia;
- medicamentos;
- observações.

Boundary obrigatório:

```text
LIVE PREVIEW != ISSUED DOCUMENT
```

Por isso a prévia é marcada explicitamente como `Rascunho · não emitida` / `Sem validade até a emissão`, não chama RPC, não persiste, não imprime e não cria identifier.

Após emissão, histórico/impressão continuam usando exclusivamente snapshots imutáveis da D2-A.

Não há mudança de banco, ACL, capability, lifecycle ou Nexus.

Gate de saída da #430:

- testes verdes;
- TypeScript verde;
- lint verde;
- build verde;
- dependency audit verde;
- workflows clínicos/Nexus aplicáveis verdes;
- diff/mergeabilidade revisados.

Depois, parar para decisão de merge. Smoke será feito somente após eventual redeploy.

---

# D2-C — Therapeutic Guidance V1

**PLANEJADO; não iniciar antes da estabilização/smoke da Prescrição.**

Escopo:

- editor próprio de orientação terapêutica;
- mesma foundation, snapshot, renderer e histórico;
- `therapeutic_guidance`;
- sem expandir para exames, atestados ou relatórios.

---

## Fases posteriores

Depois de D2-B/D2-C estáveis, selecionar novas famílias documentais por evidência real do piloto. Candidatos históricos:

- pedido de exame;
- referral;
- declaração/atestado;
- relatório clínico;
- resultado externo/revisão com contrato próprio.

Ver `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` e `docs/CLINICAL_TOOLING_REUSE_PLAN.md`.

---

## UX alvo do Encounter

```text
Registro
Anamneses & Avaliações
Prescrição
Nexus / Ferramentas clínicas
```

Prescrição pertence ao atendimento atual. Não colocar `Nova Prescrição` no histórico longitudinal; o histórico serve para consulta de documentos já emitidos.

---

## Regras de continuidade

1. D2-A está fechada; não redesenhar foundation sem blocker reproduzido.
2. Não cortar behavior tests/verifiers para caber em PR.
3. Evitar PRs funcionais paralelas no mesmo boundary clínico.
4. Produção só vira `VALIDADO EM PRODUÇÃO` com evidência real.
5. Após cada slice, revisar `docs/CURRENT_STATE.md`, documento do domínio e `docs/MANUAL_SOURCE_MAP.md` quando houver mudança visível.
6. O manual só descreve Prescrição como disponível depois de deploy/smoke real.
7. Consultar `docs/CLINICAL_TOOLING_REUSE_PLAN.md` antes de criar ferramenta já existente no Nexus/MedicsPro histórico.
8. A PR #430 deve parar em revisão; merge/deploy/produção são decisões separadas.
