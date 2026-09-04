# MedicsPro — migração para modelo profissional multiprofissional

**Status:** arquitetura aprovada para implementação incremental  
**Escopo:** remover o acoplamento estrutural entre autorização clínica e a profissão fisioterapia sem quebrar o sistema atual.

## 1. Diagnóstico

O MedicsPro já possui partes genericamente modeladas (`professional_id`, assessment engine, clinic_id), porém o núcleo histórico ainda acopla atividade clínica ao papel `fisio` e a nomes de contrato como `fisio_id` e tabelas `physiotherapy_*`.

Exemplos atuais:

- `public.profiles.role` contém `fisio` como único papel assistencial;
- `isClinicalRole()` considera apenas `fisio`;
- `appointments.fisio_id`, recorrências e comissões ainda usam nomenclatura fisioterapêutica;
- RPCs de recorrência autorizam explicitamente `role = 'fisio'`;
- RLS de avaliações/evoluções históricas exige `current_app_role() = 'fisio'`;
- o assessment engine mais novo já usa `professional_id`, mas suas políticas ainda exigem `fisio`;
- tabelas históricas `physiotherapy_evaluations` e `physiotherapy_evolutions` continuam sendo contratos ativos.

A troca direta de `fisio` por `professional` seria uma migração insegura e de alto impacto.

## 2. Modelo alvo

Separar quatro dimensões:

1. **Clinic role** — função organizacional: `owner`, `admin`, `professional`, `recep`, `financeiro`;
2. **Profession** — profissão regulamentada/atuação: `physician`, `physiotherapist`, `psychologist`, `nutritionist`, etc.;
3. **Capability** — autorização funcional específica: `clinical.record.write`, `clinical.assessment.execute`, `nexus.eem`, `nexus.psychopharmacology`, etc.;
4. **Entitlement** — módulo contratado/habilitado para a clínica: `nexus`, `finance`, `whatsapp`, etc.

Regra central:

> Role não deve codificar profissão. Profissão não deve conceder acesso sozinha. Capability e RLS devem proteger atos sensíveis.

## 3. Estratégia de migração

### Fase A — camada de compatibilidade

Sem renomear colunas/tabelas existentes:

- introduzir `profession` no perfil profissional;
- introduzir funções server-side de autorização clínica (`current_profession()`, `has_capability(...)` ou equivalente canônico);
- manter `fisio` funcionando como legado durante a transição;
- mapear fisioterapeutas existentes para `profession = 'physiotherapist'`;
- não remover `fisio_id` ainda.

### Fase B — autorização orientada a capability

Migrar gradualmente RLS/RPCs de:

```sql
current_app_role() = 'fisio'
```

para uma checagem clínica canônica que valide:

- usuário ativo;
- mesma `clinic_id`;
- papel/capability assistencial;
- autoria quando aplicável;
- profissão quando o recurso é restrito a determinada profissão;
- entitlement da clínica para módulos pagos/restritos.

A interface nunca substitui essa checagem.

### Fase C — contratos genéricos

Novos contratos devem usar `professional_id`.

Contratos legados como `appointments.fisio_id` devem ser tratados com compatibilidade antes de qualquer rename físico. Opções aceitáveis incluem:

- alias/adapters no repository;
- view compatível;
- coluna nova com backfill e período de dual-read/dual-write, se realmente necessário;
- migração final somente após todos os consumidores estarem identificados.

Nunca executar rename destrutivo de `fisio_id` em uma única migration.

### Fase D — prontuário clínico unificado

O assessment engine genérico (`clinical_assessments`) deve ser a base prioritária para novos instrumentos.

As tabelas `physiotherapy_evaluations` e `physiotherapy_evolutions` devem permanecer como histórico/contrato legado até existir plano explícito de migração para um prontuário multiprofissional versionado.

Nexus não deve gravar em um prontuário paralelo.

## 4. Ordem de implementação recomendada

1. inventário automático/manual de consumidores de `fisio`, `fisio_id`, `physiotherapy_*`;
2. adicionar `profession` e metadados profissionais sem alterar autorização vigente;
3. criar helper server-side canônico de profissional clínico;
4. migrar assessment engine para helper genérico;
5. migrar fluxo de atendimento/agenda;
6. migrar recorrência e conflitos;
7. revisar comissões e relatórios;
8. só então considerar normalização física de nomes legados.

## 5. Critérios de segurança

Cada fase deve testar no mínimo:

- profissional autorizado da mesma clínica;
- profissional sem capability;
- profissão incompatível com recurso restrito;
- owner/admin sem autorização clínica de escrita;
- recepção/financeiro;
- perfil inativo;
- usuário de outra clínica;
- usuário anônimo;
- tentativa de atribuir ato clínico a outro profissional.

Qualquer regressão cross-tenant é P0.

## 6. Compatibilidade com o Nexus

O Nexus entra sobre o modelo alvo, não sobre `role = 'fisio'`.

Exemplos de capabilities futuras:

- `clinical.assessments.execute`
- `clinical.record.write`
- `nexus.access`
- `nexus.scales`
- `nexus.eem`
- `nexus.meem`
- `nexus.egfr`
- `nexus.cv_risk`
- `nexus.psychopharmacology`
- `nexus.metabolic_monitoring`

Ferramentas médicas restritas devem exigir profissão/capability adequada no servidor, além do entitlement da clínica.

## 7. Não fazer

- não adicionar `medico` como mais um role equivalente a `fisio` e repetir o problema;
- não duplicar tabelas por profissão;
- não confiar em menu oculto para proteger recurso clínico;
- não renomear em massa `fisio_id` sem camada de compatibilidade;
- não migrar dados clínicos históricos sem rollback, reconciliação e verificação de autoria;
- não alterar a lógica clínica do Nexus durante essa migração de identidade.
