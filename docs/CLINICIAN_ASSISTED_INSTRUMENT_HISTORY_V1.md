# Neutral Clinician-Assisted Instrument History V1

**Status desta revisão:** implementação de repositório validada; rollout de produção ainda não executado.

## Objetivo

Expor no prontuário longitudinal um histórico clínico neutro das aplicações `clinician_assisted` sem abrir leitura direta do ledger imutável e sem transformar autorização de aplicação ou autorização Nexus em requisito de leitura.

Regra canônica:

```text
ENGINE != AUTHORIZATION != RELEVANCE
APPLY AUTHORITY != CHART READ AUTHORITY
```

A engine Nexus continua dona de definição/versionamento/scoring. O histórico longitudinal é uma projeção clínica estreita sobre o resultado já persistido.

## Boundary de leitura

A RPC `public.list_patient_clinician_assisted_instrument_history(uuid)` reutiliza `public.can_access_patient_clinical_record(uuid)`.

Isso preserva tenant, `clinical.timeline.read`, identidade clínica e care relationship do boundary canônico para profissionais, além do comportamento de leitura de owner/admin já existente.
A leitura **não** exige:

- `clinical.instrument.apply`;
- `nexus.access`;
- `nexus.scales`;
- acesso direto a `clinical_instrument_administrations`.

O browser continua sem SELECT direto no ledger. A única superfície autenticada é a RPC SECURITY DEFINER estreita.

## Projeção

A V1 retorna somente:

- instrumento;
- versão exata da regra;
- appointment de origem;
- profissional autor;
- score total/máximo;
- classificação e severidade;
- interpretação;
- data/hora;
- indicadores booleanos de safety signal.

Não retorna respostas brutas, `output_snapshot`, `evidence_snapshot`, SOAP, recomendações internas ou payloads Nexus.
## UX

A mesma projeção aparece em duas superfícies:

1. `Consultório → Instrumentos`, abaixo de `Aplicar agora`;
2. prontuário longitudinal/histórico fora do Encounter ativo.

Uma aplicação concluída pelo servidor incrementa apenas a revisão local do histórico e força nova leitura da projeção. Falha do histórico não bloqueia o restante do prontuário nem a aplicação corrente.

Safety signals aparecem apenas como contexto neutro de segurança. A UI não infere diagnóstico, risco ou conduta a partir das respostas.

## Verificação

O gate PostgreSQL 16 reutiliza a stack efetiva de Clinician-Assisted Administration V1, aplica a reconciliação canônica de leitura clínica e executa a migration de histórico duas vezes.

Os cenários provam:

- browser sem SELECT direto no ledger;
- profissional com chart-read vê o histórico neutro;
- leitura independente de `clinical.instrument.apply`;
- owner/admin preservam o read contract atual;
- recepção, financeiro e cross-tenant são negados;
- patient id nulo falha explicitamente;
- safety signal é reduzido a flags booleanas;
- nenhuma autoridade Nexus/apply/raw-ledger entra na projeção.
