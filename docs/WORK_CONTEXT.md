# MedicsPro — Work Context

Snapshot de handoff para execução assistida por ChatGPT Work.

> **Importante:** este documento não substitui `AGENTS.md`, o código atual nem o banco real. Ele existe para reduzir perda de contexto entre chats/agentes. Se houver divergência, o executor deve inspecionar a implementação atual, identificar a causa e preservar a fonte canônica mais forte.

## 1. Fonte canônica do produto

O produto canônico é:

- **`OARANHA/crmfisio`** — MedicsPro atual, runtime oficial, destino de implementação, segurança, Supabase, frontend, migrations, Edge Functions e governança.

Dois outros repositórios devem ser tratados apenas como fontes auxiliares:

- **`OARANHA/nexus`** — upstream/laboratório de conhecimento clínico Nexus: escalas, psicofarmacologia, calculadoras, educação, evidências, regras e experimentos clínicos. Não é o runtime canônico do produto.
- **`OARANHA/medicspro`** — referência histórica de UX e workflows médicos: login, onboarding, anamnese, prescrição, exames, laudos, atestados, templates e navegação clínica. Não importar a arquitetura Vue/Mongo/Express para o produto atual.

Regra operacional:

> Qualquer feature encontrada em `OARANHA/nexus` ou `OARANHA/medicspro` deve ser comparada com `OARANHA/crmfisio` antes de qualquer implementação. Nunca criar uma segunda versão paralela de um fluxo que já exista no produto canônico.

## 2. Estado arquitetural atual

A arquitetura já foi significativamente generalizada para uma plataforma clínica multiprofissional.

Princípios canônicos:

1. papel operacional da clínica;
2. identidade profissional;
3. capabilities clínicas;
4. entitlement comercial da clínica;
5. autorização server-side.

Destino do role operacional:

- `owner`
- `admin`
- `professional`
- `recep`
- `financeiro`

`fisio` é legado de compatibilidade e não deve voltar a ser o conceito clínico genérico.

A identidade profissional é separada do role e inclui profissão, conselho, UF, registro e especialidade. Psiquiatria é especialidade de Medicina, não um role próprio.

O conceito canônico de autoria/agendamento deve ser `professional` / `professional_id` / `professionalId`. Referências `fisio_id`/`fisioId` são compatibilidade temporária e devem ser eliminadas progressivamente, sem big-bang inseguro.

## 3. Nexus já está integrado ao MedicsPro

**Não tratar o Nexus como um produto externo a integrar.**

O Nexus Clinical Engine já existe dentro de `OARANHA/crmfisio` com fundação real de frontend, banco, RLS, capabilities, entitlements, resultados versionados, red flags, evidência e contexto de paciente.

Implementações atuais relevantes incluem, entre outras:

- `src/lib/nexusClinical.ts`
- `src/lib/nexus/`
- `src/components/NexusEemPanel.tsx`
- `src/components/NexusLongitudinalPanel.tsx`
- `src/components/NexusPatientContextHub.tsx`
- `src/components/NexusPatientLauncher.tsx`
- `src/components/NexusSelfAssessmentInviteAction.tsx`
- `src/components/NexusSelfAssessmentStatus.tsx`
- `src/pages/NexusGlobalPage.tsx`
- `src/pages/NexusPatientEemPage.tsx`
- `src/pages/NexusPatientEvolutionPage.tsx`
- `src/pages/NexusPublicSelfAssessmentPage.tsx`
- migrations `*nexus*`
- Edge Functions `nexus-self-assessment-*`

O contrato canônico de resultado Nexus já registra:

- clínica;
- paciente;
- profissional;
- atendimento;
- módulo/ferramenta;
- `ruleKey` e `ruleVersion`;
- capability exigida;
- snapshot de entrada;
- snapshot de saída;
- classificação/severidade;
- interpretação;
- texto SOAP;
- snapshot de evidências;
- estado draft/finalized.

Resultados finalizados são protegidos contra sobrescrita silenciosa; a arquitetura usa autoria, contexto, RLS e regras de imutabilidade.

### Boundary Nexus

O Nexus é sensível e hoje opera em fail-closed. O acesso efetivo depende de:

`entitlement da clínica + capability + identidade médica válida`

Não liberar Nexus apenas por role, owner/admin, rota ou menu.

A implementação atual exige identidade médica/CRM válida para o boundary Nexus existente. Qualquer expansão dessa política deve ser uma decisão arquitetural explícita, não uma flexibilização acidental.

## 4. Estado funcional do Nexus

A própria implementação atual classifica os domínios aproximadamente assim:

- **EEM** — operacional;
- **Evolução longitudinal** — operacional;
- **Saúde Mental** — operacional parcial;
- **Autoavaliação segura** — operacional;
- **Evidências** — fundação ativa;
- **Psicofarmacologia** — em integração;
- **Cognição** — em integração;
- **Calculadoras clínicas** — em integração;
- **Educação em saúde** — em integração.

Portanto, a missão correta não é “criar Nexus Engine”. A missão é:

