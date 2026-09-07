# MedicsPro — Modelo canônico multiprofissional

## Objetivo

MedicsPro é uma plataforma clínica multiprofissional. O domínio não deve assumir que todo profissional clínico é fisioterapeuta.

Profissões iniciais suportadas pelo modelo:

- Fisioterapia
- Quiropraxia
- Psicologia
- Medicina
- Medicina com especialidade em Psiquiatria / Saúde Mental

O modelo precisa continuar extensível para outras profissões sem introduzir novos `roles` clínicos.

## Princípio central

Separar três conceitos que não podem ser confundidos:

1. **Papel operacional na clínica** — o que a pessoa administra/operacionaliza.
2. **Identidade profissional** — qual profissão, conselho, registro, UF e especialidade a pessoa possui.
3. **Capabilities clínicas** — quais atos e ferramentas o profissional pode usar no MedicsPro.

A profissão não determina, sozinha, acesso administrativo. O papel operacional não concede, sozinho, autoria clínica.

## Papel operacional canônico

Destino final:

- `owner`
- `admin`
- `professional`
- `recep`
- `financeiro`

`fisio` é legado de compatibilidade e deverá ser removido após o cutover dos usuários e consumers.

Um `owner` ou `admin` pode também ser profissional clínico pela sua identidade/capabilities, sem trocar de conta.

## Identidade profissional

A identidade profissional fica separada do papel operacional.

Campos mínimos:

- `professional_type`
- `council_type`
- `council_state`
- `registration_number`
- `specialty`

Exemplos:

| Papel | Profissão | Conselho | Especialidade |
| --- | --- | --- | --- |
| owner | physiotherapist | CREFITO | ortopedia |
| owner | physician | CRM | psychiatry |
| professional | psychologist | CRP | clínica |
| professional | chiropractor | conforme credencial aplicável | — |
| admin | null | null | null |

Psiquiatria é especialidade de Medicina, não profissão independente.

## Capabilities clínicas

Capabilities são a fonte de verdade para autorização clínica fina.

Catálogo inicial:

- `clinical.attend`
- `clinical.timeline.read`
- `clinical.evolution.write`
- `clinical.assessment.apply`
- `clinical.body_map`
- `clinical.documents`
- `nexus.access`
- `nexus.scales`
- `nexus.eem`
- `nexus.cognition`
- `nexus.calculators`
- `nexus.psychopharmacology`
- `nexus.education`
- `nexus.evidence`

Regras especiais, como Nexus médico, continuam exigindo simultaneamente entitlement da clínica + capability + identidade médica válida.

## Configuração pelo Admin da clínica

A interface não deve mostrar chaves técnicas de capability.

O Admin/Owner configura em linguagem de produto:

### Função na clínica

- Proprietário
- Administrador
- Profissional
- Recepção
- Financeiro

### Identidade profissional

- profissão
- conselho
- UF
- registro
- especialidade

### Atuação clínica

- Pode realizar atendimentos
- Pode registrar evoluções
- Pode aplicar avaliações
- Pode acessar histórico clínico
- Pode usar mapa corporal
- Ferramentas clínicas especiais, quando elegíveis

O backend deve validar combinações impossíveis e falhar fechado.

## Separação Platform Admin x Admin da clínica

### Platform Admin

Controla entitlement comercial da clínica:

- Financeiro
- CRM
- WhatsApp
- Relatórios
- Nexus
- Avaliações personalizadas
- demais módulos comerciais

### Admin/Owner da clínica

Controla quem, dentro da clínica, pode usar o que a clínica contratou.

`entitlement da clínica` + `capability do usuário` + `identidade profissional válida` formam o boundary efetivo.

## Domínio de agenda

O domínio não deve usar `fisioId` como nome canônico.

Destino:

- `professionalId` no frontend/domínio
- `professional_id` no banco

`appointments.fisio_id` pode existir apenas durante a janela de migração; não deve permanecer como conceito de negócio.

## Domínio clínico

Os nomes `physiotherapy_evaluations` e `physiotherapy_evolutions` são legado de produto e devem migrar para nomes neutros.

Destino recomendado:

- `clinical_evaluations`
- `clinical_evolutions`

Autoria sempre por `professional_id`.

O conteúdo específico por profissão deve viver em templates/engines clínicos e capabilities, não em roles distintos.

## Profissional solo

O profissional solo não ganha um role sintético `solo`.

Exemplo fisioterapeuta dono:

- role operacional: `owner`
- identidade: `physiotherapist` + CREFITO válido
- capabilities: atendimento/evolução/avaliação conforme configuração

Exemplo psiquiatra dono:

- role operacional: `owner`
- identidade: `physician` + CRM válido
- specialty: `psychiatry`
- capabilities: atendimento/evolução/avaliação + Nexus quando contratado/elegível

A mesma conta administra e atende.

## Home / Meu Consultório

A experiência é montada pelas capabilities e pelo contexto, não pelo role clínico.

O profissional que atende vê:

- agenda do dia
- próximo paciente
- atendimento em andamento
- prontuários/evoluções pendentes
- retornos

Se também for gestor, pode ver na mesma home:

- recebimentos
- cobranças pendentes
- mensagens que exigem atenção
- indicadores operacionais essenciais

Sem troca de login.

## Estratégia de cutover

Como o ambiente possui apenas dados de teste e poucos usuários, o cutover pode ser feito agora de forma estruturalmente correta.

### Fase 1 — Fundação

- introduzir role `professional`
- helper clínico genérico
- capabilities clínicas genéricas
- regras de identidade profissional
- manter bridge temporário para `fisio`

### Fase 2 — Consumers

- substituir checks `role = fisio` por capability/helper canônico
- migrar frontend para `professionalId`
- atualizar Agenda, Atendimento, Avaliações, Dashboard e Configurações

### Fase 3 — Dados e schema legado

- migrar usuários `fisio` para `professional`
- migrar `fisio_id` para `professional_id`
- migrar tabelas `physiotherapy_*` para nomes clínicos neutros
- atualizar RLS, RPCs, triggers, verifiers e testes

### Fase 4 — Remoção do legado

- remover role `fisio`
- remover helpers específicos de fisioterapia usados como autorização genérica
- remover aliases `fisioId`
- falhar CI caso novos consumers reintroduzam semântica específica de fisioterapia no core

## Critério de pronto

O core está multiprofissional quando:

1. nenhum fluxo de atendimento exige `role='fisio'`;
2. um owner médico e um owner fisioterapeuta conseguem atender com a mesma conta usada para gestão;
3. um admin sem identidade clínica não consegue autorar prontuário;
4. um profissional clínico sem permissões administrativas não ganha gestão por causa da profissão;
5. Nexus continua restrito a identidade médica válida + entitlement + capability;
6. Agenda e prontuário usam `professional` como conceito;
7. Configurações da clínica permitem gerenciar profissão, credencial e atuação clínica em linguagem humana.
