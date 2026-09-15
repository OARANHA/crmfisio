# MedicsPro — Estado efetivo e trajetória de produto

**Reconciliação:** 2026-09-15
**Árvore auditada:** equivalente a `main@91213008fcc3774b914540a20859b689db4c0922`
**Critério:** runtime/código + schema/backend + evidência de produção prevalecem sobre roadmap histórico.

Este documento existe porque `CURRENT_STATE`, `TODO` e `PRODUCT_ROADMAP` acumulam snapshots de momentos diferentes. Quando houver conflito, não considerar uma feature entregue apenas por existir uma tela, nem considerar aberta uma feature que já possua contrato/runtime/produção comprovados.

## Legenda

- **PROD** — implementado e observado/validado em produção.
- **PROD / fail-closed** — contrato instalado em produção, mas deliberadamente desabilitado até configuração/smoke humano.
- **IMPLEMENTADO** — runtime existe; ainda falta evidência operacional/piloto suficiente.
- **ABERTO** — lacuna real atual.

## 1. Fundação SaaS e autorização — PROD

- multi-tenant por clínica com Auth/RLS e boundaries server-side;
- roles canônicos `owner`, `admin`, `professional`, `recep`, `financeiro`;
- `platform_admin` separado do domínio tenant;
- role separado de profissão; `professional_id` é a direção clínica canônica;
- entitlement, configuração de clínica, authorization/capability e contexto de recurso são camadas distintas;
- provisioning de clínica, lifecycle, audit log e shell de Platform Admin existem;
- entitlements atuais incluem Nexus, Financeiro, CRM, Relatórios, avaliações customizadas e WhatsApp.

## 2. Fluxo clínico principal — PROD

O fluxo efetivo hoje é:

```text
Paciente → Agenda → Encounter/Consultório → Registro → Evolution oficial → Financeiro/continuidade
```

Entregue e em produção:

- Clinician Daily Home e Agenda role-aware;
- Encounter Record editável por atendimento, com revisão humana e finalização transacional;
- Consultório/Gestão Privacy Shell;
- Consultório V5 com contexto persistente, navegação por tarefa e prontuário longitudinal em drawer;
- Assessment Engine versionado, com drafts/resume/finalização e biblioteca inicial;
- visual hierarchy, Visual Comfort System e Typography Comfort Pass para uso prolongado;
- branding público MedicsPro multiprofissional.

Composição atual do Encounter:

```text
Registro | Avaliações | Instrumentos | Prescrição* | Exames* | Documentos | Nexus
```

`*` visibilidade por relevância; autorização continua server-side.

## 3. Ferramentas clínicas e documentos — PROD

Clinical Documents D2-A está operacional com lifecycle versionado/imutável e snapshot de emissão. Em produção existem:

- Prescrição;
- Orientação terapêutica;
- Pedido de Exames;
- Encaminhamento externo;
- Encaminhamento interno + continuidade operacional;
- políticas de fluxo de encaminhamento por clínica.

Assessment Library V1 já contém pelo menos Anamnese Médica Geral e Anamnese Psiquiátrica.

Nexus permanece engine especializada, fail-closed e sem poder implícito sobre o prontuário. C-01–C-06 estão integrados ao runtime MedicsPro.

## 4. Instrumentos clínicos — estado efetivo

A sequência antiga `foundation → clinician-assisted → UI` já foi ultrapassada.

Hoje existem:

- PHQ-9 e GAD-7 clinician-assisted com persistência neutra imutável, provenance e scoring compartilhado;
- workspace `Instrumentos` no Encounter com `Aplicar agora` click-first;
- safety signal do PHQ-9 item 9 preservado server-side;
- PHQ-15 adicionado ao mesmo caminho canônico.

PHQ-15 está **PROD / fail-closed**: migration, verifier e engine estão instalados, mas nenhuma clínica foi habilitada automaticamente. Falta habilitação explícita de tenant + primeiro smoke humano autenticado.

## 5. Financeiro — foundation forte, maturidade operacional parcial

Já existe o ciclo estrutural:

```text
Atendimento finalizado → pacote/cobrança → contas a receber/pagamento → baixa/resolução → relatórios
```

Efetivo hoje:

- criação de efeito financeiro coerente após finalização;
- separação entre finalização clínica e falhas esperadas de cobertura;
- `appointment_financial_exception` para pacote esgotado/expirado/não elegível;
- resolução auditável `CHARGE`/`WAIVE` conforme role;
- guards de integridade, histórico de status e `paid_at`;
- pacotes e consumo vinculados ao atendimento;
- repasses/comissões com fechamento e baixa existentes no runtime.

A operação `CHARGE`/`WAIVE` já foi provada em produção dentro de transações com rollback, inclusive idempotência e ausência de resíduos. A exceção real `package_exhausted` remanescente continua sendo decisão econômica da clínica, não dúvida técnica.

Ainda abertos por evidência de negócio: pagamento parcial, múltiplos meios, caixa/conciliação, NFS-e/recibos e configuração auditável de parceria/repasse por profissional/procedimento.

## 6. Comunicação / WhatsApp — foundation operacional

