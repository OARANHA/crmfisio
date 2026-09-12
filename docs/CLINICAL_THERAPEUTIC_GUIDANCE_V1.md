# MedicsPro — Therapeutic Guidance V1 (D2-C)

> Primeira superfície funcional de `therapeutic_guidance` sobre a Clinical Documents Foundation D2-A.

**Estado:** PR #435 MERGEADA / NÃO VALIDADO EM PRODUÇÃO  
**Merge canônico:** `33da15230cd35179681406b212e87305618a4976`  
**Evolução visual atual:** D2-C.1 / PR #436 / EM ANDAMENTO

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

A D2-C consome esses templates. A D2-C.1 publica versões visuais novas dos mesmos templates sem alterar as versões históricas.

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

A evolução D2-C.1 / PR #436 passa a adotar um renderer visual próprio e versionado:

```text
clinical-document/therapeutic-guidance-v1
```

A regra histórica permanece a mesma:

```text
documento emitido
→ usa snapshots congelados na emissão
→ nunca usa o template corrente para alterar o passado
```

Documentos antigos `plain-text-v1` continuam em fallback seguro. Detalhes: `docs/CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.md`.

## Clinical Cockpit

A PR #435 adicionou o workspace:

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

## Produção

A PR #435 está mergeada, mas ainda não deve ser chamada de `VALIDADO EM PRODUÇÃO` sem smoke real.

A D2-C.1 adiciona uma migration visual versionada. Após eventual merge da #436, o rollout deve seguir `backup → migration pinada → verifier → redeploy → smoke`.

Smoke final deve provar:

1. profissional elegível abre `Orientações` em Encounter próprio ativo;
2. cria, salva e retoma draft;
3. revisa e emite;
4. documento aparece no histórico;
5. nova orientação imprime com a composição A4 congelada;
6. orientação histórica `plain-text-v1` continua imprimível por fallback seguro;
7. profissional inelegível continua fail-closed.

Somente então D2-C/D2-C.1 podem virar `VALIDADO EM PRODUÇÃO`.
