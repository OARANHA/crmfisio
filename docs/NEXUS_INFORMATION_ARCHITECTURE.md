# Nexus Information Architecture — MedicsPro

**Status:** mapa canônico de migração e navegação  
**Objetivo:** preservar a densidade clínica, a organização mental e a identidade do Nexus ao integrá-lo ao MedicsPro.

---

## 1. Princípio central

O Nexus não deve ser reduzido a uma coleção de cards ou calculadoras espalhadas pelo MedicsPro.

O Nexus deve permanecer reconhecível como um domínio clínico coerente dentro da plataforma, com sua própria hierarquia, contexto, resultados, evidências, alertas e relações entre ferramentas.

Princípio de produto:

> **MedicsPro é a plataforma. Nexus é o Clinical Intelligence Engine com identidade própria dentro dela.**

A integração deve preservar:

- nomenclatura clínica;
- agrupamento por domínio;
- lógica determinística validada;
- relações entre instrumentos;
- red flags;
- histórico longitudinal;
- exportação contextual para prontuário/SOAP;
- educação em saúde;
- evidências e proveniência;
- autoria clínica do Nexus.

---

## 2. Duas portas de entrada

O Nexus deve existir em dois contextos complementares.

### 2.1 Nexus global

Acesso pelo menu principal do MedicsPro para exploração da biblioteca clínica.

```text
Nexus
├── Visão Geral
├── Saúde Mental
├── Cognição
├── Exame do Estado Mental
├── Psicofarmacologia
├── Calculadoras Clínicas
├── Evolução
├── Educação em Saúde
└── Evidências
```

Neste modo, o profissional pode consultar instrumentos, evidências e ferramentas sem necessariamente estar dentro de um paciente.

### 2.2 Nexus contextual ao paciente

Acesso dentro do prontuário/página do paciente.

```text
Paciente
├── Resumo
├── Prontuário
├── Avaliações
├── Documentos
├── Financeiro
└── Nexus
```

Neste modo, o Nexus recebe contexto clínico do MedicsPro e trabalha sobre o paciente real.

O Nexus não deve possuir um cadastro paralelo de pacientes.

---

## 3. Estrutura principal proposta

```text
NEXUS CLINICAL ENGINE
│
├── 1. Visão Clínica
│   ├── resumo do paciente
│   ├── instrumentos recentes
│   ├── tendências
│   ├── alertas ativos
│   ├── dados a revisar
│   └── atalhos clínicos contextuais
│
├── 2. Saúde Mental
│   ├── Depressão
│   ├── Ansiedade
│   ├── Bipolaridade
│   ├── Risco de suicídio e segurança
│   ├── Álcool e substâncias
│   ├── TDAH / neurodesenvolvimento
│   ├── TOC
│   ├── Sono
│   ├── Saúde mental perinatal
│   └── Qualidade de vida / funcionalidade
│
├── 3. Exame do Estado Mental
│   ├── EEM estruturado
│   ├── resumo narrativo
│   ├── exportação para SOAP Objetivo
│   ├── alertas associados
│   └── histórico longitudinal
│
├── 4. Cognição
│   ├── MEEM
│   ├── domínios cognitivos
│   ├── comparação longitudinal
│   └── interpretação contextual
│
├── 5. Psicofarmacologia
│   ├── troca de antidepressivos
│   ├── equivalência de antipsicóticos
│   ├── monitoramento metabólico
│   ├── monitoramento renal relacionado a fármacos
│   └── educação / evidências relacionadas
│
├── 6. Calculadoras Clínicas
│   ├── função renal
│   ├── risco cardiovascular
│   ├── cálculos farmacológicos
│   └── resultados exportáveis ao prontuário
│
├── 7. Evolução Clínica
│   ├── tendência por escala
│   ├── radar por domínio
│   ├── baseline versus atual
│   ├── metas clínicas
│   └── comparação entre consultas
│
├── 8. Educação em Saúde
│   ├── TDAH
│   ├── Depressão
│   ├── Ansiedade
│   ├── Sono
│   ├── Crises & Segurança
│   └── Psicofármacos
│
└── 9. Evidências
    ├── fontes
    ├── validações
    ├── pontos de corte
    ├── referências clínicas
    ├── versão da regra
    └── histórico de revisão
```

