import { differenceInDays, format } from 'date-fns';
import type { Appointment, FinancialTransaction, Patient, PatientPackage } from './types';

export type ChurnRiskLevel = 'baixo' | 'medio' | 'alto';

export interface ChurnRiskResult {
  patientId: string;
  patientName: string;
  score: number;
  level: ChurnRiskLevel;
  reasons: string[];
  lastVisit: string | null;
  daysWithoutVisit: number;
  completed: number;
  missed: number;
  missedRate: number;
  packageRemaining: number | null;
  packageStatus: PatientPackage['status'] | null;
  overdueAmount: number;
  hasFutureAppointment: boolean;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function calculateChurnRisk(
  patient: Patient,
  appointments: Appointment[],
  patientPackages: PatientPackage[],
  transactions: FinancialTransaction[],
  now = new Date(),
): ChurnRiskResult | null {
  if (patient.funilStage !== 'tratamento' || patient.anonimizado || patient.status === 'alta') return null;

  const appts = appointments
    .filter((item) => item.pacienteId === patient.id && item.status !== 'cancelado')
    .sort((a, b) => `${a.data}T${a.inicio}`.localeCompare(`${b.data}T${b.inicio}`));

  const completed = appts.filter((item) => item.status === 'finalizado');
  const missed = appts.filter((item) => item.status === 'faltou');
  const last = completed.length ? completed[completed.length - 1] : null;
  const nowKey = format(now, "yyyy-MM-dd'T'HH:mm");
  const hasFutureAppointment = appts.some(
    (item) => ['agendado', 'confirmado', 'em_atendimento'].includes(item.status)
      && `${item.data}T${item.inicio}` >= nowKey,
  );

  const daysWithoutVisit = last ? Math.max(0, differenceInDays(now, new Date(`${last.data}T12:00:00`))) : 0;
  const relevantSessions = completed.length + missed.length;
  const missedRate = relevantSessions ? missed.length / relevantSessions : 0;

  const patientPackage = patientPackages
    .filter((item) => item.pacienteId === patient.id)
    .sort((a, b) => b.compraData.localeCompare(a.compraData))[0] ?? null;
  const packageRemaining = patientPackage
    ? Math.max(0, patientPackage.sessoesTotais - patientPackage.sessoesUsadas)
    : null;

  const overdueAmount = transactions
    .filter((item) => item.pacienteId === patient.id && item.tipo === 'receber' && item.status === 'atrasado')
    .reduce((sum, item) => sum + item.valor, 0);

  let score = 0;
  const reasons: string[] = [];

  if (!hasFutureAppointment && completed.length > 0) {
    score += 20;
    reasons.push('sem próxima sessão');
  }
  if (daysWithoutVisit >= 30) {
    score += 40;
    reasons.push(`${daysWithoutVisit} dias sem atendimento`);
  } else if (daysWithoutVisit >= 21) {
    score += 30;
    reasons.push(`${daysWithoutVisit} dias sem atendimento`);
  } else if (daysWithoutVisit >= 14) {
    score += 15;
    reasons.push(`${daysWithoutVisit} dias sem atendimento`);
  }

  if (missedRate >= 0.4 && relevantSessions >= 2) {
    score += 20;
    reasons.push('histórico elevado de faltas');
  } else if (missedRate >= 0.2 && relevantSessions >= 3) {
    score += 10;
    reasons.push('faltas recorrentes');
  }

  if (patientPackage?.status === 'esgotado' || patientPackage?.status === 'vencido') {
    score += 15;
    reasons.push(`pacote ${patientPackage.status}`);
  } else if (packageRemaining !== null && packageRemaining <= 2) {
    score += 10;
    reasons.push(`apenas ${packageRemaining} sessão(ões) no pacote`);
  }

  if (overdueAmount > 0) {
    score += 15;
    reasons.push('financeiro em atraso');
  }

  if (hasFutureAppointment) score -= 25;
  const normalized = clamp(score);
  const level: ChurnRiskLevel = normalized >= 60 ? 'alto' : normalized >= 35 ? 'medio' : 'baixo';

  return {
    patientId: patient.id,
    patientName: patient.nome,
    score: normalized,
    level,
    reasons,
    lastVisit: last?.data ?? null,
    daysWithoutVisit,
    completed: completed.length,
    missed: missed.length,
    missedRate,
    packageRemaining,
    packageStatus: patientPackage?.status ?? null,
    overdueAmount,
    hasFutureAppointment,
  };
}

export function buildChurnRiskList(
  patients: Patient[],
  appointments: Appointment[],
  patientPackages: PatientPackage[],
  transactions: FinancialTransaction[],
  now = new Date(),
): ChurnRiskResult[] {
  return patients
    .map((patient) => calculateChurnRisk(patient, appointments, patientPackages, transactions, now))
    .filter((item): item is ChurnRiskResult => item !== null)
    .filter((item) => item.score >= 20)
    .sort((a, b) => b.score - a.score || b.daysWithoutVisit - a.daysWithoutVisit);
}
