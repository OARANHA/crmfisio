# MedicsPro — Referral / Encaminhamento Encounter UX V1 (D2-E1)

> UX canônica para criar e emitir encaminhamentos clínicos dentro do Encounter, consumindo exclusivamente a fundação D2-E0/D2-A.

**Base de produção consolidada:** `main@2ecc17a7efc6d02a94e738bf5b17d748402d8c99`  
**Estado:** **VALIDADO EM PRODUÇÃO**.

## Objetivo

Transformar o `referral` validado no backend em um fluxo utilizável no Clinical Cockpit, sem criar novo engine documental, autorização paralela ou integração externa.

Fluxo validado:

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

## Autorização

A aba `Encaminhamento` faz parte do Clinical Cockpit. A presença da aba não concede autorização: antes de operar, o workspace chama `current_user_can_issue_clinical_document('referral')`. A capability frontend é somente gate de apresentação; o servidor é autoridade.

D2-E1 não cria bypass owner/admin/platform e não transforma especialidade em ACL.

## Conteúdo clínico

O documento suporta:

- destino estruturado;
- motivo do encaminhamento — obrigatório;
- resumo clínico relevante — opcional;
- avaliação/ação solicitada — opcional;
- prioridade `Rotina`, `Alta` ou `Urgente`;
- observações — opcionais.

A UI não gera conteúdo clínico automaticamente e não consulta Nexus para decidir destino, motivo ou conduta.

## Draft / resume

O workspace isola estado por paciente + Encounter + emissor. Ao reabrir a aba, somente o draft do mesmo contexto pode ser retomado. Draft de outro atendimento/profissional não é reapresentado como pertencente ao Encounter atual.

## Revisão e emissão

A emissão exige ação humana explícita:

```text
Revisar encaminhamento
→ Confirmar emissão
```

Se existirem alterações não salvas, o cliente persiste o draft antes de chamar `issue_clinical_document`. O servidor reaplica eligibility, ownership do Encounter e validação do payload na emissão.

## Evoluções posteriores incorporadas

D2-E2 substituiu a prévia simples inicial por renderer A4 profissional compartilhado com a impressão emitida.

D2-E3 adicionou os modos:

```text
Profissional da clínica
Especialidade / serviço
Destino externo
```

O roteamento interno usa identificador estável no backend e rótulos humanos na UI/documento. Selecionar destino não concede acesso ao prontuário nem cria relação assistencial automaticamente.

## Histórico

O histórico separa encaminhamentos deste atendimento e histórico anterior. Documentos emitidos/cancelados usam snapshots congelados; evolução do template ou do cadastro profissional não reescreve o documento histórico.

## Evidência de produção

Produção confirmou a aba `Encaminhamento`, criação/retomada de draft, revisão, emissão, histórico e integração com o renderer profissional. O smoke posterior D2-E3/D2-E3.1 confirmou também o destino interno real e a impressão A4 emitida.

## Fora de escopo

Fila de recebidos, aceite/recusa, agendamento, atendimento e conclusão não pertencem a D2-E1. Esses estados seguem para D2-E4 como workflow operacional separado do lifecycle documental.
