# Nexus Clinical Engine — Onda 0 de implementação

## Objetivo

Criar a fundação técnica aditiva para o Nexus dentro do MedicsPro sem alterar contratos legados de agenda, financeiro, prontuário fisioterapêutico ou autorização existente.

Esta onda deve permitir que o MedicsPro passe a representar de forma explícita:

- profissão do integrante;
- capabilities clínicas;
- resultados determinísticos do Nexus;
- red flags clínicas;
- evidências e proveniência;
- versionamento da regra clínica;
- ligação de todo resultado a clínica, paciente, profissional e atendimento.

## Princípio de migração

**Compatibilidade antes de limpeza.**

Nesta onda NÃO fazemos:

- rename de `fisio_id`;
- remoção do role `fisio`;
- migração em massa de tabelas `physiotherapy_*`;
- troca de RLS das áreas existentes;
- mudança da lógica clínica do Nexus;
- geração automática de diagnóstico/prescrição;
- duplicação de paciente ou atendimento do MedicsPro.

## Modelo de autorização alvo

A fundação passa a reconhecer quatro dimensões distintas:

1. `role`: função organizacional/administrativa;
2. `professional_type`: profissão/registro profissional;
3. `capability`: capacidade funcional/clínica explicitamente concedida;
4. `entitlement`: recurso liberado para a clínica/plano.

Nesta onda implementamos somente o catálogo e os grants de `capability`. Entitlements continuam no mecanismo já existente do MedicsPro e serão conectados posteriormente.

## Compatibilidade transitória

Enquanto os guards antigos ainda usam `role = 'fisio'`, profissionais médicos continuam podendo usar o role clínico legado internamente. `professional_type` é a identidade profissional real e não deve ser inferido do role.

O helper server-side de capability deve seguir:

- grant explícito sempre vence o fallback;
- `owner`/`admin` não ganham autoria clínica apenas por gestão;
- o fallback legado é somente uma ponte de migração;
- capabilities médicas Nexus no fallback só são concedidas quando `professional_type = 'medico'`;
- novos módulos Nexus devem consultar capability no servidor, não confiar apenas na UI.

## Capabilities iniciais

### Core clínico

- `clinical.assessments`
- `clinical.soap`
- `clinical.patient_timeline`

### Nexus

- `nexus.access`
- `nexus.scales`
- `nexus.eem`
- `nexus.cognition`
- `nexus.calculators`
- `nexus.psychopharmacology`
- `nexus.education`
- `nexus.evidence`

## Resultado clínico canônico

Todo resultado Nexus persistido deve carregar no mínimo:

- `clinic_id`;
- `patient_id`;
- `professional_id`;
- `appointment_id` opcional;
- módulo e ferramenta Nexus;
- regra/algoritmo e versão;
- snapshot estruturado de entrada;
- snapshot estruturado de saída;
- score quando aplicável;
- classificação e gravidade;
- interpretação;
- texto de exportação ao SOAP;
- snapshot das evidências aplicadas;
- data de finalização.

Resultados finalizados são imutáveis. Correções futuras devem gerar novo registro/adendo, nunca sobrescrever a história clínica.

## Red flags

Red flags são entidades persistidas e vinculadas ao resultado que as originou. Devem possuir:

- código estável;
- severidade (`warning` ou `critical`);
- título e mensagem;
- ação sugerida/necessária;
- estado de reconhecimento;
- profissional e data do reconhecimento.

Uma red flag nunca deve desaparecer porque o código da regra mudou posteriormente.

## Evidências

O catálogo de evidências deve guardar metadados e proveniência, não apenas URLs. Resultados clínicos armazenam também snapshot das referências usadas na versão executada para auditoria histórica.

## Primeiro vertical slice após esta onda

**PHQ-9 Nexus** será o primeiro fluxo ponta a ponta:

1. profissional abre paciente real;
2. inicia PHQ-9;
3. respostas são processadas pela regra Nexus preservada;
4. resultado é persistido com versão/evidências;
5. item 9 positivo gera red flag persistente;
6. resultado aparece na timeline do paciente;
7. texto estruturado pode ser importado ao SOAP;
8. nova aplicação posterior alimenta evolução longitudinal.

## Definition of Done da Onda 0

- migration SQL aditiva e idempotente;
- zero rename/drop destrutivo;
- capabilities resolvidas server-side;
- tenant isolation em todas as tabelas clínicas novas;
- paciente/profissional/appointment validados na mesma clínica;
- resultado finalizado imutável;
- red flags auditáveis e reconhecíveis;
- evidência/versionamento preservados;
- nenhuma alteração de comportamento nas áreas legadas;
- fundação pronta para PHQ-9 sem criar um segundo prontuário ou segundo cadastro de pacientes.
