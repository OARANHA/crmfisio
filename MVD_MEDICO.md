# MVD Médico — MedicsPro + Nexus

**Status:** direção oficial para piloto médico  
**Objetivo:** colocar o MedicsPro nas mãos de médicos reais com um fluxo ponta a ponta confiável, mantendo o **Nexus** como motor clínico com identidade própria dentro da plataforma.

---

## 1. Visão do produto

O MedicsPro é a plataforma SaaS de operação, gestão, relacionamento com pacientes e prontuário para clínicas e profissionais de saúde.

O **Nexus Clinical Engine** é o motor de inteligência e suporte à decisão clínica do MedicsPro.

A integração não deve apagar a identidade do Nexus, nem reimplementar sua lógica clínica de forma paralela.

Princípio de produto:

> **MedicsPro organiza e opera a clínica. Nexus fortalece o raciocínio e o registro clínico.**

Arquitetura conceitual:

```text
MedicsPro
├── Operação
│   ├── Agenda
│   ├── Pacientes
│   ├── WhatsApp
│   ├── CRM
│   └── Financeiro
├── Assistência
│   ├── Atendimento
│   ├── Prontuário
│   ├── Avaliações
│   └── Evolução longitudinal
└── Nexus Clinical Engine
    ├── Escalas clínicas
    ├── EEM
    ├── Cognição / MEEM
    ├── Calculadoras clínicas
    ├── Psicofarmacologia
    ├── Risco cardiovascular
    ├── Função renal
    ├── Monitoramento metabólico
    ├── Alertas / red flags
    ├── Educação em saúde
    └── Evidências clínicas
```

---

## 2. Autoridade clínica do Nexus

O Nexus é um ativo clínico existente, concebido com participação médica especializada e já submetido a revisão/apresentação entre pares antes de sua integração ao MedicsPro.

Para engenharia, isso significa:

1. lógica clínica validada do Nexus não é material de refatoração casual;
2. scores, thresholds, algoritmos, regras de segurança, equivalências, condutas determinísticas e mapeamentos de evidência devem manter proveniência e versionamento;
3. mudanças clínicas precisam ser explicitamente identificadas como mudanças de domínio, não escondidas em refatorações de UI;
4. UI, persistência, estado, integração, performance e acessibilidade podem evoluir sem alterar silenciosamente o comportamento clínico;
5. nenhuma IA generativa deve substituir silenciosamente regras determinísticas críticas;
6. resultados de suporte à decisão devem permanecer revisáveis pelo profissional e não devem se apresentar como diagnóstico autônomo.

O repositório original do Nexus deve ser tratado como referência clínica e funcional durante a migração até que cada módulo possua equivalência verificada no MedicsPro.

---

## 3. O que significa MVD

Neste documento, **MVD** significa a menor versão do produto que seja simultaneamente:

- utilizável em um fluxo clínico real;
- demonstrável em poucos minutos;
- segura para piloto controlado;
- suficientemente diferenciada para despertar interesse de médicos;
- instrumentada para coletar feedback e descobrir fricções reais.

O objetivo não é incluir todas as funcionalidades possíveis antes do piloto.

O objetivo é provar a experiência completa:

```text
Login
  ↓
Agenda
  ↓
Paciente
  ↓
Iniciar atendimento
  ↓
Prontuário + Nexus
  ↓
Avaliações / EEM / ferramentas
  ↓
Finalizar atendimento
  ↓
Registro histórico
  ↓
Acompanhamento longitudinal
```

---

## 4. Critério central de sucesso

Um médico do piloto deve conseguir, sem suporte constante:

1. entrar na sua clínica;
2. visualizar agenda e paciente;
3. iniciar um atendimento;
4. produzir registro clínico estruturado;
5. usar ferramentas Nexus dentro do contexto do paciente;
6. aplicar uma escala durante a consulta ou enviá-la ao paciente;
7. receber o resultado no prontuário correto;
8. visualizar resultados anteriores e evolução longitudinal;
9. utilizar EEM e calculadoras habilitadas;
10. finalizar o atendimento sem perder dados;
11. retornar posteriormente e compreender o histórico;
12. concluir que o produto economiza tempo ou melhora segurança/organização clínica.

Se esse ciclo não estiver sólido, funcionalidades periféricas não compensam a falha.

---

## 5. Modelo de acesso obrigatório

Não misturar profissão, papel interno, permissão e recurso contratado.

### 5.1 Papel na clínica

Exemplos conceituais:

- owner;
- admin;
- professional;
- reception;
- finance.

O modelo legado atual deve ser migrado de forma segura, sem alterações improvisadas de autorização.

### 5.2 Profissão / perfil profissional

Exemplos:

- physician;
- physiotherapist;
- psychologist;
- nutritionist;
- outros profissionais habilitados.

