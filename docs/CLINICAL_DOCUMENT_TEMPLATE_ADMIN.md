# MedicsPro — Clinical Document Template Admin

> Administração tenant-scoped de modelos de prescrição. O ato administrativo de configurar um modelo **não** concede autoridade clínica para prescrever.

## Princípio central

```text
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
```

Como admin da clínica:

- posso listar modelos MedicsPro e modelos da minha clínica;
- modelos MedicsPro são somente leitura;
- posso criar um modelo da clínica;
- posso clonar um modelo MedicsPro para minha clínica;
- posso publicar uma nova versão imutável de um modelo da clínica;
- posso alterar metadados e arquivar/reativar o modelo da clínica;
- não posso administrar modelo de outro tenant.

Como médico:

- continuo vendo/usando somente templates ativos elegíveis pelo boundary D2-A;
- administrar modelos não substitui identidade médica, CRM, capability nem autoria do Encounter;
- uma receita emitida mantém seus snapshots históricos mesmo após nova versão/arquivamento do template.

---

# D2-B.2A — Backend canônico

**VALIDADO EM PRODUÇÃO em 2026-09-12.**

PR #431 → squash merge:

```text
af7b87725a62985c0f6a38dc753b737de40b48af
```

RPCs:

- `list_clinical_document_templates_for_management(text)`
- `create_clinic_clinical_document_template(...)`
- `clone_clinical_document_template_to_clinic(...)`
- `publish_clinic_clinical_document_template_version(...)`
- `update_clinic_clinical_document_template_metadata(...)`

Helpers internos:

- `require_clinical_document_template_manager()`
- `validate_clinical_document_template_contract(...)`

## Autorização

Administração exige:

- sessão autenticada;
- profile ativo;
- clínica ativa e não removida;
- tenant atual coerente;
- role `owner` ou `admin`.

Não exige CRM nem `clinical.documents`, porque essas condições pertencem ao ato clínico de emissão, não à configuração administrativa.

`professional`, `recep`, `financeiro` e ator sem vínculo com clínica não recebem autoridade de gestão. `platform_admin` não recebe acesso implícito a tenant.

## Imutabilidade e versionamento

```text
clinic template
  └── v1 published
       ↓ admin evolui o modelo
  └── v2 published

issued document from v1
  └── template_version_id = v1
  └── template_definition_snapshot = v1
  └── payload_snapshot/context_snapshot/rendered_snapshot preservados
```

Versões publicadas continuam protegidas pelo trigger D2-A. Não há hard delete administrativo.

## Renderer seguro atual

D2-B.2A não criou editor HTML. O contrato permanece fechado:

- `definition.kind = medication_prescription`;
- campos permitidos: `items`, `observations`;
- `items` obrigatório;
- renderer atual: `clinical-document/plain-text-v1`;
- variables contract limitado ao conjunto canônico atual.

HTML/CSS/JS arbitrário não é fonte clínica.

## Evidência PostgreSQL 16 / produção

Antes do merge:

- verifier oficial verde;
- behavior matrix **22/22**;
- D2-A canonical runtime verde;
- care relationship/auth regressions verdes;
- 422/422 testes de aplicação + typecheck/lint/build;
- 10/10 workflows no head final.

Rollout real:

```text
20260912_clinical_document_template_admin.sql
→ COMMIT
→ MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENT_TEMPLATE_ADMIN.sql
→ CLINICAL DOCUMENT TEMPLATE ADMIN VERIFY PASSED
→ ROLLBACK intencional do verifier
→ VERIFIER_EXIT=0
```

Arquivos:

- `supabase-migrations/20260912_clinical_document_template_admin.sql`
- `supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENT_TEMPLATE_ADMIN.sql`
- `tests/sql/clinical_document_template_admin_cases.sql`
- `scripts/test-clinical-document-template-admin.sh`

---

# D2-B.2B — Admin UI / Template Library

**PR #432 / EM ANDAMENTO / NÃO PRODUÇÃO.**

A UI deve consumir somente os RPCs D2-B.2A; não recebe grants de mutação direta nas tabelas clínicas.

Superfície:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
```

Funcionalidades desta slice:

- biblioteca de modelos MedicsPro read-only;
- biblioteca de modelos clinic-owned;
- visualização administrativa com dados fictícios;
- criar modelo da clínica;
- duplicar modelo MedicsPro para cópia independente do tenant;
- editar nome, descrição e especialidade/relevância;
- arquivar/reativar modelos clinic-owned.

Boundary:

```text
ADMIN UI
→ D2-B.2A RPCs
→ protected tables

ADMIN UI != clinical issue authority
```

Especialidade/relevância não concede autorização clínica.

A visualização B.2B representa a estrutura administrativa do modelo e não deve ser confundida com um novo renderer de impressão. O layout profissional será tratado por contrato versionado próprio.

---

# Próxima evolução — Professional Print Layout / Safe Presets

A impressão atual da Prescrição V1 foi validada funcionalmente, mas o smoke mostrou que o acabamento ainda é simples.

A evolução deve:

- usar presets versionados e fechados;
- preservar snapshots históricos;
- permitir preview fiel do layout publicado;
- reaproveitar nome/endereço/contato da clínica quando congelados no contexto emitido;
- jamais recalcular documento histórico a partir do template corrente;
- evitar HTML/CSS/JS arbitrário fornecido pelo admin.

Possíveis presets são produto/UX, não novos tipos documentais. `Pedido de Exames`, atestado e relatório permanecem fora até seus `document_type` canônicos existirem.