---

## 4. Inventário funcional confirmado no Nexus atual

O Nexus atual já possui componentes independentes para:

| Capacidade | Implementação Nexus atual | Destino MedicsPro |
|---|---|---|
| Dashboard clínico | `DashboardView.tsx` | Nexus > Visão Clínica |
| Escalas | `ScalesView.tsx` | Nexus > Saúde Mental / Cognição + Avaliações |
| EEM | `EemView.tsx` | Nexus > Exame do Estado Mental |
| SOAP | `SoapView.tsx` | integração no prontuário canônico MedicsPro |
| Calculadoras | `CalculatorsView.tsx` | Nexus > Calculadoras Clínicas |
| Troca de antidepressivos | `AntidepressantSwitchCalculator.tsx` | Nexus > Psicofarmacologia |
| Evolução longitudinal | `EvolutionChartsView.tsx` | Nexus > Evolução Clínica |
| Autoaplicação | `PatientSelfFillModal.tsx` | MedicsPro Assessments + envio seguro ao paciente |
| Educação contextual | `ContextualEducationModal.tsx` | Nexus > Educação em Saúde / sugestões contextuais |
| Biblioteca educativa | `EducationView.tsx` | Nexus > Educação em Saúde |
| Compartilhamento | `WhatsappShareModal.tsx` | integrar ao outbox/Evolution API MedicsPro |
| Evidências | `evidenceData.ts` + UI associada | Nexus > Evidências / Evidence Engine |

Header, sidebar, paciente-demo e estado central independente do Nexus não devem ser migrados como infraestrutura paralela.

---

## 5. Taxonomia das escalas

As escalas não devem aparecer apenas em ordem alfabética. Elas devem ser agrupadas por problema clínico, mantendo busca global e favoritos.

### 5.1 Depressão e humor

- PHQ-9;
- HCL-32 para rastreio de hipomania/espectro bipolar;
- EPDS para ciclo gravídico-puerperal;
- demais instrumentos de humor existentes no catálogo Nexus.

### 5.2 Ansiedade

- GAD-7;
- demais instrumentos relacionados disponíveis no Nexus.

### 5.3 Risco de suicídio e segurança

- C-SSRS / avaliação adaptada de risco e segurança;
- gatilhos provenientes de outros instrumentos, como item de ideação positiva em escala associada;
- plano de segurança e ações clínicas contextuais quando aplicável.

Red flags de segurança devem ter prioridade visual e operacional acima de scores comuns.

### 5.4 Álcool e substâncias

- AUDIT;
- AUDIT-C;
- CAGE;
- instrumentos adicionais existentes no catálogo Nexus.

### 5.5 TDAH / neurodesenvolvimento

- ASRS-18;
- SNAP-IV;
- demais instrumentos relacionados existentes no Nexus.

### 5.6 TOC

- Y-BOCS.

### 5.7 Cognição

- MEEM;
- visualização por domínios cognitivos;
- baseline e evolução longitudinal.

### 5.8 Sono

- instrumentos de sono existentes no Nexus, incluindo ISI quando habilitado pelo catálogo.

### 5.9 Qualidade de vida e funcionalidade

- EUROHIS-QOL;
- demais instrumentos funcionais existentes.

### Regra de migração

Nenhuma escala deve ser migrada apenas como questionário.

Para cada instrumento devem ser preservados, quando existentes no Nexus:

- público-alvo;
- descrição;
- instruções;
- tempo estimado;
- questões e alternativas;
- função de cálculo;
- escore total e máximo;
- classificação;
- severity level;
- interpretação;
- recomendações;
- texto para prontuário/SOAP;
- passos de conduta;
- metas de monitoramento;
- pérolas clínicas;
- pitfalls;
- alertas;
- referências e validação.

