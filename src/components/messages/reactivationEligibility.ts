import { differenceInCalendarDays, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MessageOutboxRow } from '../../lib/messageOutbox';
import type { Appointment, Patient } from '../../lib/types';

const OPEN_MESSAGE_STATUS = new Set(['fila', 'enviando', 'enviado', 'entregue', 'lido']);
const ACTIVE_APPOINTMENT_STATUS = new Set(['agendado', 'confirmado', 'em_atendimento']);

export interface ReactivationCandidate {
  id: string;
  patientId: string;
  patientName: string;
  primary: string;
  secondary?: string;
}

export interface ReactivationStats {
  noOptin: number;
  noPhone: number;
  cooldown: number;
  futureAppointment: number;
  noHistory: number;
  recentlyActive: number;
}

interface BuildArgs {
  patients: Patient[];
  appointments: Appointment[];
  logs: MessageOutboxRow[];
  inactivityDays?: number;
  cooldownDays?: number;
  now?: Date;
}

const appointmentDateTime = (appointment: Appointment) => {
  const time = appointment.fim || appointment.inicio;
  return new Date(`${appointment.data}T${time.length === 5 ? `${time}:00` : time}`);
};

export function buildReactivationSelection({
  patients,
  appointments,
  logs,
  inactivityDays = 30,
  cooldownDays = 30,
  now = new Date(),
}: BuildArgs) {
  const cooldownLimit = subDays(now, cooldownDays);
  const stats: ReactivationStats = {
    noOptin: 0,
    noPhone: 0,
    cooldown: 0,
    futureAppointment: 0,
    noHistory: 0,
    recentlyActive: 0,
  };
  const candidates: ReactivationCandidate[] = [];

  patients
    .filter((patient) => patient.status !== 'alta' && !patient.anonimizado)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .forEach((patient) => {
      const patientAppointments = appointments.filter((item) => item.pacienteId === patient.id);
      const finalized = patientAppointments
        .filter((item) => item.status === 'finalizado')
        .sort((a, b) => appointmentDateTime(b).getTime() - appointmentDateTime(a).getTime());
      const lastAppointment = finalized[0];

      if (!lastAppointment) { stats.noHistory += 1; return; }

      const hasFutureAppointment = patientAppointments.some((item) =>
        ACTIVE_APPOINTMENT_STATUS.has(item.status)
        && appointmentDateTime(item) >= now
      );
      if (hasFutureAppointment) { stats.futureAppointment += 1; return; }

      const lastVisit = appointmentDateTime(lastAppointment);
      const daysWithoutAttendance = differenceInCalendarDays(now, lastVisit);
      if (daysWithoutAttendance < inactivityDays) { stats.recentlyActive += 1; return; }

      if (!patient.optInWhats) { stats.noOptin += 1; return; }
      if (!patient.telefone?.trim()) { stats.noPhone += 1; return; }

      const contactedRecently = logs.some((log) =>
        log.patientId === patient.id
        && log.template === 'reativacao'
        && OPEN_MESSAGE_STATUS.has(log.status)
        && new Date(log.createdAt) >= cooldownLimit
      );
      if (contactedRecently) { stats.cooldown += 1; return; }

      candidates.push({
        id: patient.id,
        patientId: patient.id,
        patientName: patient.nome,
        primary: `Sem atendimento há ${daysWithoutAttendance} dias · última sessão ${format(lastVisit, 'dd/MM/yyyy', { locale: ptBR })}`,
        secondary: `${patient.telefone} · oportunidade de reativação`,
      });
    });

  return { candidates, stats };
}