### 5.3 Capability

Exemplos:

```text
clinical.assessments
clinical.soap
clinical.body_map
clinical.longitudinal_history

nexus.scales
nexus.eem
nexus.meem
nexus.egfr
nexus.cv_risk
nexus.psychopharmacology
nexus.metabolic_monitoring
```

### 5.4 Entitlement da clínica/plano

Exemplos:

```text
module.nexus
module.finance
module.whatsapp
module.patient_self_assessment
```

Regra:

> **role != profession != capability != entitlement**

A interface pode refletir a autorização, mas nunca deve ser a fronteira de segurança.

---

## 6. Paciente e prontuário canônicos

O MedicsPro é a fonte canônica de paciente, clínica, usuário e prontuário.

A integração Nexus não deve criar um segundo cadastro de paciente ou um segundo prontuário independente.

### Obrigatório

- Nexus recebe o paciente ativo do MedicsPro;
- resultados são persistidos com `clinic_id`, paciente, autor, data e contexto clínico;
- dados do Nexus entram na timeline/prontuário do MedicsPro;
- histórico deve sobreviver a mudanças futuras de template/UI;
- registros finalizados não são silenciosamente sobrescritos;
- correções clínicas utilizam versão, adendo ou mecanismo auditável equivalente.

---

## 7. MVD funcional

### P0 — fundação para piloto

Antes de divulgação ampla para médicos:

- [ ] isolamento multi-tenant revisado;
- [ ] RLS/RPC/autorização dos fluxos sensíveis revisados;
- [ ] clinic onboarding/provisioning confiável;
- [ ] usuários reais com Auth e vínculo correto à clínica;
- [ ] papel do platform admin separado do papel interno da clínica;
- [ ] agenda estável;
- [ ] paciente estável;
- [ ] fluxo iniciar/finalizar atendimento estável;
- [ ] persistência de prontuário confiável;
- [ ] financeiro essencial coerente e sem efeitos duplicados;
- [ ] logging/auditoria suficiente para investigar falhas do piloto;
- [ ] política de acesso ao módulo Nexus implementada server-side quando sensível.

### P1 — Clinical Assessment Engine

- [ ] tela `Avaliações` com **Avaliações padrão** e **Minhas avaliações**;
- [ ] templates versionados;
- [ ] respostas ligadas ao paciente e atendimento;
- [ ] resultado estruturado;
- [ ] histórico longitudinal;
- [ ] capacidade de duplicar modelo padrão sem alterar o original;
- [ ] componentes reutilizáveis para diferentes profissões;
- [ ] body map como componente estruturado onde aplicável.

### P1 — Nexus Clinical Engine integrado

Preservar e integrar as capacidades clínicas relevantes já existentes no Nexus:

- [ ] escalas clínicas;
- [ ] EEM;
- [ ] MEEM/cognição;
- [ ] SOAP/integração estruturada ao prontuário MedicsPro;
- [ ] evolução longitudinal;
- [ ] calculadoras clínicas;
- [ ] risco cardiovascular;
- [ ] função renal/eGFR;
- [ ] psicofarmacologia;
- [ ] monitoramento metabólico;
- [ ] educação em saúde contextual;
- [ ] alertas/red flags;
- [ ] referências/evidências clínicas.

A migração pode ocorrer módulo a módulo, mas o objetivo final é preservar o conjunto útil do Nexus, não substituí-lo por uma versão superficial.

---

## 8. Avaliações padrão e Minhas avaliações

Este é um componente central do MVD e também a ponte entre especialidades.

### Avaliações padrão

Biblioteca MedicsPro/Nexus com instrumentos disponibilizados conforme profissão, módulo, plano e autorização.

Exemplos oriundos do Nexus incluem instrumentos de saúde mental, cognição e rastreio clínico.

### Minhas avaliações

Profissional ou clínica pode criar modelos próprios dentro dos limites autorizados.

Regras:

- padrão não é alterado pelo usuário;
- padrão pode ser duplicado para customização;
- template possui versão;
- resposta histórica aponta para a versão utilizada;
- instrumentos validados devem distinguir claramente conteúdo canônico de versões customizadas;
- regras de score validadas não devem ser editáveis como campos comuns.

---

## 9. Autoaplicação pelo paciente

O MVD médico deve permitir:

```text
Profissional escolhe avaliação
        ↓
Aplicar agora OU enviar ao paciente
        ↓
Link seguro / fluxo de autoaplicação
        ↓
Paciente responde
        ↓
Resultado validado
        ↓
Paciente correto + prontuário + histórico
```

Integração preferencial com a infraestrutura de WhatsApp já existente no MedicsPro quando apropriado.

Requisitos mínimos:

