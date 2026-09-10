# MedicsPro — Modelo canônico multiprofissional

**Estado em 2026-09-10.** O MedicsPro é uma plataforma clínica multiprofissional. O domínio não assume que todo profissional clínico é fisioterapeuta nem que um instrumento clínico pertence universalmente a uma única especialidade.

## Princípio central

Separar conceitos que não podem ser confundidos:

1. **papel operacional na clínica** — o que a pessoa administra/operacionaliza;
2. **identidade profissional** — profissão, conselho, registro, UF e especialidade;
3. **capabilities clínicas** — atos/ferramentas permitidos ao profissional;
4. **entitlement da clínica** — recursos contratados/liberados pela plataforma;
5. **protocolo/configuração da clínica** — disponibilidade institucional dentro do que foi contratado;
6. **autorização server-side** — decisão efetiva naquele contexto;
7. **contexto do Encounter** — prioridade/apresentação da ferramenta no atendimento;
8. **PresentationContext** — somente apresentação/privacy shell.

Profissão não concede acesso administrativo. Papel operacional não concede autoria clínica. Especialidade não concede capability. Protocolo não concede capability. Contexto do Encounter não concede capability. PresentationContext não concede nenhum deles.

Para instrumentos clínicos, a regra canônica é:

```text
ENGINE != AUTHORIZATION != RELEVANCE
```

A engine implementa o instrumento e seu scoring/versionamento. A autorização decide se o ator pode executar o ato clínico. A relevância decide se a ferramenta deve aparecer, ser ordenada ou recomendada naquele contexto. Nenhuma dessas camadas concede silenciosamente outra.

## Papel operacional na clínica — canônico

Papéis atuais:

- `owner`
- `admin`
- `professional`
- `recep`
- `financeiro`

`platform_admin` pertence a domínio separado da clínica.

`fisio` é legado de compatibilidade e permanece apenas onde ainda existir fisicamente; não é role canônica para novos consumidores.

`parceiro`, `sócio` e repasse/compensação são relações econômicas futuras, não roles.

Um `owner` ou `admin` pode também possuir identidade clínica própria, mas atos clínicos só são autorizados quando a boundary clínica exigida é satisfeita independentemente do papel administrativo.

## Identidade profissional

A identidade fica separada do role e pode representar diferentes profissões/especialidades.

Campos relevantes incluem, conforme o contrato atual:

- `professional_type`
- tipo de conselho/credencial;
- UF;
- número de registro;
- especialidade.

Psiquiatria é especialidade de Medicina, não role nem profissão independente.

A profissão responde por identidade e requisitos profissionais. A especialidade pode alterar relevância, ordenação e sugestões de conteúdo/ferramentas. **Profissão ou especialidade nunca fazem auto-grant de capability.**

## Referência clínica canônica

O appointment usa `professional_id` como referência clínica canônica.

`fisio_id`/`fisioId` podem existir em compatibilidade residual e não devem ganhar novos consumidores de autorização ou domínio.

Nomes físicos históricos como `physiotherapy_evolutions` podem permanecer até uma futura migration segura; nomenclatura física não redefine o modelo de produto.

Não fazer renomeação big-bang sem necessidade operacional e verifier apropriado.

## Capabilities clínicas

Capabilities refinam atos clínicos, mas não atuam sozinhas. Exemplos existentes incluem:

- `clinical.attend`
- `clinical.timeline.read`
- `clinical.evolution.write`
- `clinical.assessment.apply`
- capabilities Nexus específicas.

Para um ato clínico, capability é a camada de **autorização efetiva**, combinada com identidade, tenant, autoria/relação assistencial e demais invariantes server-side aplicáveis. Relevância de produto, especialidade ou protocolo nunca substituem essa decisão.

Uma futura **Clinical Instrument Authorization Foundation** deverá introduzir uma autoridade clínica neutra para administração de instrumentos multiprofissionais sem reaproveitar `nexus.*` como atalho. Esta documentação não cria `clinical.instrument.apply`, não altera a capability matrix e não concede nenhuma capability.

## Protocolo e configuração da clínica

Owner/admin deve configurar pessoas em linguagem de produto, sem expor chaves técnicas quando não necessário.

Para instrumentos, protocolo/configuração responde por **disponibilidade institucional**, dentro do entitlement e das regras do produto. Exemplo conceitual: a clínica pode disponibilizar PHQ-9/GAD-7 em um protocolo de atenção primária ou saúde mental sem que isso conceda automaticamente autorização a todos os profissionais.

Uma futura granularidade por instrumento/profissional pode existir como refinamento de configuração, mas nunca deve virar uma ACL paralela capaz de criar autoridade quando a capability clínica base estiver ausente.

