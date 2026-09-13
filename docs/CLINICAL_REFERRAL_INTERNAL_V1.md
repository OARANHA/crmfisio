# D2-E3 — Encaminhamento Interno V1

**Base canônica validada:** `main@b720ca2768cf2c1cb5b20fa65125306a8ae26936`  
**Estado:** **D2-E3 / D2-E3.1 / D2-E4 VALIDADOS EM PRODUÇÃO** em 2026-09-12/13.

## Objetivo

Permitir que o mesmo documento canônico `referral` represente destino externo ou continuidade dentro da própria clínica sem criar outro engine documental e sem transformar roteamento em autorização clínica.

## Modos de destino

- **Profissional da clínica**: seleciona um profissional clínico ativo do mesmo tenant por identificador estável; o documento congela também os campos humanos do destino.
- **Especialidade / serviço da clínica**: roteia para uma área derivada da equipe clínica ativa, sem inventar um catálogo paralelo nesta slice.
- **Destino externo**: preserva integralmente o fluxo livre já existente.

Os metadados técnicos de roteamento são `destination_scope` e `target_profile_id`. Eles ficam no payload/snapshot canônico, mas nunca são exibidos no documento para o paciente.

## Boundary de segurança

`list_clinical_referral_internal_targets()` é um RPC estreito `SECURITY DEFINER`. Só responde a um autor elegível para `referral`, usa o tenant corrente, retorna apenas perfis ativos com identidade clínica canônica e exclui o próprio emissor. Não expõe e-mail, role, capabilities ou dados administrativos.

O hardening D2-E3.1 restringe os destinos às profissões clínicas canônicas atualmente suportadas:

```text
medico
fisioterapeuta
psicologo
quiropraxista
```

A regra continua sendo **profissão != role**: não existe filtro `role='professional'` como substituto de identidade profissional. Perfis administrativos com `professional_type` legado ou arbitrário, como `recepcionista`, ficam fail-closed.

`trg_clinical_referral_internal_target` revalida destino interno no banco. Um `internal_professional` não pode apontar para outro tenant, perfil inativo, perfil fora do catálogo clínico canônico ou para o próprio emissor. A transição para `issued` revalida novamente o alvo, evitando emitir para um profissional desativado ou movido depois do salvamento do draft.

Para `internal_service`, a área precisa resolver para pelo menos um profissional clínico ativo do mesmo tenant. Especialidade/profissão são usadas para roteamento e apresentação; não concedem acesso ao prontuário.

A seleção de destino **não concede** leitura de prontuário, care relationship, autoria, capability, acesso ao Encounter nem qualquer bypass owner/admin/platform. Esses temas continuam nas autoridades canônicas existentes.

## UX validada

O workspace oferece escolhas humanas:

```text
Profissional da clínica
Especialidade / serviço
Destino externo
```

Enquanto nenhum profissional/área real é escolhido, o preview permanece com **Destino não informado**. O nome da clínica não é usado sozinho para simular uma escolha interna.

Profissões internas são exibidas com rótulos humanos, por exemplo `Médico`, `Psicólogo` e `Fisioterapeuta`, enquanto os valores canônicos permanecem no contrato server-side.

## Compatibilidade

Documentos anteriores sem `destination_scope` normalizam como `external`. O objeto `recipient` mantém o contrato fechado anterior; os metadados de roteamento são top-level para preservar o validator D2-E0 e os snapshots históricos. O renderer A4 continua usando somente campos humanos.

Rascunhos incompletos anteriores ao D2-E3.1 que contenham apenas a clínica em `facility` são saneados somente na pré-visualização; nenhum snapshot emitido é reescrito.

## Evidência de produção — D2-E3 / D2-E3.1

A produção confirmou:

```text
D2-E3 migration aplicada
→ verifier production-safe PASS
→ CLINICAL REFERRAL INTERNAL V1 VERIFY PASSED
→ Foundation revalidada

D2-E3.1 hardening aplicado
→ verifier PASS / VERIFIER_EXIT=0
→ frontend redeployado
```

Smoke real:

- isolamento multi-tenant comprovado: profissionais de outra clínica não apareceram no diretório VidaNova;
- o próprio emissor foi corretamente excluído;
- perfil administrativo legado com profissão não clínica foi identificado como gap e bloqueado pelo D2-E3.1;
- após cadastro normal de um segundo profissional clínico no mesmo tenant, `Dr. Aranha · Médico da Família` apareceu como destino interno;
- preview sem escolha mostrou `Destino não informado`;
- emissão e impressão A4 congelaram `Dr. Aranha · Médico da Família · Clínica Piloto VidaNova` em linguagem humana;
- UUID, `destination_scope` e `target_profile_id` não foram expostos ao paciente.

## Continuidade operacional D2-E4

**D2-E4 — Continuidade Operacional do Encaminhamento Interno está VALIDADA EM PRODUÇÃO.**

```text
encaminhamento interno emitido
→ operação operacional separada
→ recebido
→ aceite/recusa quando aplicável
→ agendamento vinculado
→ atendimento
→ conclusão
```

O documento clínico permanece imutável durante todo esse fluxo. D2-E4 usa `clinical_referral_operations`, separado do documento e com eventos append-only. Há uma única operação por referral interno; `schedule_clinical_referral_operation(...)` revalida tenant, destino, paciente, profissional ativo e boundaries antes de criar — ou retornar idempotentemente — o appointment canônico.

A Agenda continua sendo autoridade sobre data/hora, status, cancelamento, remarcação e atendimento. O referral snapshot não é reescrito quando o appointment muda.

O hardening final preserva uma exceção estreita ao self-assignment global de Appointment: um profissional emissor pode agendar outro profissional somente quando o destino é exatamente o `target_profile_id` imutável do referral interno, no mesmo tenant/paciente, por meio da prova transacional criada e consumida na mesma transação do RPC. Isso não autoriza agendamento arbitrário de colegas, não abre `internal_service` para cross-assignment e não concede acesso ao prontuário.

### Evidência de produção — D2-E4

A stack final #450–#453 foi aplicada e validada em produção:

- migration/verifier da continuidade operacional passaram;
- o handoff da UI foi corrigido para usar o `clinical_documents.id` real;
- paciente e profissional destinatário congelado aparecem corretamente no modal de Agenda;
- o guard global `guard_appointment_mutation_boundary()` foi reconciliado sem relaxar o bloqueio normal de cross-professional assignment;
- o smoke funcional criou um único appointment para o destinatário exato e vinculou `clinical_referral_operations.status='scheduled'` ao appointment canônico;
- evento `appointment_insert_authorized` registrou a prova same-transaction com ator, paciente e target exatos;
- o referral emitido permaneceu imutável;
- retry do mesmo encaminhamento retornou `Este encaminhamento já possui um agendamento vinculado.` e não criou segundo appointment.

D2-E4 não deve ser reaberto para resolver preferências institucionais. Políticas futuras da clínica — por exemplo permitir emissão de encaminhamentos por profissionais ou permitir agendamento direto pelo encaminhador — devem compor os boundaries atuais como **clinic configuration**, mantendo todas as invariantes acima.

## Fora de escopo do V1 validado

Inbox dedicada do destinatário, aceite/recusa com experiência própria, mensageria automática, billing específico, contrarreferência e políticas configuráveis da clínica não fizeram parte do D2-E3/D2-E4 validado. Esses itens devem nascer em slices separadas, sem alterar snapshots históricos nem criar scheduler paralelo.
