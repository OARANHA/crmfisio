# D2-E3 — Encaminhamento Interno V1

Estado desta revisão: **D2-E3 base aplicado e verificado em produção; D2-E3.1 hardening implementado no repositório e pendente de rollout após merge**.

## Objetivo

Permitir que o mesmo documento canônico `referral` represente destino externo ou continuidade dentro da própria clínica sem criar outro engine documental e sem transformar roteamento em autorização clínica.

## Modos de destino

- **Profissional da clínica**: seleciona um profissional clínico ativo do mesmo tenant por identificador estável; o documento congela também os campos humanos do destino.
- **Especialidade / serviço da clínica**: roteia para uma área derivada da equipe clínica ativa, sem inventar um catálogo paralelo nesta slice.
- **Destino externo**: preserva integralmente o fluxo livre já existente.

Os metadados técnicos de roteamento são `destination_scope` e `target_profile_id`. Eles ficam no payload/snapshot canônico, mas nunca são exibidos no documento para o paciente.

## Boundary de segurança

`list_clinical_referral_internal_targets()` é um RPC estreito `SECURITY DEFINER`. Só responde a um autor elegível para `referral`, usa o tenant corrente, retorna apenas perfis ativos com profissão clínica canônica e exclui o próprio emissor. Não expõe e-mail, role, capabilities ou dados administrativos.

D2-E3.1 alinha explicitamente o diretório ao catálogo clínico canônico já usado pela aplicação: `medico`, `fisioterapeuta`, `psicologo` e `quiropraxista`. Um `professional_type` arbitrário ou administrativo não transforma um perfil em destino clínico. A regra continua deliberadamente independente de `role`; `role != profession` permanece preservado.

`trg_clinical_referral_internal_target` revalida destino interno no banco. Um `internal_professional` não pode apontar para outro tenant, perfil inativo, perfil fora do catálogo clínico canônico ou para o próprio emissor. A transição para `issued` revalida novamente o alvo, evitando emitir para um profissional desativado, movido ou cuja identidade profissional deixe de ser clínica depois do salvamento do draft.

Para `internal_service`, a área só é aceita quando resolve para pelo menos um outro profissional ativo da mesma clínica cuja profissão esteja no catálogo clínico canônico. Especialidade continua sendo roteamento/relevância, nunca autorização.

A seleção de destino **não concede** leitura de prontuário, care relationship, autoria, capability, acesso ao Encounter nem qualquer bypass owner/admin/platform. Esses temas continuam nas autoridades canônicas existentes.

## UX do rascunho

Ao apenas escolher o modo **Profissional da clínica** ou **Especialidade / serviço**, o rascunho permanece sem destino humano até que uma pessoa/área real seja selecionada. O nome da clínica só entra no recipient depois dessa seleção, evitando que a pré-visualização A4 pareça ter um destino válido antes da escolha.

## Compatibilidade

Documentos anteriores sem `destination_scope` normalizam como `external`. O objeto `recipient` mantém o contrato fechado anterior; os metadados de roteamento são top-level para preservar o validator D2-E0 e os snapshots históricos. O renderer A4 continua usando somente campos humanos.

D2-E3.1 é aditivo: substitui apenas as duas funções do boundary de roteamento e preserva grants, trigger existente, RLS, capabilities, lifecycle, snapshots e documentos emitidos.

## Evidência de produção da base D2-E3

A migration base D2-E3 foi aplicada e o verifier production-safe concluiu com `CLINICAL REFERRAL INTERNAL V1 VERIFY PASSED`. A Foundation adjacente também foi revalidada com `CLINICAL REFERRAL FOUNDATION VERIFY PASSED`. O smoke real confirmou isolamento multi-tenant: profissionais existentes em outro tenant não apareceram na Clínica Piloto VidaNova.

O diagnóstico de produção que motivou D2-E3.1 encontrou um perfil administrativo legado com `professional_type` não clínico em outro tenant. Esse perfil não deve ser elegível para roteamento clínico mesmo com o campo preenchido.

## Fora de escopo

Fila de recebidos, aceite, recusa, agendamento, atendimento, conclusão, contrarreferência e concessão operacional de continuidade pertencem ao D2-E4.
