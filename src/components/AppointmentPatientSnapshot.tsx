import { useEffect, useMemo, useState } from 'react';
import type { Appointment, Patient, PatientGuardian } from '../lib/types';
import { ageFrom } from '../lib/types';
import { appointmentWhatsappLabel, type AppointmentWhatsappState } from '../lib/appointmentWhatsapp';
import { loadPatientRegistryExtras } from '../lib/patientRegistry';

interface Props {
  patient?: Patient;
  appointment: Appointment;
  appointments: Appointment[];
  whatsapp?: AppointmentWhatsappState;
}

type PatientExtras = {
  preferredName: string;
  avatarUrl: string | null;
  guardians: PatientGuardian[];
};

export function AppointmentPatientSnapshot({ patient, appointment, appointments, whatsapp }: Props) {
  const [extras, setExtras] = useState<PatientExtras | null>(null);

  useEffect(() => {
    let active = true;
    if (!patient?.id) {
      setExtras(null);
      return;
    }
    loadPatientRegistryExtras(patient.id)
      .then((data) => active && setExtras({ preferredName: data.preferredName, avatarUrl: data.avatarUrl, guardians: data.guardians }))
      .catch((error) => console.warn('[MedicsPro] contexto rápido do paciente:', error));
    return () => { active = false; };
  }, [patient?.id]);

  const patientAppointments = appointments.filter((item) => item.pacienteId === appointment.pacienteId && item.status !== 'cancelado');
  const completed = patientAppointments.filter((item) => item.status === 'finalizado').sort((a, b) => `${b.data}T${b.inicio}`.localeCompare(`${a.data}T${a.inicio}`));
  const future = patientAppointments.filter((item) => `${item.data}T${item.inicio}` > `${appointment.data}T${appointment.inicio}` && !['finalizado', 'faltou'].includes(item.status)).sort((a, b) => `${a.data}T${a.inicio}`.localeCompare(`${b.data}T${b.inicio}`));
  const missed = patientAppointments.filter((item) => item.status === 'faltou').length;
  const lastVisit = completed[0]?.data ?? patient?.ultimaVisita ?? null;
  const nextVisit = future[0];
  const primaryGuardian = extras?.guardians.find((item) => item.isPrimaryContact) ?? extras?.guardians.find((item) => item.isLegalGuardian) ?? extras?.guardians[0];
  const emergencyContact = extras?.guardians.find((item) => item.isEmergencyContact && item.id !== primaryGuardian?.id);
  const displayName = extras?.preferredName || patient?.preferredName || patient?.nome || 'Paciente';
  const initials = useMemo(() => displayName.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase(), [displayName]);
  const whatsappNumber = patient?.telefone?.replace(/\D/g, '') ?? '';

  return (
    <section className="space-y-4 border-b border-line/70 pb-4">
      <div className="flex items-start gap-3.5">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-line bg-mint/10">
          {extras?.avatarUrl ? (
            <img src={extras.avatarUrl} alt={`Foto de ${displayName}`} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center font-display text-[15px] font-bold text-mint">{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-[15px] font-semibold text-paper">{displayName}</p>
            {patient?.nascimento && <span className="text-[12px] text-fog">{ageFrom(patient.nascimento)} anos</span>}
          </div>
          <p className="mt-1 text-[12.5px] text-fog">{patient?.telefone || 'Telefone não informado'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {patient?.telefone && <a href={`tel:${patient.telefone}`} className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-fog transition-colors hover:bg-raise hover:text-paper">Ligar</a>}
            {patient?.optInWhats && whatsappNumber && <a href={`https://wa.me/55${whatsappNumber}`} target="_blank" rel="noreferrer" className="rounded-lg border border-mint/30 bg-mint/[0.06] px-2.5 py-1.5 text-[11.5px] font-semibold text-mint transition-colors hover:bg-mint/[0.12]">WhatsApp</a>}
            <span className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${patient?.optInWhats ? 'bg-mint/[0.08] text-mint' : 'bg-amber/[0.08] text-amber'}`}>
              {patient?.optInWhats ? 'comunicação autorizada' : 'sem opt-in'}
            </span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-fog">Queixa principal</p>
        <p className="mt-1 text-[13px] leading-relaxed text-paper/90">{patient?.queixaPrincipal || 'Sem queixa principal registrada'}</p>
      </div>

      {(primaryGuardian || emergencyContact) && (
        <div className="space-y-2 border-t border-line/60 pt-3">
          {primaryGuardian && (
            <div className="flex items-start justify-between gap-3 text-[12px]">
              <div>
                <p className="font-semibold text-paper">{primaryGuardian.name}</p>
                <p className="mt-0.5 text-fog">{primaryGuardian.relationship || 'Responsável'}{primaryGuardian.isLegalGuardian ? ' · responsável legal' : ''}{primaryGuardian.isFinancialResponsible ? ' · financeiro' : ''}</p>
              </div>
              {primaryGuardian.phone && <a href={`tel:${primaryGuardian.phone}`} className="shrink-0 font-semibold text-mint">{primaryGuardian.phone}</a>}
            </div>
          )}
          {emergencyContact && (
            <div className="flex items-start justify-between gap-3 text-[12px]">
              <div>
                <p className="font-semibold text-pulse">Emergência · {emergencyContact.name}</p>
                <p className="mt-0.5 text-fog">{emergencyContact.relationship || 'Contato de emergência'}</p>
              </div>
              {emergencyContact.phone && <a href={`tel:${emergencyContact.phone}`} className="shrink-0 font-semibold text-pulse">{emergencyContact.phone}</a>}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line/60 pt-3 text-[12px]">
        <QuickDatum label="Última visita" value={lastVisit ?? '—'} />
        <QuickDatum label="Próxima sessão" value={nextVisit ? `${nextVisit.data} · ${nextVisit.inicio}` : 'Nenhuma'} />
        <QuickDatum label="Finalizadas" value={String(completed.length)} />
        <QuickDatum label="Faltas" value={String(missed)} alert={missed > 0} />
      </div>

      <p className="text-[11px] text-fog">Confirmação: <span className="font-medium text-paper/85">{appointmentWhatsappLabel(whatsapp)}</span></p>
    </section>
  );
}

function QuickDatum({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <span className="block text-[10.5px] font-semibold text-fog">{label}</span>
      <span className={`mt-0.5 block font-medium ${alert ? 'text-amber' : 'text-paper/90'}`}>{value}</span>
    </div>
  );
}