---

## 6. Modelo visual de uma escala no MedicsPro

```text
Nexus > Saúde Mental > Depressão > PHQ-9

PHQ-9
Rastreamento e acompanhamento de sintomas depressivos

[Aplicar agora] [Enviar ao paciente]

────────────────────────────────────
Paciente: João da Silva
Última aplicação: 14/08/2026
Escore anterior: 14
────────────────────────────────────

Questionário
...

Resultado
14 / 27
Depressão moderada

Tendência
18 → 16 → 14

Alertas
nenhum / red flag quando aplicável

Conduta clínica
[conteúdo Nexus]

Metas de acompanhamento
[conteúdo Nexus]

Pérolas e armadilhas
[conteúdo Nexus]

Evidências
[fontes + versão]

[Importar para prontuário]
```

A aplicação deve servir tanto à consulta atual quanto ao acompanhamento longitudinal.

---

## 7. EEM como domínio próprio

O EEM do Nexus é mais do que uma avaliação genérica e deve manter uma experiência especializada.

Domínios atuais incluem:

- aparência e higiene;
- atitude;
- fala e linguagem;
- humor;
- afeto;
- pensamento — curso;
- pensamento — forma;
- pensamento — conteúdo;
- sensopercepção;
- orientação;
- atenção, concentração e memória;
- insight;
- julgamento/crítica da realidade;
- observações livres.

O Nexus já contém regras de exclusão mútua e coerência entre opções. Essas regras devem ser preservadas na migração.

### Saída canônica

O EEM deve persistir:

1. estado estruturado;
2. versão do schema/regra;
3. autor;
4. paciente;
5. atendimento;
6. timestamp;
7. resumo narrativo gerado deterministicamente;
8. destino SOAP sugerido = **Objetivo**.

Nunca guardar somente o texto narrativo quando os dados estruturados estiverem disponíveis.

---

## 8. Cognição e MEEM

O MEEM deve ser apresentado como domínio cognitivo, não escondido em uma lista genérica de escalas.

A experiência deve suportar:

- aplicação estruturada;
- score total;
- critérios/contexto educacional quando previstos no Nexus;
- domínios cognitivos;
- comparação entre aplicações;
- visualização radar/longitudinal;
- exportação contextual para prontuário;
- acesso às evidências.

A evolução longitudinal é parte do recurso, não uma tela opcional desconectada.

---

## 9. Psicofarmacologia

Psicofarmacologia deve permanecer um agrupamento Nexus claramente identificável.

### 9.1 Troca de antidepressivos

O Nexus já possui um fluxo dedicado para troca/transição de antidepressivos.

No MedicsPro a migração deve preservar:

- medicamento de origem;
- medicamento de destino;
- doses;
- estratégia de transição;
- warnings;
- explicações;
- fonte/regra;
- saída para Plano do SOAP/prontuário;
- versão da lógica usada no cálculo.

### 9.2 Equivalência de antipsicóticos

O Nexus possui equivalência baseada em CPZE com diferentes antipsicóticos.

Resultado deve registrar:

- fármaco;
- dose de entrada;
- resultado calculado;
- unidade;
- interpretação;
- detalhes;
- evidence/rule version;
- autor e atendimento quando persistido.

### 9.3 Monitoramento metabólico

O Nexus relaciona saúde mental grave, antipsicóticos de maior risco e estratificação cardiovascular/metabólica.

No MedicsPro essa relação deve ser mantida como inteligência contextual e não dividida em telas independentes sem ligação.

---

## 10. Calculadoras clínicas

O Nexus atual possui pelo menos quatro abas principais de cálculo:

1. troca de antidepressivos;
2. equivalência de antipsicóticos / CPZE;
3. função renal / CKD-EPI 2021;
4. risco cardiovascular / SBC-Framingham.

### 10.1 Função renal

Deve permanecer relacionada ao contexto de monitoramento clínico e farmacológico quando aplicável.

### 10.2 Risco cardiovascular

