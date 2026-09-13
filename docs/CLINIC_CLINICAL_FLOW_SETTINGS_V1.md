# Clinic Clinical Flow Settings V1

## Estado

Slice de configuração institucional para fluxos clínicos. Esta versão adiciona somente a política de autoria de encaminhamentos.

## Princípio canônico

Configuração da clínica não é autorização de usuário.

```text
PLATFORM ENTITLEMENT
→ CLINIC CONFIGURATION
→ USER AUTHORIZATION / CAPABILITY
→ RESOURCE / ENCOUNTER CONTEXT
```

Uma configuração pode restringir um fluxo que a plataforma e o usuário poderiam executar; ela nunca concede capability, identidade clínica, acesso ao prontuário, care relationship ou autoria por si só.

## Encaminhamentos

A política V1 é:

```text
referral_authoring_enabled
```

Na interface aparece como:

> Permitir que profissionais emitam encaminhamentos

### `true`

Preserva o comportamento canônico já validado: um ator ainda precisa satisfazer todos os boundaries de Clinical Documents para criar, editar e emitir um `referral`.

### `false`

Bloqueia server-side:

- criação de novo draft de `referral`;
- alteração de draft existente;
- emissão de draft existente.

Não altera:

- histórico de encaminhamentos emitidos;
- snapshots emitidos;
- leitura clínica já autorizada por outros boundaries;
- cancelamento lifecycle de documento já emitido;
- D2-E4 já materializado;
- outros tipos de Clinical Documents.

## Persistência e ACL

`public.clinic_clinical_flow_settings` é tenant-owned e não possui escrita direta para `authenticated`.

Leitura e alteração usam RPCs estreitos:

```text
get_current_clinic_clinical_flow_settings()
update_current_clinic_clinical_flow_settings(boolean)
```

Somente `owner` e `admin` podem alterar a configuração. Outros membros ativos da clínica podem ler a configuração efetiva para apresentação, sem receber capacidade de modificá-la.

O default é `true` para preservar o comportamento de clínicas existentes e de clínicas recém-provisionadas que ainda não tenham uma linha explícita.

## Enforcement

O boundary de banco é `guard_clinical_referral_authoring_policy()` em `clinical_documents`.

A regra é deliberadamente estreita: somente INSERT de referral e UPDATE enquanto o documento ainda está em `draft` e permanece `draft` ou transita para `issued` são afetados. A política não é usada como ACL de histórico.

## Por que o agendamento direto não entrou nesta V1

A configuração `profissional encaminhador pode agendar diretamente o destinatário` foi considerada, mas não é incluída nesta slice.

Hoje D2-E4 possui o fluxo seguro de direct scheduling validado em produção, porém ainda não existe uma experiência operacional equivalente de inbox/fila de encaminhamentos para recepção ou destinatário assumir o agendamento quando essa ação for desativada para o emissor.

Adicionar um toggle que desligasse o único caminho operacional existente poderia criar um dead-end de produto. Essa política deve entrar junto com uma rota alternativa coerente de continuidade operacional, mantendo o boundary D2-E4 same-transaction/exact-target já validado.

## Não objetivos

Esta slice não:

- altera capabilities clínicas;
- altera `current_user_can_issue_clinical_document()`;
- redefine D2-E4;
- muda Agenda/Appointment;
- cria inbox de referrals;
- cria aceite/recusa;
- cria entitlement de plano;
- muda histórico emitido.
