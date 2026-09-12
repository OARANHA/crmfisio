# MedicsPro — Therapeutic Guidance V1 (D2-C)

> Primeira superfície funcional de `therapeutic_guidance` sobre a Clinical Documents Foundation D2-A.

**Estado:** VALIDADO EM PRODUÇÃO  
**PR funcional:** #435 → `33da15230cd35179681406b212e87305618a4976`  
**Evolução visual:** D2-C.1 / PR #436 → `af53bf2d7229c238335ab201f3438f44543f7f89` / VALIDADO EM PRODUÇÃO

## Objetivo

Disponibilizar no Encounter um ato documental multiprofissional para orientações terapêuticas autorais, sem criar outro Clinical Documents Engine e sem transformar Nexus em emissor automático de conduta.

Fluxo funcional:

```text
Encounter próprio ativo
      ↓
Orientações
      ↓
modelo therapeutic_guidance publicado
      ↓
draft
      ↓
orientações estruturadas
+ instruções ao paciente opcionais
+ observações opcionais
      ↓
salvar / retomar
      ↓
revisão humana explícita
      ↓
emitir
      ↓
snapshots imutáveis D2-A
      ↓
histórico / impressão
```

## Autoridade e elegibilidade

A UI não concede autoria. A autoridade continua sendo:

```text
current_user_can_issue_clinical_document('therapeutic_guidance')
+
assert_clinical_document_actor(...)
```

O contrato D2-A exige perfil/tenant coerentes, identidade clínica válida, `clinical.documents`, próprio Encounter ativo e paciente válido no tenant.

`therapeutic_guidance` não possui o requisito adicional médico/CRM de `medication_prescription`. Especialidade não concede acesso. Owner/admin não recebem autoria clínica por papel administrativo.

## Payload canônico

```json
{
  "items": [
    { "guidance": "..." }
  ],
  "patient_instructions": "...",
  "observations": "..."
}
```

Draft pode estar incompleto. Para emissão, `items` deve ser array não vazio e cada `guidance` deve possuir conteúdo. `patient_instructions` e `observations` permanecem opcionais.

A aplicação não inventa conteúdo clínico, não completa orientação por IA e não converte resultado Nexus em documento automaticamente.

## Templates existentes

A D2-A criou dois templates platform:

- `Orientação terapêutica geral`;
- `Orientações pós-atendimento`.

A D2-C consome esses templates. A D2-C.1 publicou versões visuais novas dos mesmos templates sem alterar as versões históricas.

## Persistência e lifecycle

A D2-C reutiliza exclusivamente os RPCs genéricos D2-A:

- `create_clinical_document_draft(...)`;
- `save_clinical_document_draft(...)`;
- `issue_clinical_document(...)`.

Lifecycle:

```text
draft → issued → optional audited cancellation
```

A UI V1 entrega criar, salvar/retomar, revisar, emitir, histórico e imprimir. O cancelamento existe no backend D2-A, mas não ganhou nova superfície nesta slice.

## Apresentação documental

A PR #435 nasceu com preview simples de conteúdo e impressão do `rendered_snapshot` congelado.

A D2-C.1 / PR #436 fechou a apresentação com renderer visual próprio e versionado:

```text
clinical-document/therapeutic-guidance-v1
```

A regra histórica permanece:

```text
documento emitido
→ usa snapshots congelados na emissão
→ nunca usa o template corrente para alterar o passado
```

Documentos antigos `plain-text-v1` continuam em fallback seguro. Detalhes: `docs/CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.md`.

## Clinical Cockpit

O workspace validado é:

```text
Orientações
```

no mesmo Clinical Cockpit/Encounter. Diferentemente de `Prescrição`, sua apresentação não é limitada por `isPhysicianProfessionalType`; a eligibility efetiva continua server-side.

## Nexus

Regra obrigatória:

```text
Nexus = apoio à decisão / instrumento / cálculo / evidência
Therapeutic Guidance = ato documental explícito do profissional
```

Nexus não concede autoria e não transforma resultado clínico em orientação emitida automaticamente.

## Escopo negativo

D2-C/D2-C.1 não implementam:

- `exam_order`;
- atestado;
- referral;
- relatório clínico;
- assinatura digital;
- PDF certificado;
- editor HTML/CSS/JS;
- auto-geração por Nexus/IA;
- expansão de autorização clínica.

## Produção — 2026-09-12

A PR #435 foi mergeada e o fluxo funcional foi testado em produção. O smoke inicial revelou um blocker exclusivamente de apresentação: impressão plain-text com rótulo técnico e sem composição clínica adequada.

Esse blocker foi fechado pela D2-C.1 / PR #436. A migration visual foi aplicada com `COMMIT`, o verifier oficial terminou verde e o frontend foi redeployado.

O smoke final confirmou:

1. workspace `Orientações` no Encounter ativo;
2. draft e live preview A4 seguro;
3. título humano do documento;
4. clínica, paciente e identidade profissional;
5. orientações e instruções formatadas;
6. revisão/emissão e histórico;
7. impressão profissional com bloco de assinatura e identificador;
8. ausência do rótulo técnico `therapeutic_guidance` na saída ao paciente.

```text
D2-C / D2-C.1 — VALIDADO EM PRODUÇÃO
```