### Função na clínica

- Proprietário
- Administrador
- Profissional
- Recepção
- Financeiro

### Identidade profissional

- profissão
- conselho/credencial
- UF
- registro
- especialidade

### Atuação clínica

A interface pode traduzir capabilities em ações humanas, como realizar atendimentos, registrar evolução oficial, aplicar avaliações e acessar ferramentas especiais quando elegível.

Backend continua validando combinações e falha fechado.

## Instrumentos clínicos multiprofissionais

Instrumentos clínicos como PHQ-9 e GAD-7 são potencialmente úteis a diferentes profissionais conforme finalidade clínica, protocolo e contexto. Contextos relevantes podem incluir, sem constituir ACL automática:

- Psiquiatria;
- Medicina de Família / Atenção Primária à Saúde;
- Clínica Médica;
- equipes de saúde mental;
- Enfermagem em APS/Saúde da Família;
- outros profissionais clinicamente elegíveis quando houver indicação e protocolo apropriados.

A aplicabilidade deve ser resolvida conceitualmente por uma função pura de produto:

```text
profession
+ specialty
+ clinic protocol/configuration
+ encounter context
-> available / relevant / recommended
```

Esse resolver é **não autoritativo**. Ele pode decidir disponibilidade de catálogo, prioridade visual e recomendação; nunca concede capability, nunca substitui RLS/RPC e nunca transforma profissão/especialidade em autorização.

Exemplos conceituais:

- **médico psiquiatra** — PHQ-9/GAD-7 podem ter relevância muito alta; ainda assim exigem a autorização clínica efetiva;
- **médico de família** — podem ser relevantes em rastreio/acompanhamento na APS conforme protocolo; sem auto-grant;
- **clínico geral** — podem ser disponibilizados conforme finalidade/contexto; sem auto-grant;
- **enfermeiro de Saúde da Família** — podem ser relevantes quando o protocolo institucional e a autorização clínica permitirem; não precisa receber uma capability Nexus por isso;
- **fisioterapeuta sem protocolo específico** — o resolver pode não disponibilizar/recomendar o instrumento, independentemente de outras capabilities do profissional.

## Nexus médico avançado x instrumentos clínicos

Não confundir o boundary atual do **produto Nexus médico avançado** com uma regra universal sobre todos os atos clínicos ou instrumentos que hoje reutilizam sua implementação.

### Nexus médico avançado

- mantém os boundaries C-01…C-06 atuais;
- `nexus.*` continua fail-closed;
- entitlement, capability, identidade médica Nexus válida e demais boundaries atuais não são flexibilizados;
- `nexus.eem` mantém seu significado e seu boundary atual;
- profissão, especialidade ou PresentationContext não liberam Nexus.

### Instrumentos clínicos

- podem ser multiprofissionais conforme finalidade, protocolo, contexto e autorização clínica adequada;
- PHQ-9/GAD-7 não devem depender conceitualmente de o profissional ser usuário do Nexus médico avançado;
- a futura autorização de aplicação deve ser clínica/instrumental, sem conceder `nexus.*` a quem apenas precisa administrar o instrumento;
- a implementação canônica já validada de versão/scoring deve ser preservada enquanto a futura fachada/persistência for decidida.

Portanto, **não flexibilizar C-06** para resolver multiprofissionalidade. O caminho futuro é desacoplar a autoridade de aplicação do namespace `nexus.*`, preservando o Nexus médico avançado fail-closed.

## Platform Admin x Admin da clínica

### Platform Admin

Controla o SaaS: clínicas, planos/entitlements, rollout/provisionamento e governança de plataforma. Não recebe acesso implícito ao prontuário/financeiro de cada tenant.

### Owner/Admin da clínica

Gerencia a operação dentro da clínica e dos entitlements contratados. O fato de ser gestor não concede autoria clínica.

## Encounter multiprofissional

O novo atendimento é compartilhado entre profissões e usa Encounter Record como unidade editável.

Conteúdo clínico comum:

- motivo/demandas;
- história atual/HDA;
- achados/exame;
- avaliação clínica/problemas;
- plano/conduta;
- observações.

Ferramentas específicas de profissão/especialidade entram por templates, capabilities e engines clínicas — não por prontuários paralelos.

Após confirmação humana:

**Encounter Record → Evolution oficial determinística → appointment finalizado**

Não existe segunda Evolution universal obrigatória no fluxo novo.

### Direção de UX — Consultório V5 Clinical Cockpit

Sem implementar ainda, a direção de composição do Encounter é:

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

