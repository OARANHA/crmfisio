# MedicsPro histórico — revisão de reaproveitamento 2026-09-16

**Fonte histórica congelada:** `OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`.
**Fonte canônica comparada:** `OARANHA/crmfisio@8b1bdbb3856f9d2c320e9dc737f4ec1263090095`.

Esta revisão complementa `MEDICSPRO_LEGACY_REUSE_MAP.md` e `PLATFORM_AND_LEGACY_GAP_AUDIT_20260911.md`. Conceitos úteis podem ser absorvidos; contratos antigos de tenancy/autorização não são portados.

## Já absorvido/evoluído

| Conceito legado                                | Estado atual                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| atendimento dedicado com paciente em contexto  | Consultório/Encounter V5, autoentrada explícita, record/finalização canônicos  |
| modelos de anamnese                            | Assessment Engine versionado + Biblioteca MedicsPro                            |
| prescrição                                     | Clinical Documents canônico, snapshot/versionamento/renderer                   |
| pedido de exames                               | Clinical Documents canônico + Encounter/renderer                               |
| termos/consentimentos como domínio próprio     | foundation canônica existente; UX ainda pode evoluir                           |
| equipe e acesso                                | RBAC/capabilities atuais substituem roles legadas                              |
| features/overrides como necessidade de produto | entitlements atuais preservam source/override sem usar plano como ACL          |
| WhatsApp como infraestrutura                   | outbox/worker/webhook/reconciliação atuais; gestão por tenant ainda incompleta |

## Reaproveitado parcialmente — ainda há valor do legado

- **Configurações da clínica:** o legado organizava identidade, configurações, horário, anamneses, prescrições, consentimentos, equipe, auditoria e integrações. O canônico tem foundations mais seguras, mas a organização final por domínio ainda está aberta.
- **Horários:** `WorkingHoursSettings` tinha semana de funcionamento e opção de agendamento fora do horário. O canônico deve absorver a intenção, com timezone/recurso/unidade e enforcement próprios.
- **Procedimentos/serviços:** o legado possuía catálogo, preço/tipo e ligação com kits. O canônico ainda precisa separar serviço operacional, ato clínico e regra financeira antes de reaproveitar essa UX.
- **Onboarding:** o wizard `Dados da Clínica -> Horário -> Concluído` era simples. O canônico já tem provisioning seguro; falta transformar aprovação em time-to-value guiado.
- **WhatsApp:** QR/pairing e status eram claros. O canônico deve reutilizar a experiência sem misturar provider global, configuração da clínica e ação operacional.

## Alto valor ainda não absorvido por completo

- **Plan Catalog / Clinic Plan Assignment:** `PlansManagerView` possuía nome, slug, preço, Price ID, limites e módulos. O atual Control Plane ainda não tem catálogo comercial versionado completo.
- **Features/limits/usage:** o legado distinguia boolean, limit e usage, com defaults e self-service. Aproveitar o conceito somente onde entitlements atuais não bastarem.
- **Subscriptions:** havia estados active/trialing/past_due/canceled/lifetime, trial, crédito/free month e detalhes de cobrança. O SaaS billing atual ainda é incompleto e deve continuar separado do financeiro paciente->clínica.
- **API Keys:** nome, organização, permissions, ambiente, expiração, webhook URL/secret, IP allowlist, last use, usage count e rate limit são ideias úteis para uma integração moderna e auditada.
- **Surveys/NPS:** feedback com NPS, frequência, recurso favorito e pedidos de novas features é útil para piloto e produto, sem misturar com prontuário.
- **Platform notifications:** segmentação global/owners/profissionais/clínica, conteúdo, action URL e preview são úteis, mas os grupos devem usar atores/capabilities canônicos.
- **Clinic plan overrides:** a tela antiga mostrava fonte `override | plan | default`; essa transparência é valiosa para o Control Plane atual.

## Rejeitar / não portar

- Vue/Pinia/Mongo/Express e contratos de tenancy antigos;
- autorização baseada apenas em UI, role ou especialidade;
- roles `medico/recepcionista/gerente` como modelo canônico;
- feature/plan paralelo ou plano como autorização clínica;
- support/platform team por membership clínica ampla;
- checkout financeiro bloqueando conclusão clínica;
- histórico clínico genericamente editável/excluível;
- mídia clínica por URL pública estática;
- HTML livre como contrato documental/assinatura;
- qualquer reaproveitamento que conceda `nexus.*` apenas para expor instrumento multiprofissional.

## Prioridade após o piloto clínico atual

1. `Enviar ao paciente` registry-driven e preparado para outros instrumentos Nexus;
2. observação/piloto real do Consultório;
3. Configurações da Clínica por domínio, incluindo horários/serviços/instrumentos/consentimentos/comunicação;
4. Plan Catalog + Clinic Plan Assignment + limits/usage;
5. WhatsApp health/configuração por tenant;
6. API Keys/integrations modernas;
7. onboarding/time-to-value, NPS e notificações de plataforma.
