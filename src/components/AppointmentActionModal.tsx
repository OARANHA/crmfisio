import { useEffect } from 'react';
import { appointmentActions, appointmentStatusGuidance } from '../lib/appointmentWorkflow';
import { STATUS_META, fmtBRL, type Appointment, type AppointmentStatus, type Patient, type Role } from '../lib/types';
import type { AppointmentWhatsappState } from '../lib/appointmentWhatsapp';
import { Btn, Chip } from '../lib/ui';
import { AppointmentPatientSnapshot } from './AppointmentPatientSnapshot';
import { AppointmentHistoryTimeline } from './AppointmentHistoryTimeline';
import { TreatmentJourneyContext } from './TreatmentJourneyContext';
import { isOperationalRole } from '../lib/permissions';

interface Props {
  appointment: Appointment | null;
  role: Role;
  patient?: Patient;
  appointments: Appointment[];
  whatsapp?: AppointmentWhatsappState;
  patientLabel: string;
  unitLabel: string;
  roomLabel: string;
  onClose: () => void;
  onStatus: (status: AppointmentStatus) => void;
  onOpenPatient: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}

export function AppointmentActionModal({
  appointment,
  role,
  patient,
  appointments,
  whatsapp,
  patientLabel,
  unitLabel,
  roomLabel,
  onClose,
  onStatus,
  onOpenPatient,
  onReschedule,
  onCancel,
}: Props) {
  const actions = appointment ? appointmentActions(role, appointment).filter((action) => action.status !== 'cancelado') : [];
  const operationalEditable = !!appointment && ['agendado', 'confirmado'].includes(appointment.status);
  const canReschedule = operationalEditable && isOperationalRole(role);
  const canCancel = operationalEditable && (isOperationalRole(role) || role === 'fisio');

  useEffect(() => {
    if (!appointment) return;
    document.body.classList.add('agenda-detail-open');
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('agenda-detail-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [appointment, onClose]);

  if (!appointment) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 top-16 z-40 bg-black/20 backdrop-blur-[1px] md:hidden"
        onClick={onClose}
        aria-label="Fechar detalhes do atendimento"
      />
      <aside
        className="agenda-detail-panel fixed bottom-0 right-0 top-16 z-50 flex w-[min(94vw,430px)] flex-col border-l border-line bg-panel shadow-[-18px_0_45px_rgba(0,0,0,0.10)]"
        aria-label="Detalhes do atendimento"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fog">Atendimento</p>
            <h2 className="mt-1 truncate font-display text-xl font-bold">{patientLabel}</h2>
            <p className="mt-1 text-[12.5px] text-fog">
              {appointment.data} · {appointment.inicio}–{appointment.fim} · {appointment.tipo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-lg text-fog transition-colors hover:bg-raise hover:text-paper"
            aria-label="Fechar detalhes"
            title="Fechar"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <AppointmentPatientSnapshot patient={patient} appointment={appointment} appointments={appointments} whatsapp={whatsapp} />
            <TreatmentJourneyContext patient={patient} appointment={appointment} />

            <div className="grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-xl bg-deep px-3 py-2.5">
                <span className="block text-[11px] font-semibold text-fog">Unidade</span>
                <span className="mt-0.5 block">{unitLabel || '—'}</span>
              </div>
              <div className="rounded-xl bg-deep px-3 py-2.5">
                <span className="block text-[11px] font-semibold text-fog">Sala/Recurso</span>
                <span className="mt-0.5 block">{roomLabel}</span>
              </div>
              <div className="rounded-xl bg-deep px-3 py-2.5">
                <span className="block text-[11px] font-semibold text-fog">Valor</span>
                <span className="mt-0.5 block font-semibold">{fmtBRL(appointment.valor)}</span>
              </div>
              <div className="rounded-xl bg-deep px-3 py-2.5">
                <span className="block text-[11px] font-semibold text-fog">Status</span>
                <div className="mt-1"><Chip className={STATUS_META[appointment.status].chip}>{STATUS_META[appointment.status].label}</Chip></div>
              </div>
            </div>

            <div className="rounded-xl bg-raise/55 px-3.5 py-3 text-[12.5px] leading-relaxed text-fog">
              {appointmentStatusGuidance(appointment.status)}
            </div>

            {(canReschedule || canCancel) && (
              <div className="grid grid-cols-2 gap-2">
                {canReschedule && <Btn variant="ghost" onClick={onReschedule}>Remarcar</Btn>}
                {canCancel && <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>}
              </div>
            )}

            {actions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-fog">Próxima ação</p>
                {actions.map((action) => (
                  <div key={action.status}>
                    <Btn className="w-full" variant={action.tone === 'primary' ? undefined : 'ghost'} disabled={action.disabled} onClick={() => onStatus(action.status)}>
                      {action.label}
                    </Btn>
                    {action.hint && <p className="mt-1 text-[11.5px] text-amber">{action.hint}</p>}
                  </div>
                ))}
              </div>
            ) : (
              !operationalEditable && <p className="text-[12px] text-fog">Nenhuma ação operacional disponível para este status.</p>
            )}

            <Btn className="w-full" variant="subtle" onClick={onOpenPatient}>
              {role === 'recep' ? 'Abrir paciente' : 'Abrir prontuário do paciente'}
            </Btn>

            <details className="group rounded-xl bg-deep/60">
              <summary className="cursor-pointer list-none px-3.5 py-3 text-[12.5px] font-semibold text-fog hover:text-paper">
                Histórico do atendimento <span className="float-right transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="border-t border-line px-3 py-3">
                <AppointmentHistoryTimeline appointmentId={appointment.id} />
              </div>
            </details>
          </div>
        </div>
      </aside>
    </>
  );
}
