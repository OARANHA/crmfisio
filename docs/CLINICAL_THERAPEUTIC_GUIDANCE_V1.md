# MedicsPro — Therapeutic Guidance V1 (D2-C)

> Primeira superfície funcional de `therapeutic_guidance` sobre a Clinical Documents Foundation D2-A.

**Estado:** PR #435 / EM ANDAMENTO / NÃO PRODUÇÃO  
**Base:** `main@655f535a453493052bcd175a9209418d86eaffd0`

## Objetivo

Disponibilizar no Encounter um ato documental multiprofissional para orientações terapêuticas autorais, sem criar outro Clinical Documents Engine e sem transformar Nexus em emissor automático de conduta.

Fluxo V1:

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
histórico / impressão do snapshot emitido
```

## Autoridade e elegibilidade

A UI não concede autoria.

A autoridade continua sendo:

```text
current_user_can_issue_clinical_document('therapeutic_guidance')
+
assert_clinical_document_actor(...)
```

O contrato D2-A exige, entre outros invariantes já existentes:

- usuário autenticado;
- profile ativo;
- tenant corrente coerente;
- identidade clínica válida;
- `clinical.documents`;
- próprio Encounter ativo no boundary D2-A;
- paciente válido no tenant.

`therapeutic_guidance` não possui o requisito adicional de identidade médica/CRM usado por `medication_prescription`. Portanto, a D2-C não deve introduzir hardcode de médico na apresentação ou no client.

Especialidade não concede acesso. Owner/admin não recebem autoria clínica por papel administrativo.

## Payload canônico

A D2-C utiliza exatamente o contrato já validado pela D2-A:

```json
{
  "items": [
    { "guidance": "..." }
  ],
  "patient_instructions": "...",
  "observations": "..."
}
```

Draft pode estar incompleto. Para emissão:

- `items` deve ser array não vazio;
- cada item deve ser objeto;
- cada `guidance` deve possuir conteúdo não vazio.

`patient_instructions` e `observations` permanecem opcionais nesta versão.

A aplicação não inventa conteúdo clínico, não completa orientação por IA e não converte resultado Nexus em documento automaticamente.

## Templates existentes

A D2-A já publica dois templates platform para este document type:

- `Orientação terapêutica geral`;
- `Orientações pós-atendimento`.

D2-C V1 apenas consome esses templates elegíveis. Administração visual específica para templates de guidance está fora desta slice.

## Persistência e lifecycle

A implementação reutiliza exclusivamente os RPCs genéricos D2-A:

- `create_clinical_document_draft(...)`;
- `save_clinical_document_draft(...)`;
- `issue_clinical_document(...)`.

Lifecycle:

```text
draft → issued → optional audited cancellation
```

A UI V1 entrega criar, salvar/retomar, revisar, emitir, histórico e imprimir. O cancelamento já existe no backend D2-A, mas não é ampliado por esta primeira superfície.

## Impressão V1

D2-C não cria um renderer paralelo nem reutiliza indevidamente o Prescription Renderer V2.

A prévia de edição é explicitamente:

```text
Prévia de conteúdo · sem validade
```

Depois da emissão, a impressão usa o `rendered_snapshot` congelado pelo servidor. Conteúdo dinâmico é escapado antes de entrar no HTML estático de impressão.

Consequência:

```text
documento emitido
→ imprime snapshot emitido
→ nunca reconstrói conteúdo histórico a partir do template corrente
```

Uma futura evolução visual de Therapeutic Guidance pode ganhar contrato de renderer próprio e versionado, mas não é requisito da D2-C V1.

## Clinical Cockpit

A PR adiciona o workspace:

```text
Orientações
```

junto aos workspaces clínicos existentes. Diferentemente de `Prescrição`, a apresentação não é limitada por `isPhysicianProfessionalType`; a elegibilidade efetiva continua sendo resolvida pelo servidor.

O workspace permanece vinculado ao mesmo `appointment_id`/Encounter canônico do profissional atual.

## Nexus

Regra obrigatória:

```text
Nexus = apoio à decisão / instrumento / cálculo / evidência
Therapeutic Guidance = ato documental explícito do profissional
```

A D2-C não lê `nexus.*` para conceder autoria e não transforma resultado clínico em orientação emitida automaticamente.

## Escopo negativo

Esta slice não implementa:

- `exam_order`;
- atestado;
- referral;
- relatório clínico;
- assinatura digital;
- PDF certificado;
- renderer visual avançado de guidance;
- editor HTML/CSS/JS;
- administração de templates de guidance;
- auto-geração por Nexus/IA;
- mudança em D2-A/RLS/RPC/grants/capabilities;
- migration de banco.

## Gates esperados

Antes de sair de draft, provar no head final:

- testes unitários do payload D2-C;
- boundary do Clinical Cockpit;
- `npm test`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- dependency audit;
- Clinical Foundation Reconciliation;
- Clinical Authorization Reconciliation;
- Clinical Encounter Record Foundation;
- Nexus C-01/C-02/C-03/C-04/C-06.

Nenhum gate existente deve ser relaxado para acomodar D2-C.

## Produção

Não há migration nova prevista para D2-C V1.

Depois de merge/redeploy, o smoke real deverá provar:

1. profissional elegível abre `Orientações` em Encounter próprio ativo;
2. cria um draft usando template publicado;
3. salva e retoma;
4. adiciona múltiplas orientações;
5. revisa explicitamente;
6. emite;
7. documento aparece no histórico;
8. impressão usa o snapshot emitido;
9. profissional sem elegibilidade continua fail-closed.

Somente depois desse smoke o estado pode virar `VALIDADO EM PRODUÇÃO`.
