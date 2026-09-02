export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string
          name: string
          cnpj: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          cnpj?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          cnpj?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          clinic_id: string
          email: string
          nome: string
          role: 'owner' | 'admin' | 'fisio' | 'recep' | 'financeiro'
          registro: string | null
          cor: string | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          clinic_id: string
          email: string
          nome: string
          role?: 'owner' | 'admin' | 'fisio' | 'recep' | 'financeiro'
          registro?: string | null
          cor?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          email?: string
          nome?: string
          role?: 'owner' | 'admin' | 'fisio' | 'recep' | 'financeiro'
          registro?: string | null
          cor?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          clinic_id: string
          nome: string
          nascimento: string
          telefone: string | null
          email: string | null
          cpf: string | null
          convenio: string | null
          queixa_principal: string | null
          cid10: string[] | null
          funil_stage: 'lead' | 'avaliacao' | 'tratamento' | 'alta'
          status: 'ativo' | 'inativo' | 'alta'
          ultima_visita: string | null
          opt_in_whats: boolean
          anonimizado: boolean
          anamnese: Json | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          nome: string
          nascimento: string
          telefone?: string | null
          email?: string | null
          cpf?: string | null
          convenio?: string | null
          queixa_principal?: string | null
          cid10?: string[] | null
          funil_stage?: 'lead' | 'avaliacao' | 'tratamento' | 'alta'
          status?: 'ativo' | 'inativo' | 'alta'
          ultima_visita?: string | null
          opt_in_whats?: boolean
          anonimizado?: boolean
          anamnese?: Json | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          nome?: string
          nascimento?: string
          telefone?: string | null
          email?: string | null
          cpf?: string | null
          convenio?: string | null
          queixa_principal?: string | null
          cid10?: string[] | null
          funil_stage?: 'lead' | 'avaliacao' | 'tratamento' | 'alta'
          status?: 'ativo' | 'inativo' | 'alta'
          ultima_visita?: string | null
          opt_in_whats?: boolean
          anonimizado?: boolean
          anamnese?: Json | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      appointments: {
        Row: {
          id: string
          clinic_id: string
          paciente_id: string
          fisio_id: string
          room_id: string | null
          data: string
          inicio: string
          fim: string
          status: 'agendado' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'faltou' | 'cancelado'
          tipo: string
          valor: number
          pacote_id: string | null
          serie_id: string | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          paciente_id: string
          fisio_id: string
          room_id?: string | null
          data: string
          inicio: string
          fim: string
          status?: 'agendado' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'faltou' | 'cancelado'
          tipo: string
          valor: number
          pacote_id?: string | null
          serie_id?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          paciente_id?: string
          fisio_id?: string
          room_id?: string | null
          data?: string
          inicio?: string
          fim?: string
          status?: 'agendado' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'faltou' | 'cancelado'
          tipo?: string
          valor?: number
          pacote_id?: string | null
          serie_id?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      physiotherapy_evaluations: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          professional_id: string
          data: string
          anamnese: Json
          objetivos: string | null
          plano_terapeutico: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          professional_id: string
          data?: string
          anamnese: Json
          objetivos?: string | null
          plano_terapeutico?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          professional_id?: string
          data?: string
          anamnese?: Json
          objetivos?: string | null
          plano_terapeutico?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      physiotherapy_evolutions: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          professional_id: string
          session_id: string | null
          texto: string
          anexos: string[]
          crefito: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          professional_id: string
          session_id?: string | null
          texto: string
          anexos?: string[]
          crefito?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          professional_id?: string
          session_id?: string | null
          texto?: string
          anexos?: string[]
          crefito?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      payments: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string | null
          tipo: 'receber' | 'pagar'
          descricao: string
          categoria: string
          valor: number
          vencimento: string
          status: 'pendente' | 'pago' | 'atrasado'
          metodo: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id?: string | null
          tipo: 'receber' | 'pagar'
          descricao: string
          categoria: string
          valor: number
          vencimento: string
          status?: 'pendente' | 'pago' | 'atrasado'
          metodo?: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string | null
          tipo?: 'receber' | 'pagar'
          descricao?: string
          categoria?: string
          valor?: number
          vencimento?: string
          status?: 'pendente' | 'pago' | 'atrasado'
          metodo?: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      patient_packages: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          package_id: string
          sessoes_totais: number
          sessoes_usadas: number
          compra_data: string
          valor_pago: number
          status: 'ativo' | 'esgotado' | 'vencido'
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          package_id: string
          sessoes_totais: number
          sessoes_usadas: number
          compra_data: string
          valor_pago: number
          status?: 'ativo' | 'esgotado' | 'vencido'
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          package_id?: string
          sessoes_totais?: number
          sessoes_usadas?: number
          compra_data?: string
          valor_pago?: number
          status?: 'ativo' | 'esgotado' | 'vencido'
          created_at?: string
        }
      }
      session_packages: {
        Row: {
          id: string
          clinic_id: string
          nome: string
          sessoes: number
          preco: number
          validade_dias: number
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          nome: string
          sessoes: number
          preco: number
          validade_dias: number
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          nome?: string
          sessoes?: number
          preco?: number
          validade_dias?: number
          created_at?: string
        }
      }
      consent_terms: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          nome: string
          versao: string
          assinado: boolean
          data_assinatura: string | null
          hash: string | null
          assinatura_url: string | null
          ip: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          nome: string
          versao: string
          assinado?: boolean
          data_assinatura?: string | null
          hash?: string | null
          assinatura_url?: string | null
          ip?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          nome?: string
          versao?: string
          assinado?: boolean
          data_assinatura?: string | null
          hash?: string | null
          assinatura_url?: string | null
          ip?: string | null
          created_at?: string
        }
      }
      nps_surveys: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          nota: number | null
          comentario: string | null
          data: string
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          nota?: number | null
          comentario?: string | null
          data: string
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          nota?: number | null
          comentario?: string | null
          data?: string
          created_at?: string
        }
      }
      wa_logs: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          template: 'confirmacao' | 'nps' | 'reativacao'
          mensagem: string
          enviado_em: string
          status: 'enviando' | 'enviado' | 'entregue' | 'lido'
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          template: 'confirmacao' | 'nps' | 'reativacao'
          mensagem: string
          enviado_em: string
          status?: 'enviando' | 'enviado' | 'entregue' | 'lido'
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          template?: 'confirmacao' | 'nps' | 'reativacao'
          mensagem?: string
          enviado_em?: string
          status?: 'enviando' | 'enviado' | 'entregue' | 'lido'
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          clinic_id: string
          ts: string
          usuario_id: string
          acao: string
          detalhe: string
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          ts?: string
          usuario_id: string
          acao: string
          detalhe: string
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          ts?: string
          usuario_id?: string
          acao?: string
          detalhe?: string
          created_at?: string
        }
      }
      commission_settlements: {
        Row: {
          id: string
          clinic_id: string
          professional_id: string
          period: string
          base_amount: number
          percentage: number
          commission_amount: number
          status: 'aberto' | 'pago'
          paid_at: string | null
          paid_by: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: never
      }
    }
    Views: {}
    Functions: {
      close_monthly_commissions: {
        Args: { p_period: string }
        Returns: Database['public']['Tables']['commission_settlements']['Row'][]
      }
      mark_commission_paid: {
        Args: { p_commission_id: string }
        Returns: Database['public']['Tables']['commission_settlements']['Row']
      }
      log_patient_data_export: {
        Args: { p_patient_id: string }
        Returns: undefined
      }
      anonymize_patient_lgpd: {
        Args: { p_patient_id: string }
        Returns: undefined
      }
    }
  }
}
