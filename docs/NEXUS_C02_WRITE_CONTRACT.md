# Nexus C-02 — contrato confiável de escrita de resultados

## Escopo

Este documento registra a decisão arquitetural do C-02. Ele fecha apenas a autoridade de `module_key` / `tool_key` / `rule_key` / `rule_version` / `required_capability` na escrita de `public.nexus_clinical_results`.

Não implementa C-03/C-04/C-05, não altera psicofarmacologia, não expande o catálogo de escalas, não altera UI, não cria bypass por role e não modifica as guards de leitura do C-01 nem os helpers C-06.

## Risco confirmado na baseline C-06

Antes do C-02, os dois controles de escrita genéricos confiam no valor armazenado em `NEW.required_capability`:

- as policies `nexus_results_insert_author` / `nexus_results_update_author` chamam `has_professional_capability(required_capability)`;
- `validate_nexus_result_context()` chama `has_professional_capability(NEW.required_capability)`.

Ao mesmo tempo, `createNexusResultDraft()` envia `required_capability` diretamente do cliente. O banco não deriva essa capability de `module_key`, `tool_key`, `rule_key` e `rule_version`.

Portanto um médico que possui `nexus.access`, mas não `nexus.eem`, consegue formular na baseline um draft com identidade `eem/eem/nexus.eem/nexus-eem-2026-09-03` e declarar `required_capability='nexus.access'`. A policy e o trigger consultam a capability adulterada. O harness PostgreSQL 16 do C-02 reproduz essa escrita antes de aplicar a correção.

Há ainda um segundo drift: o trigger histórico não inclui `module_key`, `tool_key`, `rule_key` nem `rule_version` no `UPDATE OF`, então uma alteração direta somente nesses campos não passa pelo validador de contexto.

## Writers efetivos

### Writer genérico do cliente

`src/lib/nexusClinical.ts` contém `createNexusResultDraft()` e `saveNexusResultDraft()`.

- `createNexusResultDraft()` usa INSERT direto em `nexus_clinical_results` e, antes do C-02, aceita `requiredCapability` na entrada;
- `saveNexusResultDraft()` atualiza conteúdo de draft, mas um cliente Supabase autenticado não está limitado à API TypeScript e pode emitir UPDATE direto sujeito às policies.

### EEM

`finalize_nexus_eem_result()` é um writer específico. Ele já fixa no banco:

- `module_key='eem'`;
- `tool_key='eem'`;
- `rule_key='nexus.eem'`;
- `required_capability='nexus.eem'`.

O C-02 preserva esse writer. O novo contrato apenas confirma que a combinação/versionamento corresponde à capability esperada.

### Self-assessment processor

O processor atual possui somente PHQ-9 e GAD-7 e envia combinações fixas pelo código server-side:

- `scales/phq9/nexus.phq9/nexus-2026-09-03 -> nexus.scales`;
- `scales/gad7/nexus.gad7/nexus-2026-09-03 -> nexus.scales`.

A RPC `complete_nexus_self_assessment_processing()` continua operando, mas a autoridade final passa a ser o registro canônico no banco, não o JSON recebido pela função.

## Alternativas avaliadas

### A. Converter toda escrita em RPC específica

**Vantagem:** superfície de mutação muito estreita e parâmetros específicos por domínio.

**Desvantagem:** exigiria migrar o writer genérico, alterar consumidores e provavelmente reestruturar também o processor. Isso aumenta bastante a slice e se aproxima da condição de parada definida para C-02.

**Decisão:** não adotada neste PR.

### B. CHECK/allowlist estática embutida na tabela ou em funções

**Vantagem:** pequena quantidade de SQL.

**Desvantagem:** duplica mapeamentos em constraints/policies/functions, é ruim para versionamento e aumenta risco de drift entre writers.

**Decisão:** não adotada.

### C. Registro canônico versionado + resolver server-side + enforcement transversal

Criar um registro interno cujo identificador seja a combinação:

`(module_key, tool_key, rule_key, rule_version)`

Cada combinação possui exatamente uma `required_capability`. O C-02 registra somente contratos já existentes no código — EEM, PHQ-9 e GAD-7 — sem expandir funcionalidades.

Um helper server-side resolve a capability por essa chave. A mesma resolução é usada pelo trigger de contexto e pelas policies de INSERT/UPDATE.

**Vantagens:**

- uma única fonte confiável e versionada;
- protege INSERT/UPDATE direto do navegador;
- protege writers específicos sem reescrevê-los;
- desconhecido/incompatível falha fechado;
- não cria uma segunda Nexus engine;
- permite adicionar versões futuras por migration explícita.

**Decisão:** adotada.

## Contrato pós-C-02

A autorização de escrita passa a ser:

`tool/regra/versionamento conhecido -> capability resolvida no banco -> entitlement + identidade médica + grant explícito -> autoria/tenant/paciente/appointment -> escrita`

Nunca:

`cliente escolhe capability -> banco confia no valor informado`.

Regras adicionais:

1. `required_capability` é preenchida/confirmada pelo trigger a partir do registro canônico.
2. Se um caller enviar uma capability divergente, a operação falha.
3. Combinação `module/tool/rule/version` desconhecida falha.
4. Em UPDATE, identidade/versionamento do contrato e `required_capability` são imutáveis.
5. As policies autorizam usando a capability retornada pelo resolver, nunca usando a coluna como autoridade isolada.
6. Resultado `finalized` mantém a imutabilidade histórica já existente.
7. C-01 continua responsável pelo boundary de leitura Nexus e suas guards RESTRICTIVE não são alteradas.
8. C-06 continua responsável por identidade, entitlement, grants explícitos e vínculo assistencial canônico.

## Rollout fail-closed

A migration recusa o rollout se encontrar em `nexus_clinical_results` um registro existente cuja combinação não esteja entre os contratos canônicos conhecidos ou cuja `required_capability` divirja do mapeamento. Ela não inventa, normaliza nem reclassifica resultados históricos.

Se esse preflight falhar em produção, o rollout deve parar para auditoria dos registros encontrados; não se deve adicionar uma entrada ao catálogo apenas para fazer a migration passar.