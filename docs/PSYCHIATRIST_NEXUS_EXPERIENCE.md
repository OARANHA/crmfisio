# Experiência do Médico Psiquiatra no MedicsPro com Nexus

## Princípio

MedicsPro é a plataforma. Nexus é o Clinical Intelligence Engine com identidade própria dentro dela.

O login do médico psiquiatra não deve abrir um MedicsPro genérico com um botão extra chamado Nexus. A experiência deve reconhecer o contexto médico/psiquiátrico e priorizar fluxos clínicos de saúde mental, sem confundir profissão, autorização, capability e entitlement.

`role != profession != capability != entitlement != clinic configuration`

A profissão orienta a experiência. A autorização real continua sendo determinada por capabilities, regras de tenant, entitlements e configuração da clínica.

## Entrada após login

Para profissional com profissão médica e especialidade psiquiatria, a home deve assumir um modo clínico psiquiátrico com identidade Nexus visível, porém integrado ao MedicsPro.

### Home / Dashboard

Prioridade visual:

1. agenda e pacientes do dia;
2. alertas clínicos e red flags pendentes;
3. autoavaliações recebidas aguardando revisão;
4. instrumentos recentes e tendências relevantes;
5. atalhos para EEM, Saúde Mental, Psicofarmacologia e evolução longitudinal;
6. pendências de prontuário/SOAP;
7. mensagens e tarefas operacionais secundárias.

O financeiro não deve dominar a home clínica do psiquiatra.

## Navegação recomendada

```text
MedicsPro
├── Início
├── Agenda
├── Pacientes
├── Prontuário
├── Nexus
│   ├── Visão Clínica
│   ├── Saúde Mental
│   ├── Exame do Estado Mental
│   ├── Cognição
│   ├── Psicofarmacologia
│   ├── Calculadoras Clínicas
│   ├── Evolução Clínica
│   ├── Educação em Saúde
│   └── Evidências
├── Mensagens
└── Mais
```

A presença dos itens depende de capability/entitlement. Não mostrar um módulo não autorizado apenas porque a profissão é psiquiatra.

## Paciente aberto

Ao entrar em um paciente, o Nexus deve parecer parte nativa do prontuário:

```text
Paciente
├── Resumo clínico
├── Prontuário / SOAP
├── Avaliações
├── Evoluções
├── Documentos
└── Nexus
    ├── Visão clínica
    ├── Escalas e rastreios
    ├── EEM
    ├── Psicofarmacologia
    ├── Cognição
    ├── Tendências
    ├── Red flags
    └── Evidências
```

O Nexus nunca cria cadastro paralelo de paciente, prontuário paralelo ou login paralelo.

## Diferenças concretas para psiquiatria

### 1. Resumo clínico orientado à saúde mental

No topo do prontuário, destacar quando disponíveis:

- queixa principal e hipóteses/diagnósticos registrados;
- medicações em uso;
- alergias e riscos relevantes;
- último EEM;
- últimas escalas relevantes;
- tendência longitudinal;
- red flags não reconhecidas;
- próxima consulta;
- pendências de revisão clínica.

### 2. Saúde Mental como biblioteca clínica organizada

Não apresentar uma lista alfabética simples. Organizar por domínio:

- Depressão e humor;
- Ansiedade;
- Bipolaridade;
- Risco de suicídio e segurança;
- Álcool e substâncias;
- TDAH / neurodesenvolvimento;
- TOC;
- Sono;
- Saúde mental perinatal;
- funcionalidade/qualidade de vida.

### 3. Exame do Estado Mental como experiência própria

O EEM deve ter interface especializada, com estado estruturado, coerência entre opções, resumo narrativo determinístico, histórico longitudinal e sugestão de exportação para a seção Objetivo do SOAP.

Não reduzir EEM a um formulário genérico.

### 4. Psicofarmacologia como domínio Nexus

Quando autorizado, o psiquiatra deve ter acesso contextual a:

- troca de antidepressivos;
- equivalências suportadas;
- monitoramento metabólico;
- função renal relacionada a psicofármacos;
- educação e evidências vinculadas.

Regras clínicas protegidas devem ser determinísticas, versionadas e revisadas por especialista. Nenhuma IA deve originar silenciosamente diagnóstico, dose ou prescrição.

### 5. Autoavaliações integradas

No prontuário, permitir:

- aplicar instrumento na consulta;
- enviar ao paciente por WhatsApp;
- acompanhar aberto/submetido/processado;
- revisar score, classificação e red flags;
- comparar com aplicações anteriores;
- importar conteúdo apropriado ao prontuário.

PHQ-9/GAD-7 são apenas o início do fluxo, não a definição completa do Nexus.

### 6. Red flags acima de scores comuns

Red flags de segurança devem ter precedência visual e operacional. Um score comum nunca deve competir visualmente com alerta de risco suicida ou outra condição configurada como crítica.

### 7. Longitudinal como parte da consulta

O psiquiatra deve enxergar tendência, não apenas resultado isolado:

- baseline vs atual;
- evolução por escala;
- histórico de EEM;
- mudanças de tratamento registradas;
- eventos relevantes na linha do tempo;
- red flags anteriores e reconhecimento.

### 8. SOAP médico canônico

O Nexus pode sugerir conteúdo para SOAP, mas o profissional mantém autoria e decisão final.

Fluxo esperado:

`Nexus propõe → médico revisa → aceita/edita/rejeita → prontuário registra autoria humana`

Resultados finalizados e regras clínicas usadas devem preservar versão e proveniência.

## Identidade visual

A experiência deve ter “cara de Nexus”, mas não parecer outro sistema dentro do MedicsPro.

Usar:

- assinatura visual Nexus em módulos clínicos;
- hierarquia e densidade clínica próprias;
- cards de evidência, tendência e segurança;
- linguagem clínica consistente;
- light/dark mode compartilhado com MedicsPro;
- mesma navegação, paciente, sessão e permissões da plataforma.

Evitar:

- iframe;
- segunda sidebar completa;
- segundo cadastro de paciente;
- dashboard duplicado sem contexto;
- branding tão separado que pareça produto externo.

## Identidade Nexus

```text
Nexus Clinical Engine

Conteúdo e arquitetura clínica:
Dr. Adolfo Aranha
Médico Psiquiatra

Motor de suporte à decisão clínica baseado
em evidências e desenvolvido para assistência
ao profissional de saúde.
```

Não atribuir autoria clínica à IA.

## Critério de produto

Quando um psiquiatra entrar no MedicsPro, ele deve sentir que está em um sistema construído para sua rotina clínica, com Nexus profundamente integrado, e não em um CRM genérico adaptado por cima.

Ao mesmo tempo, o MedicsPro continua multiprofissional. A diferença de experiência vem da composição dinâmica entre profissão, capability, entitlement e contexto clínico — não de forks separados da aplicação.