O Nexus atual contempla múltiplos modos/variáveis, incluindo fatores clássicos, critérios de alto risco, agravantes e contexto de saúde mental/antipsicóticos.

Não reduzir essa funcionalidade a um campo de percentual.

A saída deve manter:

- entradas relevantes;
- método/regra utilizada;
- resultado;
- classificação;
- agravantes/reclassificadores;
- interpretação;
- texto clínico exportável;
- evidence/rule version.

---

## 11. Evolução longitudinal

A `EvolutionChartsView` não deve virar uma página isolada sem contexto.

Ela deve ser a camada transversal de acompanhamento do Nexus.

### Modos de visualização

- score ao longo do tempo;
- percentual de mudança;
- baseline versus atual;
- classificação ao longo das consultas;
- radar por domínio;
- metas clínicas;
- comparação de instrumentos relacionados.

O Nexus atual possui perfis de radar específicos por instrumento e domínios clínicos internos. Essa estrutura deve ser preservada quando clinicamente relevante.

### Regra de persistência

Resultado histórico deve sempre referenciar a versão exata do instrumento/regra utilizada naquela data.

Mudança futura na regra não pode alterar retroativamente um resultado antigo.

---

## 12. Educação em saúde

A educação do Nexus deve existir em duas formas.

### Biblioteca

Navegação direta por temas:

- TDAH;
- Depressão;
- Ansiedade;
- Sono;
- Crises & Segurança;
- Psicofármacos.

### Educação contextual

Sugestões geradas deterministicamente a partir dos dados disponíveis do paciente, escalas e EEM.

Cada sugestão pode carregar:

- tema;
- título;
- descrição curta;
- motivo da sugestão;
- fontes que produziram o match;
- texto editável para SOAP;
- material para paciente quando aplicável.

Alertas de segurança sempre têm precedência sobre conteúdo educativo comum.

---

## 13. Evidências como recurso de primeira classe

O Nexus já possui uma camada explícita de evidências.

No MedicsPro isso deve evoluir para um Evidence Engine persistente/versionado.

Cada ativo clínico deve poder referenciar:

```text
clinical_asset
├── id / slug
├── versão clínica
├── tipo
├── domínio
├── fontes
├── validação
├── pontos de corte
├── reviewed_at
├── reviewed_by
└── status
```

A UI deve permitir ao médico chegar às evidências sem poluir o fluxo principal.

O objetivo é combinar:

- velocidade de uso;
- transparência;
- auditabilidade;
- confiança clínica.

---

## 14. SOAP e prontuário

O `SoapView` independente do Nexus não deve virar um segundo prontuário.

O MedicsPro permanece a fonte canônica do registro clínico.

O Nexus fornece blocos estruturados/contextuais para o prontuário MedicsPro.

### Mapeamento padrão

| Fonte Nexus | Destino sugerido |
|---|---|
| narrativa livre do médico | S — Subjetivo |
| EEM | O — Objetivo |
| achados objetivos / calculadoras | O — Objetivo ou A conforme regra explícita |
| classificação/interpretação de escala | A — Avaliação |
| educação em saúde / plano de segurança / condutas selecionadas | P — Plano |
| texto composto excepcional | SOAP completo somente quando explicitamente definido |

A importação deve ser visível e editável pelo profissional.

Nunca substituir silenciosamente texto já escrito pelo médico.

---

## 15. Autoaplicação do paciente

A autoaplicação do Nexus deve usar a infraestrutura MedicsPro.

Fluxo alvo:

```text
Paciente > Nexus / Avaliações
        ↓
Selecionar instrumento
        ↓
Enviar ao paciente
        ↓
MedicsPro cria assignment + token opaco expiráavel
        ↓
WhatsApp via outbox/Evolution API
        ↓
Paciente responde sem acessar o prontuário
        ↓
backend valida e calcula
        ↓
resultado entra no paciente
        ↓
Nexus atualiza evolução / alertas
```

Não copiar o padrão de nome/identidade do paciente em query string da aplicação demonstrativa do Nexus.

