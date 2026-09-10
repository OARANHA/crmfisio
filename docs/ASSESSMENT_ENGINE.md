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

## Canonical separation for clinical instruments

Para instrumentos clínicos, preservar explicitamente:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

Essas três responsabilidades não devem ser fundidas:

- **engine** — definição do instrumento, versão, validação das respostas, scoring e semântica do resultado;
- **authorization** — decisão efetiva de quem pode executar o ato, protegida por capability e boundaries server-side;
- **relevance** — disponibilidade contextual, ordenação e sugestão conforme profissão, especialidade, protocolo/configuração da clínica e contexto do Encounter.

Profissão ou especialidade não fazem auto-grant. Protocolo não faz auto-grant. Uma ferramenta aparecer ou ser recomendada na UI não autoriza sua execução.

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

A existência atual de `clinical.assessment.apply` demonstra a direção multiprofissional do Assessment Engine, mas **não autoriza reutilizar automaticamente essa capability para qualquer instrumento clínico futuro**. A futura Clinical Instrument Authorization Foundation deve definir seu boundary próprio sem conceder `nexus.*` e sem alterar a capability matrix nesta sincronização documental.

## Draft / finalized

- draft pode ser editável conforme autorização e contexto;
- finalized é histórico e não deve ser sobrescrito silenciosamente;
- correção posterior exige amendment/version semantics quando implementada;
- estados de UI devem refletir persistência real, nunca apenas idle local.

## PHQ-9/GAD-7 and canonical implementation

PHQ-9/GAD-7 não devem ser cadastrados no Assessment Engine como uma **segunda implementação** apenas para torná-los multiprofissionais.

Enquanto a futura arquitetura de fachada/persistência for decidida:

- preservar a definição/versionamento já validados dos instrumentos existentes;
- preservar o scoring server-side validado existente;
- não criar duas fontes de verdade para o mesmo instrumento;
- não permitir que duas versões semanticamente diferentes sejam apresentadas como o mesmo PHQ-9/GAD-7;
- usar o Assessment Engine como referência multiprofissional de arquitetura para avaliações estruturadas, não como justificativa para duplicação de catálogo/scoring.

O fato de uma implementação atual viver no subsistema Nexus não transforma o instrumento, por si só, em ato universalmente médico-only. Da mesma forma, isso não autoriza flexibilizar `nexus.*`: o produto Nexus médico avançado continua com seus boundaries fail-closed.

## Instrument Delivery — evolução futura

Para instrumentos como PHQ-9/GAD-7, a sequência recomendada não é outra engine. É uma fachada clínica multiprofissional sobre contratos canônicos, em slices futuras e ainda não implementadas:

1. **Clinical Instrument Authorization Foundation**;
2. **Clinician-Assisted Administration**;
3. **Encounter Instrument UX**;
4. **Consultório V5 integration/polish**.

A UX futura deve oferecer dois caminhos explícitos para a mesma versão do mesmo instrumento:

```text
PHQ-9
[Aplicar agora] [Enviar ao paciente]

GAD-7
[Aplicar agora] [Enviar ao paciente]
```

### Aplicar agora

Administração presencial/assistida durante a consulta:

- não depende de celular;
- não depende de WhatsApp;
- as respostas pertencem ao paciente;
- o profissional registra as respostas durante o ato clínico;
- `appointment_id` deve ser associado quando houver Encounter;
- instrumento e versão permanecem explícitos;
- usa o mesmo scoring validado do self-assessment;
- provenance deve registrar o modo de administração e autoria do ato profissional;
- resultado não equivale a diagnóstico automático.

### Enviar ao paciente

Administração remota/self-assessment do mesmo instrumento, preservando versão, validação, scoring, provenance e lifecycle canônicos.

O modo de administração não altera a identidade/versionamento do instrumento. Conceitualmente, a provenance futura deve ser capaz de distinguir pelo menos:

```text
administration_mode:
  patient_self
  clinician_assisted
```

No modo assistido, não registrar falsamente que o profissional “respondeu” ao instrumento quando ele apenas o administrou e documentou respostas do paciente.

## Nexus boundary

Instrument Delivery não pode virar atalho de autorização Nexus.

Distinguir:

- **Nexus médico avançado** — mantém C-01…C-06, `nexus.*` fail-closed e identidade médica Nexus onde exigida atualmente;
- **instrumentos clínicos** — podem ser multiprofissionais conforme finalidade, protocolo, contexto e autorização clínica própria.

Não alterar o significado de `nexus.eem` nem relaxar C-06 para permitir PHQ-9/GAD-7 a profissionais não médicos. O caminho futuro é desacoplar a autorização de aplicação do namespace `nexus.*`, preservando a engine/scoring canônicos sempre que apropriado.

## PHQ-9 safety requirement

Resposta positiva ao item 9 do PHQ-9 deve permanecer visível como informação clínica relevante e gerar destaque para necessidade de avaliação clínica.

Requisitos futuros:

- preservar a resposta original;
- não esconder o sinal somente dentro do score total;
- não inferir diagnóstico automaticamente;
- não tratar a resposta isolada como diagnóstico;
- não gerar conduta ou prescrição automática.

A apresentação deve comunicar necessidade de avaliação clínica, não uma conclusão diagnóstica automática. Este documento define o contrato futuro; nada disso é implementado por esta sincronização.

## Consultório V5 — direção de UX

A evolução do Instrument Delivery deve integrar-se ao futuro Clinical Cockpit sem criar páginas clínicas paralelas:

```text
um Encounter
├─ Registro
├─ Avaliações
├─ Instrumentos
├─ Prescrição
├─ Exames
├─ Documentos
└─ Nexus
```

A ergonomia do MedicsPro histórico pode orientar composição, contexto e fluidez. Não portar Vue/Pinia/Mongo, autorização antiga, autosave antigo, checkout ou outros contratos históricos.

## Historical data

Não fazer backfill fictício ou reinterpretação silenciosa de registros clínicos antigos.

Tabelas/formatos históricos continuam legíveis conforme os contracts existentes até haver uma migration explícita, segura e verificada. Renomear fisicamente tabelas não é requisito para evoluir a UX.

## Product principles

- um único prontuário longitudinal multiprofissional;
- especialidade compõe conteúdo/ferramentas, não cria outro sistema nem concede autorização;
- modelos padrão + modelos próprios usam a mesma engine;
- instrumentos clínicos validados não devem ser duplicados apenas para cruzar boundaries de produto;
- histórico e autoria valem mais que flexibilidade de formulário sem governança;
- UI profissional usa linguagem clínica, não nomes internos de capability/entitlement;
- não criar botão/fluxo de assessment sem backend/lifecycle real;
- `ENGINE != AUTHORIZATION != RELEVANCE`.

## Deliberately deferred

A foundation atual não significa que todo conteúdo clínico esteja pronto. Continuam evoluções separadas:

- curadoria adicional de templates por especialidade;
- Clinical Instrument Authorization Foundation;
- Clinician-Assisted Administration;
- Encounter Instrument UX;
- Consultório V5 integration/polish;
- melhoria longitudinal/comparações;
- novos componentes somente quando necessários;
- correction/amendment quando o domínio exigir;
- integração explícita de achados no Encounter, se justificada.

Esses itens evoluem a plataforma clínica existente; não reabrem a foundation de Assessment e não estão marcados como implementados.