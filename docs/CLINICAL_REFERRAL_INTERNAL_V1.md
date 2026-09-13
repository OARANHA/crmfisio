# D2-E3 — Encaminhamento Interno V1

Estado desta revisão: **implementado no repositório; não aplicar em produção antes do merge**.

## Objetivo

Permitir que o mesmo documento canônico `referral` represente destino externo ou continuidade dentro da própria clínica sem criar outro engine documental e sem transformar roteamento em autorização clínica.

## Modos de destino

- **Profissional da clínica**: seleciona um profissional clínico ativo do mesmo tenant por identificador estável; o documento congela também os campos humanos do destino.
- **Especialidade / serviço da clínica**: roteia para uma área derivada da equipe clínica ativa, sem inventar um catálogo paralelo nesta slice.
- **Destino externo**: preserva integralmente o fluxo livre já existente.

Os metadados técnicos de roteamento são `destination_scope` e `target_profile_id`. Eles ficam no payload/snapshot canônico, mas nunca são exibidos no documento para o paciente.

## Boundary de segurança

`list_clinical_referral_internal_targets()` é um RPC estreito `SECURITY DEFINER`. Só responde a um autor elegível para `referral`, usa o tenant corrente, retorna apenas perfis ativos com identidade profissional mínima e exclui o próprio emissor. Não expõe e-mail, role, capabilities ou dados administrativos.

`trg_clinical_referral_internal_target` revalida destino interno no banco. Um `internal_professional` não pode apontar para outro tenant, perfil inativo, perfil sem `professional_type` ou para o próprio emissor. A transição para `issued` revalida novamente o alvo, evitando emitir para um profissional desativado depois do salvamento do draft.

A seleção de destino **não concede** leitura de prontuário, care relationship, autoria, capability, acesso ao Encounter nem qualquer bypass owner/admin/platform. Esses temas continuam nas autoridades canônicas existentes.

## Compatibilidade

Documentos anteriores sem `destination_scope` normalizam como `external`. O objeto `recipient` mantém o contrato fechado anterior; os metadados de roteamento são top-level para preservar o validator D2-E0 e os snapshots históricos. O renderer A4 continua usando somente campos humanos.

## Fora de escopo

Fila de recebidos, aceite, recusa, agendamento, atendimento, conclusão, contrarreferência e concessão operacional de continuidade pertencem ao D2-E4.
