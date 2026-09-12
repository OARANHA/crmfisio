# MedicsPro — Referral / Encaminhamento Canonical Foundation (D2-E0)

> Fundação backend canônica para encaminhamento clínico multiprofissional. Não cria UI, renderer A4 final nem integração externa.

**Base de implementação:** `main@baa505c678db63aa4a01bf95cd0a9d32876a69db`  
**Merge canônico:** `main@be1fb4696dc285637c2c3e8d0f7bf857238b0926`  
**Estado:** VALIDADO EM PRODUÇÃO

## Decisão canônica

```text
Encaminhamento != Orientação terapêutica
Encaminhamento = referral próprio em Clinical Documents
```

`referral` herda a Clinical Documents Foundation D2-A em vez de criar persistence, lifecycle ou ACL paralelos.

O repositório histórico `OARANHA/medicspro` foi consultado como referência obrigatória de produto e não apresentou um módulo canônico de encaminhamento identificável por nome/estrutura que devesse ser portado. Portanto a implementação parte do runtime atual, sem copiar arquitetura histórica.

## Lifecycle

```text
published template version
→ draft
→ save/resume pelos RPCs D2-A
→ explicit human review na UX
→ issue
→ payload/context/template snapshots imutáveis
→ history
→ optional audited cancellation
```

D2-E0 não modifica os RPCs genéricos de draft/save/issue/cancel. Apenas torna `referral` um tipo conhecido e validado por esses contratos.

## Autorização

Referral é **multiprofissional** no V1.

O boundary server-side é:

```text
profile ativo
+
mesmo tenant/current_clinic_id
+
current_user_has_valid_clinical_identity()
+
clinical.documents
+
próprio Encounter ativo nos RPCs D2-A
```

Não há requisito médico/CRM adicional para `referral`.

Isso não significa que role, profissão ou especialidade concedam acesso. A autorização continua derivada da identidade clínica válida, capability e contexto assistencial. Owner/admin/platform não recebem bypass.

Os contratos existentes permanecem inalterados:

- `medication_prescription` continua médico/CRM;
- `exam_order` continua médico/CRM no recorte D2-D0;
- `therapeutic_guidance` continua multiprofissional pela boundary clínica comum.

## Payload V1

Draft pode permanecer incompleto. Emissão exige um destino identificável e motivo clínico.

```json
{
  "recipient": {
    "professional_name": "optional",
    "professional_type": "optional",
    "specialty": "optional",
    "service": "optional",
    "facility": "optional",
    "contact": "optional"
  },
  "reason": "required",
  "clinical_summary": "optional",
  "requested_action": "optional",
  "priority": "routine | high | urgent",
  "observations": "optional"
}
```

### Regras de emissão

- `recipient` deve ser objeto;
- pelo menos um entre `professional_name`, `professional_type`, `specialty`, `service` ou `facility` deve ser texto não vazio;
- `contact` é opcional;
- chaves desconhecidas dentro de `recipient` falham fechadas;
- `reason` é texto obrigatório não vazio;
- `clinical_summary`, `requested_action` e `observations` são textos opcionais;
- `priority`, quando informado, pertence ao conjunto fechado `routine | high | urgent`.

A validação é server-side em `assert_clinical_document_payload_ready()`; a UI pode antecipar erros, mas não vira autoridade.

## Template platform V1

```text
name: Encaminhamento clínico
document_type: referral
version: 1
layout: clinical-document/plain-text-v1
```

A versão V1 funda o contrato documental e permite o lifecycle completo. O renderer profissional A4 deve publicar nova versão imutável sem reescrever documentos históricos.

## Saída legada segura

O renderer genérico reconhece `referral` e usa título humano:

```text
Documento: Encaminhamento clínico
```

O código interno `referral` não é usado como rótulo do documento para o paciente.

## Escopo negativo D2-E0

D2-E0 não implementa:

- workspace/tela de Encaminhamento;
- preview A4 profissional;
- assinatura digital;
- envio automático ao destinatário;
- diretório/rede de especialistas;
- integração com operadoras, hospitais ou serviços;
- aceite/recusa do encaminhamento;
- agendamento externo;
- retorno/contrarreferência;
- cobrança;
- Nexus criando encaminhamento automaticamente;
- nova capability;
- alteração de RLS/grants/roles;
- expansão da autorização de Prescrição ou Pedido de Exames.

## Segurança e regressão

A slice inclui verifier production-safe e harness PostgreSQL 16 que comprovam:

- constraints fechadas com os quatro tipos canônicos;
- função de eligibility preservando physician-only em Prescrição/Exames e multiprofissional em Referral/Orientações;
- ausência de owner/admin bypass;
- capability obrigatória;
- care/Encounter boundary herdado;
- payload fail-closed;
- snapshot imutável e eventos append-only;
- cancelamento auditável;
- renderer com título humano;
- ausência de direct writes para `authenticated`;
- replay da migration sem mutar estado de negócio;
- regressões dos renderers de Prescrição, Orientações e Pedido de Exames.

## Rollout validado em produção — 2026-09-12

```text
merge
→ be1fb4696dc285637c2c3e8d0f7bf857238b0926

migration
→ MIGRATION_EXIT=0

verifier
→ CLINICAL REFERRAL FOUNDATION VERIFY PASSED
→ VERIFIER_EXIT=0

frontend
→ nenhum redeploy necessário em D2-E0
```

D2-E0 está fechado. A sequência canônica é **D2-E1 — Referral Encounter UX V1**, seguida por **D2-E2 — Referral Professional Print Renderer V1**.
