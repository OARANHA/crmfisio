# Clinician-Assisted Clinical Instruments V1

## Status

**IMPLEMENTADO NA BRANCH / NÃO VALIDADO EM PRODUÇÃO.**

Base de implementação: `main@0fff35a597d9c5174f485c5fe3eb71d0f6473539`.

Esta slice fecha somente a operação server-side de **administração assistida pelo profissional** para os instrumentos neutros já expostos pela #399: PHQ-9 e GAD-7. A UI `Aplicar agora` fica para a próxima slice.

## Princípio canônico

```text
ENGINE != AUTHORIZATION != RELEVANCE
Nexus engine registry membership != multiprofessional clinical exposure
```

PHQ-9/GAD-7 continuam usando a definição, versão e scoring canônicos do Nexus, mas a autoridade para um profissional aplicá-los presencialmente vem do domínio clínico neutro da #399:

```text
clinical.instrument.apply
+ identidade clínica válida
+ instrumento ativo no clinical_instrument_catalog
+ instrumento habilitado pela clínica
+ próprio Encounter em_atendimento
= pode aplicar agora
```

`nexus.scales` não é exigido nem concedido por esta operação.

## Fluxo V1

```text
browser autenticado
→ Edge clinical-instrument-clinician-assisted
→ valida JWT real do profissional
→ shared clinical-instrument-engine
→ calcula PHQ-9/GAD-7 no servidor
→ service-only RPC record_clinician_assisted_clinical_instrument(...)
→ reinstala o ator autenticado como contexto transacional
→ revalida can_apply_clinical_instrument_in_encounter(...)
→ deriva clinic/patient do Encounter
→ confere mapping/versionamento no clinical_instrument_catalog
→ grava snapshot imutável em clinical_instrument_administrations
```

Nenhum `clinic_id`, `patient_id`, autoria ou versão da engine é aceito do browser como fonte de verdade.

## Engine compartilhada

A regra PHQ-9/GAD-7 antes estava embutida no processor de self-assessment. Esta slice a extrai para:

`supabase/functions/_shared/clinical-instrument-engine.ts`

O mesmo módulo passa a ser consumido por:

- `nexus-self-assessment-processor` (`patient_self` já existente);
- `clinical-instrument-clinician-assisted` (`clinician_assisted`).

Assim, modo de administração não cria uma segunda definição, corte, versão ou regra de item 9.

PHQ-9 preserva `nexus.phq9 / nexus-2026-09-03` e o safety signal canônico `phq9.item9.positive` quando `q9 > 0`. Esse sinal exige avaliação clínica de segurança/risco; não equivale isoladamente a diagnóstico e não dispara prescrição, encaminhamento ou conduta automática.

GAD-7 preserva `nexus.gad7 / nexus-2026-09-03`.

## Persistência neutra

Nova tabela:

`clinical_instrument_administrations`

Ela não substitui nem enfraquece `nexus_clinical_results`. O resultado multiprofissional assistido não entra na tabela Nexus porque C-02/C-06 corretamente mantêm essa superfície presa às capabilities e identidade do domínio Nexus especializado.

Snapshot mínimo persistido:

- tenant/paciente/Encounter/profissional derivados server-side;
- `instrument_key` neutro;
- identidade/versionamento da engine;
- provenance `clinician_assisted`;
- answers snapshot;
- output snapshot;
- score/max score;
- classificação/severidade/interpretação;
- texto SOAP produzido pela engine como conteúdo auxiliar;
- evidence snapshot;
- safety signals;
- timestamp de conclusão.

A administração é terminal/imutável nesta V1. Não existe UPDATE/DELETE clínico. Correção futura exige um contrato explícito de correção/addendum; não deve sobrescrever o ato original.

## Idempotência

O cliente gera um `request_id` UUID por submissão.

Chave:

```text
(professional_id, appointment_id, request_id)
```

Replay com o mesmo request e mesmas respostas devolve a administração original. Reutilizar a mesma chave com respostas diferentes falha fechado.

## Segurança

O browser:

- não possui INSERT/UPDATE/DELETE/SELECT direto na nova tabela;
- não executa a RPC de persistência;
- não calcula score;
- não escolhe capability Nexus;
- não fornece tenant/paciente/autor/versionamento como autoridade.

A Edge autentica o Bearer token via `auth.getUser()` antes de chamar a RPC service-only. A RPC reexecuta o boundary #399 sob o ator autenticado e valida novamente Encounter ativo próprio + catálogo/versionamento.

Owner/admin não recebem bypass clínico. Profissão/especialidade continuam sem auto-grant.

## Provas automatizadas

O gate PostgreSQL 16 deve provar:

- replay da migration;
- browser sem acesso direto;
- profissional autorizado + próprio Encounter ativo;
- profissional multiprofissional autorizado sem `nexus.scales`;
- ator sem `clinical.instrument.apply` negado;
- cross-professional negado;
- cross-tenant negado;
- appointment não ativo negado;
- mapping/versionamento de engine não forjável pela chamada;
- replay idempotente;
- conflito de idempotência detectado;
- snapshot imutável;
- verifier histórico #399 continua verde;
- verifier V1 read-only verde.

A suíte TypeScript/JS também trava a paridade do scorer compartilhado e a separação entre autenticação Edge, engine e persistência.

## Fora de escopo

- UI `Aplicar agora` no Encounter;
- `Enviar ao paciente` novo — o self-assessment remoto existente continua um boundary distinto;
- expansão além de PHQ-9/GAD-7;
- novo grant `nexus.*`;
- Enfermagem como nova identidade suportada;
- diagnóstico automático;
- prescrição/encaminhamento automático;
- incorporação automática em Evolution/Encounter Record;
- correção/addendum de administração já concluída;
- rollout de produção nesta implementação.

## Rollout após merge

A ordem segura é:

```text
1. aplicar 20260913_clinician_assisted_clinical_instruments_v1.sql
2. rodar VERIFY_20260913_CLINICIAN_ASSISTED_CLINICAL_INSTRUMENTS_V1.sql em read-only
3. redeploy nexus-self-assessment-processor
4. deploy clinical-instrument-clinician-assisted
5. smoke autenticado PHQ-9 e GAD-7
6. confirmar item 9 positivo, idempotência e negativa de ator/Encounter indevidos
```

O redeploy do processor Nexus é necessário porque ele agora importa a engine compartilhada, embora o comportamento clínico do self-assessment permaneça o mesmo.

Somente após migration + verifier + Edge Functions + smoke real esta slice pode ser marcada como `VALIDADO EM PRODUÇÃO`.

## Próxima slice

**Encounter Instrument UX — Aplicar agora**:

- resolver disponibilidade/autorização do instrumento no Encounter;
- renderer click-first para perguntas 0–3;
- submissão única com `request_id`;
- mostrar score/classificação/safety signal retornados pelo servidor;
- manter `Enviar ao paciente` como ação/contexto separado;
- nunca recalcular score no browser.
