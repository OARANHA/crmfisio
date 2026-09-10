# MedicsPro — Assessment Engine

**Status em 2026-09-10:** foundation estruturada já entregue e integrada ao fluxo clínico. Este documento orienta evolução da engine; não é backlog para recriar uma segunda plataforma de avaliações.

## Objective

Manter uma plataforma reutilizável de avaliações clínicas que suporte modelos fornecidos pelo MedicsPro e modelos de clínica/profissional sem fragmentar o prontuário em telas independentes por especialidade.

A engine deve melhorar velocidade, comparação longitudinal e rastreabilidade, preservando tenant isolation, autoria, versionamento e histórico.

## Product model

Conceitos canônicos:

1. **Avaliações padrão** — templates curados/providos pelo MedicsPro.
2. **Minhas avaliações** — templates criados/duplicados pela clínica ou, quando autorizado, profissional.
3. **Avaliação preenchida** — registro clínico ligado a uma versão específica de template.
4. **Componentes clínicos** — controles reutilizáveis como texto, escala, escolha, medida, attachment reference e body map.
5. **Histórico longitudinal** — leitura histórica de avaliações/evoluções/eventos clínicos autorizados.

Uma clínica pode duplicar um modelo padrão e personalizar a cópia. Não mutar silenciosamente o template canônico da plataforma.

## Current canonical state

A foundation atual já possui:

- templates de assessment;
- versões imutáveis/publicadas;
- assessments com lifecycle draft/finalized;
- autoria/contexto de clínica, paciente, profissional e appointment quando aplicável;
- Assessment Runner contextual ao Encounter;
- histórico de avaliações;
- componentes estruturados, incluindo body map;
- boundaries server-side e testes de autorização/lifecycle.

Portanto:

- não criar outra “anamnese engine” paralela;
- não voltar a `ClinicalWorkspace` como única arquitetura atual;
- não tratar a existência de campos físicos `physiotherapy_*` como restrição a fisioterapia;
- não migrar/destruir históricos apenas por nomenclatura legada.

## Relationship with Encounter Record

Assessment e Encounter Record são artefatos complementares.

O Encounter Record é a unidade editável da consulta atual e registra, uma única vez, motivo/demandas, HDA, achados/exame, avaliação/problemas, plano/conduta e observações.

Assessment é **opcional e estruturado**, usado quando um instrumento/modelo agrega valor clínico.

Não copiar automaticamente todas as respostas de Assessment para o Encounter Record. Se houver futura ação de incorporar achado, ela deve ser explícita, auditável e sem duplicação.

## Template/version invariants

- template publicado usado historicamente não muda o significado do registro antigo;
- final assessment preserva a versão aplicada;
- edição gera versão nova quando necessário;
- tenant não modifica template platform-owned diretamente;
- histórico não depende do template atual continuar igual.

## Componentes clínicos

A engine deve continuar favorecendo poucos componentes estáveis que cobrem a maior parte dos formulários:

- heading/section;
- texto curto/longo;
- número/medida;
- escala;
- escolha simples/múltipla;
- sim/não/checkbox;
- data;
- body map;
- attachment reference;
- texto informativo.

Evitar transformar a engine em low-code genérico sem necessidade clínica.

## Body map

Body map é dado clínico estruturado, não uma imagem decorativa.

Quando aplicável, preservar:

- view/lado corporal;
- coordenadas normalizadas/região;
- lateralidade;
- intensidade;
- tipo de sintoma;
- nota;
- autor;
- timestamp;
- assessment/contexto associado.

A evolução futura de maior valor é comparação longitudinal, mantendo ausência como ausência e não inventando valores intermediários.

## Authorization and ownership

Assessment segue as mesmas disciplinas gerais do runtime:

- tenant isolation;
- identidade profissional válida quando o ato exigir;
- capability/autorização server-side;
- autoria preservada;
- browser visibility não é security boundary;
- entitlement comercial não concede autoridade clínica.

`professional_id` é a referência clínica canônica. `fisio_id` não deve ganhar novos consumidores de autorização.

## Draft / finalized

- draft pode ser editável conforme autorização e contexto;
- finalized é histórico e não deve ser sobrescrito silenciosamente;
- correção posterior exige amendment/version semantics quando implementada;
- estados de UI devem refletir persistência real, nunca apenas idle local.

## Instrument Delivery — próxima evolução específica

Para instrumentos como PHQ-9/GAD-7, a próxima slice recomendada não é outra engine. É um **Instrument Delivery** unificado sobre contratos existentes, com dois caminhos claros:

- **Aplicar agora**;
- **Enviar ao paciente**.

O resultado precisa retornar ao contexto clínico com autoria, versão, provenance e lifecycle apropriados.

No caso Nexus, preservar também o boundary médico-only/fail-closed. Instrument Delivery não pode virar atalho de autorização.

## Historical data

Não fazer backfill fictício ou reinterpretação silenciosa de registros clínicos antigos.

Tabelas/formatos históricos continuam legíveis conforme os contracts existentes até haver uma migration explícita, segura e verificada. Renomear fisicamente tabelas não é requisito para evoluir a UX.

## Product principles

- um único prontuário longitudinal multiprofissional;
- especialidade compõe conteúdo/ferramentas, não cria outro sistema;
- modelos padrão + modelos próprios usam a mesma engine;
- histórico e autoria valem mais que flexibilidade de formulário sem governança;
- UI profissional usa linguagem clínica, não nomes internos de capability/entitlement;
- não criar botão/fluxo de assessment sem backend/lifecycle real.

## Deliberately deferred

A foundation atual não significa que todo conteúdo clínico esteja pronto. Continuam evoluções separadas:

- curadoria adicional de templates por especialidade;
- Instrument Delivery unificado;
- melhoria longitudinal/comparações;
- novos componentes somente quando necessários;
- correction/amendment quando o domínio exigir;
- integração explícita de achados no Encounter, se justificada.

Esses itens evoluem a engine existente; não reabrem sua fundação.