O link público deve usar token opaco, escopo mínimo, TTL e política de uso definida.

---

## 16. Red flags e alertas

Alertas clínicos não devem ser implementados como simples cor no card.

Modelo conceitual:

```text
clinical_alert
├── patient_id
├── source_type
├── source_result_id
├── rule_id
├── severity
├── title
├── description
├── recommended_action
├── created_at
├── acknowledged_at
└── acknowledged_by
```

Severidades sugeridas:

- `info`;
- `warning`;
- `critical`.

Princípios:

- critical domina a hierarquia visual;
- um alerta deve indicar a próxima ação relevante;
- não gerar múltiplos alertas equivalentes para o mesmo fato;
- histórico deve ser auditável;
- acknowledgement não apaga o evento.

---

## 17. Identidade visual Nexus dentro do MedicsPro

O Nexus deve parecer parte do MedicsPro, sem perder sua marca.

### Deve compartilhar com MedicsPro

- grid;
- componentes básicos;
- tipografia principal;
- tokens light/dark;
- acessibilidade;
- estados de carregamento/erro;
- padrões de navegação;
- responsividade.

### Deve manter assinatura própria

- nome **Nexus**;
- marca/logo quando apropriado;
- subtítulo como `Clinical Intelligence Engine`;
- pequeno conjunto de tokens/acento identificadores;
- linguagem clínica consistente;
- selo/área institucional de autoria clínica quando definido pelo produto.

Evitar transformar o Nexus em um “iframe visual” dentro do MedicsPro.

---

## 18. Contexto técnico mínimo de cada ferramenta

Toda ferramenta Nexus integrada deve receber um contexto explícito.

```ts
interface NexusClinicalContext {
  clinicId: string;
  patientId?: string;
  professionalId: string;
  appointmentId?: string | null;
  profession?: string | null;
  capabilities: string[];
}
```

Nenhum componente deve descobrir paciente ou clínica por estado global paralelo quando o MedicsPro já fornece esse contexto.

---

## 19. Contrato de resultado Nexus

As capacidades clínicas devem convergir para um contrato persistível comum, mantendo payload específico por ferramenta.

```ts
interface NexusClinicalResult {
  id?: string;
  engine: 'nexus';
  toolId: string;
  toolType: 'scale' | 'eem' | 'calculator' | 'pharmacology' | 'education';
  clinicalVersion: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  severity?: 'low' | 'moderate' | 'high' | 'severe';
  score?: number | null;
  classification?: string | null;
  interpretation?: string | null;
  redFlags?: NexusRedFlag[];
  evidenceRefs?: string[];
  soapExports?: NexusSoapExport[];
  payload: Record<string, unknown>;
  createdAt: string;
}
```

Esse contrato não substitui schemas clínicos específicos; ele cria uma superfície comum para timeline, dashboard, auditoria e prontuário.

---

## 20. Onde cada coisa vive

| Conteúdo | Fonte canônica |
|---|---|
| paciente | MedicsPro |
| clínica/tenant | MedicsPro |
| profissional | MedicsPro |
| agenda/appointment | MedicsPro |
| prontuário | MedicsPro |
| WhatsApp/outbox | MedicsPro |
| autorização/RLS | MedicsPro |
| assessment persistence | MedicsPro Clinical Assessment Engine |
| lógica clínica Nexus | Nexus Clinical Engine |
| scores/thresholds/regras Nexus | Nexus Clinical Engine, versionados |
| evidências clínicas Nexus | Nexus Evidence Engine |
| visualização longitudinal | MedicsPro persistence + Nexus interpretation/UI |

---

## 21. Matriz de destino

