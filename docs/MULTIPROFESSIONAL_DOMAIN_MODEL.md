# MedicsPro — Modelo canônico multiprofissional

**Estado em 2026-09-10.** O MedicsPro é uma plataforma clínica multiprofissional. O domínio não assume que todo profissional clínico é fisioterapeuta.

## Princípio central

Separar conceitos que não podem ser confundidos:

1. **papel operacional na clínica** — o que a pessoa administra/operacionaliza;
2. **identidade profissional** — profissão, conselho, registro, UF e especialidade;
3. **capabilities clínicas** — atos/ferramentas permitidos ao profissional;
4. **entitlement da clínica** — recursos contratados/liberados pela plataforma;
5. **autorização server-side** — decisão efetiva naquele contexto;
6. **PresentationContext** — somente apresentação/privacy shell.

Profissão não concede acesso administrativo. Papel operacional não concede autoria clínica. PresentationContext não concede nenhum dos dois.

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

Nexus médico permanece uma composição fail-closed de entitlement + capability + identidade médica válida + relação assistencial/contexto + autorização server-side.

Especialidade pode definir relevância de ferramenta; não é atalho de autorização.

## Configuração da clínica

Owner/admin deve configurar pessoas em linguagem de produto, sem expor chaves técnicas quando não necessário:

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

## Assessment

Avaliações padrão e modelos próprios continuam no mesmo Assessment Engine versionado/autorado. Body map é componente clínico estruturado. A profissão/especialidade determina aplicabilidade/conteúdo, não cria outra engine.

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
5. Nexus continua médico-only pelas boundaries reais;
6. Encounter/Assessment são compartilhados e extensíveis por ferramenta/conteúdo;
7. PresentationContext permanece apresentação, nunca autorização;
8. relações econômicas de parceiro/repasse permanecem separadas de role.