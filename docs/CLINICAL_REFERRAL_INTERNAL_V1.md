# D2-E3 — Encaminhamento Interno V1

**Base canônica validada:** `main@2ecc17a7efc6d02a94e738bf5b17d748402d8c99`  
**Estado:** **VALIDADO EM PRODUÇÃO** em 2026-09-12/13.

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

## Evidência de produção

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

## Fora de escopo

Fila de recebidos, aceite/recusa, agendamento, atendimento, conclusão e contrarreferência não pertencem ao lifecycle do documento. Esses estados são workflow operacional separado e formam a próxima etapa D2-E4.

## Continuidade operacional D2-E4

**D2-E4 — Continuidade Operacional do Encaminhamento Interno**:

```text
encaminhamento interno emitido
→ recebido
→ aceito / recusado
→ agendamento vinculado
→ atendimento
→ conclusão
```

O documento clínico permanece imutável durante todo esse fluxo. D2-E4 usa
`clinical_referral_operations`, separado do documento e com eventos append-only.
Há uma única operação por referral interno; `schedule_clinical_referral_operation`
revalida tenant, destino, paciente, profissional ativo e permissão antes de
criar (ou retornar idempotentemente) o appointment canônico. A remarcação normal
move apenas o vínculo operacional para o appointment substituto.

Inbox do destinatário, aceite/recusa explícitos, mensageria, billing e
contrarreferência continuam fora deste V1.
