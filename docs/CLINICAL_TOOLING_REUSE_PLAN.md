# MedicsPro — Clinical Tooling Reuse Plan

> Mapa de continuidade para absorção seletiva de ativos do Nexus e do MedicsPro histórico no runtime canônico. Este documento não autoriza copiar arquitetura antiga nem ampliar ACLs.

**Snapshot:** 2026-09-12  
**Runtime canônico de referência:** `OARANHA/crmfisio@0459e5908c942ac63c0dec87d517aa2131936204`  
**Nexus upstream auditado:** `OARANHA/nexus@427174dd909f7aedae52406f2a5d0cfc0314ce22`  
**MedicsPro histórico auditado:** `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`

Os dois repositórios de referência permanecem nas mesmas revisões usadas pelos inventários existentes, portanto `docs/NEXUS_GAP_MAP.md` e `docs/MEDICSPRO_LEGACY_REUSE_MAP.md` continuam sendo as fontes detalhadas. Este arquivo consolida apenas a decisão de produto atual e a ordem de absorção.

## Regra institucional

```text
OARANHA/crmfisio = produto/runtime canônico e único destino de implementação
OARANHA/nexus    = upstream/laboratório de inteligência clínica especializada
OARANHA/medicspro = referência histórica de produto/UX/workflow
```

Regra de arquitetura:

```text
MedicsPro organiza o atendimento e registra o ato clínico.
Nexus calcula, estrutura evidência e apoia decisão.
Assessment Engine coleta avaliações/anamneses estruturadas.
Clinical Documents registra documentos emitidos pelo profissional.
```

Nunca criar um segundo prontuário, um segundo forms engine ou uma prescrição automática a partir de resultado Nexus.

## Destino canônico por tipo de ativo

| Ativo encontrado | Destino canônico | Regra |
| --- | --- | --- |
| Escalas/instrumentos validados | Clinical Instruments com engine Nexus quando já for a fonte técnica | Reusar identidade/versão/scoring; autorização e relevância continuam separadas |
| Calculadoras clínicas | Nexus | Cada cálculo exige contrato, unidades, faixa de entrada, provenance e validação clínica antes de exposição |
| Psicofarmacologia, equivalências e switching | Nexus | Apoio à decisão; não emite prescrição e não substitui julgamento humano |
| Catálogo farmacológico curado | Nexus | Fonte de conhecimento/seleção assistida; não confundir com documento prescrito |
| Anamneses e avaliações estruturadas | Assessment Engine | `click-first, prose-when-needed`; não duplicar PHQ-9/GAD-7 |
| Body Map / Pain Map | Assessment/Encounter component já canônico | Preservar dado estruturado e histórico |
| Prescrição e orientação terapêutica | Clinical Documents | Ato explícito do profissional, snapshot imutável e auditável |
| Pedido de exame, atestado, relatório, referral | Clinical Documents em slices futuras | Só após contrato de tipo, autoria, eligibility, lifecycle e histórico |
| Navegação contextual, templates e ergonomia do atendimento | Clinical Cockpit | Absorver intenção UX, nunca Vue/Pinia/Mongo/Express ou ACL legada |
| Autosave legado | Somente onde houver draft real | Nunca mostrar `salvo` antes de confirmação persistida |
| Checkout clínico acoplado ao financeiro | Rejeitado | Finalização clínica permanece separada da cobertura/financeiro |

## Ativos Nexus que não devem ser esquecidos

O inventário upstream já identificou, entre outros:

- PHQ-9 e GAD-7;
- EEM estruturado;
- catálogo de outras escalas ainda não absorvidas em massa;
- função renal;
- risco cardiovascular;
- equivalências farmacológicas;
- base de antidepressivos;
- antidepressant switching;
- monitoramento/alertas de psicofarmacologia;
- longitudinal/comparabilidade.

A existência no upstream não significa prontidão clínica para produção. Cada porte precisa de revisão de evidência/licença, contrato técnico, testes e UX apropriada.

