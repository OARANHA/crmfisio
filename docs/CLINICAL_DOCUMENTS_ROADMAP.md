# MedicsPro — Clinical Documents Roadmap

> Documento de continuidade para Prescrição e Documentos Clínicos. Código, schema e runtime prevalecem se este arquivo envelhecer.

**Base observada ao fechar o D1:** `main@f65f399c503c03d2ae9e0ebf6630b8c1ed639cf3`  
**Estado:** D1 CONCLUÍDO / D2 DECOMPOSTO / IMPLEMENTAÇÃO AINDA NÃO INICIADA

## Princípio arquitetural

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

`clinical.documents` é apenas um gate-base clínico. Ele **não** significa autorização automática para prescrição medicamentosa, pedido de exame, atestado ou qualquer outro ato documental específico.

Profissão e especialidade podem influenciar eligibility/relevância conforme contrato explícito, mas não devem funcionar como bypass textual de autorização.

---

## D1 — conclusão aprovada

O inventário histórico e atual concluiu que o MedicsPro canônico ainda não possui um verdadeiro Clinical Documents Engine transversal.

Primitives atuais aproveitáveis:

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
- não foi encontrada uma grande biblioteca persistida de receitas prontas: havia mecanismo de templates e um conteúdo padrão real de receita, enquanto medicamentos demonstrativos no preview não constituíam catálogo clínico.

Decisão aprovada:

```text
Clinical Documents Foundation pequena
+
contratos tipados por document_type
```

Não criar Prescription Engine isolado e não criar um documento genérico baseado em HTML/CSS arbitrário.

---

## Document types planejados

Primeira fase:

- `medication_prescription`
- `therapeutic_guidance`

Fases posteriores, somente após a foundation estar estável:

- `exam_order`
- `referral`
- `attendance_declaration`
- `medical_certificate` / variantes aprovadas
- `clinical_report`

Não misturar resultado externo de exame com laudo autoral sem contrato próprio.

---

## Lifecycle alvo

```text
published template
→ document draft
→ validated payload
→ preview
→ explicit human confirmation
→ issued snapshot
→ print/download
→ longitudinal history
```

Estados V1 da foundation:

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

Snapshot emitido deve preservar, no mínimo:

- payload;
- contexto do paciente;
- contexto da clínica;
- emissor e identidade profissional;
- conselho/UF/registro;
- appointment/Encounter;
- template/version utilizado;
- definição do template utilizada;
- rendered snapshot;
- renderer version;
- issued_at.

---

## Authorization / eligibility

### Gate-base

- authenticated;
- active profile;
- tenant correto;
- identidade clínica válida;
- `clinical.documents = true`;
- care/Encounter context válido.

### `medication_prescription` V1

Política de produto conservadora proposta:

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

# Decomposição aprovada da D2

A D2 completa não deve ser entregue numa única PR.

## D2-A — Clinical Documents Foundation

**Próxima slice imediata.**

Escopo:

- schema foundation;
- ownership `platform | clinic`;
- template + immutable published version;
- documentos/snapshots/events;
- lifecycle `draft → issued → canceled`;
- RPC-first/RPC-only para lifecycle quando apropriado;
- RLS fail-closed;
- eligibility server-side por `document_type`;
- seeds platform-curated dos quatro templates estruturais;
- PostgreSQL 16 behavior matrix;
- verifier;
- idempotência;
- documentação.

Fora de escopo:

- workspace completo de Prescrição;
- editor de medicamentos;
- preview frontend completo;
- impressão frontend;
- UI de administração de templates;
- Exam Order / Atestados / Relatórios;
- integração Nexus/medicamentos;
- assinatura digital/legal;
- PDF server-side complexo.

Templates platform planejados na foundation:

1. Receita simples — `medication_prescription`
2. Receita com orientações — `medication_prescription`
3. Orientação terapêutica geral — `therapeutic_guidance`
4. Orientações pós-atendimento — `therapeutic_guidance`

Nenhum template pode trazer medicamento, dose, diagnóstico ou tratamento clínico pré-preenchido.

## D2-B — Prescription V1

Depende de D2-A mergeada e validada.

Escopo:

- workspace `Prescrição` no Clinical Encounter;
- seleção de template elegível;
- editor tipado de medicamentos;
- draft/resume do Encounter correto;
- preview determinístico;
- emissão;
- read-only pós-emissão;
- impressão;
- histórico do Encounter/paciente;
- somente `medication_prescription`.

Não deve reabrir schema/lifecycle sem blocker comprovado.

## D2-C — Therapeutic Guidance V1

Depende de D2-A e preferencialmente da integração frontend estabilizada em D2-B.

Escopo:

- editor próprio de orientação terapêutica;
- mesma foundation, snapshot, renderer e histórico;
- `therapeutic_guidance`;
- sem expandir para exames, atestados ou relatórios.

---

## UX alvo do Encounter

Estado planejado, ainda **NÃO implementado**:

```text
Registro
Anamneses & Avaliações
Prescrição
Nexus
Mais
```

Prescrição pertence ao atendimento atual. Não colocar `Nova Prescrição` no histórico longitudinal.

O atual `Prontuário longitudinal e histórico` deve ser tratado como referência secundária e poderá ser refinado para `Histórico clínico`/`Contexto longitudinal` em slice própria ou junto da integração documental, sem duplicar ações do Encounter atual.

---

## Regras de continuidade

1. D2-A deve fechar foundation e provas de autorização antes de UI clínica completa.
2. Nenhum agente deve cortar behavior tests, verifier ou idempotência para caber em PR.
3. Nenhum agente deve publicar múltiplas PRs funcionais sem relatar a necessidade.
4. Usuário não executa migration durante desenvolvimento; GitHub/revisão/merge ficam com o agente responsável, e produção só entra após merge validado.
5. Após cada slice mergeada, atualizar `CURRENT_STATE.md` e `MANUAL_SOURCE_MAP.md` conforme estado real.
6. O manual final só deve descrever Prescrição/Documentos quando o comportamento estiver validado na UI/produção.
