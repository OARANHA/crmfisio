# MedicsPro — Prescription Renderer V2 (D2-B.2C)

> Renderer visual seguro e versionado para `medication_prescription`. A apresentação pode evoluir sem transformar template em HTML arbitrário e sem alterar receitas já emitidas.

## Objetivo

Fechar o gap observado no smoke real de Prescrição: o lifecycle clínico estava correto, mas a impressão era funcional e visualmente simples.

A D2-B.2C torna a mesma definição visual autoridade para:

```text
Admin preview
      ↓
render_definition publicado
      ↓
Draft live preview
      ↓
issue
      ↓
template_definition_snapshot
      ↓
Issued print
```

Princípios:

```text
PREVIEW == PRINT CONTRACT
TEMPLATE MANAGEMENT != CLINICAL AUTHORSHIP
ISSUED DOCUMENT != CURRENT TEMPLATE
```

## O que foi reaproveitado do MedicsPro histórico

Referência revisada:

`OARANHA/medicspro@0fd709612598fa93a9cf0517b9ba924b1405ec83`

UX madura aproveitada conceitualmente:

- biblioteca de modelos;
- escolha de modelo antes da prescrição;
- clínica/profissional/paciente no documento;
- medicamentos estruturados;
- observações;
- assinatura visual;
- visualização antes da impressão;
- modelos diferentes por contexto/especialidade.

Não reaproveitado:

- substituição textual de `{{variáveis}}` em HTML;
- `v-html` como renderer;
- HTML/CSS arbitrário administrável;
- documento histórico reconstruído a partir do template corrente.

## Contrato visual fechado

Layout:

```text
clinical-document/prescription-v2
```

Presets V1:

- `classic`
- `institutional`
- `compact`

Acentos permitidos:

- `monochrome`
- `navy`
- `emerald`

Medicamentos:

- `numbered`
- `cards`

Configuração permitida:

```json
{
  "layout": "clinical-document/prescription-v2",
  "preset": "institutional",
  "accent": "navy",
  "title": "Receita médica",
  "medication_style": "cards",
  "show_clinic_address": true,
  "show_clinic_phone": true,
  "show_patient_birth_date": true,
  "show_specialty": true
}
```

Qualquer chave extra ou valor fora do enum falha fechado no PostgreSQL.

## Administração

Owner/admin ativos continuam sendo os únicos gestores de templates do tenant via boundary D2-B.2A.

A D2-B.2C adiciona:

`save_clinic_prescription_template_presentation(...)`

A RPC:

- exige manager canônico do tenant;
- aceita somente template clinic-owned ativo da clínica atual;
- valida o renderer fechado;
- atualiza metadados;
- publica nova versão somente quando `render_definition` muda;
- não concede capacidade de emitir prescrição;
- não permite editar template platform diretamente.

## Imutabilidade

Ao emitir uma nova receita, o documento congela:

- `payload_snapshot`;
- `context_snapshot`;
- `template_definition_snapshot`;
- `template_version_id`;
- `rendered_snapshot` textual de auditoria.

O `template_definition_snapshot` inclui a `render_definition` usada na emissão. A impressão histórica lê essa definição congelada, nunca o template atual.

Exemplo:

```text
Template clinic v2 = institutional/navy
→ Receita A emitida
→ snapshot guarda v2 + renderer institutional/navy

Admin publica v3 = compact/emerald
→ novas receitas usam v3
→ Receita A continua institutional/navy
```

## Contexto congelado para impressão

Novas emissões congelam também os dados de apresentação necessários:

- paciente: nome + nascimento;
- clínica: nome + endereço + telefone;
- profissional: nome + tipo profissional + conselho/UF/registro;
- appointment;
- Encounter record;
- horário de emissão.

Esses dados são presentation context. Autorização continua vindo do boundary clínico D2-A.

## Renderer frontend compartilhado

`src/lib/prescriptionPrintRenderer.ts`

É a única composição visual V2 usada por:

1. visualização administrativa;
2. live preview do rascunho;
3. impressão do documento emitido.

Todo texto dinâmico é escapado antes de entrar no HTML estático de impressão. O admin não fornece HTML, CSS ou JavaScript.

A prévia em tela usa `iframe srcDoc` sandboxed e sem script. O único script gerado é o `window.print()` controlado pelo próprio código para a janela de impressão de documento já emitido.

## Compatibilidade histórica

Versões antigas `clinical-document/plain-text-v1` permanecem válidas e imutáveis.

No frontend, versões antigas recebem fallback visual seguro `classic + monochrome + numbered`; não são reinterpretadas como HTML legado.

`rendered_snapshot` + `renderer_version = d2-a/plain-text-v1` continuam preservados como snapshot textual de auditoria. O visual V2 é governado pelo `render_definition` congelado no template snapshot.

## Templates MedicsPro iniciais

A migration evolui/adiciona presets platform:

- Receita simples → `classic / monochrome`;
- Receita com orientações → `institutional / navy`;
- Receita compacta → `compact / emerald`.

Templates platform continuam somente leitura; admin pode duplicar para o tenant e adaptar a cópia.

Não adicionar `Pedido de Exames` nesta família enquanto `exam_order` não existir como document type canônico.

## Gates

D2-B.2C deve provar:

- PostgreSQL 16 do renderer V2;
- regressão D2-B.2A;
- regressão D2-A;
- reconciliação de autorização/care relationship;
- HTML arbitrário rejeitado;
- cross-tenant negado;
- profissional não ganha gestão administrativa;
- admin não ganha autoria clínica;
- versão visual nova não altera documento emitido;
- preview/print usam o renderer compartilhado;
- unit tests, typecheck, lint e build.

## Rollout

A migration é manual/controlada.

```text
PR mergeada
!=
migration aplicada
!=
frontend validado em produção
```

Depois de merge:

1. backup conforme runbook;
2. aplicar migration pinada ao SHA mergeado;
3. executar verifier oficial;
4. redeploy frontend;
5. smoke como admin: editar/visualizar modelo da clínica;
6. smoke como médico: criar draft, conferir preview, emitir e imprimir;
7. confirmar que a impressão corresponde ao preset visual emitido;
8. somente então marcar D2-B.2C `VALIDADO EM PRODUÇÃO`.