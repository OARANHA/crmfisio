# Patient Registry V2 — Cadastro, responsáveis e arquivos

## Objetivo

Evoluir o cadastro de pacientes para uma experiência clínica completa, progressiva e compatível com MVD (Mínima Distribuição Visual), sem transformar o primeiro contato em um formulário excessivo.

## Princípios

- Cadastro em página própria (`/pacientes/novo`), não em modal.
- Dados essenciais primeiro; informações complementares aparecem por contexto.
- Menores de idade exigem ao menos um responsável antes da conclusão do cadastro.
- Responsáveis são entidades relacionadas, não colunas `pai`/`mae` fixas no paciente.
- Foto do paciente é opcional, privada e servida por Storage autenticado.
- Arquivos clínicos nunca usam buckets públicos.
- A clínica controla disponibilidade da função; credenciais/provedor de storage permanecem sob controle da plataforma.

## Cadastro V1

### Identificação
- foto/avatar opcional
- nome completo
- nome social/preferido opcional
- data de nascimento
- CPF opcional no primeiro contato

### Contato
- telefone / WhatsApp
- e-mail
- endereço resumido opcional

### Responsáveis
Ativado automaticamente para menores de 18 anos e disponível manualmente para adultos dependentes.

Cada responsável possui:
- nome
- parentesco/papel
- CPF
- telefone
- e-mail
- responsável legal
- responsável financeiro
- contato principal

### Convênio e contexto inicial
- convênio
- número da carteirinha
- queixa principal
- CID-10 quando aplicável
- observações administrativas
- opt-in WhatsApp

## Storage

Bucket inicial: `patient-avatars`.

- privado (`public = false`)
- caminho: `<clinic_id>/<patient_id>/avatar.<ext>`
- leitura/escrita condicionada à clínica autenticada
- avatar substituível
- documentos clínicos serão buckets separados e terão regras mais rígidas de retenção/auditoria

## Segurança

- RLS em `patient_guardians` pela `clinic_id`.
- Policies do Storage validam o primeiro segmento do caminho contra `current_clinic_id()`.
- `anon` não possui acesso ao bucket.
- Foto não é armazenada como URL pública; o banco guarda somente `avatar_path`.
- LGPD: exportação/anonymização futura deve contemplar responsáveis e avatar.

## Rollout

1. Migration aditiva cria campos, responsáveis, bucket e policies.
2. Validar RLS/Storage em staging/self-hosted Supabase.
3. Deploy frontend.
4. Testar paciente adulto, menor, troca de avatar e isolamento entre clínicas.

## Rollback

Antes de dados reais: remover policies/bucket/tabela/campos em ordem reversa.
Após uso em produção: desabilitar escrita/UI e preservar dados; não apagar responsáveis ou objetos automaticamente.
