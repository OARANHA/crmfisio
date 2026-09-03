import type { Appointment, AppointmentStatus, Role } from './types';
import { isClinicalRole, isOperationalRole } from './permissions';

export interface AppointmentAction {
  status: AppointmentStatus;
  label: string;
  tone: 'primary' | 'neutral' | 'danger';
  disabled?: boolean;
  hint?: string;
}

const minutesFromHHMM = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export const canMarkNoShow = (appointment: Appointment, now = new Date()) => {
  const today = now.toISOString().slice(0, 10);
  if (appointment.data < today) return true;
  if (appointment.data > today) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= minutesFromHHMM(appointment.inicio) + 15;
};

export function appointmentActions(
  role: Role,
  appointment: Appointment,
  now = new Date(),
): AppointmentAction[] {
  const { status } = appointment;
  if (status === 'finalizado' || status === 'cancelado' || status === 'faltou') return [];

  const actions: AppointmentAction[] = [];
  const operational = isOperationalRole(role);
  const clinical = isClinicalRole(role);

  if (status === 'agendado' && operational) {
    actions.push({ status: 'confirmado', label: 'Confirmar presença', tone: 'primary' });
  }

  if ((status === 'agendado' || status === 'confirmado') && clinical) {
    actions.push({ status: 'em_atendimento', label: 'Iniciar atendimento', tone: 'primary' });
  }

  if (status === 'em_atendimento' && clinical) {
    actions.push({ status: 'finalizado', label: 'Finalizar atendimento', tone: 'primary' });
  }

  if ((status === 'agendado' || status === 'confirmado') && operational) {
    const noShowAllowed = canMarkNoShow(appointment, now);
    actions.push({
      status: 'faltou',
      label: 'Registrar falta',
      tone: 'danger',
      disabled: !noShowAllowed,
      hint: noShowAllowed ? undefined : 'Disponível 15 min após o início da sessão.',
    });
    actions.push({ status: 'cancelado', label: 'Cancelar sessão', tone: 'danger' });
  }

  return actions;
}

export function appointmentStatusGuidance(status: AppointmentStatus) {
  switch (status) {
    case 'agendado': return 'Aguardando confirmação ou início do atendimento.';
    case 'confirmado': return 'Presença confirmada. O profissional pode iniciar o atendimento.';
    case 'em_atendimento': return 'Sessão em andamento. Finalize somente após concluir o atendimento.';
    case 'finalizado': return 'Sessão concluída e encerrada.';
    case 'faltou': return 'Falta registrada. Para remarcar, crie uma nova sessão.';
    case 'cancelado': return 'Sessão cancelada. Para remarcar, crie uma nova sessão.';
  }
}
