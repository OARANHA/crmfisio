# 🚀 DEPLOYMENT GUIDE - MEDICSPRO CRM FISIOTERAPIA

## ✅ FASE 1 COMPLETA - INTEGRAÇÃO SUPABASE AUTH + SCHEMA

### 📋 O QUE FOI ENTREGUE

| Arquivo | Descrição |
|---------|-----------|
| `src/lib/supabaseClient.ts` | Cliente Supabase tipado com auto-refresh de sessão |
| `src/lib/database.types.ts` | Types TypeScript gerados do schema PostgreSQL |
| `src/lib/useAuth.ts` | Hook React para autenticação JWT real |
| `.env.example` | Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` |
| `supabase-schema.sql` | **Script SQL completo** com tabelas, RLS, triggers, storage |

---

## 🔧 PASSOS PARA DEPLOY (ORDEM OBRIGATÓRIA)

### **PASSO 1: Executar Schema no Supabase** ⚠️ CRÍTICO

1. Acesse o **Supabase Studio**: https://studio.medicspro.com.br
2. Faça login com credenciais admin do Supabase
3. Selecione o projeto **default** (ou crie um novo)
4. Vá em **SQL Editor** (menu lateral)
5. Clique em **+ New query**
6. Copie o conteúdo do arquivo `supabase-schema.sql` deste repositório
7. Cole no editor e execute (**Run**)
8. **Valide** que todas as tabelas foram criadas:
   - `clinics`, `profiles`, `patients`, `appointments`
   - `physiotherapy_evaluations`, `physiotherapy_evolutions`
   - `payments`, `session_packages`, `patient_packages`
   - `consent_terms`, `nps_surveys`, `wa_logs`, `audit_log`

> ✅ Se algum erro aparecer, verifique logs e corrija antes de prosseguir.

---

### **PASSO 2: Obter ANON_KEY do Supabase**

1. No **Supabase Studio**, vá em **Settings** (engrenagem) → **API**
2. Copie a **Project URL**: deve ser `https://supabase.medicspro.com.br`
3. Copie a **anon public key** (começa com `eyJ...`)
4. **NUNCA** compartilhe a `service_role_key` no frontend!

---

### **PASSO 3: Configurar Environment Variables no Portainer**

1. Acesse o **Portainer** no 28server
2. Vá em **Stacks** → **crmfisio**
3. Clique em **Advanced configuration** → **Environment variables**
4. Adicione as seguintes variáveis:

```
VITE_SUPABASE_URL=https://supabase.medicspro.com.br
VITE_SUPABASE_ANON_KEY=<cole_a_anon_key_aqui>
```

5. Clique em **Save** (ou **Update stack**)

> ⚠️ **IMPORTANTE**: Não commitar `.env` no repositório. Use apenas variáveis do Portainer.

---

### **PASSO 4: Provisionar clínicas e usuários**

Não insira registros diretamente em `auth.users`. Senhas e identidades são gerenciadas
exclusivamente pela API administrativa do Supabase Auth em código server-side.

- O bootstrap único de `platform_admin` e a criação segura da primeira clínica estão em
  `docs/PLATFORM_PROVISIONING.md`.
- O primeiro usuário de cada clínica é criado como `owner` pela Edge Function
  `provision-clinic`.
- Usuários adicionais são criados por `owner/admin` pela Edge Function `admin-team` e
  sempre herdam o `clinic_id` do chamador autenticado.
- A `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposta no frontend ou em comandos
  executados em computadores não confiáveis.

---

### **PASSO 5: Redeploy no Portainer**

1. No **Portainer**, vá em **Stacks** → **crmfisio**
2. Clique em **Redeploy from git repository**
3. Aguarde o build e deploy (≈2-3 minutos)
4. Verifique os logs do container para garantir que não há erros de ambiente

---

### **PASSO 6: Testar Login Real**

1. Acesse: https://app.medicspro.com.br
2. A tela de login deve aparecer (sem seleção mockada de usuários)
3. Faça login com:
   - Email: `admin@medicspro.com.br`
   - Senha: `<senha_definida_no_passo_4>`
4. Valide que:
   - O dashboard carrega
   - O menu mostra módulos conforme RBAC do perfil
   - O logout funciona

---

## 🔒 SEGURANÇA E LGPD

### Row Level Security (RLS) Ativado

Todas as tabelas clínicas possuem RLS habilitado:
- Isolamento obrigatório por `clinic_id`
- Políticas específicas por perfil (`owner`, `admin`, `fisio`, `recep`, `financeiro`)
- Audit log append-only (somente INSERT)

### Storage Privado

Bucket `clinical-attachments` configurado:
- Acesso restrito a usuários autenticados da mesma clínica
- Tamanho máximo: 10MB por arquivo
- Tipos permitidos: JPEG, PNG, PDF

### Dados Sensíveis

- CPF mascarado na UI (função `maskCpf` já implementada)
- Anamnese armazenada como JSONB criptografado em repouso
- Direito ao esquecimento: campo `anonimizado` para soft delete

---

## 🐛 TROUBLESHOOTING

### Erro: "Invalid API key"

**Causa**: `VITE_SUPABASE_ANON_KEY` incorreta ou faltando  
**Solução**: Revisar Passo 2 e Passo 3

### Erro: "Row not found" ou "Permission denied"

**Causa**: RLS bloqueando acesso fora da clínica  
**Solução**: 
- Verificar se `clinic_id` do profile está correto
- Confirmar que o usuário pertence à clínica esperada

### Login funciona, mas dados não carregam

**Causa**: Tabelas vazias ou schema não executado  
**Solução**: Revisar Passo 1 e validar tabelas no SQL Editor

### Container não sobe após redeploy

**Causa**: Variável de ambiente mal formatada  
**Solução**: Checar logs no Portainer e corrigir `.env`

---

## 📊 PRÓXIMAS FASES (ROADMAP)

| Fase | Entrega | Status |
|------|---------|--------|
| **Fase 1** | Auth + Schema + RLS | ✅ Concluída |
| **Fase 2** | CRUD Pacientes + Prontuário | 🔄 Em progresso |
| **Fase 3** | Agenda + Recorrência | ⏳ Pendente |
| **Fase 4** | Financeiro + Pacotes | ⏳ Pendente |
| **Fase 5** | WhatsApp Integration | ⏳ Pendente |
| **Fase 6** | LGPD Self-Service (export/anon) | ⏳ Pendente |
| **Fase 7** | Teleatendimento (Jitsi) | ⏳ Futuro |

---

## 📞 CONTATO E SUPORTE

Em caso de dúvidas durante o deploy:
- Revisar este guia passo-a-passo
- Verificar logs do container no Portainer
- Consultar SQL de criação de tabelas

**Repositório**: https://github.com/OARANHA/crmfisio  
**Supabase Studio**: https://studio.medicspro.com.br  
**App Produção**: https://app.medicspro.com.br

---

*Documento gerado automaticamente após commit da Fase 1 - MedicsPro Team*
