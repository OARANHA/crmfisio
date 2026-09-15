# Consultório V5 — Navigation Composition V1

**Status:** PRODUÇÃO — MERGED / DEPLOYED / RUNTIME VALIDATED
**PR:** `#469`
**Merge SHA:** `233b6cb30e4f6943d1ede28acceafe2e08d18284`

## Objetivo

Materializar a primeira slice do Consultório V5 como composição frontend sobre o Encounter canônico já existente. A slice reduz troca de contexto e separa intenções clínicas sem criar prontuário, engine, autorização ou lifecycle paralelo.

## Composição

```text
um Encounter
├─ Registro
├─ Avaliações
├─ Instrumentos
├─ Prescrição        (quando relevante)
├─ Exames            (quando relevante)
├─ Documentos
│  ├─ Orientação terapêutica
│  └─ Encaminhamento
└─ Nexus
```

`Prescrição` e `Exames` continuam condicionados somente à relevância de apresentação médica já existente. Relevância não autoriza o ato; os workspaces e o servidor continuam revalidando os boundaries próprios.

## Separação de engines

### Avaliações

`ClinicalAssessmentRunner` continua usando o Assessment Engine versionado. `clinical.assessment.apply` não é reaproveitado para autorizar instrumentos clinician-assisted.

### Instrumentos

`ClinicianAssistedInstrumentApplyNow` ganha workspace próprio. A disponibilidade continua resolvida instrumento a instrumento pelo boundary neutro do Encounter e pela configuração explícita da clínica.

### Documentos

`Documentos` é somente um agrupador de navegação para:

- `therapeutic_guidance`;
- `referral`.

Os dois continuam com payload, document type, draft/save/issue, renderer, snapshot e regras server-side independentes. Prescrição e Pedido de Exames permanecem workspaces próprios porque têm frequência e ergonomia distintas, embora pertençam ao mesmo D2-A document engine.

## Comparação histórica obrigatória

Referência: `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`, especialmente `app-agendadoutor/src/views/pages/atendimentos/InProgressAppointmentView.vue`.

### Preservar

- paciente/contexto da consulta visível durante o trabalho;
- navegação clínica orientada à tarefa;
- acesso rápido aos principais atos durante o atendimento.

### Evoluir

- reduzir quantidade de destinos concorrentes;
- separar avaliações estruturadas de instrumentos validados;
- agrupar documentos de continuidade de menor frequência sem fundir engines;
- usar alvos de navegação mais confortáveis da UI Foundation V2.

### Rejeitar

- Vue/Pinia/Mongo/Express como arquitetura de destino;
- atualização de status/checkout do legado;
- autosave legado;
- autorização inferida de profissão/role;
- módulos sem boundary canônico atual;
- dados pessoais desnecessários ocupando o workspace principal.

## Invariantes

```text
ENGINE != AUTHORIZATION != RELEVANCE
one Encounter != one engine
navigation grouping != authorization grouping
navigation grouping != persistence grouping
```

A slice não altera:

- schema/migrations;
- RLS;
- RPCs;
- Edge Functions;
- capabilities;
- care relationship;
- Encounter lifecycle;
- finalização;
- scoring;
- document lifecycle;
- renderers ou snapshots.

## Validação

- testes direcionados de Encounter/Referral/Persistence/V5: verdes;
- contratos de Prescription, Exam Order e Clinician-Assisted atualizados para a composição V5 sem relaxar invariantes;
- suíte completa: `105/105` arquivos, `572/572` testes;
- `npm run typecheck`: verde;
- `npm run lint`: verde, zero warnings;
- `npm run build`: verde;
- `git diff --check`: verde.

O build mantém o warning conhecido de chunk principal acima de 500 kB; esta slice não adiciona dependência nem nova engine e não é a origem desse warning.

## Rollout

Antes de produção:

1. PR CI verde;
2. merge controlado;
3. deploy frontend normal;
4. smoke manual em Encounter real para profissional médico e profissional não médico;
5. confirmar navegação mobile/desktop, troca entre Avaliações/Instrumentos e subnavegação de Documentos;
6. confirmar que nenhuma capability é concedida pela apresentação;
7. atualizar `docs/CURRENT_STATE.md` para marcar V5 como produção somente depois do smoke.


## Produção

Validado no `28server / 158.220.97.145` após deploy GitOps:

- sete workspaces canônicos presentes no bundle vivo;
- médico com Prescrição e Exames por relevância de apresentação;
- rotas principais responderam HTTP 200;
- container sem restart/OOM;
- nenhum backend, migration, RLS/RPC ou Edge Function foi alterado por esta slice.
