# MedicsPro — Product Roadmap

## North Star

**Receita protegida/recuperada + eficiência operacional + qualidade clínica por clínica/mês.**

O MedicsPro deve provar valor financeiro e operacional sem abrir mão de segurança clínica, multi-tenant e excelente UX.

## Estado atual — 2026-09-05

### ✅ Fundação pronta para piloto controlado

- Supabase real como fonte de verdade do núcleo operacional.
- Isolamento multi-tenant por `clinic_id` com RLS/RBAC.
- `platform_admin` separado dos papéis internos das clínicas.
- Provisionamento seguro e auditável de clínicas e primeiro `owner`.
- Entitlements por clínica com separação entre plano, configuração e autorização.
- Unidades e salas persistidas.
- Agenda com transições de estado protegidas e autoria operacional.
- Financeiro operacional validado com gate SQL limpo e cenários manuais de aceite.
- Pacotes com venda, saldo, consumo unitário, validade e bloqueio por esgotamento.
- Histórico de status financeiro e `paid_at` auditável.
- Revenue Recovery e automações já conectados ao banco real.

### 🟢 Financeiro — liberado para piloto controlado

Critérios validados em `docs/FINANCIAL_PILOT_ACCEPTANCE.md`:

- um único recebível por atendimento avulso finalizado;
- idempotência;
- pacote ativo consome uma sessão sem cobrança avulsa;
- pacote esgotado/vencido bloqueia finalização;
- baixa por PIX registra `pago`, método, `paid_at` e histórico;
- lançamentos pagos são imutáveis;
- recepção pode criar contas a receber e não pode criar contas a pagar;
- automação `pendente -> atrasado` validada;
- totais da UI conferidos contra `payments`;
- gate `VERIFY_20260904_FINANCIAL_PILOT_READINESS.sql` com zero inconsistências.

### ⚠️ Pendências P1 já conhecidas

1. Fluxo auditável para cancelamento após pagamento antecipado: estorno, crédito, retenção ou transferência para reagendamento.
2. Expor na UI o vínculo entre cobrança antecipada e atendimento sem depender de operação manual no banco.
3. Fechar governança de entitlements/configurações de ponta a ponta em todos os módulos.
4. Generalizar o papel clínico além do legado `fisio`, preservando compatibilidade enquanto médicos usam `professional_type='medico'`.
5. Garantir que o Nexus Clinical Engine seja exclusivo de médicos autorizados e nunca liberado apenas por `role='fisio'`.

## Próxima sequência de execução

1. **Configurações / Entitlements / governança por clínica**
   - garantir que módulos ocultem/bloqueiem corretamente na UI e no servidor;
   - permitir ao Platform Admin controlar disponibilidade por clínica;
   - permitir à clínica configurar apenas o que estiver dentro do entitlement.

2. **Atendimento clínico em andamento**
   - experiência dedicada ao profissional;
   - autoria, evolução, plano, medidas e finalização segura;
   - base comum para diferentes profissões.

3. **Assessment Engine**
   - avaliações padrão;
   - minhas avaliações;
   - builder versionado;
   - body map/pain map estruturado;
   - histórico longitudinal.

4. **Nexus Clinical Engine**
   - médico-only;
   - especialidade-aware;
   - validação de CRM e entitlement efetivo;
   - preservar lógica clínica especializada já existente.

5. **Agenda premium + comunicação**
   - semana/dia por profissional e sala;
   - indisponibilidades e exceções;
   - confirmação, no-show, lista de espera e Evolution com observabilidade.

6. **Financeiro avançado**
   - estorno/crédito/retenção;
   - pagamento parcial/múltiplos meios;
   - caixa e conciliação;
   - repasses/comissões;
   - recibos/comprovantes e NFS-e.

7. **CRM / retenção / reativação**
   - funil lead -> avaliação -> tratamento -> pacote;
   - follow-ups;
   - reativação 30/60/90;
   - churn risk e jornada do paciente.

8. **Relatórios / ROI / inteligência operacional**
   - receita, ocupação, inadimplência, retenção e produtividade;
   - relatório mensal de ROI do MedicsPro.

## Regra de produto

Nenhuma feature entra apenas por estética. Cada entrega deve melhorar pelo menos um destes indicadores:

- receita;
- ocupação da agenda;
- retenção;
- qualidade clínica;
- segurança;
- eficiência operacional;
- onboarding/time-to-value;
- percepção de produto moderno e confiável.

## Regra de release

`main` deve ser tratada como **branch potencialmente deployável**. O ambiente Portainer atual acompanha o GitHub em ciclos curtos; portanto, todo merge em `main` precisa estar em estado deploy-safe e mudanças de banco devem ser compatíveis com a versão publicada.
