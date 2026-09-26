# Doutrina — Autoridade e Fronteiras

## Regra principal

Conveniente não significa autorizado.

Toda mudança deve identificar qual domínio possui autoridade sobre o dado, a decisão e o efeito.

## Separações obrigatórias

```text
clinic_id
!= identidade escolhida pelo browser

role
!= profissão

platform entitlement
!= clinic configuration
!= user authorization
!= clinical authorization
!= encounter/resource context

Contact
!= Lead
!= Patient

commercial data
!= clinical data

provider capability
!= domain authority

AI suggestion
!= clinical decision

platform_admin
!= clinic membership
```

## Tenant

`clinic_id` é boundary server-side. UI, query param, payload ou ferramenta de IA não escolhem livremente o tenant.

Qualquer novo domínio tenant-aware precisa de estratégia explícita para:

- identidade autenticada;
- membership;
- RLS/RPC;
- service-role;
- logs;
- export/anonymization quando aplicável;
- testes cross-clinic.

## Contact, Lead e Patient

- **Contact** representa identidade comercial/comunicacional dentro do tenant.
- **Lead** representa oportunidade/processo comercial.
- **Patient** representa identidade clínica.

Uma mensagem, clique, campanha, formulário ou social identity não cria automaticamente Patient.

A conversão `Lead → Patient` deve ser explícita, auditável e idempotente, preservando vínculo sem fundir automaticamente timelines comerciais e clínicas.

## Dados comerciais e clínicos

CRM pode saber que existe Patient vinculado e exibir contexto mínimo necessário.

CRM não recebe por conveniência acesso amplo a prontuário, instrumentos, CID, evolução, documentos clínicos ou conteúdo sensível.

Dados assistenciais seguem suas próprias boundaries.

## Autorização clínica

Atos clínicos exigem a combinação aplicável de:

- usuário autenticado;
- clinic membership;
- identidade profissional;
- capability;
- autoria/relação assistencial/contexto;
- regra server-side.

Owner/admin não ganham autoria clínica pela função administrativa.

## Plataforma

Platform Admin administra o SaaS.

Acesso a um tenant ou dado clínico exige mecanismo separado, explícito, mínimo, temporário quando aplicável e auditável.

## Providers e integrações

Evolution, Meta, Google, Supabase, modelos de IA e futuros providers são implementações de capacidades.

Nenhum provider redefine automaticamente:

- entidade de domínio;
- autorização;
- ciclo de vida;
- fonte de verdade;
- política clínica.

## Gate

Antes de aprovar arquitetura, registrar:

1. qual domínio é autoridade;
2. qual boundary existente será reutilizada;
3. que dado cruza fronteiras;
4. qual dado é deliberadamente impedido de cruzar;
5. que teste prova tenant/authorization isolation;
6. como correção administrativa preserva histórico.
