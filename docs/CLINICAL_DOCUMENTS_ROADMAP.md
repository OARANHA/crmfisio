# MedicsPro — Clinical Documents Roadmap

> Documento de continuidade para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Base canônica observada antes da D2-B:** `main@de24d63f643782ec6b4b2442b4bc68ee570d46b9`  
**Estado:** D1 CONCLUÍDO / D2-A VALIDADO EM PRODUÇÃO / D2-B IMPLEMENTADO NA PR #429 E NÃO VALIDADO EM PRODUÇÃO

## Princípio arquitetural

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

`clinical.documents` é gate-base clínico. Ele **não** significa autorização automática para prescrição medicamentosa, pedido de exame, atestado ou qualquer outro ato documental específico.

Profissão e especialidade podem influenciar eligibility/relevância conforme contrato explícito, mas não funcionam como bypass textual de autorização.

---

## D1 — conclusão aprovada

O inventário histórico e atual concluiu que o MedicsPro precisava de uma Clinical Documents Foundation transversal antes de qualquer UI real de prescrição.

Primitives aproveitadas:

- Clinical Encounter e appointment ativo;
- identidade clínica e conselho/registro;
- `clinical.documents` como capability-base;
- care relationship / tenant boundaries;
- patterns RPC-only;
- versionamento e imutabilidade do Assessment Engine;
- snapshot/auditoria dos consentimentos;
- histórico longitudinal;
- auditabilidade existente.

Referência histórica `OARANHA/medicspro`:

- Prescrição possuía templates, medicamentos estruturados, observações, preview, salvar/imprimir e histórico;
- templates históricos possuíam nome, descrição, especialidade, default, conteúdo rico, variáveis e layout;
- Pedido de Exames, Atestados, Laudos/Resultados e anexos existiam como domínios paralelos;
- o histórico serve para produto/UX/conteúdo, nunca para copiar Vue/Pinia/Mongo/Express ou ACL antiga;
- não foi encontrada uma grande biblioteca persistida de receitas prontas: havia mecanismo de templates e conteúdo padrão real, enquanto medicamentos demonstrativos no preview não constituíam catálogo clínico.

Decisão implementada:

```text
Clinical Documents Foundation pequena
+
contratos tipados por document_type
```

Não criar Prescription Engine isolado e não criar documento genérico baseado em HTML/CSS arbitrário.

---

## Document types atuais

A foundation D2-A contém:

- `medication_prescription`
- `therapeutic_guidance`

