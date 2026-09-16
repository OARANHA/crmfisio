# PC-PTSD-5 Clinician-Assisted V1

**Status:** #495 MERGED / MAIN VALIDATED / NÃO PROD.
**Base de desenvolvimento:** resolver sempre a `origin/main` atual; a slice foi reconciliada contra `main@97184b14dffecc46b5c67a00d21946fd21b0cdfd` em 2026-09-16.
**Branch:** `feat/pcptsd5-clinician-assisted-v1`.
**Head final revisado da PR:** `82505f60b3bc47e29df21b0f4fd479e4965fa000`.
**Merge/main:** `f62b221d05a568f363595e93ad945f4e1df84c5c`.
**PR:** `#495` MERGED, CI 24/24 PASS; pós-merge 7/7 workflows de push PASS.

## Decisão

PC-PTSD-5 entra somente como `Aplicar agora`, fail-closed e sem auto-enable. O instrumento original do U.S. VA National Center for PTSD é domínio público/não copyrighted. A V1 preserva o gate de exposição traumática seguido de cinco itens binários sobre o último mês.

A interface usa **tradução operacional PT-BR preparada para o MedicsPro**. Nesta revisão não foi identificada validação publicada de uma versão brasileira do PC-PTSD-5 nem tradução oficial PT-BR do VA. O VA informa tradução oficial/confirmada apenas em espanhol entre as traduções publicadas por seu National Center. Existe validação publicada em língua portuguesa em Moçambique, mas isso não valida automaticamente esta redação PT-BR nem a população brasileira.

Consequência: a UI, engine e documentação **não podem chamar esta versão de “PC-PTSD-5 brasileiro validado”**. Habilitação por clínica permanece explícita e deve considerar essa limitação.

## Identidade canônica

```text
instrument_key:       pcptsd5
engine_source:        nexus
engine_module_key:    scales
engine_tool_key:      pcptsd5
engine_rule_key:      nexus.pcptsd5
engine_rule_version:  nexus-pcptsd5-ptbr-ops-2026-09-16
engine capability:    nexus.scales  # proveniência somente
```

Autorização neutra: `clinical.instrument.apply` + habilitação explícita da clínica + Encounter próprio ativo. Nenhum `nexus.*` é concedido para executar o ato clínico neutro.

## Contrato clínico

- gate `q0` de exposição a evento potencialmente traumático;
- se `q0 = Não`, o instrumento encerra e o escore é `0/5`; somente `q0` é persistido;
- se `q0 = Sim`, os cinco itens `q1..q5` são obrigatórios e binários `0|1`;
- total `0..5`, soma das cinco respostas afirmativas;
- cutoff operacional versionado `>=4`, baseado em evidência externa de atenção primária dos EUA; não é cutoff validado no Brasil;
- resultado é rastreio de provável TEPT/sofrimento relacionado a trauma e não estabelece diagnóstico;
- resultado abaixo do cutoff não exclui TEPT;
- o próprio VA ressalta que limiares menores podem ser apropriados em alguns contextos/populações conforme trade-off de sensibilidade/especificidade;
- não há prescrição, encaminhamento, diagnóstico ou conduta automática.

## Proveniência e direitos

- U.S. VA National Center for PTSD — PC-PTSD-5: instrumento em domínio público e não copyrighted; gate + cinco itens; orientação de scoring e necessidade de avaliação adicional para rastreios positivos.
- Prins A et al. J Gen Intern Med. 2016;31:1206-1211 — desenvolvimento/avaliação; cutoff 3 prioriza sensibilidade, cutoff 4 maximiza eficiência na amostra estudada.
- Bovin MJ et al. JAMA Netw Open. 2021;4:e2036733 — acurácia em Veterans e discussão de cutoff.
- validação adicional em atenção primária civil dos EUA publicada em 2022 encontrou bom desempenho para cutoff 4.
- Massinga J et al. — validação de versão em português em Moçambique; é evidência de língua/população distinta e **não** prova validação brasileira desta tradução.

## Exposição de produto

- `Aplicar agora`: somente após owner/admin habilitar explicitamente `pcptsd5` para a clínica.
- `Enviar ao paciente`: **não existe nesta slice**.
- catálogo público/patient-self: inalterado.
- histórico longitudinal neutro: reutiliza `clinical_instrument_administrations`.
- migration não concede capability e não insere setting de clínica.

## Gate e snapshot canônico

O browser mostra primeiro somente o gate. Se negativo, os cinco sintomas não são exibidos e o payload persistido contém apenas `q0`. Se positivo, os cinco sintomas tornam-se obrigatórios e o snapshot contém `q0 + q1..q5`.

O Edge scorer é autoridade sobre score/classificação/interpretação. Chaves extras do browser são descartadas do snapshot canônico.

## Validação local concluída

- PostgreSQL 16 behavior/replay/idempotency/verifier: PASS (`PCPTSD5_CLINICIAN_ASSISTED_V1_POSTGRES16_OK`);
- PostgreSQL 17.6 behavior + replay + authorization + writer + forged-version + verifier: PASS;
- negative gate persiste somente `q0`: PASS;
- positive gate persiste exatamente `q0..q5`: PASS;
- trocar o gate para a resposta de parada limpa sintomas previamente preenchidos: PASS;
- forged engine version bloqueada: PASS;
- migration replay idempotente: PASS;
- nenhuma capability ou clinic setting existente alterada: PASS;
- `patient_self` permanece ausente para `pcptsd5`: PASS;
- full suite final: 116 arquivos / 638 testes PASS;
- typecheck, lint, build e `git diff --check`: PASS;
- dependency audit: 2 advisories moderados preexistentes em Vitest/@vitest-mocker, sem mudança de dependências nesta slice; correção automática exigiria major/breaking upgrade e não foi misturada aqui.

PR CI concluiu 24/24 verde antes do merge e os 7 workflows disparados pelo push da `main` também concluíram com sucesso. O próximo gate é rollout produtivo separado; merge não equivale a produção.

## Produção

Nenhuma alteração de produção é autorizada por este documento. Rollout, se aprovado após merge/CI, deve ser separado: migration + verifier read-only + Edge shared engine/frontend + smoke transacional com rollback e zero resíduos. Nenhuma clínica deve ser auto-habilitada.