> **absorver seletivamente o que ainda existe no `OARANHA/nexus` para a engine já integrada no `OARANHA/crmfisio`.**

### Direção para psicofarmacologia

Não criar uma “Medication Engine” paralela ao Nexus. O domínio recomendado é:

`Nexus Clinical Engine -> psychopharmacology`

que pode conter progressivamente:

- catálogo de medicamentos;
- equivalências;
- switching/cross-taper;
- monitoramento;
- segurança medicamentosa;
- interações;
- ajuste contextual;
- evidências e proveniência.

A prescrição em si é um ato/documento/workflow do MedicsPro. O suporte de decisão sobre medicamentos pertence ao Nexus.

Exemplo conceitual:

`Prescrição MedicsPro -> contexto do paciente -> Nexus psicofarmacologia -> alertas/evidência -> decisão humana -> registro MedicsPro`

## 5. Repositório `OARANHA/nexus`: como usar

Antes de portar qualquer código, classificar cada recurso do upstream em quatro estados:

1. **já incorporado**;
2. **parcialmente incorporado**;
3. **ainda não incorporado**;
4. **não vale incorporar**.

A análise deve cobrir pelo menos:

- saúde mental e escalas;
- EEM;
- cognição;
- calculadoras;
- psicofarmacologia;
- antidepressant switching;
- equivalências;
- função renal;
- risco cardiovascular;
- educação contextual;
- evidências;
- geração/organização SOAP;
- regras/red flags;
- longitudinal.

Ao portar lógica clínica:

- preservar determinismo quando a regra for determinística;
- preservar versão de regra;
- registrar proveniência/evidência;
- nunca transformar IA em autoridade clínica;
- exigir revisão/autoria humana;
- criar testes clínicos de regressão;
- evitar copiar bancos estáticos sem avaliar modelagem, versão e manutenção.

## 6. Repositório histórico `OARANHA/medicspro`: como usar

Usar como referência de produto e UX, especialmente para:

- login/recuperação de senha em fluxo coeso;
- onboarding de clínica;
- atendimento médico;
- anamnese;
- prescrição;
- exames;
- laudos;
- atestados;
- documentos/termos;
- templates clínicos;
- autosave;
- organização da ficha do paciente;
- galeria clínica;
- notas separadas de evolução;
- gestão conceitual de features/planos/overrides.

Não importar:

- Mongo/Mongoose;
- Express/JWT antigo;
- Pinia/Vue;
- modelos de tenancy antigos;
- lógica de segurança antiga;
- documentos monolíticos de Clinic;
- hardcodes de plano.

O reaproveitamento correto é de fluxo, experiência, regra de domínio e conceito — reconstruídos na arquitetura atual.

## 7. Assessment Engine e Prontuário V3

O Assessment Engine já é direção estratégica do produto:

`template -> sections/components -> response -> authored clinical record -> longitudinal history`

Categorias:

- **Avaliações padrão** — curadas pelo MedicsPro;
- **Minhas avaliações** — criadas/duplicadas pela clínica/profissional.

Body map é componente clínico estruturado, não imagem decorativa.

O Prontuário V3 deve nascer multiprofissional e longitudinal. Evitar criar prontuários paralelos por profissão.

Modelo de produto desejado:

`Paciente -> Atendimento -> registros de diferentes profissões -> mesma timeline clínica`

A especialidade/profissão altera capacidades, templates e ferramentas disponíveis; não cria outro sistema.

Para Medicina, o produto poderá expor progressivamente recursos como:

- anamnese;
- exame físico;
- hipóteses/diagnóstico;
- conduta;
- prescrição;
- solicitação de exames;
- laudos;
- atestados;
- encaminhamentos;
- documentos.

O Nexus deve aparecer contextualmente nesses fluxos quando houver benefício clínico real.

## 8. Entitlements, módulos e configuração

Separar sempre:

1. **Platform entitlement** — o que o SaaS libera para a clínica;
2. **Clinic configuration** — o que owner/admin da clínica ativa/configura dentro do contratado;
3. **Professional capability** — o que um profissional pode usar;
4. **Authorization** — o que RLS/RPC/backend permite naquele contexto.

Não colapsar isso em um boolean de menu.

Exemplos de domínios comerciais:

- Financeiro;
- CRM;
- WhatsApp;
- Relatórios;
- Nexus;
- Avaliações personalizadas;
- futuros recursos premium.

A UI do administrador da clínica deve usar linguagem humana, não chaves técnicas de capability.

## 9. Financeiro

O core financeiro já foi validado para piloto controlado em vários cenários:

- atendimento avulso finalizado gera recebível idempotente;
- pacote ativo consome sessão sem cobrança avulsa;
- pacote inválido bloqueia finalização;
- baixa exige método e preserva `paid_at`/histórico;
- lançamento pago é protegido;
- valores são centavos inteiros;
- cancelamento pré-pago exige resolução financeira explícita e auditável.

Antes de criar novas features financeiras, preferir auditoria ponta a ponta do ciclo:

`Atendimento -> pacote/cobrança -> contas a receber -> pagamento -> baixa -> relatório`

Priorizar buracos de integridade antes de sofisticação.

## 10. Estado de refatoração arquitetural

O antigo `store.tsx` monolítico não deve ser recriado. O aplicativo atual já está organizado em providers/domínios separados, incluindo Auth, Agenda, Financeiro, Pacientes, Clínico, Diretório da clínica, Pacotes, Comunicação, Auditoria e Infraestrutura.

Novos domínios devem respeitar essa decomposição e evitar reintroduzir estado global centralizado sem necessidade.

## 11. Prioridade atual de produto

Objetivo: **beta controlado com profissionais reais**, não expansão indefinida do catálogo.

Ordem recomendada de execução:

1. **Prontuário Clínico V3**
   - Evoluções;
   - Avaliações;
   - Timeline clínica;
   - Body map;
   - fluxo `abrir paciente -> atender -> registrar -> finalizar`;
   - nascer multiprofissional.

2. **Fechar `professional_id`**
   - eliminar consumers residuais `fisioId/fisio_id`;
   - consolidar repository/types;
   - fazer cutover de banco apenas quando seguro.

3. **Nexus gap audit / absorção seletiva**
   - especialmente psicofarmacologia, calculadoras, cognição, educação e evidências;
   - usar a engine atual, não criar uma nova.

4. **Financeiro — auditoria do ciclo completo**
   - foco em integridade e ausência de buracos de regra de negócio.

5. **Configurações / Administração da clínica**
   - módulos usados;
   - permissões/funções;
   - capacidades clínicas;
   - equipe/profissionais;
   - unidades;
   - integrações;
   - recursos opcionais;
   - separação clara Platform Admin x Admin da clínica.

6. **Onboarding de nova clínica**
   - pedido/cadastro;
   - aprovação;
   - provisionamento;
   - primeiro owner;
   - primeiro profissional;
   - unidade;
   - agenda;
   - primeiro paciente;
   - primeiro atendimento;
   - primeiro recebimento.

7. **UX final para beta**
   - estados vazios;
   - erros;
   - loading;
   - responsividade;
   - consistência visual;
   - dark/light;
   - redução de cliques e carga cognitiva.

Não priorizar agora, sem evidência clara de necessidade:

- dezenas de features novas;
- renomeação massiva imediata de todas as tabelas legadas;
- NFS-e;
- múltiplas integrações de pagamento simultâneas;
- CRM avançado;
- telemedicina;
- automações sofisticadas fora do caminho crítico do beta.

## 12. Protocolo para ChatGPT Work

Antes de qualquer alteração significativa:

1. ler `AGENTS.md`;
2. ler este `docs/WORK_CONTEXT.md`;
3. verificar HEAD real da `main`;
4. inspecionar código e testes relevantes;
5. comparar com upstream histórico quando aplicável;
6. identificar se já existe implementação canônica;
7. explicar divergências encontradas;
8. implementar a menor slice coerente e segura.

### Git / PR

- trabalhar em branch dedicada;
- `main` é potencialmente deployável;
- abrir PR revisável;
- rodar `npm ci`, `npm test`, `npm run typecheck`, `npm run build` quando aplicável;
- não reportar conclusão ampla sem CI/checks verdes.

### Banco / servidor

- não assumir migration aplicada em produção;
- migrations sensíveis devem ter verifier;
- destacar explicitamente qualquer ação manual necessária no servidor;
- não executar mudanças destrutivas sem necessidade comprovada;
- preservar compatibilidade entre frontend publicado e banco durante rollout.

### Segurança clínica

- UI não é boundary de autorização;
- preservar RLS/RPC/server enforcement;
- autoria clínica deve permanecer explícita;
- dados finalizados não devem sofrer overwrite silencioso;
- entitlement nunca substitui autorização de dados;
- Nexus permanece sujeito à política médica/entitlement/capability canônica até decisão documentada em contrário.

## 13. Primeira missão recomendada no Work

Antes de implementar medicamentos ou ampliar Medicina, produzir uma auditoria diferencial profunda:

`OARANHA/nexus` **vs** Nexus já integrado em `OARANHA/crmfisio`.

Entregável esperado:

`docs/NEXUS_GAP_MAP.md`

Para cada domínio, registrar:

- estado atual no `crmfisio`;
- fonte equivalente no `nexus`;
- gaps reais;
- risco clínico/técnico;
- dependências;
- prioridade 80/20;
- decisão: portar / redesenhar / adiar / descartar;
- testes necessários;
- migrations necessárias, se houver;
- ordem de PRs proposta.

**Não implementar a absorção em massa no mesmo passo da auditoria.** Primeiro obter o mapa diferencial correto; depois executar slices pequenas e rastreáveis.

---

Última regra: se a solução sugerida exigir reconstruir algo que já existe no MedicsPro, parar e provar por que a implementação atual não pode ser evoluída. A preferência é sempre fortalecer o caminho canônico existente.