Fases posteriores, somente após os fluxos V1 estabilizarem:

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
draft
→ issued
→ canceled
```

Regras:

- documento emitido é imutável;
- sem hard delete pós-emissão;
- cancelamento exige motivo e auditoria;
- correção futura deve ser append-only/supersession, nunca edição silenciosa;
- impressão posterior deve usar snapshot emitido, não recalcular a partir do template atual.

Snapshot emitido preserva contexto do payload, paciente, clínica, emissor, identidade profissional, appointment/Encounter, template/version, definição utilizada, rendered snapshot, renderer version e `issued_at`.

---

## Authorization / eligibility

### Gate-base

- authenticated;
- active profile;
- tenant correto;
- identidade clínica válida;
- `clinical.documents = true`;
- Encounter/contexto assistencial válido.

### `medication_prescription` V1

Contrato D2-A atual:

- identidade profissional médica válida;
- CRM + UF + registro válidos;
- profissional responsável pelo próprio Encounter ativo;
- eligibility server-side explícita do `document_type`.

Essa whitelist V1 não deve ser descrita como regra legal universal para todas as profissões brasileiras. Ampliações futuras exigem policy explícita.

### `therapeutic_guidance` V1

- identidade clínica válida;
- `clinical.documents = true`;
- próprio Encounter ativo;
- eligibility específica do tipo.

### Administração

`professional + clinical.documents` **não** concede administração de templates platform/clinic.

`platform_admin` não recebe acesso clínico implícito.

---

# D2-A — Clinical Documents Foundation

**Estado: VALIDADO EM PRODUÇÃO.**

PR #425 foi mergeada na `main` em 2026-09-12. Commit canônico:

```text
0459e5908c942ac63c0dec87d517aa2131936204
```

Entregue:

- schema foundation;
- ownership `platform | clinic`;
- template + immutable published version;
- documentos/snapshots/events;
- lifecycle `draft → issued → canceled`;
- RPC-first/RPC-only para lifecycle protegido;
- RLS fail-closed;
- eligibility server-side por `document_type`;
- quatro templates platform;
- typed validation na emissão;
- identifier humano com UUID completo;
- cancelamento histórico/auditável;
- PostgreSQL 16 behavior matrix;
- verifier;
- replay/idempotência;
- documentação.

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

D2-A continua a autoridade backend de lifecycle/autorização/persistência. A superfície de Prescrição pertence à D2-B.

---

# D2-B — Prescription V1

**Estado: IMPLEMENTADO NA PR #429 / NÃO MERGEADO / NÃO VALIDADO EM PRODUÇÃO.**

Branch:

```text
feat/clinical-prescription-v1-d2b
```

Documento de implementação:

```text
docs/CLINICAL_PRESCRIPTION_V1.md
```

Arquitetura escolhida:

```text
Encounter ativo do profissional
→ workspace Prescrição
→ template publicado elegível
→ document draft D2-A
→ medicamentos estruturados
→ salvar rascunho
→ revisão humana explícita
→ issue_clinical_document
→ snapshot imutável
→ impressão / histórico
```

Implementado na PR:

- workspace `Prescrição` dentro do mesmo Clinical Encounter;
- apresentação/relevância médica sem transformar profissão em autorização;
- `clinical.documents` como primeiro gate de UI;
- `current_user_can_issue_clinical_document('medication_prescription')` como eligibility server-side adicional;
- somente `medication_prescription`;
- seleção de template elegível;
- editor tipado com medicamento, dose, via, frequência, duração e instruções;
- observações;
- draft/resume do próprio emissor no Encounter atual;
- estado local isolado por paciente + Encounter + usuário;
- save explícito; sem autosave genérico;
- revisão humana antes da emissão;
- emissão pelos RPCs D2-A;
- documento emitido não retorna ao editor;
- impressão usando apenas snapshots emitidos, inclusive identidade profissional congelada;
- histórico do Encounter separado do histórico anterior;
- testes de payload e boundary arquitetural.

Não foi necessário criar:

- migration;
- RPC;
- RLS;
- grant;
- capability;
- novo `document_type`;
- Prescription Engine paralelo;
- integração Nexus.

### Nexus em D2-B

O Nexus pode ser consultado como fonte de aprendizado para catálogo farmacológico, equivalências e psicofarmacologia, mas **não amplia D2-B para switching/recomendação automática**.

Contrato:

```text
Nexus = conhecimento/cálculo/apoio à decisão
Clinical Documents = ato documental explícito do profissional
```

### Gate de saída da D2-B

Antes de considerar a slice pronta para merge:

- todos os testes devem passar;
- TypeScript deve passar;
- lint deve passar;
- build deve passar;
- dependency audit deve passar;
- workflows clínicos/Nexus aplicáveis devem permanecer verdes;
- diff final deve ser revisado;
- PR deve estar mergeable.

Depois de eventual merge/deploy, fazer smoke real no Encounter antes de promover D2-B para `VALIDADO EM PRODUÇÃO`.

---

# D2-C — Therapeutic Guidance V1

**PLANEJADO; não iniciar antes da estabilização da D2-B.**

Escopo:

- editor próprio de orientação terapêutica;
- mesma foundation, snapshot, renderer e histórico;
- `therapeutic_guidance`;
- sem expandir para exames, atestados ou relatórios.

---

## Fases posteriores

Depois que D2-B/D2-C estiverem estáveis, selecionar novos documentos por evidência real do piloto, sem abrir todos de uma vez.

Candidatos históricos:

- pedido de exame;
- referral;
- declaração/atestado;
- relatório clínico;
- resultado externo/revisão com contrato próprio.

Ver `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` e `docs/CLINICAL_TOOLING_REUSE_PLAN.md`.

---

## UX alvo do Encounter

Com D2-B implementada na PR #429, a composição pretendida é:

```text
Registro
Anamneses & Avaliações
Prescrição
Nexus / Ferramentas clínicas
```

Prescrição pertence ao atendimento atual. Não colocar `Nova Prescrição` no histórico longitudinal.

O histórico permite consultar documentos já emitidos sem transformar registro histórico em Encounter editável.

---

## Regras de continuidade

1. D2-A está fechada; não redesenhar foundation sem blocker reproduzido.
2. Nenhum agente deve cortar behavior tests, verifier ou idempotência para caber em PR.
3. Evitar múltiplas PRs funcionais paralelas no mesmo boundary clínico.
4. Produção só é promovida a `VALIDADO EM PRODUÇÃO` após evidência real.
5. Após cada slice, revisar `docs/CURRENT_STATE.md` e `docs/MANUAL_SOURCE_MAP.md` conforme estado real.
6. O manual só descreve Prescrição quando D2-B estiver efetivamente utilizável/validada.
7. Consultar `docs/CLINICAL_TOOLING_REUSE_PLAN.md` antes de criar ferramentas já existentes no Nexus ou no MedicsPro histórico.
8. A PR #429 deve parar em revisão; merge/deploy/produção são decisões separadas.