- token/link não pode permitir enumeração de pacientes;
- expiração/revogação quando necessário;
- instrumento e versão identificados;
- vínculo inequívoco à clínica e paciente;
- prevenção contra envio duplicado acidental quando relevante;
- consentimento/propósito de comunicação respeitados;
- resposta não deve permitir acesso ao restante do prontuário.

---

## 10. SOAP e fluxo de consulta

O Nexus não deve manter um SOAP paralelo ao prontuário MedicsPro.

Experiência-alvo:

```text
S — Subjetivo
O — Objetivo       ← importar achados/medidas/resultados apropriados
A — Avaliação      ← importar estratificações/resultados apropriados
P — Plano          ← incorporar elementos editáveis quando clinicamente adequado
```

Princípios:

- o Subjetivo preserva a narrativa clínica e autonomia do profissional;
- importações são explícitas e revisáveis;
- conteúdo gerado/estruturado não deve ser assinado sem revisão do profissional;
- resultado de escala deve manter instrumento, versão, score, interpretação e data;
- alertas de segurança devem continuar visíveis até adequadamente tratados no fluxo.

---

## 11. Alertas clínicos e red flags

Alertas precisam conectar risco a ação, não produzir fadiga.

Exemplo conceitual:

```text
PHQ-9: 19
Item crítico positivo

⚠ Avaliação adicional recomendada
[Abrir instrumento de risco]
```

Requisitos:

- severidade visual consistente;
- regras determinísticas auditáveis;
- origem do alerta registrada;
- nenhum alerta crítico deve depender exclusivamente de interpretação de IA generativa;
- o sistema apoia a decisão: o médico continua responsável pelo julgamento clínico.

---

## 12. Evidence Engine e proveniência

Toda regra clínica crítica migrada para o MedicsPro deve poder responder:

- qual instrumento/regra é esta?
- qual versão?
- qual fonte sustenta a regra?
- quando foi revisada?
- quem aprovou/revisou clinicamente quando aplicável?
- qual regra estava ativa quando este resultado histórico foi produzido?

Modelo conceitual:

```text
clinical_instrument
clinical_instrument_version
clinical_rule
clinical_rule_version
evidence_source
clinical_review
```

Não é obrigatório implementar toda essa modelagem de uma vez para o primeiro PR, mas nenhuma arquitetura do MVD deve impedir essa evolução.

---

## 13. Experiência de demonstração

O MVD deve suportar uma demonstração curta sem dados falsos frágeis ou caminhos especiais escondidos.

Roteiro-alvo:

1. abrir agenda;
2. abrir paciente;
3. iniciar consulta;
4. preencher parte do SOAP;
5. aplicar escala Nexus;
6. visualizar score/gravidade;
7. importar resultado para prontuário;
8. abrir histórico longitudinal;
9. registrar EEM;
10. abrir uma calculadora clínica Nexus;
11. finalizar atendimento;
12. reabrir paciente e visualizar histórico consolidado.

A demonstração deve usar o mesmo fluxo de produção que o piloto utilizará.

---

## 14. Gate de piloto médico

O produto só deve ser tratado como pronto para piloto quando:

### Segurança

- [ ] nenhum P0 conhecido de tenant isolation;
- [ ] nenhuma dependência de ocultação de UI para autorização;
- [ ] segredos apenas server-side;
- [ ] fluxos clínicos sensíveis auditáveis.

### Integridade clínica

- [ ] resultados Nexus comparados com a implementação de referência para casos de teste selecionados;
- [ ] scores e thresholds críticos testados;
- [ ] histórico não é alterado retroativamente por atualização de regra/template;
- [ ] autoria e timestamps corretos;
- [ ] finalização e correção de prontuário preservam histórico.

### Operação

- [ ] agenda e atendimento sem bloqueios conhecidos de alta frequência;
- [ ] criação/seleção de paciente consistente;
- [ ] financeiro essencial não duplica cobrança por retry/status;
- [ ] WhatsApp falha de maneira observável e recuperável.

### UX

- [ ] médico novo consegue executar o roteiro principal com treinamento mínimo;
- [ ] estados vazio/loading/error/success estão cobertos;
- [ ] nenhuma etapa essencial depende de navegação confusa;
- [ ] light/dark não quebram conteúdo clínico ou semântica de risco quando habilitados.

### Observabilidade do piloto

- [ ] erros relevantes podem ser correlacionados sem registrar payload clínico desnecessário;
- [ ] feedback do profissional pode ser associado ao fluxo/tela;
- [ ] principais funis de uso podem ser medidos de forma compatível com privacidade.

---

## 15. O que não deve bloquear o MVD

Não esperar, antes do piloto, por:

