import type { Appointment, FinancialTransaction, Patient, PatientPackage, SessionPackage } from './types';

export interface TreatmentContext {
  stageLabel: string;
  completed: number;
  missed: number;
  future: number;
  packageName: string | null;
  packageStatus: PatientPackage['status'] | null;
  sessionCurrent: number | null;
  sessionTotal: number | null;
  sessionsUsed: number | null;
  sessionsRemaining: number | null;
  progressPct: number | null;
  pendingAmount: number;
  overdueAmount: number;
  financialState: 'ok' | 'pendente' | 'atrasado';
  interruptionRisk: boolean;
}

const STAGE_LABEL: Record<Patient['funilStage'], string> = {
  lead: 'Lead',
  avaliacao: 'Avaliação',
  tratamento: 'Em tratamento',
  alta: 'Alta clínica',
};

export function buildTreatmentContext(params: {
  patient?: Patient;
  appointment: Appointment;
  appointments: Appointment[];
  patientPackages: PatientPackage[];
  packages: SessionPackage[];
  transactions: FinancialTransaction[];
}): TreatmentContext {
  const { patient, appointment, appointments, patientPackages, packages, transactions } = params;
  const patientAppointments = appointments
    .filter((item) => item.pacienteId === appointment.pacienteId && item.status !== 'cancelado')
    .sort((a, b) => `${a.data}T${a.inicio}`.localeCompare(`${b.data}T${b.inicio}`));

  const completed = patientAppointments.filter((item) => item.status === 'finalizado').length;
  const missed = patientAppointments.filter((item) => item.status === 'faltou').length;
  const currentKey = `${appointment.data}T${appointment.inicio}`;
  const future = patientAppointments.filter((item) => `${item.data}T${item.inicio}` > currentKey && !['finalizado', 'faltou'].includes(item.status)).length;

  const patientPackageList = patientPackages
    .filter((item) => item.pacienteId === appointment.pacienteId)
    .sort((a, b) => b.compraData.localeCompare(a.compraData));
  const linkedPackage = appointment.pacoteId
    ? patientPackageList.find((item) => item.id === appointment.pacoteId || item.pacoteId === appointment.pacoteId)
    : undefined;
  const activePackage = linkedPackage ?? patientPackageList.find((item) => item.status === 'ativo') ?? patientPackageList[0];
  const catalogPackage = activePackage ? packages.find((item) => item.id === activePackage.pacoteId) : undefined;

  const sessionsUsed = activePackage ? Math.max(0, Math.min(activePackage.sessoesUsadas, activePackage.sessoesTotais)) : null;
  const sessionTotal = activePackage?.sessoesTotais ?? null;
  const sessionCurrent = activePackage && sessionTotal
    ? Math.min(sessionTotal, appointment.status === 'finalizado' ? Math.max(1, sessionsUsed ?? 1) : Math.max(1, (sessionsUsed ?? 0) + 1))
    : null;
  const sessionsRemaining = activePackage && sessionsUsed !== null ? Math.max(0, activePackage.sessoesTotais - sessionsUsed) : null;
  const progressPct = activePackage && activePackage.sessoesTotais > 0
    ? Math.round(((sessionsUsed ?? 0) / activePackage.sessoesTotais) * 100)
    : null;

  const patientTransactions = transactions.filter((item) => item.pacienteId === appointment.pacienteId && item.tipo === 'receber');
  const overdueAmount = patientTransactions.filter((item) => item.status === 'atrasado').reduce((sum, item) => sum + item.valor, 0);
  const pendingAmount = patientTransactions.filter((item) => item.status === 'pendente').reduce((sum, item) => sum + item.valor, 0);
  const financialState: TreatmentContext['financialState'] = overdueAmount > 0 ? 'atrasado' : pendingAmount > 0 ? 'pendente' : 'ok';

  const completedAppointments = patientAppointments.filter((item) => item.status === 'finalizado');
  const lastCompleted = completedAppointments.length > 0 ? completedAppointments[completedAppointments.length - 1] : undefined;
  const hasFuture = future > 0 || ['agendado', 'confirmado', 'em_atendimento'].includes(appointment.status);
  const daysSinceLast = lastCompleted ? Math.floor((Date.now() - new Date(`${lastCompleted.data}T12:00:00`).getTime()) / 86_400_000) : 0;
  const interruptionRisk = patient?.funilStage === 'tratamento' && !hasFuture && completed > 0 && daysSinceLast >= 21;

  return {
    stageLabel: patient ? STAGE_LABEL[patient.funilStage] : 'Jornada não identificada',
    completed,
    missed,
    future,
    packageName: catalogPackage?.nome ?? (activePackage ? 'Pacote de sessões' : null),
    packageStatus: activePackage?.status ?? null,
    sessionCurrent,
    sessionTotal,
    sessionsUsed,
    sessionsRemaining,
    progressPct,
    pendingAmount,
    overdueAmount,
    financialState,
    interruptionRisk,
  };
}
