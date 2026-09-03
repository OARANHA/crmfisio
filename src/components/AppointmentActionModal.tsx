import { appointmentActions, appointmentStatusGuidance } from '../lib/appointmentWorkflow';
import { STATUS_META, fmtBRL, type Appointment, type AppointmentStatus, type Patient, type Role } from '../lib/types';
import type { AppointmentWhatsappState } from '../lib/appointmentWhatsapp';
import { Btn, Chip, Modal } from '../lib/ui';
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

  return (
    <Modal open={!!appointment} onClose={onClose} title="Atendimento">
      {appointment && (
        <div className="space-y-4">
          <div>
            <p className="font-display font-bold text-lg">{patientLabel}</p>
            <p className="font-mono text-[11px] text-fog">
              {appointment.data} · {appointment.inicio}–{appointment.fim} · {appointment.tipo}
            </p>
          </div>

          <AppointmentPatientSnapshot patient={patient} appointment={appointment} appointments={appointments} whatsapp={whatsapp} />
          <TreatmentJourneyContext patient={patient} appointment={appointment} />

          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="border border-line bg-deep p-3">
              <span className="block font-mono text-[9px] text-fog uppercase">Unidade</span>
              {unitLabel || '—'}
            </div>
            <div className="border border-line bg-deep p-3">
              <span className="block font-mono text-[9px] text-fog uppercase">Sala/Recurso</span>
              {roomLabel}
            </div>
            <div className="border border-line bg-deep p-3">
              <span className="block font-mono text-[9px] text-fog uppercase">Valor</span>
              {fmtBRL(appointment.valor)}
            </div>
            <div className="border border-line bg-deep p-3">
              <span className="block font-mono text-[9px] text-fog uppercase">Status</span>
              <Chip className={STATUS_META[appointment.status].chip}>{STATUS_META[appointment.status].label}</Chip>
            </div>
          </div>

          <div className="border border-line bg-deep/60 p-3 text-[11.5px] text-fog">
            {appointmentStatusGuidance(appointment.status)}
          </div>

          <AppointmentHistoryTimeline appointmentId={appointment.id} />

          {(canReschedule || canCancel) && (
            <div className="grid sm:grid-cols-2 gap-2">
              {canReschedule && <Btn variant="ghost" onClick={onReschedule}>Remarcar sessão</Btn>}
              {canCancel && <Btn variant="ghost" onClick={onCancel}>Cancelar com motivo</Btn>}
            </div>
          )}

          {actions.length > 0 ? (
            <div className="space-y-2">
              {actions.map((action) => (
                <div key={action.status}>
                  <Btn className="w-full" variant={action.tone === 'primary' ? undefined : 'ghost'} disabled={action.disabled} onClick={() => onStatus(action.status)}>
                    {action.label}
                  </Btn>
                  {action.hint && <p className="font-mono text-[10px] text-amber mt-1">{action.hint}</p>}
                </div>
              ))}
            </div>
          ) : (
            !operationalEditable && <p className="font-mono text-[10.5px] text-fog">Nenhuma ação operacional disponível para este status.</p>
          )}

          <Btn className="w-full" variant="ghost" onClick={onOpenPatient}>
            {role === 'recep' ? 'Abrir paciente' : 'Abrir prontuário do paciente'}
          </Btn>
        </div>
      )}
    </Modal>
  );
}