## Ativos do MedicsPro histórico que não devem ser esquecidos

O inventário legado já catalogou valor em:

- Prescrição com itens estruturados, templates, preview, impressão e histórico;
- Pedido de Exames;
- Atestados/declarações;
- distinção `resultado recebido != resultado revisado`;
- anamnese por modelos/seções/perguntas estruturadas;
- paciente sempre em contexto durante o atendimento;
- navegação rápida entre ferramentas clínicas;
- feedback de persistência;
- anexos/galeria como necessidade futura;
- workflows de documentos próximos ao Encounter.

O que se absorve é o entendimento do trabalho do profissional. Arquitetura, autorização, tenancy e persistência antigas permanecem rejeitadas.

## Prioridade atual

### Agora — D2-B Prescription V1

D2-A está mergeada e a migration foi aplicada/verificada em produção em 2026-09-12. A próxima slice funcional é **D2-B — Prescription V1** sobre a foundation existente.

Objetivo mínimo:

```text
Encounter
→ Prescrição
→ escolher template elegível
→ criar/retomar draft
→ editar itens tipados
→ preview determinístico
→ confirmação humana
→ emitir
→ read-only
→ imprimir
→ histórico
```

D2-B não deve reabrir o schema/lifecycle D2-A sem blocker comprovado e não deve transformar o Nexus em autor da prescrição.

### Depois — D2-C Therapeutic Guidance V1

Usar a mesma foundation e renderer/histórico para `therapeutic_guidance`, sem abrir Exam Order/Atestados/Relatórios na mesma slice.

### Trilha paralela posterior — ferramentas Nexus de alto valor

Após estabilizar a integração documental no Cockpit, priorizar ferramentas Nexus por valor clínico, risco e esforço, em vez de portar catálogo inteiro. Candidatos a avaliação de slice:

1. Clinician-Assisted PHQ-9/GAD-7 sobre a autorização neutra já criada;
2. calculadora de função renal;
3. calculadora de risco cardiovascular;
4. catálogo farmacológico curado/equivalências como apoio;
5. switching apenas depois de validação clínica específica por pares/regras.

Esta ordem é de produto, não autorização automática.

## UX alvo

O profissional não precisa saber a qual engine técnica uma ferramenta pertence. O Cockpit deve compor superfícies coerentes:

```text
Registro
Anamneses & Avaliações
Prescrição
Nexus / Ferramentas clínicas
Mais
```

Exemplo de descoberta futura:

```text
PHQ-9                         Instrumento clínico / engine Nexus
Função renal                  Calculadora Nexus
Anamnese Psiquiátrica         Assessment Engine
Mapa corporal                 Assessment/Encounter
Nova prescrição               Clinical Documents
```

`AVAILABLE`, `RELEVANT` e `RECOMMENDED` são conceitos de apresentação. Nenhum deles concede capability.

## Guardrails

- `ENGINE != AUTHORIZATION != RELEVANCE`;
- specialty nunca auto-concede capability;
- `nexus.*` continua fail-closed;
- instrumento multiprofissional não deve exigir `nexus.*` só porque usa cálculo Nexus internamente;
- resultado/calculadora não gera conduta ou prescrição automaticamente;
- documento emitido é ato humano explícito e auditável;
- nenhum código histórico é portado sem adaptação à arquitetura atual;
- nova ferramenta só entra no manual após comportamento real validado.

## Leitura obrigatória relacionada

- `AGENTS.md`
- `docs/CURRENT_STATE.md`
- `docs/NEXUS_GAP_MAP.md`
- `docs/MEDICSPRO_LEGACY_REUSE_MAP.md`
- `docs/ASSESSMENT_ENGINE.md`
- `docs/CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.md`
- `docs/CLINICAL_DOCUMENTS_FOUNDATION.md`
- `docs/CLINICAL_DOCUMENTS_ROADMAP.md`