- dezenas de novas especialidades;
- catálogo gigantesco de escalas;
- FHIR completo;
- aplicativo mobile nativo;
- marketplace;
- IA generativa para diagnóstico/conduta;
- automações secundárias de baixa frequência;
- customização visual sem impacto no fluxo principal.

A regra é terminar os ciclos de maior valor antes de aumentar o catálogo.

---

## 16. Sequência recomendada de implementação

### Fase A — fundação

1. auditar autorização, RLS e multi-tenant nos fluxos do piloto;
2. consolidar papel vs profissão vs capability vs entitlement;
3. estabilizar atendimento/prontuário;
4. fechar financeiro essencial e efeitos do appointment lifecycle;
5. garantir configuração de clínica e liberação do módulo Nexus.

### Fase B — assessment engine

6. Avaliações padrão;
7. Minhas avaliações;
8. respostas + versionamento;
9. histórico longitudinal;
10. autoaplicação segura;
11. integração WhatsApp quando apropriada.

### Fase C — Nexus

12. definir contrato de integração Nexus ↔ MedicsPro;
13. importar módulos clínicos sem duplicar paciente/prontuário;
14. EEM/MEEM;
15. escalas e alertas;
16. calculadoras;
17. psicofarmacologia e monitoramento;
18. evidências e proveniência;
19. testes de equivalência clínica.

### Fase D — piloto

20. revisar UX do fluxo de consulta completo;
21. criar clínica/dados de demonstração seguros;
22. executar roteiro ponta a ponta;
23. corrigir P0/P1;
24. convidar pequeno grupo de médicos;
25. coletar fricções e medir tempo para realizar tarefas;
26. decidir expansão com base em uso real.

---

## 17. Priorização P0/P1/P2

### P0

- vazamento cross-tenant;
- autorização clínica incorreta;
- perda ou corrupção de prontuário;
- score/algoritmo Nexus divergente com potencial clínico relevante;
- segredo exposto;
- duplicação financeira grave.

### P1

- fluxo de atendimento quebrado;
- avaliação não vinculada corretamente ao paciente;
- autoaplicação não retorna ao prontuário;
- EEM/escala/calculadora Nexus indisponível no fluxo principal;
- histórico longitudinal incorreto;
- UX que impeça médico de concluir consulta;
- falha importante no onboarding da clínica/profissional.

### P2

- melhorias de produtividade;
- polimento visual relevante;
- atalhos;
- relatórios adicionais;
- ampliação de catálogo após o fluxo central estar estável.

---

## 18. Definição de pronto para cada integração Nexus

Um módulo Nexus só é considerado migrado quando:

1. comportamento clínico esperado está preservado;
2. casos de teste de referência passam;
3. dados usam paciente/clínica canônicos do MedicsPro;
4. autorização correta é aplicada;
5. histórico e versionamento estão definidos;
6. UI funciona no fluxo real de consulta;
7. erro/loading/empty estão tratados;
8. não existe dependência desnecessária do app Nexus standalone;
9. documentação/evidência acompanha a regra;
10. diferença intencional em relação ao Nexus original está registrada e clinicamente revisada quando aplicável.

---

## 19. Métricas do piloto

O piloto não deve medir apenas bugs.

Perguntas essenciais:

- quantos médicos conseguem concluir a primeira consulta sem ajuda?
- quanto tempo levam para registrar atendimento?
- quais ferramentas Nexus usam espontaneamente?
- quantas avaliações são aplicadas na consulta vs enviadas ao paciente?
- quantos resultados voltam corretamente?
- quantos cliques/etapas causam desistência?
- os médicos retornam ao histórico longitudinal?
- qual funcionalidade eles mencionam espontaneamente para outro médico?
- eles confiariam no produto com pacientes reais?
- pagariam pelo produto ou pediriam para continuar usando?

---

## 20. Mensagem de posicionamento inicial

Evitar vender o produto como "mais um prontuário".

Direção de posicionamento:

> **MedicsPro reúne operação da clínica, prontuário e relacionamento com pacientes. O Nexus adiciona inteligência clínica baseada em evidências diretamente ao fluxo de atendimento.**

Identidade conceitual:

```text
MedicsPro
Healthcare Operating System

Nexus
Clinical Intelligence Engine
```

O nome **Nexus** deve permanecer visível e preservado dentro do ecossistema MedicsPro.

---

## 21. Próxima ação de engenharia

Antes de implementar novos módulos Nexus em massa, criar um inventário técnico de integração:

```text
Módulo Nexus
→ componente atual
→ lógica clínica
→ dados necessários
→ resultado produzido
→ destino no MedicsPro
→ capability necessária
→ entitlement necessário
→ persistência
→ risco clínico
→ testes de equivalência
```

Usar esse inventário para migrar módulos verticalmente e evitar uma cópia indiscriminada do app standalone.