Esse cockpit deve absorver ergonomia e aprendizado do MedicsPro histórico sem portar Vue/Pinia/Mongo, autorização antiga, autosave antigo, checkout ou outras decisões arquiteturais legadas.

## Assessment

Avaliações padrão e modelos próprios continuam no mesmo Assessment Engine versionado/autorado. Body map é componente clínico estruturado. A profissão/especialidade determina aplicabilidade/conteúdo, não cria outra engine.

PHQ-9/GAD-7 **não devem ser duplicados como uma segunda implementação no Assessment Engine**. O Assessment Engine continua sendo referência multiprofissional para avaliações estruturadas; instrumentos validados podem reutilizar sua disciplina arquitetural sem duplicar catálogo, versão ou scoring já canônicos.

## Instrument Delivery futuro

A direção futura é disponibilizar o mesmo instrumento por dois modos de administração:

```text
PHQ-9
[Aplicar agora] [Enviar ao paciente]

GAD-7
[Aplicar agora] [Enviar ao paciente]
```

`Aplicar agora` representa administração presencial/assistida pelo profissional durante a consulta, sem depender de celular ou WhatsApp. `Enviar ao paciente` representa administração remota/self-assessment.

O modo de administração **não muda a identidade nem a versão do instrumento** e deve reutilizar o mesmo scoring validado. A provenance futura deve distinguir pelo menos, conceitualmente:

```text
administration_mode:
  patient_self
  clinician_assisted
```

No modo assistido, as respostas continuam pertencendo ao paciente; o sistema preserva a autoria do ato profissional que administrou/registrou o instrumento e liga `appointment_id` quando houver Encounter.

## PHQ-9 — requisito futuro de segurança

Resposta positiva ao item 9 deve permanecer explicitamente visível e gerar destaque para necessidade de avaliação clínica. Esse sinal:

- não pode ser perdido no score total;
- não equivale isoladamente a diagnóstico;
- não deve inferir diagnóstico automaticamente;
- não deve gerar conduta ou prescrição automática;
- deve preservar a resposta original.

Este é um contrato futuro de segurança/apresentação; esta sincronização documental não o implementa.

## PresentationContext / Consultório

#396 separa experiência assistencial de superfícies gerenciais sem trocar conta ou autorização.

- professional: Consultório-only;
- owner/admin: Consultório + Gestão somente com identidade clínica válida + `clinical.attend`;
- recep/financeiro: Gestão-only.

No Consultório ficam superfícies assistenciais autorizadas. Financeiro global, CRM gerencial, Relatórios administrativos e Configurações ficam visualmente ocultos/protegidos pelo privacy shell.

Um owner/admin pode alternar para Gestão quando elegível; **não misturar automaticamente caixa/recebimentos globais na mesma home clínica** apenas porque a pessoa também é gestora.

Trocar contexto não muda role, RLS, JWT, tenant, capabilities, entitlements ou `canView`.

## Profissional solo

Profissional solo não recebe role sintético `solo`.

Exemplo conceitual:

- role: `owner`;
- identidade: profissão/credencial válidas;
- capabilities: atos clínicos configurados/autorizados;
- presentation: Gestão e Consultório somente se cumprir elegibilidade clínica.

A mesma conta pode administrar e atender; o privacy shell separa o foco visual sem criar uma segunda identidade.

## Limpeza residual

A generalização estrutural já aconteceu; o trabalho restante é incremental:

- remover consumidores residuais `fisio_id`/`fisioId` quando houver alternativa segura;
- não depender de `role='fisio'` em código novo;
- preservar compatibilidade de dados históricos até cutover explicitamente planejado;
- ajustar nomes físicos apenas em migration própria, com consumidores/verifiers mapeados.

Não presumir quantidade de dados ou usuários de produção para justificar um cutover.

## Critério canônico

O core permanece multiprofissional quando:

1. nenhum fluxo novo exige role de profissão;
2. owner/admin não recebem autoria clínica por gestão;
3. professional não recebe gestão por profissão;
4. `professional_id` é a referência de autoria/appointment no novo código;
5. Nexus médico avançado continua protegido pelas boundaries C-01…C-06 e `nexus.*` permanece fail-closed;
6. instrumentos clínicos multiprofissionais não exigem conceitualmente autoridade Nexus apenas porque hoje reutilizam implementação/scoring do Nexus;
7. Encounter/Assessment são compartilhados e extensíveis por ferramenta/conteúdo;
8. `ENGINE != AUTHORIZATION != RELEVANCE` é preservado;
9. PresentationContext permanece apresentação, nunca autorização;
10. relações econômicas de parceiro/repasse permanecem separadas de role.