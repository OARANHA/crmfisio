# MedicsPro — Clinical Document Template Admin (D2-B.2A)

> Boundary backend para administração tenant-scoped de modelos de prescrição. O ato administrativo de configurar um modelo **não** concede autoridade clínica para prescrever.

## Objetivo

Permitir que `owner`/`admin` ativos da clínica preparem a futura biblioteca visual de modelos de prescrição sem reabrir a Clinical Documents Foundation e sem permitir escrita direta nas tabelas protegidas.

Princípio:

```text
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
```

Como admin da clínica:

- posso listar modelos MedicsPro e os modelos da minha clínica;
- modelos MedicsPro são somente leitura;
- posso criar um modelo da clínica;
- posso clonar um modelo MedicsPro para minha clínica;
- posso publicar uma nova versão imutável de um modelo da clínica;
- posso alterar metadados e arquivar o modelo da clínica;
- não posso administrar modelo de outro tenant.

Como médico:

- continuo vendo/usando somente templates ativos elegíveis pelo boundary D2-A;
- administrar modelos não substitui identidade médica, CRM, capability ou autoria do Encounter;
- uma prescrição emitida mantém seus snapshots históricos mesmo após nova versão/arquivamento do template.

## Contrato D2-B.2A

A slice é backend-only e gerencia apenas:

```text
medication_prescription
```

Não adiciona `exam_order`, atestado, relatório, assinatura digital, PDF, catálogo de medicamentos ou automação Nexus.

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

V1 de administração exige:

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

Versões publicadas continuam protegidas pelo trigger D2-A. Não há hard delete administrativo nesta slice.

## Renderer seguro

D2-B.2A não cria editor HTML. O contrato continua fechado:

- `definition.kind = medication_prescription`;
- campos permitidos: `items`, `observations`;
- `items` obrigatório;
- renderer permitido nesta etapa: `clinical-document/plain-text-v1`;
- variables contract limitado ao conjunto canônico atual.

Layouts profissionais configuráveis serão uma evolução aditiva posterior. HTML/CSS/JS arbitrário não será fonte clínica.

## Validação

A suite D2-B.2A deve provar, em PostgreSQL 16:

- owner/admin gerenciam templates do próprio tenant sem identidade médica;
- gestão não concede emissão;
- profissionais/recepção/financeiro são negados;
- cross-tenant é negado;
- template platform não é mutável;
- clone platform vira cópia independente da clínica;
- publicação cria versão append-only e avança `current_version_id`;
- versões publicadas permanecem imutáveis;
- snapshots de documento emitido permanecem idênticos depois de v2;
- archive não apaga documento histórico;
- INSERT/UPDATE/DELETE direto por `authenticated` continua negado;
- renderer/fields fora do contrato fail closed.

Arquivos de rollout:

- migration: `supabase-migrations/20260912_clinical_document_template_admin.sql`
- verifier production-safe: `supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENT_TEMPLATE_ADMIN.sql`
- behavior cases: `tests/sql/clinical_document_template_admin_cases.sql`
- harness: `scripts/test-clinical-document-template-admin.sh`

## Rollout

Migration de produção é manual/controlada. Merge de PR não equivale a migration aplicada.

Estados editoriais:

```text
IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO
→ MERGEADO / NÃO VALIDADO EM PRODUÇÃO
→ migration + verifier reais
→ VALIDADO EM PRODUÇÃO
```

A futura UI de `Configurações → Modelos de Prescrição` deve consumir os RPCs desta slice; não deve receber grants de mutação direta nas tabelas clínicas.
