import { supabase } from './supabaseClient';

export type FinancialExceptionDisposition = 'charge' | 'waived';

export interface FinancialException {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  appointmentDate: string;
  appointmentStart: string;
  reasonCode: string;
  amount: number;
  sourcePackageId: string | null;
  packageName: string | null;
  detectedAt: string;
}

export interface FinancialExceptionResolution {
  exceptionId: string;
  appointmentId: string;
  disposition: FinancialExceptionDisposition;
  amount: number;
  paymentId: string | null;
  resolvedAt: string;
}

interface PendingFinancialExceptionRow {
  exception_id: string;
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  appointment_date: string;
  appointment_start: string;
  reason_code: string;
  amount: number;
  source_package_id: string | null;
  package_name: string | null;
  detected_at: string;
}

interface FinancialExceptionResolutionRow {
  exception_id: string;
  appointment_id: string;
  disposition: FinancialExceptionDisposition;
  amount: number;
  payment_id: string | null;
  resolved_at: string;
}

export const FINANCIAL_EXCEPTION_REASON_LABELS: Record<string, string> = {
  package_exhausted: 'Pacote sem saldo',
  package_expired: 'Pacote fora da validade na data do atendimento',
  package_not_eligible: 'Cobertura de pacote não elegível',
};

export const financialExceptionReasonLabel = (reasonCode: string): string =>
  FINANCIAL_EXCEPTION_REASON_LABELS[reasonCode] ?? 'Cobertura financeira não materializada';

const mapPendingFinancialException = (row: PendingFinancialExceptionRow): FinancialException => ({
  id: row.exception_id,
  appointmentId: row.appointment_id,
  patientId: row.patient_id,
  patientName: row.patient_name,
  appointmentDate: row.appointment_date,
  appointmentStart: row.appointment_start,
  reasonCode: row.reason_code,
  amount: row.amount,
  sourcePackageId: row.source_package_id,
  packageName: row.package_name,
  detectedAt: row.detected_at,
});

const mapResolution = (row: FinancialExceptionResolutionRow): FinancialExceptionResolution => ({
  exceptionId: row.exception_id,
  appointmentId: row.appointment_id,
  disposition: row.disposition,
  amount: row.amount,
  paymentId: row.payment_id,
  resolvedAt: row.resolved_at,
});

export async function loadPendingFinancialExceptions(): Promise<FinancialException[]> {
  const { data, error } = await supabase.rpc('list_pending_appointment_financial_exceptions');
  if (error) throw error;
  return ((data ?? []) as PendingFinancialExceptionRow[]).map(mapPendingFinancialException);
}

export async function resolveAppointmentFinancialException(
  exceptionId: string,
  disposition: FinancialExceptionDisposition,
  reason?: string | null,
): Promise<FinancialExceptionResolution> {
  const normalizedReason = disposition === 'waived' ? reason?.trim() ?? '' : null;
  if (disposition === 'waived' && !normalizedReason) {
    throw new Error('Informe o motivo da cortesia.');
  }

  const { data, error } = await supabase.rpc('resolve_appointment_financial_exception', {
    p_exception_id: exceptionId,
    p_disposition: disposition,
    p_reason: normalizedReason,
  });
  if (error) throw error;

  const row = (data as FinancialExceptionResolutionRow[] | null)?.[0];
  if (!row) throw new Error('A resolução financeira não retornou confirmação persistida.');
  return mapResolution(row);
}
