import type { Appointment, Patient } from '../lib/types';
import { appointmentWhatsappLabel, type AppointmentWhatsappState } from '../lib/appointmentWhatsapp';

interface Props {
  patient?: Patient;
  appointment: Appointment;
  appointments: Appointment[];
  whatsapp?: AppointmentWhatsappState;
}

export function AppointmentPatientSnapshot({ patient, appointment, appointments, whatsapp }: Props) {
  const patientAppointments = appointments.filter((item) => item.pacienteId === appointment.pacienteId && item.status !== 'cancelado');
  const completed = patientAppointments.filter((item) => item.status === 'finalizado').sort((a, b) => `${b.data}T${b.inicio}`.localeCompare(`${a.data}T${a.inicio}`));
  const future = patientAppointments.filter((item) => `${item.data}T${item.inicio}` > `${appointment.data}T${appointment.inicio}` && !['finalizado', 'faltou'].includes(item.status)).sort((a, b) => `${a.data}T${a.inicio}`.localeCompare(`${b.data}T${b.inicio}`));
  const lastVisit = completed[0]?.data ?? patient?.ultimaVisita ?? null;
  const nextVisit = future[0];

  return (
    <div className="border border-line bg-deep/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase text-fog">Resumo rápido do paciente</p>
          <p className="text-[12px] mt-1">{patient?.telefone || 'Telefone não informado'}</p>
        </div>
        <span className={`font-mono text-[9px] border px-2 py-1 ${patient?.optInWhats ? 'border-mint/35 text-mint' : 'border-amber/35 text-amber'}`}>
          WhatsApp {patient?.optInWhats ? 'autorizado' : 'sem opt-in'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="border border-line/70 p-2">
          <span className="block font-mono text-[8.5px] uppercase text-fog">Última visita</span>
          {lastVisit ?? '—'}
        </div>
        <div className="border border-line/70 p-2">
          <span className="block font-mono text-[8.5px] uppercase text-fog">Próxima sessão</span>
          {nextVisit ? `${nextVisit.data} · ${nextVisit.inicio}` : 'Nenhuma'}
        </div>
        <div className="border border-line/70 p-2">
          <span className="block font-mono text-[8.5px] uppercase text-fog">Sessões finalizadas</span>
          {completed.length}
        </div>
        <div className="border border-line/70 p-2">
          <span className="block font-mono text-[8.5px] uppercase text-fog">Confirmação WhatsApp</span>
          {appointmentWhatsappLabel(whatsapp)}
        </div>
      </div>
    </div>
  );
}