| Ativo Nexus | Destino primário | Destinos secundários |
|---|---|---|
| Escalas | Nexus > domínio clínico | Avaliações, Timeline, SOAP, Evolução |
| EEM | Nexus > EEM | SOAP Objetivo, Timeline |
| MEEM | Nexus > Cognição | Avaliações, Evolução, SOAP |
| Calculadoras | Nexus > Calculadoras | SOAP, Timeline quando persistidas |
| Psicofarmacologia | Nexus > Psicofarmacologia | SOAP Plano, Evidências |
| Educação | Nexus > Educação | Plano, envio/material paciente |
| Alertas | Nexus > Visão Clínica | paciente, atendimento, timeline |
| Evidências | Nexus > Evidências | drawer/modal contextual |
| Evolução | Nexus > Evolução | resumo do paciente / dashboards |

---

## 22. Ordem de migração recomendada

### Onda 0 — infraestrutura

- modelo multiprofissional;
- capabilities e entitlement;
- contrato Nexus;
- versionamento clínico;
- result/event model;
- evidence model;
- red flag model.

### Onda 1 — escalas + longitudinal

- PHQ-9;
- GAD-7;
- C-SSRS;
- HCL-32;
- AUDIT/AUDIT-C;
- persistência no Assessment Engine;
- histórico;
- radar/evolução;
- autoaplicação.

Essa onda demonstra rapidamente a integração Nexus ↔ MedicsPro e cria a base reutilizável para as demais escalas.

### Onda 2 — EEM + cognição

- EEM completo;
- exportação para SOAP Objetivo;
- MEEM;
- evolução cognitiva;
- alertas contextuais associados.

### Onda 3 — calculadoras

- eGFR;
- risco cardiovascular;
- CPZE;
- integração com timeline/prontuário/evidências.

### Onda 4 — psicofarmacologia

- troca de antidepressivos;
- regras de transição;
- warnings;
- monitoramento metabólico;
- integração com Plano do prontuário.

### Onda 5 — educação contextual

- biblioteca educativa;
- engine de suggestions;
- integração com escalas/EEM;
- material compartilhável ao paciente quando aplicável.

---

## 23. Definition of Done por módulo Nexus

Um módulo só pode ser declarado migrado quando:

1. comportamento clínico foi comparado com o Nexus original;
2. regra clínica e versão estão identificadas;
3. evidências relevantes foram preservadas;
4. contexto de tenant/paciente/profissional é MedicsPro;
5. RLS/autorização foram validados;
6. estado draft/finalized é coerente quando aplicável;
7. resultado histórico é imutável/versionado;
8. exportação SOAP funciona quando aplicável;
9. red flags funcionam quando aplicável;
10. longitudinal funciona quando aplicável;
11. light/dark e acessibilidade foram verificados;
12. loading/empty/error states existem;
13. não foi criado paciente, login, WhatsApp ou prontuário paralelo;
14. teste de equivalência Nexus original ↔ MedicsPro passou para cenários representativos.

---

## 24. Anti-padrões proibidos

Não fazer:

- copiar todo `App.tsx` do Nexus para dentro do MedicsPro;
- manter segundo estado global de paciente;
- duplicar SOAP;
- duplicar WhatsApp;
- esconder ferramentas apenas com `profession === doctor` sem autorização server-side;
- transformar cada escala em página hard-coded independente;
- perder evidence metadata durante a migração;
- recalcular resultado histórico com regra nova sem manter versão anterior;
- reduzir red flag a uma cor sem ação;
- migrar UI e esquecer a relação entre escala, evolução, EEM, educação e SOAP;
- remover o nome Nexus da experiência clínica.

---

## 25. Critério de experiência

Ao final da integração, um médico deve sentir que o Nexus continua sendo um sistema clínico coerente, porém agora conectado a tudo que o MedicsPro resolve operacionalmente.

A experiência ideal é:

```text
agenda → paciente → atendimento
                 ↓
               Nexus
        ┌────────┼────────┐
      escala     EEM   calculadora
        ↓         ↓        ↓
      resultado estruturado
                 ↓
        prontuário + timeline
                 ↓
      evolução longitudinal
                 ↓
         próxima decisão
```

O valor não está apenas nas ferramentas isoladas.

O diferencial é o **encadeamento clínico organizado** entre elas e o restante da operação da clínica.
