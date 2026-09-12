# MedicsPro — Referral / Encaminhamento Encounter UX V1 (D2-E1)

> UX canônica para criar e emitir encaminhamentos clínicos dentro do Encounter, consumindo exclusivamente a fundação D2-E0/D2-A.

**Base canônica:** `main@be1fb4696dc285637c2c3e8d0f7bf857238b0926`  
**Estado:** IMPLEMENTADO / NÃO VALIDADO EM PRODUÇÃO

## Objetivo

Transformar o `referral` já validado no backend em um fluxo utilizável no Clinical Cockpit, sem criar novo engine documental, autorização paralela ou integração externa.

Fluxo:

```text
Encounter próprio ativo
→ Encaminhamento
→ template referral publicado
→ draft estruturado
→ destino + motivo + contexto clínico
→ save / resume
→ revisão humana explícita
→ issue D2-A
→ snapshots imutáveis
→ histórico do atendimento e histórico anterior
```

## UX V1

A aba `Encaminhamento` aparece no Clinical Cockpit para o contexto clínico. A presença da aba não concede autorização: antes de carregar templates/documentos ou permitir qualquer operação, o workspace chama:

```text
current_user_can_issue_clinical_document('referral')
```

A capability frontend `clinical.documents` continua apenas como gate de apresentação; o servidor é a autoridade.

### Destino estruturado

O usuário pode informar o que estiver disponível:

- profissional;
- profissão;
- especialidade;
- serviço;
- instituição/local;
- contato.

Para emissão, pelo menos um entre profissional, profissão, especialidade, serviço ou instituição deve estar preenchido. Contato sozinho não identifica o destino.

### Conteúdo clínico

- motivo do encaminhamento — obrigatório;
- resumo clínico relevante — opcional;
- avaliação/ação solicitada — opcional;
- prioridade — `Rotina`, `Alta` ou `Urgente`;
- observações — opcional.

A UI não gera conteúdo clínico automaticamente e não consulta Nexus para decidir destino, motivo ou conduta.

## Draft / resume

O workspace isola estado por:

```text
patient.id + encounter.id + user.id
```

Ao reabrir a aba, somente um draft do mesmo paciente, mesmo Encounter e mesmo emissor pode ser retomado. Draft de outro atendimento/profissional não é reapresentado como se pertencesse ao contexto atual.

## Revisão e emissão

A emissão exige ação humana explícita em duas etapas:

```text
Revisar encaminhamento
→ Confirmar emissão
```

Se houver alterações não salvas, o cliente usa `save_clinical_document_draft` antes de `issue_clinical_document`.

O servidor reaplica eligibility, Encounter ownership e validação do payload no momento da emissão.

## Prévia V1

D2-E1 apresenta uma **prévia de conteúdo sem validade**, com rótulos humanos e sem pretender ser o documento final A4.

A prévia mostra:

- paciente;
- destino;
- prioridade;
- motivo;
- resumo clínico;
- ação solicitada;
- observações;
- contato do destino.

Ela é explicitamente marcada como `Sem validade`.

O renderer profissional, com cabeçalho clínico, identidade do emissor, data e assinatura, pertence à slice D2-E2. D2-E1 não usa `window.print()` e não inventa um renderer paralelo temporário.

## Histórico

O histórico separa:

- encaminhamentos deste atendimento;
- histórico anterior.

Para documentos emitidos/cancelados, a UI usa:

```text
payload_snapshot ?? payload
```

Assim o conteúdo histórico permanece o snapshot emitido mesmo que o template atual evolua.

## Escopo negativo

D2-E1 não implementa:

- migration;
- Edge Function;
- nova capability/RLS/grant/role;
- A4 profissional;
- impressão final;
- assinatura digital;
- diretório de profissionais/serviços;
- busca externa de prestadores;
- envio automático por WhatsApp/e-mail;
- aceite/recusa do destino;
- contrarreferência;
- agendamento externo;
- cobrança;
- Nexus auto-referral.

## Validação obrigatória

Antes de merge:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev --audit-level=critical
```

Além disso, o workflow D2-E1 executa PostgreSQL 16 para:

- D2-E0 Referral Foundation;
- Clinical Authorization Reconciliation.

## Rollout

D2-E1 é frontend-only.

Após merge:

```text
frontend redeploy
→ abrir Encounter próprio ativo
→ confirmar aba Encaminhamento
→ criar draft
→ preencher destino + motivo
→ salvar
→ sair/voltar e confirmar resume
→ revisar
→ emitir
→ confirmar histórico Emitido
```

Somente depois desse smoke a slice vira `VALIDADO EM PRODUÇÃO`.

Próxima slice: **D2-E2 — Referral Professional Print Renderer V1**.
