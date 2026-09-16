# Clinical Instrument Patient Delivery V1

**Status:** implementação concluída e validada no MedicsPro Lab; ainda sem PR/merge/rollout de produção.
**Base:** `main@8b1bdbb3856f9d2c320e9dc737f4ec1263090095`.
**Branch:** `feat/clinical-instrument-patient-delivery-v1`.

## Objetivo

Adicionar `Enviar ao paciente` à fachada clínica multiprofissional sem criar uma segunda engine, um segundo sistema de tokens ou uma autorização Nexus indireta.

```text
ENGINE != AUTHORIZATION != RELEVANCE
APPLY NOW != PATIENT DELIVERY != CHART READ
```

O transporte remoto existente (`nexus_self_assessment_invites`, token individual, WhatsApp, página pública e processor) será reutilizado. Convites Nexus históricos permanecem válidos e separados.

## Não hardcodar PHQ-9/GAD-7

A V1 deve nascer preparada para novos instrumentos canônicos absorvidos do Nexus. Presença no Nexus ou no `clinical_instrument_catalog` não basta para expor entrega remota.

A elegibilidade `patient_self` será registry-driven e versionada. Um instrumento somente poderá ser enviado quando simultaneamente:

- existir no catálogo clínico neutro e estiver ativo;
- estiver habilitado explicitamente para a clínica;
- possuir contrato explícito de entrega `patient_self` para a versão canônica;
- possuir definição pública versionada compatível com a engine;
- o ator satisfizer o boundary clínico de envio;
- o Encounter/paciente/contexto congelado da V1 coincidirem no servidor.

Adicionar um novo instrumento remoto no futuro deve significar adicionar contrato/definição validados, não alterar branches de autorização.

## Compatibilidade com o transporte Nexus existente

A tabela histórica de convites será evoluída de forma aditiva com um discriminador de autoridade/origem. Linhas existentes permanecem `nexus`.

Novos convites multiprofissionais usam `clinical_instrument` e nunca exigem nem concedem `nexus.scales`.

O mesmo token, expiração, página pública, submissão e fila WhatsApp podem ser reutilizados. O processor escolhe o writer pela autoridade congelada no convite:

```text
nexus              -> resultado Nexus existente
clinical_instrument -> clinical_instrument_administrations
```

## Persistência neutra

`clinical_instrument_administrations` passa a aceitar dois modos de provenance:

```text
clinician_assisted
patient_self
```

O resultado remoto usa a mesma identidade/versionamento/scoring da engine compartilhada. O convite é a prova congelada do ato autorizado; processamento tardio não exige que o appointment ainda esteja `em_atendimento`.

O writer remoto é service-only, deriva tenant/paciente/profissional/appointment/instrumento do convite e é idempotente. Browser não escolhe versão de engine nem grava resultado clínico.

## Boundary V1

Na primeira versão, criar o convite ocorre dentro do próprio Encounter ativo. Isso é uma decisão conservadora da V1, não uma regra universal para toda futura entrega remota.

O boundary de envio é próprio e reutiliza a fundação clínica neutra sem chamar `nexus.*`. Owner/admin não recebem bypass de autoria/Encounter.

## UX

```text
Instrumentos
├─ Aplicar agora
├─ Enviar ao paciente
└─ Histórico
```

O histórico neutro deve evoluir para exibir `clinician_assisted` e `patient_self`, sem respostas brutas, snapshots Nexus, SOAP ou evidence.

A página pública não concede acesso ao prontuário e não mostra diagnóstico/conduta automática. Safety signals permanecem explícitos para revisão clínica.

## Instrumentos futuros

O inventário Nexus atual possui múltiplas ondas de candidatos. Nem todo instrumento é adequado a `patient_self`.

- instrumentos de autoaplicação podem receber contrato remoto após revisão de direitos, versão, população e segurança;
- instrumentos clinician-rated/especialistas podem permanecer apenas assistidos;
- C-SSRS exige safety slice própria;
- mera existência no Nexus nunca habilita exposição multiprofissional ou envio remoto.

## Validação de implementação

No estado atual da branch:

- PostgreSQL 16 dedicado: behavior matrix + replay da migration + verifier formal aprovados;
- workers separados por `authority_source`, inclusive negative controls nos dois sentidos;
- `clinical_instrument` não cria `nexus_clinical_results`; Nexus histórico não escreve administração neutra;
- UI `Enviar ao paciente` é registry-driven e não contém branches de autorização PHQ-9/GAD-7;
- histórico longitudinal neutro projeta `clinician_assisted` + `patient_self` sem respostas brutas;
- full suite final: 116 arquivos / 628 testes; typecheck, lint, build, dependency audit e `git diff --check` passaram no mesmo estado candidato a commit;
- produção permanece intocada.

O gate canônico da slice é `.github/workflows/clinical-instrument-patient-delivery-v1.yml`.

## Fora de escopo V1

- criar novo canal além do transporte atual;
- habilitar automaticamente PHQ-15 ou qualquer novo instrumento;
- importar em massa as escalas Nexus;
- criar entitlement comercial novo;
- enviar fora de Encounter sem boundary dedicado;
- migrar/reclassificar convites Nexus históricos;
- diagnóstico, prescrição ou encaminhamento automáticos.