Outbox, worker, webhook, reconciliação, templates/mensagens e observabilidade existem. O gap principal é evoluir a configuração/health por tenant/provider e consolidar o modelo de administração SaaS versus administração da clínica.

## 7. Platform Admin / control plane — foundation entregue, produto comercial incompleto

Existe hoje:

- shell separado;
- lifecycle de clínica;
- provisioning server-authoritative;
- audit log;
- entitlements com source/intervalo e override explícito;
- páginas de visão geral, módulos, onboarding, governança, comercial e receita;
- automações/health básicos.

Ainda não considerar entregue:

- catálogo versionado de planos;
- plan assignment/trial/subscription como domínio comercial completo;
- limites/usage reconciliados por tenant;
- ledger de assinatura SaaS e gateway de cobrança;
- equipe/delegação do Platform Admin com capabilities próprias;
- support/break-glass temporário e auditado;
- provider health detalhado por tenant/instância;
- gestão moderna de API keys/integrações.

A auditoria histórica de 2026-09-11 continua válida como direção: absorver conceitos operacionais maduros do MedicsPro antigo sem portar Vue/Pinia/Mongo/Express, tenancy antiga ou autorização frontend.

## 8. Beta / evidência operacional

Fechado tecnicamente:

- pós-finalização real do Encounter Record;
- verifier #388 × #389;
- operability check read-only do beta;
- smoke público/mobile do privacy shell;
- prova server-side dos perfis de apresentação;
- visual profissional desktop do Modo Consultório;
- Visual Comfort + Typography Comfort + branding em produção.

Permanece aberto como evidência/piloto, não como foundation estrutural:

- smoke visual autenticado de owner/admin clínico em Gestão ↔ Consultório;
- smoke visual autenticado de recepção/financeiro quando houver ator real apropriado;
- smoke autenticado mobile do Consultório;
- observação de profissionais reais usando Agenda → Encounter → conclusão durante trabalho normal;
- decisão econômica e resolução real da exceção `package_exhausted` existente;
- primeiro tenant que optar por habilitar PHQ-15 e executar `Aplicar agora` real.

Não fabricar usuários/roles ou atos clínicos apenas para pintar checklist de verde.

# Trajetória recomendada

## Fase A — agora: ergonomia do profissional + fechamento de piloto

1. Autoentrada segura no Modo Consultório após ação explícita de iniciar/continuar o próprio Encounter.
2. Medir cliques, tempo e fricções reais no fluxo de atendimento.
3. Adicionar **Cobertura deste atendimento** por read model/RPC contextual, sem expor Financeiro global.
4. Implementar correção/adendo auditável para Encounter Record finalizado.
5. Melhorar histórico neutro de instrumentos clinician-assisted sem abrir leitura direta do ledger.
6. Unificar UX de Instrument Delivery: `Aplicar agora` e `Enviar ao paciente`, mantendo boundaries distintos.

## Fase B — configuração clínica/operacional

1. consolidar Configurações da Clínica por domínio;
2. serviços/procedimentos, duração, recursos e unidades;
3. Biblioteca MedicsPro × Minhas avaliações sobre o Assessment Engine existente;
4. instrumentos, documentos, consentimentos e protocolos com configuração real/enforced;
5. configuração financeira/parcerias com effective dates e auditoria.

## Fase C — control plane vendável

1. Plan Catalog + Clinic Plan Assignment V1;
2. trial/subscription e limites/usage derivados do contrato comercial;
3. overrides explícitos sem transformar override em plano;
4. billing SaaS separado do financeiro paciente→clínica;
5. health de providers/WhatsApp por tenant;
6. delegação de equipe MedicsPro e suporte deny-by-default.

## Fase D — maturidade após evidência do piloto

- pagamentos parciais/múltiplos meios, caixa e conciliação;
- recibos/NFS-e quando o mercado alvo justificar;
- relatórios avançados e inteligência operacional;
- automações adicionais por evidência de ROI;
- integrações externas somente com boundary, observabilidade e ownership claros;
- timezone por clínica antes de expansão geográfica que exija múltiplos fusos.

# Gaps técnicos residuais

- limpar consumidores de `fisio_id` somente com reconciliação dedicada; não substituir silenciosamente boundaries ainda vigentes;
- resolver estados tri-state de capability/configuração onde `unknown` possa ser confundido com enabled/disabled;
- reduzir bundle/chunks grandes quando profiling justificar impacto real;
- preservar `PresentationContext != authorization`;
- preservar `ENGINE != AUTHORIZATION != RELEVANCE`;
- preservar documento emitido como snapshot imutável da versão usada na emissão.

# Próxima slice escolhida

**Encounter Auto-Entry to Consultório V1.**

Motivo: reduz atrito imediatamente para owner/admin clinicamente elegível, exige zero mudança de RLS/schema/lifecycle e fecha um residual explicitamente documentado desde #396. A transição deve ocorrer somente após ação explícita de iniciar/continuar o próprio Encounter e passar pelo `PresentationContextProvider`, que já impede selecionar `clinical` quando o ator não é elegível.
