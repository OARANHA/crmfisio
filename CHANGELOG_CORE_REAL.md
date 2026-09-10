# Core Real — release notes

## 2026-09-10 — Multiprofessional clinical runtime / Encounter / privacy shell

### Multiprofessional clinical foundation

- Consolida os papéis operacionais `owner`, `admin`, `professional`, `recep` e `financeiro`, mantendo `platform_admin` fora do domínio interno das clínicas.
- Consolida `role != profissão` e `professional_id` como referência clínica canônica; `fisio_id` permanece somente como compatibilidade onde ainda existir fisicamente.
- Mantém identidade clínica, capability, autoria/relação assistencial e autorização server-side como requisitos independentes do papel administrativo.

### Nexus hardening C-01–C-06

- Consolida Nexus como engine clínica especializada integrada ao runtime MedicsPro.
- `OARANHA/nexus` permanece upstream/lab, não segundo runtime.
- Gates C-01–C-06 fecham RLS, write contract, lifecycle, clinical record e authorization com comportamento médico-only/fail-closed.

### Home, Agenda e Encounter UX

- #390 entrega Clinician Daily Home com foco no próprio dia e sem transformar dashboard clínico em financeiro global.
- #391 entrega Agenda Role-Aware V4 e comandos alinhados ao ator/appointment correto.
- #392 estabelece Clinical Encounter UX V4 com resolver canônico do atendimento ativo, sessão exata, assessment/evolution e finalização protegida.
- #393 reconcilia o MedicsPro histórico como referência de ergonomia e evolui o Encounter V4.1 sem importar arquitetura/autorização legadas.

### Encounter Clinical Record

- #394 cria o Encounter Record como unidade editável do novo atendimento: motivo/demandas, HDA/história atual, achados/exame, avaliação clínica/problemas, plano/conduta e observações.
- O profissional registra uma vez; após revisão e confirmação humana, o sistema materializa a Evolution oficial determinística e finaliza o appointment.
- Não existe uma segunda Evolution universal obrigatória no novo fluxo.
- Finalized Encounter Record é histórico; correção/adendo auditável permanece slice futura.
- A migration #394 foi aplicada em produção em 2026-09-10.
- O production-safe verifier de #395 passou com `VERIFY #394 PRODUCTION OK`, sem fixtures ou escrita de dados de aplicação.
- O verifier comportamental separado preserva os 34 cenários isolados de CI.

### Finalização clínica e financeiro

- #388 separa sucesso clínico de falhas **esperadas** de cobertura.
- `package_exhausted`, `package_expired` e `package_not_eligible` passam a gerar `appointment_financial_exception` sem apagar uma finalização clínica válida e sem consumo gratuito silencioso.
- Falhas financeiras inesperadas de integridade continuam fail-closed/atômicas.
- #389 adiciona resolução explícita: owner/admin `CHARGE|WAIVE`, financeiro `CHARGE`, recep/professional sem resolução.
- Parceiro/repasse não é role nem autorização.
- O verifier histórico #388 ainda contém uma assertion sobre ausência da RPC criada posteriormente pelo #389; essa assertion ficou obsoleta para o schema atual e deve ser versionada/atualizada antes de reutilização direta.

### Consultório / Gestão

- #396 adiciona `PresentationContext = clinical | management` como privacy/presentation shell.
- `presentationContext != authorization`: não altera role, JWT, tenant, RLS, capabilities, entitlements ou `canView`.
- Professional permanece Consultório-only; owner/admin só alternam Consultório/Gestão com identidade clínica válida + `clinical.attend`; recep/financeiro permanecem Gestão-only.
- Consultório oculta Financeiro global, CRM gerencial, Relatórios administrativos e Configurações, mantendo URLs sob os guards reais.
- Preferência local é isolada por `user_id + clinic_id`.
- Autoentrada automática no Consultório permanece deliberadamente futura.

### Evidência operacional ainda aberta

- O smoke real do draft #394 comprovou persistência do Encounter Record, preservação após refresh/navegação e revisão observada; antes da finalização o cenário possuía 1 record, 0 Evolutions, 0 payments e 0 financial exceptions.
- Este changelog não declara a comprovação read-only pós-finalização do mesmo smoke sem evidência posterior no repositório.
- Smoke real de `CHARGE`/`WAIVE` do #389 também permanece pendente se não houver evidência posterior registrada.
- Foundations técnicas acima não equivalem a validação UX por profissionais externos; esse trabalho continua no beta/piloto.

## 2026-09-05 — Beta foundation / financial pilot gate

- Consolida separação entre `platform_admin` e papéis internos das clínicas.
- Valida provisionamento seguro e auditável de clínica + primeiro `owner`.
- Consolida entitlements por clínica com leitura efetiva em runtime.
- Valida a clínica piloto inicial com owner, recepção, profissional médico de teste, unidade e paciente.
- Financeiro passa pelo gate técnico `VERIFY_20260904_FINANCIAL_PILOT_READINESS.sql` com zero inconsistências.
- Valida cenários financeiros então canônicos: recebível único, idempotência, consumo unitário de pacote, baixa PIX, histórico, imutabilidade de lançamento pago, limites da recepção e automação `pendente -> atrasado`.
- O bloqueio de consumo de pacote esgotado desta etapa foi posteriormente refinado por #388: cobertura esperada inválida não deve apagar uma finalização clínica válida; a inconsistência passa a ser registrada como exceção financeira explícita.
- Confirma funcionamento do smoke operacional de baixa pela interface observado naquele momento.

## Core real inicial

- Remove seeds do núcleo operacional como fonte de verdade.
- Carrega pacientes, agenda, financeiro, perfis, evoluções, consentimentos, NPS e pacotes do Supabase.
- Persiste cadastro de pacientes, agendamentos, status de atendimento, financeiro, evolução, consentimento e NPS.
- Adiciona isolamento multi-tenant e RBAC via RLS sem recursão em `profiles`.
- Adiciona painel Revenue Recovery no Dashboard.
