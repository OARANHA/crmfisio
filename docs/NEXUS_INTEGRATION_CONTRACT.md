# MedicsPro ↔ Nexus Clinical Engine — contrato de integração

**Status:** contrato arquitetural inicial para integração do Nexus ao MVD médico

## 1. Objetivo

Integrar o Nexus ao MedicsPro preservando:

- identidade própria do Nexus;
- comportamento clínico validado;
- paciente e prontuário canônicos do MedicsPro;
- tenant isolation/RLS;
- autoria clínica;
- evidência e versionamento;
- capacidade de evolução independente de UI e infraestrutura.

Princípio:

> O Nexus fornece inteligência clínica. O MedicsPro fornece identidade, contexto do paciente, persistência, prontuário, agenda, comunicação, auditoria e governança SaaS.

## 2. Limites de responsabilidade

### MedicsPro é canônico para

- usuário autenticado;
- clínica (`clinic_id`);
- profissional e profissão;
- paciente;
- consulta/agendamento;
- prontuário/timeline;
- consentimentos;
- anexos;
- WhatsApp;
- entitlement e configuração da clínica;
- auditoria e segurança.

### Nexus é canônico para

- definição e execução de lógica clínica Nexus;
- scores e thresholds Nexus;
- EEM/MEEM Nexus;
- calculadoras clínicas Nexus;
- psicofarmacologia Nexus;
- red flags e regras determinísticas Nexus;
- textos/evidências associados às regras clínicas;
- transformação determinística de resultado em blocos estruturados para revisão clínica.

## 3. Regra de ouro

Nexus não cria paciente, clínica ou usuário próprios dentro do MedicsPro.

Todo módulo recebe um contexto explícito semelhante a:

```ts
interface NexusClinicalContext {
  clinicId: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  profession: string;
  locale: 'pt-BR';
}
```

O frontend não é autoridade para validar `clinicId`, `professionalId`, profissão ou capabilities. Escritas sensíveis devem ser validadas server-side/RLS/RPC.

## 4. Saída clínica padrão

Todo módulo Nexus integrável deve poder produzir resultado estruturado, não apenas texto renderizado.

Contrato conceitual:

```ts
interface NexusResult {
  engine: 'nexus';
  moduleId: string;
  moduleVersion: string;
  evidenceVersion?: string;
  status: 'completed' | 'incomplete' | 'alert';
  score?: number | null;
  severity?: string | null;
  flags: NexusFlag[];
  structuredData: Record<string, unknown>;
  recordExports: NexusRecordExport[];
  evidenceRefs: string[];
  calculatedAt: string;
}

interface NexusFlag {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

interface NexusRecordExport {
  target: 'subjective' | 'objective' | 'assessment' | 'plan' | 'timeline';
  label: string;
  content: string;
  structuredData?: Record<string, unknown>;
}
```

Esse contrato não autoriza o sistema a assinar automaticamente o registro. O profissional revisa o conteúdo antes da incorporação/finalização quando se tratar de ato clínico.

## 5. Persistência

Resultados clínicos devem preservar pelo menos:

- `clinic_id`;
- `patient_id`;
- `professional_id`;
- `appointment_id` quando houver;
- identificador do módulo Nexus;
- versão da lógica/regra;
- versão/referência de evidência quando aplicável;
- input clínico necessário para auditoria/reprodução, respeitando minimização de dados;
- resultado estruturado;
- flags/red flags;
- timestamps;
- estado draft/finalized quando integrar prontuário.

Não persistir somente HTML, screenshot ou texto concatenado quando houver significado clínico estruturado.

## 6. Avaliações e escalas

O `clinical_assessments` do MedicsPro deve ser preferido como infraestrutura comum para escalas/questionários quando o modelo couber no assessment engine.

Para escalas Nexus:

- o template MedicsPro pode descrever campos e UX;
- a versão Nexus define o algoritmo/score clínico;
- o resultado precisa registrar a versão do algoritmo;
- instrumentos licenciados devem respeitar condições de uso/distribuição;
- autoaplicação pelo paciente deve terminar vinculada ao mesmo paciente/assessment, nunca em cadastro paralelo.

## 7. SOAP / prontuário

Nexus não mantém SOAP independente no produto final.

Capacidades do Nexus devem oferecer exportação contextual para o prontuário MedicsPro.

Diretriz:

- **S** permanece prioritariamente narrativo e sob autoria clínica;
- **O** pode receber resultados estruturados, EEM, medidas e scores;
- **A** pode receber estratificação/resultado determinístico para revisão;
- **P** pode receber sugestões/planos estruturados permitidos pelo módulo, sempre revisáveis;
- qualquer red flag crítica deve permanecer visível mesmo se o profissional não importar o texto para o SOAP.

## 8. Red flags

Alertas Nexus devem ser objetos estruturados e possuir código estável.

Exemplo:

```ts
{
  code: 'PHQ9_ITEM9_POSITIVE',
  severity: 'critical',
  message: 'Resposta positiva em item de risco.'
}
```

A aplicação pode mudar apresentação visual, mas não pode suprimir silenciosamente um alerta clínico obrigatório definido pelo Nexus.

## 9. Evidências

Cada módulo Nexus deve possuir metadados de proveniência suficientes para responder:

- qual regra foi usada?;
- qual versão?;
- quais referências sustentam a regra?;
- quando foi revisada?;
- houve alteração desde o resultado histórico?

Resultados históricos continuam vinculados à versão usada naquele momento.

## 10. Autorização

Acesso Nexus é composto por:

`tenant membership + active profile + clinic entitlement + profession/capability + resource-specific authorization`.

Exemplos:

- PHQ-9 pode ser permitido a diferentes profissões conforme política clínica;
- EEM pode ser habilitado a grupos profissionais definidos;
- psicofarmacologia médica deve possuir capability e profissão compatíveis;
- platform admin não recebe acesso clínico implícito.

## 11. Estratégia de migração do repositório Nexus

Para cada módulo:

1. identificar implementação Nexus de referência;
2. listar inputs, outputs, regras, thresholds, alertas e evidências;
3. criar fixtures/golden cases antes da migração;
4. extrair lógica clínica de apresentação quando necessário;
5. adaptar somente interfaces de contexto/persistência;
6. integrar ao MedicsPro;
7. comparar resultados Nexus original vs. MedicsPro;
8. validar UX, segurança e RLS;
9. marcar módulo como `parity_verified` somente após equivalência.

## 12. Definition of Done por módulo Nexus

Um módulo só é considerado integrado quando:

- usa paciente real do MedicsPro;
- respeita tenant e autorização server-side;
- mantém versão da regra clínica;
- possui equivalência com casos de referência;
- persiste resultado estruturado;
- integra histórico/timeline;
- consegue exportar para o prontuário quando aplicável;
- red flags estão preservadas;
- loading/error/empty states funcionam;
- não depende de demo patient/local state como fonte canônica;
- não duplicou infraestrutura já existente no MedicsPro.

## 13. Primeira sequência de integração

1. escalas clínicas + assessment engine;
2. histórico/evolução longitudinal;
3. autoaplicação segura;
4. EEM;
5. MEEM/cognição;
6. eGFR;
7. risco cardiovascular;
8. psicofarmacologia e monitoramento metabólico;
9. educação contextual;
10. demais capacidades Nexus.

A ordem pode mudar por dependência técnica, mas nunca por simples facilidade visual.
