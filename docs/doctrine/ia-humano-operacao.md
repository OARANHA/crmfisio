# Doutrina — IA, Humano e Operação

## Princípio

Conversar, operar o sistema e tomar decisões de alto impacto são responsabilidades diferentes.

Não dar a um agente acesso amplo apenas porque um único modelo consegue executar múltiplas tarefas.

## Separação de contexto

Um agente que conversa com paciente/lead deve receber apenas o vocabulário, ferramentas e dados necessários para aquela interação.

Detalhes internos como:

- nomes de tabelas;
- códigos de erro internos;
- roles técnicas;
- nomes de tools;
- UUIDs;
- payloads de provider;
- traces operacionais

não devem estar no contexto conversacional salvo quando forem genuinamente necessários para explicar algo de forma segura e traduzida ao usuário.

## Papéis funcionais

O desenho pode variar, mas deve preservar a separação:

### Converser / front desk

Responsável por diálogo externo e coleta de intenção.

Acesso mínimo a tools compatíveis com o diálogo.

### Operator

Executa operações internas autorizadas: CRM, classificação, agenda, análise operacional, resolução de fila.

Não recebe automaticamente autoridade para falar com o paciente.

### Clinical intelligence

Pode estruturar evidência, recuperar conhecimento ou apoiar raciocínio dentro das boundaries clínicas.

Não recebe por isso autoridade para assinar, prescrever, diagnosticar ou concluir ato clínico.

### Human professional / operator

Continua responsável pelas decisões que exigem autoria, consentimento, julgamento clínico ou aprovação explícita.

## Tool use

IA deve usar domain tools estreitas.

Preferir:

```text
schedule_find_slots
schedule_create_appointment
crm_get_lead
crm_move_lead
knowledge_search
handoff_request
```

Evitar:

```text
execute_sql
database_query
arbitrary_http
service_role_passthrough
```

A mesma operação de domínio deve ser reutilizada por UI/API/IA/automação sempre que possível, produzindo os mesmos eventos e side effects.

## Handoff

### IA → humano

Transferir:

- motivo;
- resumo objetivo;
- contexto relevante;
- ações já tentadas;
- bloqueio/risco;
- próximo passo sugerido;
- links/IDs internos mínimos necessários.

Não despejar conversa crua como substituto do resumo.

### Humano → IA/automação

Registrar resultado estruturado:

- resolvido;
- recontatar;
- agendado;
- perdido;
- convertido;
- corrigido;
- bloqueado;
- outro estado canônico do domínio.

## Guardrails determinísticos

Políticas críticas não podem depender apenas de prompt.

Quando aplicável, código deve vetar:

- tenant errado;
- opt-out;
- falta de consentimento/base apropriada;
- ação fora da janela/capability;
- acesso clínico indevido;
- promessa operacional impossível;
- repetição perigosa;
- ação destrutiva não confirmada;
- envio duplicado;
- uso de tool não autorizada.

## Shadow mode

Mudanças importantes de modelo, roteamento ou decision layer devem preferir fase de observação:

```text
novo decisor observa
→ divergências são medidas
→ humano/regras avaliam
→ autoridade é liberada explicitamente
```

## Knowledge, memory e clinical data

- **Knowledge** = documentos/políticas/FAQ/fontes aprovadas.
- **Memory** = aprendizados e preferências organizacionais governados.
- **Clinical data** = dado assistencial sensível com finalidade própria.

Não promover conteúdo clínico de paciente para memória organizacional ou RAG comercial automaticamente.
