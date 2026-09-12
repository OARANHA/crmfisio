# MedicsPro — Clinical Document Template Admin

> Administração tenant-scoped de modelos de prescrição. Configurar um modelo **não** concede autoridade clínica para prescrever.

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
- posso alterar metadados, apresentação segura e arquivar/reativar;
- não posso administrar modelo de outro tenant.

Como médico:

- continuo vendo/usando somente templates ativos elegíveis pelo boundary D2-A;
- administrar modelos não substitui identidade médica, CRM, capability nem autoria do Encounter;
- uma receita emitida mantém seus snapshots históricos mesmo após nova versão/arquivamento do template.

---

# D2-B.2A — Backend canônico

**VALIDADO EM PRODUÇÃO em 2026-09-12.**

PR #431 → `af7b87725a62985c0f6a38dc753b737de40b48af`.

RPCs:

- `list_clinical_document_templates_for_management(text)`
- `create_clinic_clinical_document_template(...)`
- `clone_clinical_document_template_to_clinic(...)`
- `publish_clinic_clinical_document_template_version(...)`
- `update_clinic_clinical_document_template_metadata(...)`

Autorização de administração exige sessão/profile/tenant ativos e role `owner|admin`; não exige CRM nem `clinical.documents` e não concede emissão.

Versões publicadas continuam append-only e protegidas pelo trigger D2-A. Não há hard delete administrativo.

Produção:

```text
20260912_clinical_document_template_admin.sql
→ COMMIT / MIGRATION_EXIT=0

VERIFY_20260912_CLINICAL_DOCUMENT_TEMPLATE_ADMIN.sql
→ CLINICAL DOCUMENT TEMPLATE ADMIN VERIFY PASSED
→ VERIFIER_EXIT=0
```

---

# D2-B.2B — Admin UI / Template Library

**VALIDADO EM PRODUÇÃO.**

PR #432 → `8247f91ec5c35c6cf409b7356ed1c1601b961623`.

Superfície:

```text
Configurações
→ Documentos clínicos
→ Modelos de prescrição
```

Entregue e confirmado no smoke real:

- biblioteca de modelos MedicsPro read-only;
- biblioteca de modelos clinic-owned;
- visualização administrativa;
- criar modelo da clínica;
- duplicar platform → clinic-owned;
- editar nome/descrição/especialidade-relevância;
- arquivar/reativar;
- nenhum grant de mutação direta;
- `+ Novo modelo` não persiste nada antes da confirmação do admin.

O smoke confirmou que a superfície administrativa funciona e também confirmou o próximo gap de produto: o preview e a impressão devem obedecer ao mesmo layout profissional configurável.

---

# D2-B.2C — Professional Print Layout / Safe Presets

**PR #433 / EM ANDAMENTO / NÃO PRODUÇÃO.**

Documento específico: `docs/CLINICAL_PRESCRIPTION_RENDERER_V2.md`.

A evolução adiciona o contrato fechado:

```text
clinical-document/prescription-v2
```

e a RPC administrativa:

- `save_clinic_prescription_template_presentation(...)`

Regras:

- somente template clinic-owned ativo do tenant pode ser alterado;
- platform continua read-only;
- alteração visual publica nova versão quando `render_definition` muda;
- alteração apenas de metadados não cria versão visual desnecessária;
- renderer aceita somente presets/acentos/blocos tipados;
- qualquer chave arbitrária, HTML/CSS/JS ou enum fora do contrato falha fechado;
- contexto emitido congela dados necessários de paciente/clínica/profissional;
- documento histórico continua preso ao `template_version_id` + snapshots da emissão.

Presets V1:

- `classic`;
- `institutional`;
- `compact`.

Admin preview, draft preview e issued print reutilizam o mesmo renderer frontend seguro. A tela administrativa se aproxima da UX madura do MedicsPro histórico através de drawer + preview fiel, sem reutilizar o `v-html`/template HTML livre do sistema antigo.

---

# Invariantes de continuidade

```text
ADMIN UI
→ explicit admin RPCs
→ protected tables

ADMIN UI != clinical issue authority
PREVIEW == PRINT CONTRACT
ISSUED DOCUMENT != CURRENT TEMPLATE
```

Especialidade/relevância não concede autorização clínica.

`Pedido de Exames`, atestado e relatório permanecem fora até seus `document_type` canônicos existirem.